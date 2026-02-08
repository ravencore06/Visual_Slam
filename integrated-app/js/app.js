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

        this.initNavigation();
    }

    initNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                // Remove active class from all
                navItems.forEach(n => n.classList.remove('active'));
                // Add active to clicked
                item.classList.add('active');

                // Get view name from text content (simple mapping)
                const text = item.innerText.trim();
                if (text.includes('Dashboard')) this.navTo('view-dashboard');
                else if (text.includes('Map')) this.navTo('view-map');
                else if (text.includes('Diagnostics')) this.navTo('view-analytics');
                else if (text.includes('Device')) this.navTo('view-devices');
            });
        });
    }

    navTo(viewId) {
        // Hide all views
        document.querySelectorAll('.view-panel').forEach(el => {
            el.style.display = 'none';
            el.classList.remove('active-view');
        });

        // Show target
        const target = document.getElementById(viewId);
        if (target) {
            target.style.display = 'flex';
            // Small timeout to allow display:flex to apply before adding class for animation
            setTimeout(() => target.classList.add('active-view'), 10);
        }
    }

    async start() {
        if (this.isRunning) {
            this.stop();
            return;
        }

        this.log("System Starting...", "info");
        this.updateStatus("Initializing...");
        this.btnStart.innerHTML = '⏳';

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
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Camera API not available. This feature requires a secure context (HTTPS) or localhost.");
            this.resetStartButton();
            return;
        }

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
            console.error("Camera error:", e);
            alert("Camera failed: " + e.message + "\nPlease check permissions and ensure you are using HTTPS.");
            this.resetStartButton();
            return;
        }

        // 3. Load Model
        this.updateStatus("Loading AI Model...");
        this.log("Loading AI Model (COCO-SSD)...", "info");
        await this.vision.load();
        this.updateStatus("System Active");
        this.log("AI Model Ready. Diagnostics Online.", "info");

        // 4. Start Sensors
        this.odometry.start();

        this.isRunning = true;
        this.loop();
        this.access.announce("System started. Ready.", 2);

        // Update Button State
        this.btnStart.innerHTML = '⏹';
        this.btnStart.style.background = 'rgba(255, 50, 50, 0.4)';
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
        this.btnStart.innerHTML = '▶';
        this.btnStart.className = 'icon-btn';
        this.btnStart.style.background = '';
    }

    updateStatus(text) {
        // Find the blink-dot context or header status if possible, or just log it.
        // In this dashboard, we don't have a direct "status text" container except log.
        // We can update the Live Indicator text as a proxy.
        const indicator = document.querySelector('.live-indicator .sub-text');
        if (indicator) indicator.innerText = `STATUS: ${text.toUpperCase()}`;
    }

    setTarget() {
        const msg = this.nav.setTarget(0, 5);
        this.minimap.setTarget(0, 5);
        this.access.announce(msg, 2);
        this.log(`Target Set: Local (0, 5m).`, "info");

        const btn = document.getElementById('btn-set-target');
        // Visual feedback
        btn.style.color = '#00d26a';
        setTimeout(() => btn.style.color = '', 1000);
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
