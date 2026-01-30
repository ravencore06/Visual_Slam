class AppController {
    constructor() {
        this.vision = new VisionModule();
        this.odometry = new OdometryModule();
        this.nav = new NavigationModule();
        this.access = new AccessibilityModule();

        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.isRunning = false;
    }

    async start() {
        // 1. Permissions & Audio Unlock
        this.access.enable();
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            await DeviceMotionEvent.requestPermission();
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
        const pos = this.odometry.getPosition();
        // North is Y+ in our logic (though screen Y is down, let's keep math simple: Y+ is forward)
        // Actually, let's just say Target is (CurrentX, CurrentY + 5)
        // But we need to know "Forward" relative to user? 
        // No, let's just pick a fixed point (0, 5) relative to start (0,0).

        const msg = this.nav.setTarget(0, 5);
        this.access.announce(msg, 2);
        document.getElementById('target-info').innerText = "Target: (0, 5)";
    }

    async loop() {
        if (!this.isRunning) return;

        // A. Odometry
        const pos = this.odometry.getPosition();
        // Update UI
        const posInfo = document.getElementById('pos-info');
        if (posInfo) {
            posInfo.innerHTML = `Pos: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) <br> Hdg: ${(pos.heading * 180 / Math.PI).toFixed(0)}&deg;`;
        }

        // B. Vision (Throttled)
        // Check if video is ready
        if (this.video.readyState >= 2) {
            const predictions = await this.vision.detect(this.video);
            if (predictions) {
                this.drawPredictions(predictions);
            }
        }

        // C. Navigation
        const navUpdate = this.nav.update(pos);
        if (navUpdate) {
            if (navUpdate.instruction) {
                // Priority 2 for stop/arrived, 1 for normal
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

    drawPredictions(predictions) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = '16px sans-serif';
        this.ctx.strokeStyle = '#00FFFF';
        this.ctx.fillStyle = '#00FFFF';

        predictions.forEach(p => {
            const [x, y, w, h] = p.bbox;
            this.ctx.strokeRect(x, y, w, h);
            this.ctx.fillText(`${p.class} ${Math.round(p.score * 100)}%`, x, y > 10 ? y - 5 : 10);
        });
    }
}

const app = new AppController();
