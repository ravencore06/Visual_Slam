class NavigationModule {
    constructor() {
        this.target = null;
        this.state = 'IDLE';
        this.thresholds = { arrival: 1.5, rotation: 20, move: 10 };
    }

    setTarget(x, y) {
        this.target = { x, y };
        this.state = 'ROTATING';
        return "New destination set. Turn to face target.";
    }

    update(userPos) {
        if (!this.target) return null;

        const dx = this.target.x - userPos.x;
        const dy = this.target.y - userPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Bearing
        let bearing = Math.atan2(dx, dy) * (180 / Math.PI);
        if (bearing < 0) bearing += 360;

        // Angle Diff
        let userHdgDeg = userPos.heading * (180 / Math.PI);
        let diff = bearing - userHdgDeg;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        // State Machine
        let instruction = null;
        let event = null; // for haptics

        if (dist < this.thresholds.arrival) {
            if (this.state !== 'ARRIVED') {
                this.state = 'ARRIVED';
                instruction = "You have arrived.";
                event = 'arrived';
            }
            return { instruction, event, dist, diff };
        }

        if (this.state === 'ROTATING') {
            if (Math.abs(diff) < this.thresholds.move) {
                this.state = 'MOVING';
                instruction = "Walk forward.";
                event = 'straight';
            } else {
                // Only instruct periodically (handled by caller/accessibility module)
                // But we return the raw data
            }
        } else if (this.state === 'MOVING') {
            if (Math.abs(diff) > this.thresholds.rotation) {
                this.state = 'ROTATING';
                instruction = "Stop. Turn to correct heading.";
                event = 'stop';
            }
        }

        return { instruction, event, dist, diff, state: this.state };
    }
}
