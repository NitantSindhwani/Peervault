/**
 * Hardened PeerVault Compressed Supabase Realtime Signaling Engine
 * 
 * Compresses raw SDP offers/answers using CompressionStream (gzip/deflate) to keep
 * payload size sub-kilobyte and eliminate signaling server costs.
 */

import { supabase } from './client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface SignalMessage {
  type: string;
  senderPeerId?: string;
  compressedPayload?: string;
  payload?: any;
  candidates?: RTCIceCandidateInit[];
  opaqueData?: string;
}

/**
 * Compress string payload using browser CompressionStream (gzip)
 */
export async function compressPayload(text: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return btoa(text);

  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  writer.write(encoder.encode(text));
  writer.close();

  const buffer = await new Response(stream.readable).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decompress Base64 string payload using DecompressionStream
 */
export async function decompressPayload(base64: string): Promise<string> {
  if (typeof DecompressionStream === 'undefined') return atob(base64);

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const buffer = await new Response(stream.readable).arrayBuffer();
  return new TextDecoder().decode(buffer);
}

export class SignalingRoom {
  private channel: RealtimeChannel;
  private peerId: string;
  private onSignalReceived?: (msg: SignalMessage) => void;

  constructor(roomId: string, peerId?: string, onSignalReceived?: (msg: SignalMessage) => void) {
    this.peerId = peerId || `peer_${Math.random().toString(36).substring(2, 8)}`;
    this.onSignalReceived = onSignalReceived;
    this.channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    });
  }

  public async join(onMessage?: (msg: SignalMessage) => void): Promise<void> {
    if (onMessage) {
      this.onSignalReceived = onMessage;
    }

    this.channel
      .on('broadcast', { event: 'signal' }, async (eventPayload) => {
        const msg = eventPayload.payload as SignalMessage;
        if (msg && this.onSignalReceived) {
          if (msg.compressedPayload) {
            try {
              const decompressed = await decompressPayload(msg.compressedPayload);
              msg.payload = JSON.parse(decompressed);
            } catch {
              msg.payload = msg.compressedPayload;
            }
          }
          this.onSignalReceived(msg);
        }
      })
      .subscribe();
  }

  public async sendPublicKey(pubKeyHex: string): Promise<void> {
    await this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type: 'ecdh_public_key',
        senderPeerId: this.peerId,
        payload: { publicKey: pubKeyHex },
      },
    });
  }

  public async sendOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    const compressedPayload = await compressPayload(JSON.stringify(offer));
    await this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type: 'sdp_offer',
        senderPeerId: this.peerId,
        compressedPayload,
      },
    });
  }

  public async sendAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    const compressedPayload = await compressPayload(JSON.stringify(answer));
    await this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type: 'sdp_answer',
        senderPeerId: this.peerId,
        compressedPayload,
      },
    });
  }

  public async sendIceCandidates(candidates: RTCIceCandidateInit[]): Promise<void> {
    await this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type: 'ice_candidate',
        senderPeerId: this.peerId,
        payload: candidates,
      },
    });
  }

  public leave(): void {
    supabase.removeChannel(this.channel);
  }
}
