import { useState, useEffect, useRef, useCallback } from 'react';
import {
  generateECDHKeyPair,
  deriveSharedSymmetricKey,
  importPeerPublicKey,
  encryptChunk,
  decryptChunk,
} from '@/lib/crypto/crypto-engine';
import { createSenderPeerConnection, createReceiverPeerConnection } from '@/lib/webrtc/peer-connection';

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

export function useClipVault(initialPairId?: string) {
  const [pairId, setPairId] = useState<string | null>(initialPairId || null);
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'pairing' | 'synced' | 'error'>('idle');

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const sessionKeyRef = useRef<CryptoKey | null>(null);
  const signalPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // Setup channel message handler
  const attachChannelEvents = useCallback((channel: RTCDataChannel) => {
    dataChannelRef.current = channel;
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => setStatus('synced');
    channel.onclose = () => setStatus('idle');
    channel.onerror = () => setStatus('error');

    channel.onmessage = async (event) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : null;
        if (msg?.type === 'clip_update' && msg.payload && sessionKeyRef.current) {
          const iv = new Uint8Array(msg.iv);
          const encryptedBuffer = new Uint8Array(msg.payload).buffer;
          const decrypted = await decryptChunk(encryptedBuffer, sessionKeyRef.current, iv);
          const text = new TextDecoder().decode(decrypted);
          setContent(text);
        }
      } catch (e) {
        console.error('[ClipVault] Decryption error:', e);
      }
    };
  }, []);

  // ─── SENDER: Start pairing room ──────────────────────────────────────────
  const startPairing = useCallback(async () => {
    try {
      const newPairId = `clip_${Math.random().toString(36).substring(2, 10)}`;
      setPairId(newPairId);
      setStatus('pairing');

      const keyPair = await generateECDHKeyPair();
      const rawPubKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
      const pubKeyHex = Array.from(new Uint8Array(rawPubKey))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const channels = createSenderPeerConnection();
      pcRef.current = channels.pc;
      attachChannelEvents(channels.controlChannel);

      channels.pc.onicecandidate = (event) => {
        if (event.candidate) {
          fetch('/api/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId: newPairId,
              action: 'submit_sender_candidate',
              candidate: event.candidate.toJSON(),
            }),
          }).catch(() => {});
        }
      };

      const offer = await channels.pc.createOffer();
      await channels.pc.setLocalDescription(offer);

      // Post offer to native signal route
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: newPairId,
          action: 'submit_offer',
          offer: { pubKeyHex, sdp: JSON.stringify(offer) },
        }),
      });

      // Poll for receiver's answer
      if (signalPollerRef.current) clearInterval(signalPollerRef.current);
      signalPollerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/signal?roomId=${newPairId}`);
          if (!res.ok) return;
          const data = await res.json();

          if (data.answer && channels.pc.signalingState !== 'stable') {
            const rawAnswer = data.answer.sdp ? JSON.parse(data.answer.sdp) : data.answer;
            await channels.pc.setRemoteDescription(new RTCSessionDescription(rawAnswer));

            // Derive shared key using receiver's public key
            if (data.answer.pubKeyHex) {
              const remoteKeyBuffer = hexToBuffer(data.answer.pubKeyHex);
              const importedKey = await importPeerPublicKey(remoteKeyBuffer);
              sessionKeyRef.current = await deriveSharedSymmetricKey(keyPair.privateKey, importedKey, `clip_${newPairId}`);
            }

            if (signalPollerRef.current) clearInterval(signalPollerRef.current);
          }

          if (channels.pc.remoteDescription && data.receiverCandidates && Array.isArray(data.receiverCandidates)) {
            for (const cand of data.receiverCandidates) {
              try { await channels.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
            }
          }
        } catch (pollErr) {
          console.warn('[ClipVault] Poll error:', pollErr);
        }
      }, 1000);
    } catch (e) {
      console.error('[ClipVault] Pairing error:', e);
      setStatus('error');
    }
  }, [attachChannelEvents]);

  // ─── RECEIVER: Auto-join from URL pairId ──────────────────────────────────
  useEffect(() => {
    if (!initialPairId) return;

    let active = true;
    setStatus('pairing');

    async function joinAsReceiver(targetPairId: string) {
      try {
        const keyPair = await generateECDHKeyPair();
        const rawPubKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
        const myPubKeyHex = Array.from(new Uint8Array(rawPubKey))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        // Poll for sender's offer
        for (let attempt = 0; attempt < 60 && active; attempt++) {
          try {
            const res = await fetch(`/api/signal?roomId=${targetPairId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.offer?.sdp) {
                const { pc } = createReceiverPeerConnection({}, (channels) => {
                  const ch = channels.controlChannel || channels.dataChannel;
                  if (ch) attachChannelEvents(ch);
                });
                pcRef.current = pc;

                pc.onicecandidate = (event) => {
                  if (event.candidate) {
                    fetch('/api/signal', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        roomId: targetPairId,
                        action: 'submit_receiver_candidate',
                        candidate: event.candidate.toJSON(),
                      }),
                    }).catch(() => {});
                  }
                };

                const senderOffer = JSON.parse(data.offer.sdp);
                await pc.setRemoteDescription(new RTCSessionDescription(senderOffer));

                if (data.senderCandidates && Array.isArray(data.senderCandidates)) {
                  for (const cand of data.senderCandidates) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
                  }
                }

                // Derive shared key from sender's public key
                if (data.offer.pubKeyHex) {
                  const senderKeyBuf = hexToBuffer(data.offer.pubKeyHex);
                  const importedSenderKey = await importPeerPublicKey(senderKeyBuf);
                  sessionKeyRef.current = await deriveSharedSymmetricKey(keyPair.privateKey, importedSenderKey, `clip_${targetPairId}`);
                }

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                // Post answer back with receiver public key
                await fetch('/api/signal', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    roomId: targetPairId,
                    action: 'submit_answer',
                    answer: {
                      sdp: JSON.stringify(answer),
                      pubKeyHex: myPubKeyHex,
                    },
                  }),
                });
                return;
              }
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 800));
        }
      } catch (err) {
        console.error('[ClipVault] Receiver error:', err);
        if (active) setStatus('error');
      }
    }

    void joinAsReceiver(initialPairId);

    return () => {
      active = false;
      if (pcRef.current) {
        try { pcRef.current.close(); } catch {}
      }
    };
  }, [initialPairId, attachChannelEvents]);

  // ─── Encrypted Content Sender ─────────────────────────────────────────────
  const sendContent = useCallback(async (text: string) => {
    setContent(text);
    if (dataChannelRef.current?.readyState === 'open' && sessionKeyRef.current) {
      try {
        const textBuffer = new TextEncoder().encode(text).buffer;
        const { ciphertext, iv } = await encryptChunk(textBuffer, sessionKeyRef.current);

        dataChannelRef.current.send(
          JSON.stringify({
            type: 'clip_update',
            payload: Array.from(new Uint8Array(ciphertext)),
            iv: Array.from(iv),
          })
        );
      } catch (err) {
        console.warn('[ClipVault] Send encrypted chunk failed:', err);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (signalPollerRef.current) clearInterval(signalPollerRef.current);
      if (pcRef.current) {
        try { pcRef.current.close(); } catch {}
      }
    };
  }, []);

  return {
    pairId,
    content,
    status,
    startPairing,
    sendContent,
  };
}
