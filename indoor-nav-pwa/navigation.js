/**
 * Indoor Navigation Module 3: Navigation Logic
 * 
 * Implements a deterministic Finite State Machine (FSM) for "Homing" navigation.
 */

// --- 1. Geometry Utilities ---
class GeometryUtils {
    // Calculate bearing from (x1, y1) to (x2, y2)
    // Returns angle in degrees (0 = North, 90 = East)
    static getBearing(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1; // Assuming Y is North/Up in our coordinate system

        // atan2(y, x) gives angle from X-axis (East). 
        // We want angle from Y-axis (North).
        // Standard Math: 0 is Right (East), 90 is Up (North).
        // Navigation: 0 is Up (North), 90 is Right (East).
        // So we swap x/y in atan2: atan2(dx, dy)
        let theta = Math.atan2(dx, dy) * (180 / Math.PI);

        // Normalize to 0-360
        if (theta < 0) theta += 360;
        return theta;
    }

    // Calculate shortest turn angle from currentHeading to targetBearing
    // Returns angle in degrees (-180 to +180). Positive = Right, Negative = Left.
    static getAngleDiff(currentHeading, targetBearing) {
        let diff = targetBearing - currentHeading;
        // Normalize to -180 to +180
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return diff;
    }

    static getDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

// --- 2. Instruction Engine (TTS & Haptics) ---
class InstructionEngine {
    constructor() {
        this.synth = window.speechSynthesis;
        this.lastSpokenTime = 0;
        this.minSpeechInterval = 3000; // ms
    }

    speak(text, force = false) {
        const now = Date.now();
        if (!force && (now - this.lastSpokenTime < this.minSpeechInterval)) {
            return; // Too soon
        }

        if (this.synth.speaking) {
            this.synth.cancel(); // Interrupt previous speech for urgent updates
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        this.synth.speak(utterance);
        this.lastSpokenTime = now;
        console.log(`[TTS]: ${text}`);
    }

    vibrate(pattern) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }
}

// --- 3. Navigator (State Machine) ---
class Navigator {
    constructor() {
        this.state = 'IDLE'; // IDLE, ROTATING, MOVING, ARRIVED
        this.target = null; // { x, y }
        this.user = { x: 0, y: 0, heading: 0 };

        this.engine = new InstructionEngine();

        // Thresholds
        this.arrivalThreshold = 1.5; // meters
        this.rotationThreshold = 20; // degrees (Deadband to start rotating)
        this.moveThreshold = 10; // degrees (Deadband to start moving)

        this.lastInstruction = '';
    }

    setTarget(x, y) {
        this.target = { x, y };
        this.state = 'ROTATING'; // Assume we need to orient first
        this.engine.speak("New destination set.");
    }

    update(userX, userY, userHeading) {
        this.user = { x: userX, y: userY, heading: userHeading };

        if (!this.target) return;

        const dist = GeometryUtils.getDistance(this.user.x, this.user.y, this.target.x, this.target.y);
        const bearing = GeometryUtils.getBearing(this.user.x, this.user.y, this.target.x, this.target.y);
        const angleDiff = GeometryUtils.getAngleDiff(this.user.heading, bearing);

        // --- State Machine Logic ---
        switch (this.state) {
            case 'IDLE':
                break;

            case 'ARRIVED':
                if (dist > this.arrivalThreshold * 2) {
                    this.state = 'ROTATING'; // User moved away, restart
                }
                break;

            case 'ROTATING':
                // Check if aligned enough to move
                if (Math.abs(angleDiff) < this.moveThreshold) {
                    this.state = 'MOVING';
                    this.engine.speak("Walk forward.");
                    this.engine.vibrate([50, 50, 50]);
                } else {
                    // Give rotation instructions
                    this.giveRotationInstruction(angleDiff);
                }
                break;

            case 'MOVING':
                // Check arrival
                if (dist < this.arrivalThreshold) {
                    this.state = 'ARRIVED';
                    this.engine.speak("You have arrived.");
                    this.engine.vibrate([500, 100, 500]);
                    return;
                }

                // Check if user deviated too much
                if (Math.abs(angleDiff) > this.rotationThreshold) {
                    this.state = 'ROTATING';
                    this.engine.speak("Stop. Turn to correct heading.");
                    this.engine.vibrate([200]);
                } else {
                    // Continue moving
                    // Optional: Give distance updates every 5m
                }
                break;
        }
    }

    giveRotationInstruction(angleDiff) {
        let text = "";
        let pattern = [];

        if (angleDiff > 0) {
            // Turn Right
            text = `Turn right ${Math.round(angleDiff)} degrees.`;
            pattern = [300]; // Long pulse
        } else {
            // Turn Left
            text = `Turn left ${Math.round(Math.abs(angleDiff))} degrees.`;
            pattern = [100, 50, 100]; // Two short pulses
        }

        // Only speak if significant change or time elapsed (handled by engine)
        this.engine.speak(text);
        // Vibrate only on significant turns
        if (Math.abs(angleDiff) > 45) {
            this.engine.vibrate(pattern);
        }
    }
}

// Export global instance
window.IndoorNavigator = new Navigator();
