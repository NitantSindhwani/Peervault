import { useState, useEffect, useRef, useCallback } from 'react';
import { generateECDHKeyPair, deriveSharedSymmetricKey, encryptChunk, decryptChunk } from '@/lib/crypto/crypto-engine';
import { createSenderPeerConnection, createReceiverPeerConnection } from '@/lib/webrtc/peer-connection';

export function useClipVault(initialPairId?: string) {
  const [pairId, setPairId] = useState<string | null>(initialPairId || null);
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'pairing' | 'synced' | 'error'>('idle');

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const sessionKeyRef = useRef<CryptoKey | null>(null);
  const signalPollerRef = useRef<NodeJS.Timeout | null>(null);

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
      dataChannelRef.current = channels.controlChannel;

      channels.controlChannel.onopen = () => setStatus('synced');
      channels.controlChannel.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'clip_update' && msg.payload && sessionKeyRef.current) {
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

      const offer = await channels.pc.createOffer();
      await channels.pc.setLocalDescription(offer);

      // Post offer to native 0-cost Next.js signal route
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: newPairId,
          action: 'submit_offer',
          offer: { pubKeyHex, sdp: JSON.stringify(offer) },
        }),
      });

      // Poll for answer
      signalPollerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/signal?roomId=${newPairId}`);
          const data = await res.json();
          if (data.answer && channels.pc.signalingState !== 'stable') {
            await channels.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            clearInterval(signalPollerRef.current!);
          }
        } catch {}
      }, 1000);

    } catch (e) {
      console.error('[ClipVault] Pairing error:', e);
      setStatus('error');
    }
  }, []);

  const sendContent = useCallback(
    async (text: string) => {
      setContent(text);
      if (dataChannelRef.current?.readyState === 'open' && sessionKeyRef.current) {
        const textBuffer = new TextEncoder().encode(text).buffer;
        const { ciphertext, iv } = await encryptChunk(textBuffer, sessionKeyRef.current);

        dataChannelRef.current.send(
          JSON.stringify({
            type: 'clip_update',
            payload: Array.from(new Uint8Array(ciphertext)),
            iv: Array.from(iv),
          })
        );
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (signalPollerRef.current) clearInterval(signalPollerRef.current);
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
