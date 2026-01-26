class VisionModule {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.lastRun = 0;
        this.interval = 200; // 5 FPS
    }

    async load() {
        try {
            // Load COCO-SSD
            this.model = await cocoSsd.load();
            this.isLoaded = true;
            console.log("Vision: Model Loaded");
            return true;
        } catch (e) {
            console.error("Vision: Load Failed", e);
            return false;
        }
    }

    async detect(video) {
        if (!this.isLoaded || video.readyState < 2) return [];

        const now = Date.now();
        if (now - this.lastRun < this.interval) return null; // Throttle

        this.lastRun = now;

        // Run inference
        // tf.tidy is handled internally by coco-ssd usually, but good practice if using raw model
        const predictions = await this.model.detect(video);
        return predictions;
    }
}
