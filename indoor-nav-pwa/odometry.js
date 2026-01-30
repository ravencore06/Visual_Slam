/**
 * Indoor Navigation Module 2: Relative Positioning
 * 
 * Implements Pedestrian Dead Reckoning (PDR) and basic Visual Odometry (VO) fusion.
 */

// --- 1. Step Detection (Accelerometer) ---
class StepDetector {
    constructor(options = {}) {
        this.threshold = options.threshold || 1.2; // Acceleration magnitude threshold (g)
        this.minStepInterval = options.minStepInterval || 300; // ms
        this.lastStepTime = 0;
        this.stepCount = 0;
        this.isPeak = false;
        this.onStep = options.onStep || (() => { });

        // Simple Low-Pass Filter
        this.alpha = 0.8;
        this.gravity = 9.81;
        this.lastAccel = { x: 0, y: 0, z: 0 };
    }

    update(accel) {
        // 1. Remove Gravity (High-Pass Filter) or Smooth (Low-Pass)
        // We want the DYNAMIC acceleration (user movement), not static gravity.
        // Simple approach: Magnitude of total acceleration - gravity

        const x = this.alpha * this.lastAccel.x + (1 - this.alpha) * accel.x;
        const y = this.alpha * this.lastAccel.y + (1 - this.alpha) * accel.y;
        const z = this.alpha * this.lastAccel.z + (1 - this.alpha) * accel.z;
        this.lastAccel = { x, y, z };

        // Magnitude of the filtered acceleration vector
        const magnitude = Math.sqrt(x * x + y * y + z * z) / this.gravity; // Normalize to g

        // 2. Peak Detection
        const now = performance.now();
        if (magnitude > this.threshold && (now - this.lastStepTime > this.minStepInterval)) {
            if (!this.isPeak) {
                this.isPeak = true;
                this.stepCount++;
                this.lastStepTime = now;
                this.onStep(this.stepCount);
            }
        } else if (magnitude < this.threshold) {
            this.isPeak = false;
        }
    }
}

// --- 2. Heading Estimation (Gyroscope + Compass) ---
class HeadingEstimator {
    constructor() {
        this.heading = 0; // Radians, 0 = North/Start
        this.lastTime = 0;
        this.isCalibrated = false;
        this.bias = 0;
    }

    update(rotationRate, timestamp) {
        if (!this.lastTime) {
            this.lastTime = timestamp;
            return;
        }

        const dt = (timestamp - this.lastTime) / 1000; // Seconds
        this.lastTime = timestamp;

        // Integrate Z-axis rotation (Yaw)
        // rotationRate.alpha is usually Z-axis rotation in degrees/sec on mobile
        // Note: Android/iOS differences exist. We assume standard web API:
        // alpha: Z (yaw), beta: X (pitch), gamma: Y (roll)

        // Simple integration: heading += rate * dt
        // Convert to radians
        const rateRad = (rotationRate.alpha || 0) * (Math.PI / 180);

        // Invert if necessary based on device orientation (portrait/landscape)
        // For portrait, alpha is yaw.
        this.heading += rateRad * dt;

        // Normalize to 0-2PI
        this.heading = this.heading % (2 * Math.PI);
    }

    // Optional: Fuse with compass (DeviceOrientationEvent.alpha)
    setAbsoluteHeading(degrees) {
        this.heading = degrees * (Math.PI / 180);
        this.isCalibrated = true;
    }
}

// --- 3. Visual Odometry (Simplified Optical Flow) ---
class VisualOdometry {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.prevFrame = null;
        this.width = 160; // Low res for performance
        this.height = 120;
        this.flow = { x: 0, y: 0 };
    }

    processFrame() {
        if (this.video.readyState < 2) return;

        // Draw current frame to small canvas
        this.ctx.drawImage(this.video, 0, 0, this.width, this.height);
        const currentFrame = this.ctx.getImageData(0, 0, this.width, this.height);

        if (this.prevFrame) {
            this.flow = this.calculateOpticalFlow(this.prevFrame, currentFrame);
        }

        this.prevFrame = currentFrame;
        return this.flow;
    }

    // Very simple block matching or sparse flow (Grid based)
    // For MVP: We just calculate average pixel difference in center region to detect "movement" vs "static"
    // A full Lucas-Kanade in JS is ~500 lines. We use a simplified "Center of Mass" of difference.
    calculateOpticalFlow(oldFrame, newFrame) {
        let diffX = 0;
        let diffY = 0;
        let totalDiff = 0;

        const data1 = oldFrame.data;
        const data2 = newFrame.data;
        const width = this.width;
        const height = this.height;

        // Grid sampling (skip pixels for speed)
        const step = 4;

        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const i = (y * width + x) * 4;
                // Grayscale conversion: 0.299R + 0.587G + 0.114B
                const gray1 = 0.299 * data1[i] + 0.587 * data1[i + 1] + 0.114 * data1[i + 2];
                const gray2 = 0.299 * data2[i] + 0.587 * data2[i + 1] + 0.114 * data2[i + 2];

                const diff = Math.abs(gray1 - gray2);

                if (diff > 20) { // Threshold for noise
                    totalDiff += diff;
                    // This is NOT true optical flow vectors, but a "change magnitude"
                    // To get direction, we'd need gradient descent (LK).
                    // For this MVP, we just return total movement magnitude to detect "Stationary" vs "Moving".
                }
            }
        }

        return { magnitude: totalDiff };
    }
}

// --- 4. Position Tracker (Fusion) ---
class PositionTracker {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.stepLength = 0.7; // meters
        this.headingEstimator = new HeadingEstimator();
        this.stepDetector = new StepDetector({
            onStep: () => this.onStepDetected()
        });
        this.visualOdometry = null; // Init later
    }

    init(video, canvas) {
        this.visualOdometry = new VisualOdometry(video, canvas);

        // Listen to sensors
        window.addEventListener('devicemotion', (e) => {
            if (e.accelerationIncludingGravity) {
                this.stepDetector.update(e.accelerationIncludingGravity);
            }
            if (e.rotationRate) {
                this.headingEstimator.update(e.rotationRate, e.timeStamp || performance.now());
            }
        });

        this.updateLoop();
    }

    onStepDetected() {
        // Get current heading
        const theta = this.headingEstimator.heading;

        // Check VO: If camera says we are stationary, ignore step (it's a shake)
        // For MVP, we assume valid step if VO magnitude > threshold
        // const flow = this.visualOdometry.flow;
        // if (flow.magnitude < 1000) return; // Too static

        // Update Position
        this.x += this.stepLength * Math.sin(theta);
        this.y += this.stepLength * Math.cos(theta); // North is Y+

        console.log(`Step! Pos: (${this.x.toFixed(2)}, ${this.y.toFixed(2)}) Heading: ${(theta * 180 / Math.PI).toFixed(0)}`);

        // Dispatch event for UI
        const event = new CustomEvent('position-update', {
            detail: { x: this.x, y: this.y, heading: theta }
        });
        window.dispatchEvent(event);
    }

    updateLoop() {
        if (this.visualOdometry) {
            this.visualOdometry.processFrame();
        }
        requestAnimationFrame(() => this.updateLoop());
    }
}

// Export global instance
window.IndoorNav = new PositionTracker();
