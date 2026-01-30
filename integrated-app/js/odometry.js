class OdometryModule {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.heading = 0;
        this.stepCount = 0;

        // Internal helpers
        this.stepThreshold = 1.2;
        this.lastAccel = { x: 0, y: 0, z: 0 };
        this.alpha = 0.8;
        this.lastStepTime = 0;
        this.lastGyroTime = 0;
    }

    start() {
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', (e) => this.handleMotion(e));
        }
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

            if (mag > this.stepThreshold && (now - this.lastStepTime > 300)) {
                this.stepCount++;
                this.lastStepTime = now;

                // Update Position based on current heading
                const stepLen = 0.7; // meters
                this.x += stepLen * Math.sin(this.heading);
                this.y += stepLen * Math.cos(this.heading);
            }
        }

        // 2. Heading (Gyro Integration)
        const rot = e.rotationRate;
        if (rot) {
            const now = e.timeStamp || Date.now();
            if (this.lastGyroTime) {
                const dt = (now - this.lastGyroTime) / 1000;
                // Z-axis rotation (alpha) in degrees/sec
                const rate = (rot.alpha || 0) * (Math.PI / 180);
                this.heading += rate * dt;
                this.heading = this.heading % (2 * Math.PI);
            }
            this.lastGyroTime = now;
        }
    }

    getPosition() {
        return { x: this.x, y: this.y, heading: this.heading };
    }
}
