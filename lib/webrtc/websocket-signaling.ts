/**
 * PeerVault Multi-Relay Signaling Engine
 *
 * Connects to ALL relay channels simultaneously (not sequentially) so that
 * the first working channel delivers the message immediately.
 *
 * Same-device: BroadcastChannel < 0.1ms, localStorage < 1ms
 * Cross-device: socketsbay.com room broadcast (auto-reconnect on drop)
 */

export class WebSocketSignaler {
  private sockets: WebSocket[] = [];
  private bc: BroadcastChannel | null = null;
  private roomId: string;
  private onMessageCallback: (data: any) => void;
  private isClosed: boolean = false;
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private relayAttempts = new Map<string, number>();

  // All public relay URLs that broadcast to all clients sharing the same room path.
  // We intentionally exclude PeerJS here — PeerJS routes by peer ID, NOT by room,
  // so two clients with different peer IDs never receive each other's messages.
  private readonly RELAY_URLS: string[];

  constructor(roomId: string, onMessage: (data: any) => void) {
    this.roomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
    this.onMessageCallback = onMessage;
    this.RELAY_URLS = [
      `wss://ntfy.sh/pv_sig_${this.roomId}/ws`,
    ];
  }

  public connect(): void {
    if (this.isClosed) return;

    // 1. Same-device / cross-tab: BroadcastChannel (< 0.1ms)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(`pv_sig_bc_${this.roomId}`);
        this.bc.onmessage = (event) => {
          if (event.data && event.data.roomId === this.roomId) {
            this.onMessageCallback(event.data);
          }
        };
      } catch {}
    }

    // 2. Same-device / cross-tab: localStorage storage events (< 1ms)
    if (typeof window !== 'undefined') {
      this.storageHandler = (event: StorageEvent) => {
        if (event.key === `pv_sig_evt_${this.roomId}` && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            if (data && data.roomId === this.roomId) {
              this.onMessageCallback(data);
            }
          } catch {}
        }
      };
      window.addEventListener('storage', this.storageHandler);
    }

    // 3. Cross-device: connect to ALL WebSocket room-broadcast relays simultaneously.
    // Each relay auto-reconnects with exponential backoff if it drops.
    for (const url of this.RELAY_URLS) {
      this.connectToRelay(url);
    }

    // 4. Initial poll to catch any message that arrived before WebSocket opened
    if (typeof fetch !== 'undefined') {
      fetch(`https://ntfy.sh/pv_sig_${this.roomId}/json?poll=1`)
        .then((r) => r.text())
        .then((text) => {
          const lines = text.trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const envelope = JSON.parse(line);
              if (envelope.event === 'message' && envelope.message) {
                const data = typeof envelope.message === 'string' ? JSON.parse(envelope.message) : envelope.message;
                if (data && (data.roomId === this.roomId || !data.roomId)) {
                  this.onMessageCallback(data);
                }
              }
            } catch {}
          }
        })
        .catch(() => {});
    }
  }

  private connectToRelay(url: string): void {
    if (this.isClosed) return;
    const attempt = this.relayAttempts.get(url) || 0;
    try {
      const ws = new WebSocket(url);
      this.sockets.push(ws);

      ws.onopen = () => {
        console.log(`[Signaler] Connected: ${url}`);
        this.relayAttempts.set(url, 0);
      };

      ws.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          // Handle ntfy.sh envelope format
          if (envelope.event === 'message' && envelope.message) {
            const data = typeof envelope.message === 'string' ? JSON.parse(envelope.message) : envelope.message;
            if (data && (data.roomId === this.roomId || !data.roomId)) {
              this.onMessageCallback(data);
            }
            return;
          }
          // Direct JSON message fallback
          if (envelope && envelope.roomId === this.roomId) {
            this.onMessageCallback(envelope);
          }
        } catch {}
      };

      ws.onerror = () => {
        // Silently ignore — onclose will handle cleanup + retry
      };

      ws.onclose = () => {
        const idx = this.sockets.indexOf(ws);
        if (idx >= 0) this.sockets.splice(idx, 1);

        // Exponential backoff reconnect (max 30s between attempts, max 10 attempts)
        if (!this.isClosed && attempt < 10) {
          const delay = Math.min(30000, 1000 * Math.pow(1.5, attempt));
          this.relayAttempts.set(url, attempt + 1);
          setTimeout(() => this.connectToRelay(url), delay);
        }
      };
    } catch {}
  }

  public send(payload: any): void {
    const fullMessage = { roomId: this.roomId, ...payload, ts: Date.now() };

    // BroadcastChannel (same-device)
    if (this.bc) {
      try { this.bc.postMessage(fullMessage); } catch {}
    }

    // localStorage storage event (same-device cross-tab)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`pv_sig_evt_${this.roomId}`, JSON.stringify(fullMessage));
      } catch {}
    }

    // All WebSocket relays (cross-device)
    const msg = JSON.stringify(fullMessage);
    for (const ws of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(msg); } catch {}
      }
    }

    // High-reliability edge HTTP pubsub broadcast (works across network boundaries & Cloudflare isolates)
    if (typeof fetch !== 'undefined') {
      fetch(`https://ntfy.sh/pv_sig_${this.roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: msg,
      }).catch(() => {});
    }
  }

  public close(): void {
    this.isClosed = true;
    if (this.bc) {
      try { this.bc.close(); } catch {}
      this.bc = null;
    }
    if (this.storageHandler && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }
    for (const ws of this.sockets) {
      try { ws.close(); } catch {}
    }
    this.sockets = [];
  }
}
