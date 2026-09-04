/**
 * PeerVault Censorship-Resistant Multi-Relay Signaling Engine
 *
 * Utilizes high-performance decentralized Nostr relays + local fast-paths:
 * - Same-device / cross-tab: BroadcastChannel (< 0.1ms), localStorage (< 1ms)
 * - Cross-device: Multiple redundant global relays (nos.lol, nostr.mom, eden.nostr.land)
 *
 * Zero API keys, zero blocked domains, zero serverless isolate dependency.
 */

import { schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';

const NOSTR_RELAYS = [
  'wss://nos.lol',
  'wss://nostr.mom',
  'wss://eden.nostr.land',
];

export class WebSocketSignaler {
  private sockets: { ws: WebSocket; url: string }[] = [];
  private bc: BroadcastChannel | null = null;
  private roomId: string;
  private roomTag: string;
  private onMessageCallback: (data: any) => void;
  private isClosed: boolean = false;
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private relayAttempts = new Map<string, number>();

  // Ephemeral ECDSA/Schnorr keypair for signing public Nostr relay events
  private privKey: Uint8Array;
  private pubKeyHex: string;

  constructor(roomId: string, onMessage: (data: any) => void) {
    this.roomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
    this.roomTag = `pv_${this.roomId}`;
    this.onMessageCallback = onMessage;

    // Generate random 32-byte private key for this session
    this.privKey = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(this.privKey);
    } else {
      for (let i = 0; i < 32; i++) this.privKey[i] = Math.floor(Math.random() * 256);
    }
    const pubBytes = schnorr.getPublicKey(this.privKey);
    this.pubKeyHex = Array.from(pubBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
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

    // 3. Cross-device: connect to ALL redundant Nostr relays simultaneously
    for (const url of NOSTR_RELAYS) {
      this.connectToNostrRelay(url);
    }
  }

  private connectToNostrRelay(url: string): void {
    if (this.isClosed) return;
    const attempt = this.relayAttempts.get(url) || 0;

    try {
      const ws = new WebSocket(url);
      const entry = { ws, url };
      this.sockets.push(entry);

      ws.onopen = () => {
        console.log(`[Signaler] Connected to global relay: ${url}`);
        this.relayAttempts.set(url, 0);
        // Subscribe to ephemeral signaling events tagged with our room
        try {
          const subId = `pv_sub_${this.roomId.substring(0, 8)}`;
          ws.send(JSON.stringify(['REQ', subId, { kinds: [20000], '#d': [this.roomTag] }]));
        } catch {}
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          // NIP-01 EVENT format: ["EVENT", <subscription_id>, <event_object>]
          if (Array.isArray(parsed) && parsed[0] === 'EVENT' && parsed[2]?.content) {
            const ev = parsed[2];
            // Ignore messages sent by ourselves
            if (ev.pubkey === this.pubKeyHex) return;

            const payload = JSON.parse(ev.content);
            if (payload && (payload.roomId === this.roomId || !payload.roomId)) {
              this.onMessageCallback(payload);
            }
          }
        } catch {}
      };

      ws.onerror = () => {
        // Silently handled on close
      };

      ws.onclose = () => {
        const idx = this.sockets.indexOf(entry);
        if (idx >= 0) this.sockets.splice(idx, 1);

        // Auto-reconnect with backoff
        if (!this.isClosed && attempt < 8) {
          const delay = Math.min(20000, 1000 * Math.pow(1.5, attempt));
          this.relayAttempts.set(url, attempt + 1);
          setTimeout(() => this.connectToNostrRelay(url), delay);
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

    // Encode into a cryptographically signed Nostr event (NIP-01 ephemeral kind 20000)
    try {
      const content = JSON.stringify(fullMessage);
      const createdAt = Math.floor(Date.now() / 1000);
      const tags = [['d', this.roomTag]];
      const serialized = JSON.stringify([0, this.pubKeyHex, createdAt, 20000, tags, content]);
      const idBytes = sha256(new TextEncoder().encode(serialized));
      const id = Array.from(idBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      const sigBytes = schnorr.sign(idBytes, this.privKey);
      const sig = Array.from(sigBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

      const event = {
        id,
        pubkey: this.pubKeyHex,
        created_at: createdAt,
        kind: 20000,
        tags,
        content,
        sig,
      };

      const frame = JSON.stringify(['EVENT', event]);
      for (const { ws } of this.sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(frame); } catch {}
        }
      }
    } catch (err) {
      console.warn('[Signaler] Failed signing Nostr frame:', err);
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
    for (const { ws } of this.sockets) {
      try { ws.close(); } catch {}
    }
    this.sockets = [];
  }
}
