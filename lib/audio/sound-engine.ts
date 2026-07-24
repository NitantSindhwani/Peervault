/**
 * Hardened PeerVault Cyber-Acoustics Sound Engine
 * 
 * Native Web Audio API synthesizer for zero-latency, zero-asset acoustic feedback.
 * Synthesizes distinct sound signatures directly via oscillators:
 * - Mute / Unmute Feedback Tones
 * - Hover Click (800Hz micro-tone)
 * - Drop Impact (120Hz sub-bass thump)
 * - Transfer Ambient Hum (432Hz sine wave)
 * - Completion Harmonic Chime (C5-E5-G5 3-note major chord)
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;

  private initCtx() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    // Play acoustic feedback tone BEFORE setting muted state
    if (!this.muted) {
      // About to MUTE -> Play crisp Mute Tone (descending pitch 600Hz -> 250Hz)
      this.playTone(600, 250, 0.05);
    } else {
      // About to UNMUTE -> Play crisp Unmute Tone (ascending pitch 250Hz -> 600Hz)
      this.playTone(250, 600, 0.05);
    }

    this.muted = !this.muted;

    if (this.muted && this.humGain) {
      this.humGain.gain.setTargetAtTime(0, this.ctx?.currentTime || 0, 0.05);
    }
    return this.muted;
  }

  private playTone(startFreq: number, endFreq: number, duration: number) {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration + 0.01);
    } catch {}
  }

  /**
   * Tactile 800Hz micro-click on hover/click
   */
  public playHoverClick() {
    if (this.muted) return;
    this.playTone(800, 400, 0.03);
  }

  /**
   * Sub-bass 120Hz thump when file is dropped into dropzone
   */
  public playDropImpact() {
    if (this.muted) return;
    this.playTone(140, 40, 0.15);
  }

  /**
   * Ambient sine hum while WebRTC data stream is active
   */
  public startStreamingHum() {
    if (this.muted || this.humOsc) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    this.humOsc = ctx.createOscillator();
    this.humGain = ctx.createGain();

    this.humOsc.type = 'sine';
    this.humOsc.frequency.setValueAtTime(432, ctx.currentTime);

    this.humGain.gain.setValueAtTime(0, ctx.currentTime);
    this.humGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.2);

    this.humOsc.connect(this.humGain);
    this.humOsc.connect(ctx.destination);

    this.humOsc.start();
  }

  public stopStreamingHum() {
    if (this.humGain && this.ctx) {
      this.humGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      setTimeout(() => {
        try {
          this.humOsc?.stop();
        } catch {}
        this.humOsc = null;
        this.humGain = null;
      }, 150);
    }
  }

  /**
   * Crisp 3-note harmonic major chord (C5-E5-G5) on 100% transfer completion
   */
  public playCompletionChime() {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    this.stopStreamingHum();

    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.65);
    });
  }
}

export const soundEngine = new SoundEngine();
