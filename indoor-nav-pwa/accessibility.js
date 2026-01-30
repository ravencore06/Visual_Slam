/**
 * Indoor Navigation Module 4: Accessibility (Audio & Haptics)
 * 
 * Implements a robust feedback system with priority management.
 */

class FeedbackManager {
    constructor() {
        this.synth = window.speechSynthesis;
        this.isAudioEnabled = false;
        this.lastSpokenTime = 0;
        this.minSpeechInterval = 2000; // ms (debounce for normal messages)

        // Vibration Patterns (ms)
        this.patterns = {
            'left': [100, 50, 100],      // Short-Short
            'right': [300],              // Long
            'straight': [50, 50, 50],    // Buzz-Buzz-Buzz
            'stop': [50, 50, 50, 50, 50, 50], // Rapid Alert
            'arrived': [500, 100, 500],  // Long-Long
            'info': [50]                 // Blip
        };

        // Priority Levels
        this.PRIORITY = {
            CRITICAL: 2, // Interrupts everything
            NORMAL: 1,   // Standard queue
            INFO: 0      // Only if silent
        };
    }

    // Must be called by a user interaction (click/tap) to unlock audio context
    enableAudio() {
        if (this.synth) {
            // Speak a silent utterance to unlock iOS audio
            const utterance = new SpeechSynthesisUtterance('');
            this.synth.speak(utterance);
            this.isAudioEnabled = true;
            console.log("Audio Enabled");
            this.announce("Audio feedback enabled.", this.PRIORITY.NORMAL);
        } else {
            console.warn("Speech Synthesis not supported.");
        }
    }

    /**
     * Announce a message via TTS.
     * @param {string} text - The text to speak.
     * @param {number} priority - Priority level (0, 1, 2).
     */
    announce(text, priority = 1) {
        if (!this.synth) return;

        const now = Date.now();

        // 1. Handle Critical Messages (Interrupt)
        if (priority === 2) { // CRITICAL
            this.synth.cancel(); // Stop current speech
            this.speak(text);
            return;
        }

        // 2. Handle Normal/Info Messages (Queue/Debounce)
        if (this.synth.speaking) {
            if (priority === 0) return; // Drop info if busy
            // Normal messages queue automatically by default in Web Speech API
            // But we might want to debounce repetitive ones
        }

        // Debounce identical messages or too frequent updates
        if (now - this.lastSpokenTime < this.minSpeechInterval) {
            // Unless it's a different message? 
            // For simplicity, we just throttle non-critical speech.
            console.log(`[TTS Throttled]: ${text}`);
            return;
        }

        this.speak(text);
    }

    speak(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1; // Slightly faster
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Select Voice (Prefer Google US English or similar)
        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.lang === 'en-US');
        if (preferredVoice) utterance.voice = preferredVoice;

        this.synth.speak(utterance);
        this.lastSpokenTime = Date.now();
        console.log(`[TTS]: ${text}`);
    }

    /**
     * Trigger haptic feedback.
     * @param {string} type - 'left', 'right', 'stop', 'arrived', etc.
     */
    vibrate(type) {
        if (!navigator.vibrate) return;

        const pattern = this.patterns[type] || this.patterns['info'];

        try {
            navigator.vibrate(pattern);
            console.log(`[Haptic]: ${type} (${pattern})`);
        } catch (e) {
            console.warn("Vibration failed (likely iOS restriction).");
        }
    }

    /**
     * Combined helper for navigation events.
     */
    notify(event, text, priority = 1) {
        this.announce(text, priority);
        this.vibrate(event);
    }
}

// Export global instance
window.Accessibility = new FeedbackManager();
