/**
 * Audio Synthesizer for Outbreak Alarms using Web Audio API.
 * Synthesizes a subtle, tactile radar acoustic ping without external audio files.
 */

class AudioAlertEngine {
  constructor() {
    this.audioCtx = null;
    this.enabled = false;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && !this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    return this.enabled;
  }

  playCriticalAlert() {
    if (!this.enabled) return;
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('[Audio Alert] Failed to play tone:', e);
    }
  }
}

export const audioAlertEngine = new AudioAlertEngine();
