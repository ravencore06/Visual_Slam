class AppController {
    constructor() {
        this.vision = new VisionModule();
        this.odometry = new OdometryModule();
        this.nav = new NavigationModule();
        this.access = new AccessibilityModule();
        this.minimap = new MiniMap('minimap'); // NEW

        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.isRunning = false;
        this.lastAlertTime = 0;
    }

    async start() {
        console.log("App Starting...");
        // 1. Permissions & Audio Unlock
        this.access.enable();
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                await DeviceMotionEvent.requestPermission();
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
        } catch (e) {
            alert("Camera failed: " + e.message);
            return;
        }

        // 3. Load Model
        document.getElementById('status').innerText = "Loading Model...";
        await this.vision.load();
        document.getElementById('status').innerText = "Running";

        // 4. Start Sensors
        this.odometry.start();

        this.isRunning = true;
        this.loop();
        this.access.announce("System started. Ready.", 2);
    }

    setTarget() {
        // For demo: Set target 5 meters North of current position
        // const pos = this.odometry.getPosition(); // Unused in simple demo

        // Set target at (0, 5) relative to start
        const msg = this.nav.setTarget(0, 5);
        this.minimap.setTarget(0, 5); // Update Map

        this.access.announce(msg, 2);
        // document.getElementById('target-info').innerText = "Target: (0, 5)"; // Removed in new UI
    }

    async loop() {
        if (!this.isRunning) return;

        // A. Visual Odometry Update
        if (this.video.readyState >= 2) {
            this.odometry.updateVisuals(this.video);
        }

        // B. Odometry State
        const pos = this.odometry.getPosition();

        // Update UI (New IDs)
        const posInfo = document.getElementById('pos-info');
        if (posInfo) {
            const hdgInfo = document.getElementById('hdg-info');
            if (hdgInfo) {
                // Update specific elements if they exist
                if (posInfo.childNodes[0]) {
                    posInfo.childNodes[0].textContent = `Pos: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) `;
                }
                hdgInfo.innerHTML = `Hdg: ${(pos.heading * 180 / Math.PI).toFixed(0)}&deg;`;
            } else {
                // Fallback to old behavior
                posInfo.innerHTML = `Pos: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) <br> Hdg: ${(pos.heading * 180 / Math.PI).toFixed(0)}&deg;`;
            }
        }

        // Update MiniMap
        this.minimap.update(pos);

        // C. Vision (Throttled)
        if (this.video.readyState >= 2) {
            const predictions = await this.vision.detect(this.video);
            if (predictions) {
                this.drawPredictions(predictions);
                this.checkObstacles(predictions); // NEW: Obstacle Check
            }
        }

        // D. Navigation
        const navUpdate = this.nav.update(pos);
        if (navUpdate) {
            if (navUpdate.instruction) {
                const priority = (navUpdate.event === 'stop' || navUpdate.event === 'arrived') ? 2 : 1;
                this.access.announce(navUpdate.instruction, priority);

                const instrEl = document.getElementById('instruction');
                if (instrEl) instrEl.innerText = navUpdate.instruction;
            }
            if (navUpdate.event) {
                this.access.vibrate(navUpdate.event);
            }

            // Continuous feedback for rotation
            if (navUpdate.state === 'ROTATING' && Math.abs(navUpdate.diff) > 20) {
                const dir = navUpdate.diff > 0 ? "Right" : "Left";
                this.access.announce(`Turn ${dir} ${Math.round(Math.abs(navUpdate.diff))} degrees`, 1);
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

            // Use Depth if available, else fallback to height
            const isClose = p.depth ? (p.depth < 1.5) : (h > this.canvas.height * 0.3);

            if (isCentral && isClose) {
                // Trigger Alert
                this.access.announce(`Obstacle: ${p.class} ahead!`, 2);
                this.access.vibrate('stop'); // Use stop pattern

                // Visual Alert
                const hud = document.getElementById('video-container'); // Use container for border flash
                if (hud) {
                    hud.style.border = "5px solid red";
                    setTimeout(() => hud.style.border = "none", 1000);
                }

                this.lastAlertTime = now;
                break;
            }
        }
    }

    drawPredictions(predictions) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = '16px Courier New';
        this.ctx.strokeStyle = '#00FFFF';
        this.ctx.fillStyle = '#00FFFF';

        predictions.forEach(p => {
            const [x, y, w, h] = p.bbox;
            this.ctx.strokeRect(x, y, w, h);

            let label = `${p.class} ${Math.round(p.score * 100)}%`;
            if (p.depth) label += ` ${p.depth.toFixed(1)}m`;

            this.ctx.fillText(label, x, y > 10 ? y - 5 : 10);
        });
    }
}

const app = new AppController();
