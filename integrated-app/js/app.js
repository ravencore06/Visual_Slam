class AppController {
    constructor() {
        this.vision = new VisionModule();
        this.odometry = new OdometryModule();
        this.nav = new NavigationModule();
        this.access = new AccessibilityModule();
        this.minimap = new MiniMap('minimap');

        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.isRunning = false;
        this.lastAlertTime = 0;

        // UI Elements
        this.elPos = document.getElementById('pos-display');
        this.elHdg = document.getElementById('hdg-display');
        this.elInstruction = document.getElementById('instruction');
        this.elSystemStatus = document.getElementById('system-status');
        this.btnStart = document.getElementById('btn-start');
        this.hudLayer = document.getElementById('hud-layer');

        // Dashboard UI Elements
        this.elObjCount = document.getElementById('obj-count-display');
        this.elLogList = document.getElementById('log-list');
    }

    async start() {
        if (this.isRunning) {
            this.stop();
            return;
        }

        this.log("System Starting...", "info");
        this.updateStatus("Initializing..."); // Keep this for the main status display
        this.btnStart.innerHTML = '<span class="icon">⏳</span> Loading...'; // Keep this for the button

        // 1. Permissions & Audio Unlock
        this.access.enable();
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                await DeviceMotionEvent.requestPermission();
                this.log("Sensors: Permission Granted", "info");
            } catch (e) {
                console.warn("Permission denied/error", e);
            }
        }

        // 2. Camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            this.video.srcObject = stream;
            await new Promise(r => this.video.onloadedmetadata = r);
            this.video.play();

            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.log(`Camera Active: ${this.video.videoWidth}x${this.video.videoHeight}`, "info");
        } catch (e) {
            alert("Camera failed: " + e.message);
            this.resetStartButton(); // Keep this
            return;
        }

        // 3. Load Model
        this.updateStatus("Loading AI Model..."); // Keep this for main status
        this.log("Loading AI Model (COCO-SSD)...", "info");
        await this.vision.load();
        this.updateStatus("System Active"); // Keep this for main status
        this.log("AI Model Ready. Diagnostics Online.", "info");

        // 4. Start Sensors
        this.odometry.start();

        this.isRunning = true;
        this.loop();
        this.access.announce("System started. Ready.", 2);

        // Update Button State
        this.btnStart.innerHTML = '<span class="icon">⏹</span> Stop';
        this.btnStart.classList.replace('btn-primary', 'btn-secondary'); // Visual toggle
        this.btnStart.style.background = 'rgba(255, 50, 50, 0.2)'; // Manual override for stop color
        this.btnStart.style.borderColor = 'rgba(255, 50, 50, 0.5)';
    }

    stop() {
        this.isRunning = false;
        this.odometry.stop();
        this.video.pause();
        this.video.srcObject = null;
        this.resetStartButton();
        this.updateStatus("System Idle");
        this.access.announce("System stopped.", 1);
        this.log("System Halted.", "warning");
    }

    resetStartButton() {
        this.btnStart.innerHTML = '<span class="icon">🚀</span> Start';
        this.btnStart.className = 'btn-primary'; // Reset class
        this.btnStart.style.background = '';
        this.btnStart.style.borderColor = '';
    }

    updateStatus(text) {
        if (this.elSystemStatus) this.elSystemStatus.innerText = text;
    }

    setTarget() {
        const msg = this.nav.setTarget(0, 5);
        this.minimap.setTarget(0, 5);
        this.access.announce(msg, 2);
        this.log(`Target Set: Local (0, 5m).`, "info");

        const btn = document.getElementById('btn-set-target');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="icon">✅</span> Set!';
        setTimeout(() => btn.innerHTML = originalText, 1500);
    }

    log(msg, type = "info") {
        if (!this.elLogList) return;

        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.innerHTML = `<span class="time">${time}</span><span class="msg">${msg}</span>`;

        this.elLogList.prepend(div);

        // Limit log size
        if (this.elLogList.children.length > 50) {
            this.elLogList.removeChild(this.elLogList.lastChild);
        }
    }

    async loop() {
        if (!this.isRunning) return;

        // A. Visual Odometry Update
        if (this.video.readyState >= 2) {
            this.odometry.updateVisuals(this.video);
        }

        // B. Odometry State
        const pos = this.odometry.getPosition();

        // Update UI
        if (this.elPos) this.elPos.innerText = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}`;
        if (this.elHdg) this.elHdg.innerHTML = `${(pos.heading * 180 / Math.PI).toFixed(0)}&deg;`;

        // Update MiniMap
        this.minimap.update(pos);

        // C. Vision (Throttled)
        if (this.video.readyState >= 2) {
            const predictions = await this.vision.detect(this.video);
            if (predictions) {
                this.drawPredictions(predictions);
                this.checkObstacles(predictions);

                // Update Dashboard Stat
                if (this.elObjCount) this.elObjCount.innerText = predictions.length;
            }
        }

        // D. Navigation
        const navUpdate = this.nav.update(pos);
        if (navUpdate) {
            if (navUpdate.instruction) {
                const priority = (navUpdate.event === 'stop' || navUpdate.event === 'arrived') ? 2 : 1;
                this.access.announce(navUpdate.instruction, priority);
                this.log(`Nav: ${navUpdate.instruction}`, "info");
            }
            if (navUpdate.event) {
                this.access.vibrate(navUpdate.event);
            }

            // Continuous feedback for rotation
            if (navUpdate.state === 'ROTATING' && Math.abs(navUpdate.diff) > 20) {
                const dir = navUpdate.diff > 0 ? "Right" : "Left";
                // Throttle this announcement in a real app, keeping simple here
            }
        }

        requestAnimationFrame(() => this.loop());
    }

    checkObstacles(predictions) {
        const now = Date.now();
        if (now - this.lastAlertTime < 2000) return; // Throttle alerts

        const centerX = this.canvas.width / 2;

        for (let p of predictions) {
            const [x, y, w, h] = p.bbox;
            const isCentral = (x < centerX && (x + w) > centerX);
            const isClose = p.depth ? (p.depth < 1.5) : (h > this.canvas.height * 0.3);

            if (isCentral && isClose) {
                this.access.announce(`Obstacle: ${p.class} ahead!`, 2);
                this.access.vibrate('stop');
                this.log(`OBSTACLE DETECTED: ${p.class} (${p.depth ? p.depth.toFixed(1) + 'm' : 'Close'})`, "obstacle");

                // Visual Alert
                const vPanel = document.querySelector('.video-panel');
                if (vPanel) {
                    vPanel.style.borderColor = 'var(--warning)';
                    setTimeout(() => vPanel.style.borderColor = 'var(--border-color)', 1000);
                }

                this.lastAlertTime = now;
                break;
            }
        }
    }

    drawPredictions(predictions) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = '14px JetBrains Mono';
        this.ctx.lineWidth = 2;

        predictions.forEach(p => {
            const [x, y, w, h] = p.bbox;

            const color = '#00d26a'; // Dashboard Green
            this.ctx.strokeStyle = color;
            this.ctx.strokeRect(x, y, w, h);

            // Label Box
            const text = `${p.class.toUpperCase()} ${(p.score * 100).toFixed(0)}%`;
            const textWidth = this.ctx.measureText(text).width;

            this.ctx.fillStyle = color;
            this.ctx.fillRect(x, y - 20, textWidth + 10, 20);

            this.ctx.fillStyle = '#000';
            this.ctx.fillText(text, x + 5, y - 6);
        });
    }
}

const app = new AppController();
