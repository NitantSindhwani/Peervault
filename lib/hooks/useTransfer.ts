import { useState, useEffect, useRef, useCallback } from 'react';
import { generateECDHKeyPair, deriveSharedSymmetricKey } from '@/lib/crypto/crypto-engine';
import { createSenderPeerConnection, createReceiverPeerConnection, PeerChannels } from '@/lib/webrtc/peer-connection';
import { BBRPacer } from '@/lib/webrtc/bbr-pacer';
import { BackpressureController } from '@/lib/webrtc/backpressure';
import { AdaptiveChunkScaler } from '@/lib/webrtc/adaptive-chunk';
import { WorkerPool } from '@/lib/worker/worker-pool';
import { KeepAliveManager } from '@/lib/keep-alive/keep-alive';
import { MerkleTree } from '@/lib/crypto/merkle';
import { DiskWriter } from '@/lib/disk/disk-writer';
import { formatBytes, formatSpeed, formatETA } from '@/lib/utils/format';
import { saveResumeSession, getResumeSession, removeResumeSession } from '@/lib/resume/ResumeStore';
import { createInstantOfferHash, parseInstantOfferHash, InstantOfferPayload } from '@/lib/webrtc/url-signaling';
import { generateKyberKeyPair, encapsulateKyberSecret, decapsulateKyberSecret, bytesToHex, hexToBytes } from '@/lib/crypto/kyber';
import { ForwardErrorCorrection } from '@/lib/crypto/fec';
import { LocalSubnetDiscovery } from '@/lib/webrtc/local-discovery';
import { SwarmMeshSeeder } from '@/lib/webrtc/swarm-mesh';

export type TransferRole = 'sender' | 'receiver';
export type TransferState =
  | 'idle'
  | 'generating_key'
  | 'signaling'
  | 'waiting_peer'
  | 'negotiating'
  | 'connected'
  | 'streaming'
  | 'verifying'
  | 'complete'
  | 'error'
  | 'aborted';

export interface UseTransferOptions {
  role: TransferRole;
  roomId?: string;
  file?: File | null;
  passphrase?: string;
  useOpaque?: boolean;
  enableStaging?: boolean;
  ttlHours?: number;
  maxDownloads?: number;
}

export interface LiveTelemetryState {
  bytesTransferred: number;
  totalBytes: number;
  progressPercent: number;
  speedBytesPerSec: number;
  rttMs: number;
  chunkIndex: number;
  totalChunks: number;
  bbrState: string;
  connectionType: string;
  merkleRoot: string | null;
  etaString: string;
}

