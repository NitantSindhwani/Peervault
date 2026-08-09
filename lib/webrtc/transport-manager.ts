/**
 * Hardened PeerVault Multi-Transport Manager
 * 
 * Unified interface supporting:
 * 1. WebRTC DataChannel (UDP / SCTP — Primary)
 * 2. WebTransport Datagram (QUIC / HTTP/3 — Enterprise NAT Fallback)
 * 3. WebSocket / HTTPS Relay (TCP — Emergency Fallback)
 */

export type TransportType = 'webrtc' | 'webtransport' | 'websocket';

export interface TransportMessage {
  type: string;
  payload?: any;
}

export class TransportManager {
  private activeType: TransportType = 'webrtc';
  private dataChannel: RTCDataChannel | null = null;
  private webTransport: any = null;
  private webSocket: WebSocket | null = null;
  private onMessageCallback?: (msg: ArrayBuffer | string) => void;
  private onStatusChange?: (type: TransportType, connected: boolean) => void;

  constructor(onStatusChange?: (type: TransportType, connected: boolean) => void) {
    this.onStatusChange = onStatusChange;
  }

  /**
   * Bind primary RTCDataChannel
   */
  public bindDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;
    this.activeType = 'webrtc';

    channel.onopen = () => {
      if (this.onStatusChange) this.onStatusChange('webrtc', true);
    };
    // If channel is already open, fire status immediately
    if (channel.readyState === 'open') {
      if (this.onStatusChange) this.onStatusChange('webrtc', true);
    }

    channel.onmessage = (event) => {
      if (this.onMessageCallback) this.onMessageCallback(event.data);
    };

    channel.onclose = () => {
      if (this.onStatusChange) this.onStatusChange('webrtc', false);
    };
  }

  /**
   * Connect WebTransport QUIC Datagram session fallback
   */
  public async connectWebTransport(url: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('WebTransport' in window)) {
      console.warn('[Transport] WebTransport API unsupported in browser');
      return false;
    }

    try {
      // @ts-ignore
      const transport = new WebTransport(url);
      await transport.ready;
      this.webTransport = transport;
      this.activeType = 'webtransport';

      if (this.onStatusChange) this.onStatusChange('webtransport', true);

      // Listen to incoming datagrams
      this.readWebTransportDatagrams();
      return true;
    } catch (err) {
      console.warn('[Transport] WebTransport connection failed:', err);
      return false;
    }
  }

  private async readWebTransportDatagrams() {
    if (!this.webTransport?.datagrams?.readable) return;
    const reader = this.webTransport.datagrams.readable.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && this.onMessageCallback) {
          this.onMessageCallback(value.buffer);
        }
      }
    } catch (err) {
      console.warn('[Transport] WebTransport datagram reader error:', err);
    }
  }

  /**
   * Connect WebSocket fallback
   */
  public connectWebSocket(url: string): void {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.webSocket = ws;

    ws.onopen = () => {
      this.activeType = 'websocket';
      if (this.onStatusChange) this.onStatusChange('websocket', true);
    };

    ws.onmessage = (event) => {
      if (this.onMessageCallback) this.onMessageCallback(event.data);
    };
  }

  /**
   * Unified send method
   */
  public send(data: string | ArrayBuffer): void {
    if (this.activeType === 'webrtc' && this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(data as any);
    } else if (this.activeType === 'webtransport' && this.webTransport?.datagrams?.writable) {
      const writer = this.webTransport.datagrams.writable.getWriter();
      const payload = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
      writer.write(payload).then(() => writer.releaseLock()).catch(() => { try { writer.releaseLock(); } catch {} });
    } else if (this.activeType === 'websocket' && this.webSocket?.readyState === WebSocket.OPEN) {
      this.webSocket.send(data);
    }
  }

  public onMessage(callback: (msg: ArrayBuffer | string) => void): void {
    this.onMessageCallback = callback;
  }

  public getActiveType(): TransportType {
    return this.activeType;
  }

  public close(): void {
    if (this.dataChannel) this.dataChannel.close();
    if (this.webTransport) this.webTransport.close();
    if (this.webSocket) this.webSocket.close();
  }
}
