/**
 * Hardened PeerVault Application-Level Sliding-Window Backpressure Control
 * 
 * Manages speed mismatches between high-speed network throughput and slower disk I/O
 * write operations to prevent browser memory crashes during 10GB+ transfers.
 */

export interface WindowMetrics {
  windowSize: number;
  unacknowledgedCount: number;
  bufferedAmount: number;
  isPaused: boolean;
}

export class BackpressureController {
  private windowSize: number = 32; // Keep in-flight chunks bounded until receiver ACKs drain.
  private unacknowledged: Set<number> = new Set();
  private bufferedAmountLowThreshold: number = 4 * 1024 * 1024; // 4MB
  private maxBufferedAmount: number = 16 * 1024 * 1024;   // 16MB per channel
  private minBufferedAmount: number = 4 * 1024 * 1024;    // 4MB
  private isPaused: boolean = false;
  private onPauseStateChange?: (isPaused: boolean) => void;

  constructor(onPauseStateChange?: (isPaused: boolean) => void) {
    this.onPauseStateChange = onPauseStateChange;
  }

  /**
   * Bind data channel bufferedAmountLowThreshold watcher
   */
  public bindDataChannel(dataChannel: RTCDataChannel): void {
    dataChannel.bufferedAmountLowThreshold = this.bufferedAmountLowThreshold;

    dataChannel.onbufferedamountlow = () => {
      if (dataChannel.bufferedAmount <= this.minBufferedAmount) {
        this.setPaused(false);
      }
    };
  }

  /**
   * Check whether sender is allowed to transmit next chunk
   */
  public canSend(dataChannel: RTCDataChannel): boolean {
    if (dataChannel.bufferedAmount >= this.maxBufferedAmount) {
      if (!this.isPaused) this.setPaused(true);
      return false;
    }

    if (dataChannel.bufferedAmount <= this.minBufferedAmount && this.isPaused) {
      this.setPaused(false);
    }

    return true;
  }

  /**
   * Record a chunk transmission
   */
  public registerSentChunk(chunkIndex: number): void {
    this.unacknowledged.add(chunkIndex);
  }

  /**
   * Process receiver ACK token
   */
  public handleAck(chunkIndex: number): void {
    for (const id of this.unacknowledged) {
      if (id <= chunkIndex) {
        this.unacknowledged.delete(id);
      }
    }
    if (this.isPaused && this.unacknowledged.size < this.windowSize / 2) {
      this.setPaused(false);
    }
  }

  /**
   * Dynamic window adjustment based on disk write speeds
   */
  public adjustWindowSize(newSize: number): void {
    this.windowSize = Math.max(256, Math.min(8192, newSize));
  }

  private setPaused(paused: boolean): void {
    if (this.isPaused !== paused) {
      this.isPaused = paused;
      if (this.onPauseStateChange) {
        this.onPauseStateChange(paused);
      }
    }
  }

  public getMetrics(dataChannel?: RTCDataChannel): WindowMetrics {
    return {
      windowSize: this.windowSize,
      unacknowledgedCount: this.unacknowledged.size,
      bufferedAmount: dataChannel ? dataChannel.bufferedAmount : 0,
      isPaused: this.isPaused,
    };
  }
}
