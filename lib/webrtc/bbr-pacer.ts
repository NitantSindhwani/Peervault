/**
 * Hardened PeerVault BBR-Style Congestion Control Engine
 * 
 * Measures real-time Round Trip Time (RTT) via high-precision performance.now()
 * sent over control frames, dynamically calculating maximum delivery rate and
 * bottleneck bandwidth to pace chunk transmission before buffer bloat occurs.
 */

export type BBRState = 'STARTUP' | 'DRAIN' | 'PROBE_BW' | 'PROBE_RTT';

export interface BBRMetrics {
  rtt: number;             // ms
  minRtt: number;          // ms
  bottleneckBw: number;    // Bytes per second
  pacingRate: number;      // Bytes per second
  state: BBRState;
}

export class BBRPacer {
  private state: BBRState = 'STARTUP';
  private rttSamples: number[] = [];
  private minRtt: number = Infinity;
  private maxDeliveryRate: number = 0; // Bytes per ms
  private pacingGain: number = 1.25; // 1.25 in STARTUP
  private pingIntervalTimer: any = null;
  private onMetricsUpdate?: (metrics: BBRMetrics) => void;

  constructor(onMetricsUpdate?: (metrics: BBRMetrics) => void) {
    this.onMetricsUpdate = onMetricsUpdate;
  }

  /**
   * Start RTT ping sampling over control channel
   */
  public startPingLoop(controlChannel: RTCDataChannel): void {
    if (this.pingIntervalTimer) clearInterval(this.pingIntervalTimer);

    this.pingIntervalTimer = setInterval(() => {
      if (controlChannel.readyState === 'open') {
        const pingMsg = JSON.stringify({
          type: 'bbr_ping',
          ts: performance.now(),
        });
        controlChannel.send(pingMsg);
      }
    }, 200);
  }

  /**
   * Stop ping sampling
   */
  public stopPingLoop(): void {
    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }
  }

  /**
   * Handle incoming pong message on sender side
   */
  public handlePong(ts: number, bytesAcked: number = 64512, durationMs: number = 10): void {
    const now = performance.now();
    const rtt = Math.max(1, now - ts);

    // Track min RTT over rolling window
    this.rttSamples.push(rtt);
    if (this.rttSamples.length > 20) this.rttSamples.shift();

    this.minRtt = Math.min(this.minRtt, rtt);

    // Calculate delivery rate in Bytes/ms
    if (durationMs > 0 && bytesAcked > 0) {
      const currentRate = bytesAcked / durationMs;
      this.maxDeliveryRate = Math.max(this.maxDeliveryRate, currentRate);
    }

    // BBR State Machine Transitions
    this.updateBBRState();

    if (this.onMetricsUpdate) {
      this.onMetricsUpdate(this.getMetrics());
    }
  }

  /**
   * State Machine logic for BBR gains
   */
  private updateBBRState(): void {
    if (this.state === 'STARTUP') {
      this.pacingGain = 1.25;
      // Transition to DRAIN if minRtt degrades or bandwidth plateaus
      if (this.rttSamples.length >= 10) {
        const avgRtt = this.rttSamples.reduce((a, b) => a + b, 0) / this.rttSamples.length;
        if (avgRtt > this.minRtt * 1.8) {
          this.state = 'DRAIN';
        }
      }
    } else if (this.state === 'DRAIN') {
      this.pacingGain = 0.75; // Drain queue
      if (this.rttSamples[this.rttSamples.length - 1] <= this.minRtt * 1.2) {
        this.state = 'PROBE_BW';
      }
    } else if (this.state === 'PROBE_BW') {
      this.pacingGain = 1.0;
    }
  }

  /**
   * Compute delay in milliseconds before sending next chunk
   */
  public getPacingDelayMs(chunkSizeBytes: number): number {
    const pacingRateBytesPerMs = Math.max(0.05, (this.maxDeliveryRate || 100) * this.pacingGain);
    const delayMs = chunkSizeBytes / pacingRateBytesPerMs;
    return Math.min(500, Math.max(0, Math.floor(delayMs)));
  }

  /**
   * Current metrics snapshot
   */
  public getMetrics(): BBRMetrics {
    const currentRtt = this.rttSamples.length > 0 ? this.rttSamples[this.rttSamples.length - 1] : 0;
    const bottleneckBw = (this.maxDeliveryRate || 0) * 1000; // Bytes/sec
    const pacingRate = bottleneckBw * this.pacingGain;

    return {
      rtt: Math.round(currentRtt),
      minRtt: this.minRtt === Infinity ? 0 : Math.round(this.minRtt),
      bottleneckBw: Math.round(bottleneckBw),
      pacingRate: Math.round(pacingRate),
      state: this.state,
    };
  }
}
