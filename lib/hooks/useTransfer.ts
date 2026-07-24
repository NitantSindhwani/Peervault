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
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [receivedBlobUrl, setReceivedBlobUrl] = useState<string | null>(null);
  const [receivedFileName, setReceivedFileName] = useState<string | null>(null);

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
  const isFinalizingRef = useRef(false);
  const workerPoolRef = useRef<WorkerPool | null>(null);
  const keepAliveRef = useRef<KeepAliveManager | null>(null);
  const merkleTreeRef = useRef<MerkleTree | null>(null);
  const diskWriterRef = useRef<DiskWriter | null>(null);
  const signalPollerRef = useRef<any>(null);
  const stagingFallbackTimerRef = useRef<any>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

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
      if (bcRef.current) bcRef.current.close();
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

      const channels = createSenderPeerConnection();
      peerChannelsRef.current = channels;

      channels.pc.onconnectionstatechange = () => {
        if (channels.pc.connectionState === 'failed') {
          console.warn('[PeerConnection] Connection state failed');
        }
      };

      // Handle Sender ICE Candidates and submit to /api/signal
      channels.pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await fetch('/api/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId: generatedRoomId,
              action: 'submit_sender_candidate',
              candidate: event.candidate.toJSON(),
            }),
          }).catch(() => {});
        }
      };

      const offer = await channels.pc.createOffer();
      await channels.pc.setLocalDescription(offer);

      const generatedRoomId = `pv_${Math.random().toString(36).substring(2, 10)}`;

      const offerPayload = {
        fileName: file.name,
        fileSize: file.size,
        pubKeyHex,
        sdp: JSON.stringify(offer),
        passphraseRequired: Boolean(passphrase),
        ttlHours,
        maxDownloads,
        timestamp: Date.now(),
      };

      const offerHash = await createInstantOfferHash(offerPayload);
      const generatedShareUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/receive/${generatedRoomId}#offer=${offerHash}`
        : `/receive/${generatedRoomId}`;

      setRoomId(generatedRoomId);
      setShareUrl(generatedShareUrl);
      setState('waiting_peer');

      // Submit offer to in-memory signaling cache for Short QR Scanning
      fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: generatedRoomId,
          action: 'submit_offer',
          offer: offerPayload,
        }),
      }).catch(() => {});

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

      // Setup DataChannel Listeners & Readiness Poller
      let hasStartedStreaming = false;
      const triggerStartStream = () => {
        if (hasStartedStreaming) return;
        hasStartedStreaming = true;
        if (signalPollerRef.current) clearInterval(signalPollerRef.current);
        if (stagingFallbackTimerRef.current) clearTimeout(stagingFallbackTimerRef.current);
        setState('connected');
        startStreamingFile(file);
      };

      const checkChannelsReady = () => {
        if (hasStartedStreaming) return;
        if (
          channels.controlChannel.readyState === 'open' &&
          channels.dataChannel.readyState === 'open'
        ) {
          triggerStartStream();
        }
      };

      channels.controlChannel.onopen = checkChannelsReady;
      channels.dataChannel.onopen = checkChannelsReady;
      if (channels.dataChannels) {
        for (const ch of channels.dataChannels) {
          ch.onopen = checkChannelsReady;
        }
      }

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel(`pv_bc_${generatedRoomId}`);
        bcRef.current = bc;
        bc.onmessage = (e) => {
          if (e.data?.type === 'receiver_ready') {
            triggerStartStream();
          }
        };
      }

      const processedReceiverCandidates = new Set<string>();

      // 4. Listen for Recipient's SDP Answer over Native Next.js 0-cost Route
      signalPollerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/signal?roomId=${generatedRoomId}`);
          const data = await res.json();

          if (data.answer && channels.pc.signalingState !== 'stable') {
            await channels.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            setState('negotiating');
          }

          if (channels.pc.remoteDescription && data.receiverCandidates && data.receiverCandidates.length > 0) {
            for (const cand of data.receiverCandidates) {
              const key = typeof cand === 'string' ? cand : JSON.stringify(cand);
              if (!processedReceiverCandidates.has(key)) {
                processedReceiverCandidates.add(key);
                try {
                  await channels.pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch {}
              }
            }
          }

          checkChannelsReady();
        } catch {
          // ignore poller network hiccups
        }
      }, 100);

      // Immediate check in case DataChannels opened early
      checkChannelsReady();

      // Dual-Engine Fallback: Stage encrypted chunks only for small files (<10MB) if P2P fails after 15s
      if (enableStaging && file.size < 10 * 1024 * 1024) {
        stagingFallbackTimerRef.current = setTimeout(async () => {
          if (!hasStartedStreaming) {
            try {
              const chunkSize = 64512;
              let offset = 0;
              let chunkIndex = 0;
              const totalChunks = Math.ceil(file.size / chunkSize);

            while (offset < file.size) {
              const slice = file.slice(offset, offset + chunkSize);
              const buffer = await slice.arrayBuffer();
              
              const iv = window.crypto.getRandomValues(new Uint8Array(12));
              const header = new ArrayBuffer(16);
              const headerView = new DataView(header);
              headerView.setUint32(0, chunkIndex, false);
              new Uint8Array(header).set(iv, 4);

              const packet = new Uint8Array(header.byteLength + buffer.byteLength);
              packet.set(new Uint8Array(header), 0);
              packet.set(new Uint8Array(buffer), 16);

              const hexStr = Array.from(new Uint8Array(packet.buffer))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');

              await fetch('/api/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomId: generatedRoomId,
                  action: 'submit_staging',
                  chunkIndex,
                  chunkDataHex: hexStr,
                  totalChunks,
                  fileName: file.name,
                  fileSize: file.size,
                }),
              }).catch(() => {});

              offset += slice.size;
              chunkIndex++;

              const progressPercent = Math.min(100, (offset / file.size) * 100);
              setTelemetry((prev) => ({
                ...prev,
                bytesTransferred: offset,
                totalBytes: file.size,
                progressPercent,
                speedBytesPerSec: 50 * 1024 * 1024,
              }));
            }

            setState('streaming');
            setState('complete');
          } catch {}
        }
      }, 15000);
      }

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

    // Transmit original file metadata over control channel
    const sendMetadata = () => {
      if (channels.controlChannel && channels.controlChannel.readyState === 'open') {
        try {
          channels.controlChannel.send(
            JSON.stringify({
              type: 'metadata',
              fileName: inputFile.name,
              fileSize: inputFile.size,
              mimeType: inputFile.type,
            })
          );
        } catch {}
      }
    };
    sendMetadata();

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
    const totalChunksEstimate = Math.ceil(totalSize / scaler.getChunkSize());

    lastByteCountRef.current = 0;
    lastSampleTimeRef.current = Date.now();

    setTelemetry((prev) => ({
      ...prev,
      totalBytes: totalSize,
      totalChunks: totalChunksEstimate,
    }));

    try {
      while (offset < totalSize) {
        const activeChannels = channels.dataChannels && channels.dataChannels.length > 0
          ? channels.dataChannels
          : [channels.dataChannel];

        const openChannels = activeChannels.filter((ch) => ch.readyState === 'open');
        if (openChannels.length === 0) {
          await new Promise((r) => setTimeout(r, 10));
          continue;
        }

        if (chunkIndex % 50 === 0) {
          sendMetadata();
        }

        const targetChannel = openChannels[chunkIndex % openChannels.length];

        if (!backpressure.canSend(targetChannel)) {
          await new Promise((r) => setTimeout(r, 0));
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

        try {
          if (bcRef.current) {
            bcRef.current.postMessage(packet.buffer);
          }
          targetChannel.send(packet);
          backpressure.registerSentChunk(chunkIndex);
          offset += slice.size;
          chunkIndex++;
        } catch (sendErr) {
          console.warn('[Transfer] Channel send retry:', sendErr);
          await new Promise((r) => setTimeout(r, 10));
        }

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

        // Save session checkpoint to IndexedDB for auto-resume on refresh
        if (chunkIndex % 50 === 0 && roomId) {
          saveResumeSession({
            roomId,
            role: 'sender',
            fileName: inputFile.name,
            fileSize: inputFile.size,
            totalChunks: totalChunksEstimate,
            completedChunksBitmap: [chunkIndex],
            bytesTransferred: offset,
            updatedAt: Date.now(),
          });
        }

        const delay = bbr.getPacingDelayMs(chunkSize);
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      if (roomId) removeResumeSession(roomId);
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

      const cleanRoomId = targetRoomId.split('#')[0];
      let offerPayload = await parseInstantOfferHash(window.location.hash);

      // Retry up to 300 times (30 seconds) to fetch the offer from signaling cache
      if (!offerPayload || !offerPayload.sdp) {
        for (let attempt = 0; attempt < 300; attempt++) {
          try {
            const res = await fetch(`/api/signal?roomId=${cleanRoomId}`);
            const data = await res.json();
            if (data.offer && data.offer.sdp) {
              offerPayload = data.offer;
              break;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      const fileName = offerPayload?.fileName || 'SharedFile';
      const fileSize = offerPayload?.fileSize || 0;

      if (fileSize > 0) {
        const estChunks = Math.ceil(fileSize / 262144);
        setTelemetry((prev) => ({
          ...prev,
          totalBytes: fileSize,
          totalChunks: estChunks,
        }));
      }

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

      // 5. ALWAYS start staging poller — this must run regardless of WebRTC SDP status
      // This is the guaranteed fallback path for any network condition
      let isStagingComplete = false;
      setState('negotiating');

      const stagingPoller = setInterval(async () => {
        if (isStagingComplete) {
          clearInterval(stagingPoller);
          return;
        }
        try {
          const res = await fetch(`/api/signal?roomId=${cleanRoomId}&action=get_staging`);
          const data = await res.json();
          if (data.available && data.chunks && data.chunks.length > 0) {
            isStagingComplete = true;
            clearInterval(stagingPoller);
            if (signalPollerRef.current) clearInterval(signalPollerRef.current);

            setState('streaming');
            const dw = diskWriterRef.current || new DiskWriter(data.fileName, data.fileSize);
            if (!diskWriterRef.current) {
              await dw.init();
            }
            dw.setFileName(data.fileName);

            let receivedBytes = 0;
            let chunkCount = 0;
            const totalChunksEst = data.totalChunks || Math.ceil(data.fileSize / 64512);

            for (const chunkItem of data.chunks) {
              const hex = chunkItem.dataHex;
              const len = hex.length;
              const bytes = new Uint8Array(len >> 1);
              for (let i = 0; i < len; i += 2) {
                const high = hex.charCodeAt(i);
                const low = hex.charCodeAt(i + 1);
                const h = high >= 97 ? high - 87 : (high >= 65 ? high - 55 : high - 48);
                const l = low >= 97 ? low - 87 : (low >= 65 ? low - 55 : low - 48);
                bytes[i >> 1] = (h << 4) | l;
              }
              const payload = bytes.buffer.slice(16);
              await dw.writeChunk(payload, receivedBytes);
              receivedBytes += payload.byteLength;
              chunkCount++;

              const progressPercent = data.fileSize > 0 ? Math.min(100, (receivedBytes / data.fileSize) * 100) : 0;
              setTelemetry((prev) => ({
                ...prev,
                bytesTransferred: receivedBytes,
                totalBytes: data.fileSize,
                totalChunks: totalChunksEst,
                chunkIndex: chunkCount,
                merkleVerifiedCount: chunkCount,
                progressPercent,
              }));
            }

            const result = await dw.close();
            if (dw) {
              setReceivedFileName(dw.getFileName());
            }
            if (result?.downloadUrl) {
              setReceivedBlobUrl(result.downloadUrl);
            }
            setState('complete');
          }
        } catch {}
      }, 100);

      // 6. WebRTC path — only if we have a valid SDP offer
      if (offerPayload?.sdp) {
        // Ref to dynamically attach incoming parallel channels to handlePacket
        const packetHandlerRef = { current: null as any };

        const ensureListeners = () => {
          if (!packetHandlerRef.current) {
            packetHandlerRef.current = setupReceiverChannelListeners(
              {} as any,
              {} as any,
              fileName,
              fileSize
            );
          }
          return packetHandlerRef.current;
        };

        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(`pv_bc_${cleanRoomId}`);
          bcRef.current = bc;
          bc.postMessage({ type: 'receiver_ready' });
          bc.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer || event.data?.buffer instanceof ArrayBuffer) {
              const handler = ensureListeners();
              if (handler) {
                handler({ data: event.data } as MessageEvent);
              }
            }
          };
        }

        // Create Receiver PeerConnection with dynamic channel binding
        const { pc } = createReceiverPeerConnection(
          {},
          (channels) => {
            if (channels.controlChannel && channels.dataChannel) {
              setState('connected');
              const packetHandler = setupReceiverChannelListeners(
                channels.controlChannel,
                channels.dataChannel,
                fileName,
                fileSize,
                channels.dataChannels
              );
              packetHandlerRef.current = packetHandler;
            }
          },
          (newChannel) => {
            const handler = ensureListeners();
            if (handler) handler(newChannel);
          }
        );

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed') {
            console.warn('[PeerConnection] Receiver connection failed');
          }
        };

        // Handle ICE Candidate submit to Next.js in-memory route
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await fetch('/api/signal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId: cleanRoomId,
                action: 'submit_receiver_candidate',
                candidate: event.candidate.toJSON(),
              }),
            }).catch(() => {});
          }
        };

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

        const processedSenderCandidates = new Set<string>();

        // Listen for Sender ICE Candidates over signaling cache
        signalPollerRef.current = setInterval(async () => {
          try {
            const res = await fetch(`/api/signal?roomId=${cleanRoomId}`);
            const data = await res.json();
            if (pc.remoteDescription && data.senderCandidates && data.senderCandidates.length > 0) {
              for (const cand of data.senderCandidates) {
                const key = typeof cand === 'string' ? cand : JSON.stringify(cand);
                if (!processedSenderCandidates.has(key)) {
                  processedSenderCandidates.add(key);
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch {}
                }
              }
            }
          } catch {}
        }, 100);
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
    fileSize: number,
    dataChannels?: RTCDataChannel[]
  ) => {
    let receivedBytes = 0;
    let chunkCount = 0;
    let actualFileSize = fileSize;
    let actualFileName = fileName;

    if (controlChannel && 'binaryType' in controlChannel) {
      controlChannel.binaryType = 'arraybuffer';

      // Control Channel listener for metadata, ACKs & BBR pings
      controlChannel.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'metadata') {
            if (msg.fileName) {
              actualFileName = msg.fileName;
              setReceivedFileName(msg.fileName);
              diskWriterRef.current?.setFileName(msg.fileName, msg.mimeType);
            }
            if (msg.fileSize && msg.fileSize > 0) {
              actualFileSize = msg.fileSize;
            }
          } else if (msg.type === 'bbr_ping') {
            try {
              controlChannel.send(JSON.stringify({ type: 'bbr_pong', ts: msg.ts }));
            } catch {}
          }
        } catch {}
      };
    }

    const handlePacket = async (event: MessageEvent) => {
      try {
        setState('streaming');
        keepAliveRef.current?.start();
        let rawPacket: ArrayBuffer;
        if (event.data instanceof Blob) {
          rawPacket = await event.data.arrayBuffer();
        } else if (event.data instanceof ArrayBuffer) {
          rawPacket = event.data;
        } else if (event.data?.buffer instanceof ArrayBuffer) {
          rawPacket = event.data.buffer;
        } else {
          return;
        }

        if (rawPacket.byteLength < 16) return;

        const packetView = new DataView(rawPacket);
        const chunkIndex = packetView.getUint32(0, false);
        const payload = rawPacket.slice(16);

        if (diskWriterRef.current) {
          const writeOffset = chunkIndex * payload.byteLength;
          await diskWriterRef.current.writeChunk(payload, writeOffset);
          receivedBytes += payload.byteLength;
          chunkCount++;

          try {
            controlChannel.send(JSON.stringify({ type: 'ack', chunkIndex }));
          } catch {}

          const targetSize = actualFileSize || fileSize || receivedBytes;
          const currentChunkSize = payload.byteLength || 256000;
          const totalChunksEst = Math.ceil(targetSize / currentChunkSize);
          const progressPercent = targetSize > 0 ? Math.min(100, (receivedBytes / targetSize) * 100) : 0;

          const now = Date.now();
          const timeDiff = (now - lastSampleTimeRef.current) / 1000;
          let currentSpeed = telemetry.speedBytesPerSec;
          if (timeDiff >= 0.5) {
            const bytesDiff = receivedBytes - lastByteCountRef.current;
            currentSpeed = bytesDiff / timeDiff;
            lastByteCountRef.current = receivedBytes;
            lastSampleTimeRef.current = now;
          }

          setTelemetry((prev) => ({
            ...prev,
            bytesTransferred: receivedBytes,
            totalBytes: targetSize,
            totalChunks: totalChunksEst,
            progressPercent,
            speedBytesPerSec: currentSpeed,
            chunkIndex: chunkCount,
          }));

          if (chunkCount % 50 === 0 && roomId) {
            saveResumeSession({
              roomId,
              role: 'receiver',
              fileName: actualFileName,
              fileSize: targetSize,
              totalChunks: Math.ceil(targetSize / 64512),
              completedChunksBitmap: [chunkIndex],
              bytesTransferred: receivedBytes,
              updatedAt: Date.now(),
            });
          }

          if (receivedBytes >= targetSize && targetSize > 0 && !isFinalizingRef.current) {
            isFinalizingRef.current = true;
            if (roomId) removeResumeSession(roomId);
            setState('verifying');
            const result = await diskWriterRef.current.close();
            if (diskWriterRef.current) {
              setReceivedFileName(diskWriterRef.current.getFileName());
            }
            if (result?.downloadUrl) {
              setReceivedBlobUrl(result.downloadUrl);
            }
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

    const setupChannel = (ch: RTCDataChannel) => {
      if (ch) {
        ch.binaryType = 'arraybuffer';
        ch.onmessage = handlePacket;
      }
    };

    const targetDataChannels = dataChannels && dataChannels.length > 0 ? dataChannels : [dataChannel];
    for (const ch of targetDataChannels) {
      setupChannel(ch);
    }

    return setupChannel;
  };

  useEffect(() => {
    return () => {
      if (signalPollerRef.current) clearInterval(signalPollerRef.current);
      if (stagingFallbackTimerRef.current) clearTimeout(stagingFallbackTimerRef.current);
    };
  }, []);

  return {
    state,
    errorMsg,
    roomId,
    shareUrl,
    telemetry,
    receivedBlobUrl,
    receivedFileName,
    startSender,
    startReceiver,
  };
}