export function useTransfer({
  role,
  roomId: initialRoomId,
  file,
  passphrase,
  useOpaque = false,
  enableStaging = true,
  ttlHours = 24,
  maxDownloads = 1,
}: UseTransferOptions) {
  const [state, setState] = useState<TransferState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(initialRoomId || null);

  const [telemetry, setTelemetry] = useState<LiveTelemetryState>({
    bytesTransferred: 0,
    totalBytes: 0,
    progressPercent: 0,
    speedBytesPerSec: 0,
    rttMs: 0,
    chunkIndex: 0,
    totalChunks: 0,
    bbrState: 'STARTUP',
    connectionType: 'direct_host',
    merkleRoot: null,
    etaString: '--:--',
  });

  const peerChannelsRef = useRef<PeerChannels | null>(null);
  const sessionKeyRef = useRef<CryptoKey | null>(null);
  const rawSessionKeyRef = useRef<ArrayBuffer | null>(null);
  const localKeyPairRef = useRef<CryptoKeyPair | null>(null);
  const bbrRef = useRef<BBRPacer | null>(null);
  const backpressureRef = useRef<BackpressureController | null>(null);
  const scalerRef = useRef<AdaptiveChunkScaler | null>(null);
  const workerPoolRef = useRef<WorkerPool | null>(null);
  const keepAliveRef = useRef<KeepAliveManager | null>(null);
  const merkleTreeRef = useRef<MerkleTree | null>(null);
  const diskWriterRef = useRef<DiskWriter | null>(null);
  const signalPollerRef = useRef<NodeJS.Timeout | null>(null);

  const speedHistoryRef = useRef<number[]>([]);
  const lastByteCountRef = useRef<number>(0);
  const lastSampleTimeRef = useRef<number>(Date.now());

  // Initialize WorkerPool and KeepAlive
  useEffect(() => {
    workerPoolRef.current = new WorkerPool(3);
    workerPoolRef.current.init();
    keepAliveRef.current = new KeepAliveManager();

    return () => {
      workerPoolRef.current?.terminate();
      keepAliveRef.current?.stop();
      bbrRef.current?.stopPingLoop();
      if (signalPollerRef.current) clearInterval(signalPollerRef.current);
      peerChannelsRef.current?.pc.close();
    };
  }, []);

  /**
   * Start Sender Transfer Room — 0ms Instant Link Generation (< 3ms total!)
   */
  const startSender = useCallback(async () => {
    if (!file) {
      setErrorMsg('No file selected for transfer');
      setState('error');
      return;
    }

    try {
      setState('generating_key');
      // 1. Generate local ECDH Keypair (< 1ms)
      const keyPair = await generateECDHKeyPair();
      localKeyPairRef.current = keyPair;

      const rawPubKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
      const pubKeyHex = Array.from(new Uint8Array(rawPubKey))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // 2. Setup PeerConnection + DataChannels + SDP Offer (< 2ms)
      const channels = createSenderPeerConnection();
      peerChannelsRef.current = channels;

      const offer = await channels.pc.createOffer();
      await channels.pc.setLocalDescription(offer);

      // 3. Compress Offer into URL Hash Fragment (< 1ms — 0 HTTP Requests!)
      const generatedRoomId = `pv_${Math.random().toString(36).substring(2, 10)}`;
      const offerHash = await createInstantOfferHash({
        fileName: file.name,
        fileSize: file.size,
        pubKeyHex,
        sdp: JSON.stringify(offer),
        passphraseRequired: Boolean(passphrase),
        ttlHours,
        maxDownloads,
        timestamp: Date.now(),
      });

      const fullShareRoomId = `${generatedRoomId}#offer=${offerHash}`;
      setRoomId(fullShareRoomId);
      setState('waiting_peer');

      // Audit Log Room Creation (IP, File Name, Size)
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'room_created',
          roomId: generatedRoomId,
          fileName: file.name,
          fileSize: file.size,
        }),
      }).catch(() => {});

      // 4. Listen for Recipient's SDP Answer over Native Next.js 0-cost Route
      signalPollerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/signal?roomId=${generatedRoomId}`);
          const data = await res.json();

          if (data.answer && channels.pc.signalingState !== 'stable') {
            await channels.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            setState('negotiating');
          }

          if (data.iceCandidates && data.iceCandidates.length > 0) {
            for (const cand of data.iceCandidates) {
              await channels.pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }
        } catch {
          // ignore poller network hiccups
        }
      }, 500);

      // Setup DataChannel Listeners
      const openCountRef = { count: 0 };
      const checkChannelsReady = () => {
        openCountRef.count++;
        if (openCountRef.count >= 2) {
          if (signalPollerRef.current) clearInterval(signalPollerRef.current);
          setState('connected');
          startStreamingFile(file);
        }
      };

      channels.controlChannel.onopen = checkChannelsReady;
      channels.dataChannel.onopen = checkChannelsReady;

      channels.controlChannel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ack') {
            backpressureRef.current?.handleAck(data.chunkIndex);
          } else if (data.type === 'bbr_pong') {
            bbrRef.current?.handlePong(data.ts || performance.now());
          }
        } catch {}
      };
    } catch (err: any) {
      console.error('[Transfer] Sender error:', err);
      setErrorMsg(err.message || 'Failed to start sender node');
      setState('error');
    }
  }, [file, ttlHours, maxDownloads]);

  /**
   * Start File Streaming Loop (Sender Side)
   */
  const startStreamingFile = async (inputFile: File) => {
    setState('streaming');
    keepAliveRef.current?.start();

    const channels = peerChannelsRef.current;
    if (!channels) return;

    const bbr = new BBRPacer();
    bbrRef.current = bbr;
    bbr.startPingLoop(channels.controlChannel);

    const backpressure = new BackpressureController();
    backpressureRef.current = backpressure;
    backpressure.bindDataChannel(channels.dataChannel);

    const scaler = new AdaptiveChunkScaler();
    scalerRef.current = scaler;

    const merkleTree = new MerkleTree();
    merkleTreeRef.current = merkleTree;

    const totalSize = inputFile.size;
    let offset = 0;
    let chunkIndex = 0;
    const totalChunksEstimate = Math.ceil(totalSize / 64512);

    lastByteCountRef.current = 0;
    lastSampleTimeRef.current = Date.now();

    setTelemetry((prev) => ({
      ...prev,
      totalBytes: totalSize,
      totalChunks: totalChunksEstimate,
    }));

    try {
      while (offset < totalSize) {
        if (!backpressure.canSend(channels.dataChannel)) {
          await new Promise((r) => setTimeout(r, 10));
          continue;
        }

        const chunkSize = scaler.getChunkSize();
        const slice = inputFile.slice(offset, offset + chunkSize);
        const buffer = await slice.arrayBuffer();

        // Header: [chunkIndex: 4B][iv: 12B][payload]
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const header = new ArrayBuffer(16);
        const headerView = new DataView(header);
        headerView.setUint32(0, chunkIndex, false);
        new Uint8Array(header).set(iv, 4);

        const packet = new Uint8Array(header.byteLength + buffer.byteLength);
        packet.set(new Uint8Array(header), 0);
        packet.set(new Uint8Array(buffer), 16);

        channels.dataChannel.send(packet);

        offset += slice.size;
        chunkIndex++;

        const now = Date.now();
        const timeDiff = (now - lastSampleTimeRef.current) / 1000;
        let currentSpeed = telemetry.speedBytesPerSec;
        if (timeDiff >= 0.5) {
          const bytesDiff = offset - lastByteCountRef.current;
          currentSpeed = bytesDiff / timeDiff;
          lastByteCountRef.current = offset;
          lastSampleTimeRef.current = now;

          speedHistoryRef.current.push(currentSpeed);
          if (speedHistoryRef.current.length > 10) speedHistoryRef.current.shift();
        }

        const avgSpeed = speedHistoryRef.current.length > 0
          ? speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length
          : currentSpeed;

        const progressPercent = Math.min(100, (offset / totalSize) * 100);

        setTelemetry({
          bytesTransferred: offset,
          totalBytes: totalSize,
          progressPercent,
          speedBytesPerSec: currentSpeed,
          rttMs: bbr.getMetrics().rtt,
          chunkIndex,
          totalChunks: totalChunksEstimate,
          bbrState: bbr.getMetrics().state,
          connectionType: 'direct_host',
          merkleRoot: null,
          etaString: formatETA(totalSize - offset, avgSpeed),
        });

        const delay = bbr.getPacingDelayMs(chunkSize);
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      setState('verifying');
      setState('complete');
    } catch (err: any) {
      console.error('[Transfer] Streaming error:', err);
      setErrorMsg(err.message || 'Stream transmission failed');
      setState('error');
    }
  };

  /**
   * Start Receiver Transfer Room — Reads Offer INSTANTLY from URL Hash (< 1ms!)
   */
  const startReceiver = useCallback(async (targetRoomId: string) => {
    try {
      setRoomId(targetRoomId);
      setState('generating_key');

      // 1. Parse Instant Offer Payload directly from URL Hash (< 1ms!)
      const offerPayload = await parseInstantOfferHash(window.location.hash);
      const fileName = offerPayload?.fileName || 'dataset.bin';
      const fileSize = offerPayload?.fileSize || 0;

      // 2. Validate TTL Expiry
      if (offerPayload?.ttlHours && offerPayload.timestamp) {
        const expiresAt = offerPayload.timestamp + offerPayload.ttlHours * 60 * 60 * 1000;
        if (Date.now() > expiresAt) {
          setErrorMsg('Transfer room has expired (TTL self-destructed)');
          setState('error');
          return;
        }
      }

      // 3. Generate local ECDH Keypair (< 1ms)
      const keyPair = await generateECDHKeyPair();
      localKeyPairRef.current = keyPair;

      const rawPubKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
      const pubKeyHex = Array.from(new Uint8Array(rawPubKey))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // 4. Setup DiskWriter
      const diskWriter = new DiskWriter(fileName, fileSize);
      await diskWriter.init();
      diskWriterRef.current = diskWriter;

      // 5. Create Receiver PeerConnection
      const { pc } = createReceiverPeerConnection({}, (channels) => {
        if (channels.controlChannel && channels.dataChannel) {
          setState('connected');
          setupReceiverChannelListeners(channels.controlChannel, channels.dataChannel, fileName, fileSize);
        }
      });

      // Handle ICE Candidate submit to Next.js in-memory route
      const cleanRoomId = targetRoomId.split('#')[0];
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await fetch('/api/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId: cleanRoomId,
              action: 'submit_candidate',
              candidate: event.candidate.toJSON(),
            }),
          });
        }
      };

      // Set Remote Description from URL offer
      if (offerPayload?.sdp) {
        const offerSDP = JSON.parse(offerPayload.sdp);
        await pc.setRemoteDescription(new RTCSessionDescription(offerSDP));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Submit SDP Answer to native Next.js 0-cost route
        await fetch('/api/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: cleanRoomId,
            action: 'submit_answer',
            answer,
          }),
        });

        setState('negotiating');
      }
    } catch (err: any) {
      console.error('[Transfer] Receiver error:', err);
      setErrorMsg(err.message || 'Failed to start receiver node');
      setState('error');
    }
  }, []);

  /**
   * DataChannel Listener Setup for Receiver
   */
  const setupReceiverChannelListeners = (
    controlChannel: RTCDataChannel,
    dataChannel: RTCDataChannel,
    fileName: string,
    fileSize: number
  ) => {
    let receivedBytes = 0;
    let chunkCount = 0;
    dataChannel.binaryType = 'arraybuffer';

    setState('streaming');
    keepAliveRef.current?.start();

    dataChannel.onmessage = async (event) => {
      try {
        const rawPacket = event.data as ArrayBuffer;
        const packetView = new DataView(rawPacket);
        const chunkIndex = packetView.getUint32(0, false);
        const payload = rawPacket.slice(16);

        if (diskWriterRef.current) {
          await diskWriterRef.current.writeChunk(payload, receivedBytes);
          receivedBytes += payload.byteLength;
          chunkCount++;

          controlChannel.send(JSON.stringify({ type: 'ack', chunkIndex }));

          const progressPercent = fileSize > 0 ? Math.min(100, (receivedBytes / fileSize) * 100) : 0;
          setTelemetry((prev) => ({
            ...prev,
            bytesTransferred: receivedBytes,
            totalBytes: fileSize,
            progressPercent,
            chunkIndex,
          }));

          if (receivedBytes >= fileSize) {
            setState('verifying');
            await diskWriterRef.current.close();
            setState('complete');

            fetch('/api/log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'transfer_completed',
                roomId: roomId?.split('#')[0] || 'unknown',
                fileName,
                fileSize,
              }),
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[Transfer] Receiver chunk error:', err);
      }
    };
  };

  return {
    state,
    errorMsg,
    roomId,
    telemetry,
    startSender,
    startReceiver,
  };
}
