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

        const predictions = await this.model.detect(video);

        // AI FILTERING & DEPTH ESTIMATION
        return predictions
            .filter(p => p.score > 0.6) // Filter low confidence
            .map(p => {
                // Estimate Depth: Simple heuristic based on bbox height relative to frame height
                // Assumption: Object is on ground, camera at ~1.5m height.
                // Distance ~= (FocalLength * RealHeight) / ImageHeight
                // We simplify: depth = Factor / (bbox.height / video.height)

                const hRatio = p.bbox[3] / video.videoHeight;
                let depth = 0;

                // Rough Real Heights (meters)
                const realHeights = {
                    'person': 1.7,
                    'chair': 1.0,
                    'table': 0.8,
                    'couch': 0.9,
                    'potted plant': 0.5
                };

                const realH = realHeights[p.class] || 1.0;
                depth = realH / hRatio; // Very rough approximation

                // Attach depth to prediction
                p.depth = depth;
                return p;
            });
    }
}
