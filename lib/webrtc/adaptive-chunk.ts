/**
 * Hardened PeerVault Adaptive Chunk Sizer (LEDBAT Probing Engine)
 * 
 * Dynamically adjusts chunk sizes in real time based on active network stability.
 * Scales down to 16KB when packet loss/jitter spikes, and scales up to 256KB on
 * stable low-latency networks.
 */

export class AdaptiveChunkScaler {
  private currentChunkSize: number = 256 * 1024; // 256KB default
  private minChunkSize: number = 32 * 1024;      // 32KB min
  private maxChunkSize: number = 256 * 1024;     // 256KB max
  private stableWindowCount: number = 0;
  private lossCount: number = 0;

  /**
   * Get current target chunk size in bytes
   */
  public getChunkSize(): number {
    return this.currentChunkSize;
  }

  /**
   * Report successful RTT sample window
   */
  public reportSuccess(rttMs: number, minRttMs: number): void {
    // If RTT is within 1.2x min RTT, network is stable
    if (rttMs <= minRttMs * 1.25) {
      this.stableWindowCount++;
      this.lossCount = 0;

      if (this.stableWindowCount >= 5) {
        this.scaleUp();
        this.stableWindowCount = 0;
      }
    } else {
      this.stableWindowCount = 0;
    }
  }

  /**
   * Report chunk timeout or packet loss
   */
  public reportLossOrTimeout(): void {
    this.lossCount++;
    this.stableWindowCount = 0;

    if (this.lossCount >= 2) {
      this.scaleDown();
      this.lossCount = 0;
    }
  }

  private scaleUp(): void {
    if (this.currentChunkSize < this.maxChunkSize) {
      this.currentChunkSize = Math.min(this.maxChunkSize, this.currentChunkSize * 2);
    }
  }

  private scaleDown(): void {
    if (this.currentChunkSize > this.minChunkSize) {
      this.currentChunkSize = Math.max(this.minChunkSize, Math.floor(this.currentChunkSize / 2));
    }
  }
}
