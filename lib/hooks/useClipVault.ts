import { useState, useEffect, useRef, useCallback } from 'react';
import { generateECDHKeyPair, deriveSharedSymmetricKey, encryptChunk, decryptChunk } from '@/lib/crypto/crypto-engine';
import { SignalingRoom } from '@/lib/supabase/signaling';
import { createSenderPeerConnection, createReceiverPeerConnection } from '@/lib/webrtc/peer-connection';

export function useClipVault(initialPairId?: string) {
  const [pairId, setPairId] = useState<string | null>(initialPairId || null);
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'pairing' | 'synced' | 'error'>('idle');

  const signalingRef = useRef<SignalingRoom | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const sessionKeyRef = useRef<CryptoKey | null>(null);

  const startPairing = useCallback(async () => {
    try {
      const newPairId = `clip_${Math.random().toString(36).substring(2, 10)}`;
      setPairId(newPairId);
      setStatus('pairing');

      const signaling = new SignalingRoom(`clip_${newPairId}`);
      signalingRef.current = signaling;

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

      await signaling.join(async (msg) => {
        if (msg.type === 'ecdh_public_key' && msg.payload?.publicKey) {
          const recipientKeyBuffer = new Uint8Array(
            msg.payload.publicKey.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16))
          ).buffer;

          const recipientKey = await window.crypto.subtle.importKey(
            'raw',
            recipientKeyBuffer,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
          );

          const sessionKey = await deriveSharedSymmetricKey(keyPair.privateKey, recipientKey);
          sessionKeyRef.current = sessionKey;

          const offer = await channels.pc.createOffer();
          await channels.pc.setLocalDescription(offer);
          await signaling.sendOffer(offer);
        } else if (msg.type === 'sdp_answer' && msg.payload) {
          await channels.pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        }
      });

      await signaling.sendPublicKey(pubKeyHex);
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

  return {
    pairId,
    content,
    status,
    startPairing,
    sendContent,
  };
}
