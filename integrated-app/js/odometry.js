class VisualOdometry {
    constructor() {
        this.prevFrame = null;
        this.width = 64; // Low res for performance
        this.height = 48;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    process(video) {
        if (video.readyState < 2) return 0;

        this.ctx.drawImage(video, 0, 0, this.width, this.height);
        const currentFrame = this.ctx.getImageData(0, 0, this.width, this.height);
        let movement = 0;

        if (this.prevFrame) {
            // Simple difference check
            let diff = 0;
            const data1 = this.prevFrame.data;
            const data2 = currentFrame.data;

            for (let i = 0; i < data1.length; i += 4) {
                // Grayscale diff
                const g1 = (data1[i] + data1[i + 1] + data1[i + 2]) / 3;
                const g2 = (data2[i] + data2[i + 1] + data2[i + 2]) / 3;
                diff += Math.abs(g1 - g2);
            }
            movement = diff / (this.width * this.height);
        }

        this.prevFrame = currentFrame;
        return movement;
    }
}

class OdometryModule {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.heading = 0; // Radians
        this.stepCount = 0;

        // Internal helpers
        this.stepThreshold = 1.2;
        this.lastAccel = { x: 0, y: 0, z: 0 };
        this.alpha = 0.8; // Low pass filter
        this.lastStepTime = 0;
        this.lastGyroTime = 0;

        // AI/Fusion
        this.vo = new VisualOdometry();
        this.isMoving = false;
        this.confidence = 1.0;
    }

    start() {
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', (e) => this.handleMotion(e));
        }
    }

    // Called from main loop with video element
    updateVisuals(video) {
        const flow = this.vo.process(video);
        // Threshold: If flow < 5, we are likely stationary (even if accelerometer shakes)
        this.isMoving = flow > 5;

        // Update UI debug
        const status = document.getElementById('status');
        if (status) status.innerText = `Flow: ${flow.toFixed(1)} | Moving: ${this.isMoving}`;
    }

    handleMotion(e) {
        // 1. Step Detection
        const acc = e.accelerationIncludingGravity;
        if (acc) {
            // Low pass filter
            const x = this.alpha * this.lastAccel.x + (1 - this.alpha) * acc.x;
            const y = this.alpha * this.lastAccel.y + (1 - this.alpha) * acc.y;
            const z = this.alpha * this.lastAccel.z + (1 - this.alpha) * acc.z;
            this.lastAccel = { x, y, z };

            const mag = Math.sqrt(x * x + y * y + z * z) / 9.81;
            const now = Date.now();

            // Step Logic: Peak detection + VO Confirmation
            if (mag > this.stepThreshold && (now - this.lastStepTime > 400)) {
                // FUSION: Only count step if Visual Odometry confirms movement
                // If VO is not running (e.g. camera off), assume true.
                if (this.isMoving) {
                    this.stepCount++;
                    this.lastStepTime = now;

                    // Update Position
                    const stepLen = 0.7; // meters
                    this.x += stepLen * Math.sin(this.heading);
                    this.y += stepLen * Math.cos(this.heading);
                }
            }
        }

        // 2. Heading (Gyro Integration + Complementary Filter Mock)
        const rot = e.rotationRate;
        if (rot) {
            const now = e.timeStamp || Date.now();
            if (this.lastGyroTime) {
                const dt = (now - this.lastGyroTime) / 1000;
                // Z-axis rotation (alpha) in degrees/sec
                const rate = (rot.alpha || 0) * (Math.PI / 180);

                // Simple integration
                this.heading += rate * dt;

                // Normalize
                this.heading = this.heading % (2 * Math.PI);
                if (this.heading < 0) this.heading += 2 * Math.PI;
            }
            this.lastGyroTime = now;
        }
    }

    getPosition() {
        return { x: this.x, y: this.y, heading: this.heading };
    }
}
