class AccessibilityModule {
    constructor() {
        this.synth = window.speechSynthesis;
        this.lastSpoken = 0;
    }

    enable() {
        if (this.synth) this.synth.speak(new SpeechSynthesisUtterance(''));
    }

    announce(text, priority = 1) {
        if (!text || !this.synth) return;

        const now = Date.now();
        if (priority < 2 && (now - this.lastSpoken < 3000)) return; // Throttle

        if (priority === 2) this.synth.cancel(); // Critical

        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.1;
        this.synth.speak(u);
        this.lastSpoken = now;
    }

    vibrate(type) {
        if (!navigator.vibrate) return;
        const patterns = {
            'left': [100, 50, 100],
            'right': [300],
            'stop': [50, 50, 50, 50],
            'arrived': [500, 100, 500],
            'straight': [50]
        };
        navigator.vibrate(patterns[type] || [50]);
    }
}
