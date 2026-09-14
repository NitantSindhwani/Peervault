/**
 * PeerVault Multi-Channel Signaling Engine
 *
 * Cross-device signaling uses a layered approach for maximum reliability:
 *
 * Layer 1 — Same-device (< 0.1 ms): BroadcastChannel
 * Layer 2 — Same-device cross-tab (< 1 ms): localStorage storage events
 * Layer 3 — Cross-device real-time: Nostr relays with kind 30078
 *            (Parameterized Replaceable Events — relays STORE these, unlike
 *            ephemeral kind 20000 which is discarded immediately)
 *
 * Relay selection: high-uptime, globally distributed, no registration required.
 * Kind 30078 guarantees the last value is retrievable by late joiners via REQ.
 */

import { schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';

// Diverse set of high-uptime public Nostr relays
// Mix of European, US, and Asian nodes for global latency coverage
// relay.nostr.band excluded — unreachable from some ISPs
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.mom',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
];

// NIP-33 Parameterized Replaceable Event
// Kind 30078: "Application-specific data" — relays keep the latest value per (pubkey, kind, d-tag)
// This means a late-joining receiver can REQ and get the sender's last broadcast immediately.
const NOSTR_KIND = 30078;

export class WebSocketSignaler {
  private sockets: { ws: WebSocket; url: string }[] = [];
  private bc: BroadcastChannel | null = null;
  private roomId: string;
  private roomTag: string;
  private onMessageCallback: (data: any) => void;
  private isClosed: boolean = false;
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private relayAttempts = new Map<string, number>();

  // Ephemeral Schnorr keypair — generated fresh each session
  private privKey: Uint8Array;
  private pubKeyHex: string;

  constructor(roomId: string, onMessage: (data: any) => void) {
    this.roomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
    this.roomTag = `pv_${this.roomId}`;
    this.onMessageCallback = onMessage;

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

    // Layer 1: BroadcastChannel (same-device, instant)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(`pv_sig_bc_${this.roomId}`);
        this.bc.onmessage = (event) => {
          if (event.data?.roomId === this.roomId) {
            this.onMessageCallback(event.data);
          }
        };
      } catch {}
    }

    // Layer 2: localStorage storage events (same-device cross-tab)
    if (typeof window !== 'undefined') {
      this.storageHandler = (event: StorageEvent) => {
        if (event.key === `pv_sig_evt_${this.roomId}` && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            if (data?.roomId === this.roomId) this.onMessageCallback(data);
          } catch {}
        }
      };
      window.addEventListener('storage', this.storageHandler);
    }

    // Layer 3: Nostr relays (cross-device, cross-network)
    for (const url of NOSTR_RELAYS) {
      this.connectToRelay(url);
    }
  }

  private connectToRelay(url: string): void {
    if (this.isClosed) return;
    const attempt = this.relayAttempts.get(url) || 0;

    try {
      const ws = new WebSocket(url);
      const entry = { ws, url };
      this.sockets.push(entry);

      ws.onopen = () => {
        console.log(`[Signaler] Connected to relay: ${url}`);
        this.relayAttempts.set(url, 0);

        // Subscribe using NIP-33 filter: kind 30078 + d-tag matching our room
        // This fetches the stored (replaceable) events AND subscribes to new ones.
        // A receiver connecting AFTER the sender published will still get the offer
        // because relays store the latest event for each (pubkey, kind, d) triple.
        try {
          const subId = `pv_${this.roomId.substring(0, 10)}`;
          ws.send(JSON.stringify([
            'REQ',
            subId,
            { kinds: [NOSTR_KIND], '#d': [this.roomTag], limit: 20 },
          ]));
        } catch {}
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          // NIP-01: ["EVENT", <sub_id>, <event_object>]
          if (Array.isArray(parsed) && parsed[0] === 'EVENT' && parsed[2]?.content) {
            const ev = parsed[2];
            // Ignore our own broadcasts
            if (ev.pubkey === this.pubKeyHex) return;
            const payload = JSON.parse(ev.content);
            if (payload && (payload.roomId === this.roomId || !payload.roomId)) {
              this.onMessageCallback(payload);
            }
          }
        } catch {}
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        const idx = this.sockets.indexOf(entry);
        if (idx >= 0) this.sockets.splice(idx, 1);

        // Exponential backoff reconnect (up to ~20s)
        if (!this.isClosed && attempt < 8) {
          const delay = Math.min(20000, 1000 * Math.pow(1.5, attempt));
          this.relayAttempts.set(url, attempt + 1);
          setTimeout(() => this.connectToRelay(url), delay);
        }
      };
    } catch {}
  }

  public send(payload: any): void {
    const fullMessage = { roomId: this.roomId, ...payload, ts: Date.now() };

    // Layer 1: BroadcastChannel
    if (this.bc) {
      try { this.bc.postMessage(fullMessage); } catch {}
    }

    // Layer 2: localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`pv_sig_evt_${this.roomId}`, JSON.stringify(fullMessage));
      } catch {}
    }

    // Layer 3: Nostr — NIP-33 kind 30078 Parameterized Replaceable Event
    try {
      const content = JSON.stringify(fullMessage);
      const createdAt = Math.floor(Date.now() / 1000);
      // The 'd' tag scopes the replaceable event to this specific room+action pair.
      // Using roomTag+action means each action type has its own stored slot on the relay,
      // so the offer, answer, and candidates don't overwrite each other.
      const actionTag = (payload.action || 'msg').substring(0, 32);
      const dTag = `${this.roomTag}_${actionTag}`;
      const tags = [['d', dTag]];
      const serialized = JSON.stringify([0, this.pubKeyHex, createdAt, NOSTR_KIND, tags, content]);
      const idBytes = sha256(new TextEncoder().encode(serialized));
      const id = Array.from(idBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      const sigBytes = schnorr.sign(idBytes, this.privKey);
      const sig = Array.from(sigBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

      const event = { id, pubkey: this.pubKeyHex, created_at: createdAt, kind: NOSTR_KIND, tags, content, sig };
      const frame = JSON.stringify(['EVENT', event]);

      for (const { ws } of this.sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(frame); } catch {}
        }
      }
    } catch (err) {
      console.warn('[Signaler] Failed to sign Nostr frame:', err);
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
