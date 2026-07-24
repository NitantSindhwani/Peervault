/**
 * Hardened PeerVault Cyber-Acoustics Sound Engine
 * 
 * Native Web Audio API synthesizer for zero-latency, zero-asset acoustic feedback.
 * Synthesizes 4 distinct sound signatures directly via oscillators:
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
    this.muted = !this.muted;
    if (this.muted && this.humGain) {
      this.humGain.gain.setTargetAtTime(0, this.ctx?.currentTime || 0, 0.05);
    }
    return this.muted;
  }

  /**
   * Tactile 800Hz micro-click on hover/click
   */
  public playHoverClick() {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.035);
  }

  /**
   * Sub-bass 120Hz thump when file is dropped into dropzone
   */
  public playDropImpact() {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.16);
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
    this.humGain.connect(ctx.destination);

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
