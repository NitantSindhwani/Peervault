/**
 * Hardened PeerVault Passive Tab Keep-Alive Engine
 * 
 * Prevents OS and browser resource managers (Chrome Memory Saver, iOS Safari background limits)
 * from throttling or sleeping background P2P transfer tabs using a 3-tier strategy:
 * 1. AudioContext continuous silent OscillatorNode
 * 2. Screen WakeLock API (navigator.wakeLock)
 * 3. Service Worker heartbeat ping
 */

export class KeepAliveManager {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private wakeLock: any = null;
  private isKeepAliveActive: boolean = false;

  /**
   * Start keep-alive loop (requires user gesture trigger for AudioContext)
   */
  public async start(): Promise<void> {
    if (this.isKeepAliveActive) return;
    this.isKeepAliveActive = true;

    // 1. AudioContext silent loop - created cleanly on user gesture
    if (typeof document !== 'undefined') {
      const unlockAudio = () => {
        try {
          if (!this.audioContext) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              this.audioContext = new AudioCtx();
              this.oscillator = this.audioContext.createOscillator();
              const gainNode = this.audioContext.createGain();

              gainNode.gain.value = 0.0001;
              this.oscillator.type = 'sine';
              this.oscillator.frequency.value = 440;

              this.oscillator.connect(gainNode);
              gainNode.connect(this.audioContext.destination);

              this.oscillator.start();
            }
          }
          if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
          }
        } catch {}
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
      };
      document.addEventListener('click', unlockAudio, { once: true });
      document.addEventListener('keydown', unlockAudio, { once: true });
      document.addEventListener('touchstart', unlockAudio, { once: true });
    }

    // 2. Screen WakeLock API & visibilitychange listener
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // WakeLock unavailable
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible' && this.isKeepAliveActive) {
      try {
        if (this.wakeLock) {
          try { await this.wakeLock.release(); } catch {}
          this.wakeLock = null;
        }
        if ('wakeLock' in navigator && (navigator as any).wakeLock) {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    }
  };

  /**
   * Stop keep-alive
   */
  public stop(): void {
    if (!this.isKeepAliveActive) return;
    this.isKeepAliveActive = false;

    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch {}
      this.oscillator = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }
  }

  public isActive(): boolean {
    return this.isKeepAliveActive;
  }
}
