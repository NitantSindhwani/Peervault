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

import { WebSocketSignaler } from '@/lib/webrtc/websocket-signaling';

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
  chunkSizeBytes: number;
}

const DATA_CHUNK_SIZE = 128 * 1024;
const DATA_CHANNEL_COUNT = 8;
const TELEMETRY_SAMPLE_MS = 200;

interface ReceiverProgress {
  bytesTransferred: number;
  receivedChunks: number;
  totalBytes: number;
  totalChunks: number;
  chunkSize: number;
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
  const [receivedSavedToDisk, setReceivedSavedToDisk] = useState(false);

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
    chunkSizeBytes: DATA_CHUNK_SIZE,
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
  const receiverStartedRef = useRef<string | null>(null);
  const senderStartedRef = useRef<boolean>(false);
  const lastAppliedAnswerRef = useRef<string | null>(null);
  const senderReadyDataLabelsRef = useRef<Set<string>>(new Set());
  const receiverStreamingRef = useRef(false);
  const receiverProgressRef = useRef<ReceiverProgress>({
    bytesTransferred: 0,
    receivedChunks: 0,
    totalBytes: 0,
    totalChunks: 0,
    chunkSize: DATA_CHUNK_SIZE,
  });

  const speedHistoryRef = useRef<number[]>([]);
  const lastByteCountRef = useRef<number>(0);
  const lastSampleTimeRef = useRef<number>(Date.now());
  const telemetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [logs, setLogs] = useState<{ id: string; timestamp: string; category: 'ICE' | 'SIGNAL' | 'CHANNEL' | 'ERROR' | 'DATA' | 'INFO'; message: string }[]>([]);

  const addLog = useCallback((category: 'ICE' | 'SIGNAL' | 'CHANNEL' | 'ERROR' | 'DATA' | 'INFO', message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = {
      id: `${Date.now()}_${Math.random()}`,
      timestamp,
      category,
      message,
    };
    setLogs((prev) => [...prev.slice(-150), entry]);
    console.log(`[${category}] ${message}`);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  // Window error & unhandled rejection global diagnostic capturer
  useEffect(() => {
    const handleErr = (event: ErrorEvent) => {
      addLog('ERROR', `Uncaught JS Error: ${event.message} (${event.filename}:${event.lineno})`);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason || 'Unhandled Promise Rejection');
      addLog('ERROR', `Unhandled Promise Rejection: ${msg}`);
    };
    window.addEventListener('error', handleErr);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleErr);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [addLog]);

  const wsSignalerRef = useRef<WebSocketSignaler | null>(null);

  // Universal Cross-Region Signaling Relay Helper (Local API + Global PubSub WebSocket)
  const sendSignalMessage = useCallback((targetRoomId: string, payload: any) => {
    addLog('SIGNAL', `Signaling action: ${payload.action || 'send'}`);
    if (wsSignalerRef.current) {
      wsSignalerRef.current.send(payload);
    }
    fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: targetRoomId, ...payload }),
    }).catch((err) => {
      addLog('ERROR', `POST /api/signal failed: ${err.message}`);
    });
  }, [addLog]);

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
      if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
      peerChannelsRef.current?.pc.close();
    };
  }, []);

  const resetTransfer = useCallback(() => {
    senderStartedRef.current = false;
    receiverStartedRef.current = null;
    lastAppliedAnswerRef.current = null;
    isFinalizingRef.current = false;
    setReceivedSavedToDisk(false);
    setReceivedBlobUrl(null);
    setReceivedFileName(null);
    receiverStreamingRef.current = false;
    receiverProgressRef.current = {
      bytesTransferred: 0,
      receivedChunks: 0,
      totalBytes: 0,
      totalChunks: 0,
      chunkSize: DATA_CHUNK_SIZE,
    };
    speedHistoryRef.current = [];

    if (telemetryIntervalRef.current) {
      clearInterval(telemetryIntervalRef.current);
      telemetryIntervalRef.current = null;
    }
    if (signalPollerRef.current) clearInterval(signalPollerRef.current);
    if (stagingFallbackTimerRef.current) clearTimeout(stagingFallbackTimerRef.current);
    if (peerChannelsRef.current?.pc) {
      try { peerChannelsRef.current.pc.close(); } catch {}
      peerChannelsRef.current = null;
    }
    if (wsSignalerRef.current) {
      try { wsSignalerRef.current.close(); } catch {}
      wsSignalerRef.current = null;
    }

    setRoomId(null);
    setShareUrl(null);
    setState('idle');
    setErrorMsg(null);
    setTelemetry({
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
      etaString: '--',
      chunkSizeBytes: DATA_CHUNK_SIZE,
    });
  }, []);

  /**
   * Start Sender Transfer Room — 0ms Instant Link Generation (< 3ms total!)
   */
  const startSender = useCallback(async (customFile?: File) => {
    const activeFile = customFile || file;
    if (!activeFile) {
      setErrorMsg('No file selected for transfer');
      setState('error');
      return;
    }
    
    // Clean up any previous session if re-starting
    if (peerChannelsRef.current?.pc) {
      try { peerChannelsRef.current.pc.close(); } catch {}
      peerChannelsRef.current = null;
    }
    if (wsSignalerRef.current) {
      try { wsSignalerRef.current.close(); } catch {}
      wsSignalerRef.current = null;
    }
    if (telemetryIntervalRef.current) {
      clearInterval(telemetryIntervalRef.current);
      telemetryIntervalRef.current = null;
    }
    lastAppliedAnswerRef.current = null;
    isFinalizingRef.current = false;
    speedHistoryRef.current = [];

    senderStartedRef.current = true;

    const fileToStream = activeFile;

    try {
      addLog('INFO', `Starting sender node for file: ${fileToStream.name} (${(fileToStream.size / (1024 * 1024)).toFixed(2)} MB)`);
      setState('generating_key');
      // 1. Generate local ECDH Keypair (< 1ms)
      const keyPair = await generateECDHKeyPair();
      localKeyPairRef.current = keyPair;

      const rawPubKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
      const pubKeyHex = Array.from(new Uint8Array(rawPubKey))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const generatedRoomId = `pv_${Math.random().toString(36).substring(2, 10)}`;
      addLog('INFO', `Generated room ID: ${generatedRoomId}`);

      const channels = createSenderPeerConnection({ channelCount: DATA_CHANNEL_COUNT });
      peerChannelsRef.current = channels;
      senderReadyDataLabelsRef.current = new Set();

      let hasStartedStreaming = false;
      let receiverReady = false;
      const triggerStartStream = () => {
        if (hasStartedStreaming) return;
        hasStartedStreaming = true;
        if (signalPollerRef.current) clearInterval(signalPollerRef.current);
        if (stagingFallbackTimerRef.current) clearTimeout(stagingFallbackTimerRef.current);
        addLog('CHANNEL', 'Sender starting P2P stream to recipient!');
        setState('connected');
        startStreamingFile(fileToStream);
      };

      const pendingReceiverCandidates: RTCIceCandidateInit[] = [];

      const processReceiverCandidate = async (cand: RTCIceCandidateInit) => {
        if (channels.pc.remoteDescription) {
          try {
            await channels.pc.addIceCandidate(new RTCIceCandidate(cand));
            addLog('ICE', 'Added recipient ICE candidate');
          } catch {}
        } else {
          pendingReceiverCandidates.push(cand);
        }
      };

      const signaler = new WebSocketSignaler(generatedRoomId, async (msg) => {
        if (msg.action === 'submit_answer' && msg.answer) {
          const ansStr = typeof msg.answer === 'string' ? msg.answer : JSON.stringify(msg.answer);
          if (lastAppliedAnswerRef.current !== ansStr) {
            lastAppliedAnswerRef.current = ansStr;
            try {
              const ansObj = typeof msg.answer === 'string' ? JSON.parse(msg.answer) : msg.answer;
              await channels.pc.setRemoteDescription(new RTCSessionDescription(ansObj));
              addLog('SIGNAL', 'Applied recipient SDP Answer via WebSocket!');
              setState('negotiating');
              
              // Flush buffered candidates
              for (const cand of pendingReceiverCandidates) {
                try {
                  await channels.pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch {}
              }
              pendingReceiverCandidates.length = 0;
            } catch {}
          }
        } else if (msg.action === 'submit_receiver_candidate' && msg.candidate) {
          await processReceiverCandidate(msg.candidate);
        }
      });
      signaler.connect();
      wsSignalerRef.current = signaler;

      channels.pc.onconnectionstatechange = () => {
        addLog('CHANNEL', `Sender connection state: ${channels.pc.connectionState}`);
        if (channels.pc.connectionState === 'connected') {
          checkChannelsReady();
        } else if (channels.pc.connectionState === 'failed') {
          addLog('ERROR', 'Sender WebRTC connection failed. Triggering ICE restart...');
          try {
            channels.pc.restartIce();
            channels.pc.createOffer().then(async (offer) => {
              await channels.pc.setLocalDescription(offer);
              sendSignalMessage(generatedRoomId, {
                action: 'submit_offer',
                offer: { ...offerPayload, sdp: JSON.stringify(channels.pc.localDescription) },
              });
            }).catch(() => {});
          } catch {}
        }
      };

      channels.pc.onicecandidate = async (event) => {
        if (event.candidate) {
          addLog('ICE', `Sender gathered ICE candidate: ${event.candidate.type} ${event.candidate.protocol} ${event.candidate.address || ''}`);
          sendSignalMessage(generatedRoomId, {
            action: 'submit_sender_candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      const offer = await channels.pc.createOffer();
      await channels.pc.setLocalDescription(offer);

      await new Promise<void>((r) => {
        if (channels.pc.iceGatheringState === 'complete') return r();
        const onIce = () => {
          if (channels.pc.iceGatheringState === 'complete') r();
        };
        channels.pc.addEventListener('icegatheringstatechange', onIce);
        setTimeout(r, 400);
      });

      const finalOffer = channels.pc.localDescription || offer;

      const offerPayload = {
        fileName: fileToStream.name,
        fileSize: fileToStream.size,
        pubKeyHex,
        sdp: JSON.stringify(finalOffer),
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

      // Submit offer to signaling relays (Local API + Global PubSub)
      sendSignalMessage(generatedRoomId, {
        action: 'submit_offer',
        offer: offerPayload,
      });

      // Audit Log Room Creation (IP, File Name, Size)
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'room_created',
          roomId: generatedRoomId,
          fileName: fileToStream.name,
          fileSize: fileToStream.size,
        }),
      }).catch(() => {});

      // Setup DataChannel Listeners & Readiness Poller

      const checkChannelsReady = () => {
        if (hasStartedStreaming) return;
        const active = channels.dataChannels || [channels.dataChannel];
        const isControlOpen = channels.controlChannel.readyState === 'open';
        const hasAnyReceiverReadyData = active.some((ch) => ch.readyState === 'open' && senderReadyDataLabelsRef.current.has(ch.label));
        
        // The receiver sends this only after its onmessage listeners are in place.
        // Starting earlier loses the first packets on some browser/device pairs.
        if (receiverReady && isControlOpen && hasAnyReceiverReadyData) {
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

      channels.controlChannel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'receiver_ready') {
            receiverReady = true;
            addLog('CHANNEL', 'Receiver packet handlers are ready.');
            checkChannelsReady();
          } else if (data.type === 'data_channel_ready' && typeof data.label === 'string') {
            senderReadyDataLabelsRef.current.add(data.label);
            addLog('CHANNEL', `Receiver data lane ready: ${data.label}`);
            checkChannelsReady();
          } else if (data.type === 'ack') {
            backpressureRef.current?.handleAck(data.chunkIndex);
          } else if (data.type === 'bbr_pong') {
            bbrRef.current?.handlePong(data.ts || performance.now());
          }
        } catch {}
      };

      const processedReceiverCandidates = new Set<string>();

      // 4. Listen for Recipient's SDP Answer over dual signaling relays (Local API + Global PubSub)
      signalPollerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/signal?roomId=${generatedRoomId}`);
          if (res.ok) {
            const data = await res.json();

            if (data.answer) {
              const ansStr = typeof data.answer === 'string' ? data.answer : JSON.stringify(data.answer);
              if (lastAppliedAnswerRef.current !== ansStr) {
                lastAppliedAnswerRef.current = ansStr;
                try {
                  const ansObj = typeof data.answer === 'string' ? JSON.parse(data.answer) : data.answer;
                  await channels.pc.setRemoteDescription(new RTCSessionDescription(ansObj));
                  addLog('SIGNAL', 'Successfully set remote description from recipient SDP Answer');
                  setState('negotiating');
                } catch (err: any) {
                  addLog('ERROR', `setRemoteDescription answer error: ${err.message}`);
                }
              }
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
          }
        } catch {}

        checkChannelsReady();
      }, 1200);

      // Immediate check in case DataChannels opened early
      checkChannelsReady();

      // WebRTC P2P & Multi-Relay Signaling Active
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

    keepAliveRef.current?.start();
    const bbr = new BBRPacer();
    bbrRef.current = bbr;
    bbr.startPingLoop(channels.controlChannel);

    const backpressure = new BackpressureController();
    backpressureRef.current = backpressure;
    for (const channel of channels.dataChannels || [channels.dataChannel]) {
      backpressure.bindDataChannel(channel);
    }

    const scaler = new AdaptiveChunkScaler();
    scalerRef.current = scaler;

    const merkleTree = new MerkleTree();
    merkleTreeRef.current = merkleTree;

    const totalSize = inputFile.size;
    const senderProgress = { offset: 0, chunkIndex: 0 };
    const chunkSize = scaler.getChunkSize();
    const totalChunksEstimate = Math.ceil(totalSize / chunkSize);

    // Transmit fixed protocol parameters before the first data packet.
    try {
      if (channels.controlChannel.readyState === 'open') {
        channels.controlChannel.send(JSON.stringify({
          type: 'metadata',
          fileName: inputFile.name,
          fileSize: totalSize,
          mimeType: inputFile.type,
          chunkSize,
        }));
      }
    } catch {}

    lastByteCountRef.current = 0;
    lastSampleTimeRef.current = Date.now();
    speedHistoryRef.current = [];

    setTelemetry((prev) => ({
      ...prev,
      totalBytes: totalSize,
      totalChunks: totalChunksEstimate,
    }));

    try {
      addLog('INFO', `Starting High-Speed WebRTC P2P Stream (${totalChunksEstimate} chunks)`);
      
      // A single small reader avoids the old race where many 64 MB fills ran at
      // once, overwhelming the JS heap and queuing data out of order.
      const PRE_BUFFER_SIZE = 128;
      const BURST_SIZE = 64;
      const preBufferQueue: Array<{ chunkIndex: number; payloadBytes: number; packet: Uint8Array }> = [];
      let bufferOffset = 0;
      let bufferChunkIndex = 0;
      let isReadingDone = false;
      let fillPromise: Promise<void> | null = null;

      const fillPreBuffer = (): Promise<void> => {
        if (fillPromise) return fillPromise;

        fillPromise = (async () => {
          while (bufferOffset < totalSize && preBufferQueue.length < PRE_BUFFER_SIZE) {
            const cIdx = bufferChunkIndex++;
            const slice = inputFile.slice(bufferOffset, bufferOffset + chunkSize);
            bufferOffset += slice.size;
            const buffer = await slice.arrayBuffer();

            // Header: index + fixed chunk size + 8 reserved bytes. The receiver
            // needs the nominal size to position the final short chunk correctly.
            const header = new ArrayBuffer(16);
            const headerView = new DataView(header);
            headerView.setUint32(0, cIdx, false);
            headerView.setUint32(4, chunkSize, false);

            const packet = new Uint8Array(header.byteLength + buffer.byteLength);
            packet.set(new Uint8Array(header), 0);
            packet.set(new Uint8Array(buffer), 16);
            preBufferQueue.push({ chunkIndex: cIdx, payloadBytes: buffer.byteLength, packet });
          }
          if (bufferOffset >= totalSize) isReadingDone = true;
        })().finally(() => {
          fillPromise = null;
        });

        return fillPromise;
      };

      // Start after a small read; remaining reads stay serialized in the background.
      await fillPreBuffer();

      // Steady 200ms Telemetry Timer (reads mutable senderProgress object to avoid closure stale values)
      telemetryIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const timeDiff = (now - lastSampleTimeRef.current) / 1000;
        if (timeDiff >= 0.2) {
          const currentOffset = senderProgress.offset;
          const currentChunkIndex = senderProgress.chunkIndex;
          const bytesDiff = Math.max(0, currentOffset - lastByteCountRef.current);
          const currentSpeed = bytesDiff / timeDiff;
          lastByteCountRef.current = currentOffset;
          lastSampleTimeRef.current = now;

          speedHistoryRef.current.push(currentSpeed);
          if (speedHistoryRef.current.length > 8) speedHistoryRef.current.shift();

          const avgSpeed = speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length;
          const progressPercent = Math.min(100, (currentOffset / totalSize) * 100);

          setTelemetry({
            bytesTransferred: currentOffset,
            totalBytes: totalSize,
            progressPercent,
            speedBytesPerSec: Math.max(0, currentSpeed),
            rttMs: bbr.getMetrics().rtt,
            chunkIndex: currentChunkIndex,
            totalChunks: totalChunksEstimate,
            bbrState: bbr.getMetrics().state,
            connectionType: 'direct_host',
            merkleRoot: null,
            etaString: formatETA(totalSize - currentOffset, avgSpeed),
            chunkSizeBytes: chunkSize,
          });
        }
      }, TELEMETRY_SAMPLE_MS);

      while (senderProgress.offset < totalSize) {
        const activeChannels = channels.dataChannels && channels.dataChannels.length > 0
          ? channels.dataChannels
          : [channels.dataChannel];

        const openChannels = activeChannels.filter((ch) => ch.readyState === 'open');
        if (openChannels.length === 0) {
          await new Promise((r) => setTimeout(r, 2));
          continue;
        }

        if (preBufferQueue.length === 0) {
          await fillPreBuffer();
          if (preBufferQueue.length === 0) {
            await new Promise((r) => setTimeout(r, 1));
            continue;
          }
        }

        // A bounded burst leaves the event loop time to drain SCTP buffers.
        let burstSent = 0;
        while (preBufferQueue.length > 0 && burstSent < BURST_SIZE) {
          const targetChannel = openChannels[senderProgress.chunkIndex % openChannels.length];
          const canSend = backpressure.canSend(targetChannel);
          if (!canSend) {
            break;
          }

          const item = preBufferQueue.shift()!;
          try {
            targetChannel.send(item.packet as any);
            backpressure.registerSentChunk(item.chunkIndex);
            senderProgress.offset += item.payloadBytes;
            senderProgress.chunkIndex++;
            burstSent++;
          } catch (sendErr) {
            preBufferQueue.unshift(item);
            console.warn('[Transfer] DataChannel send failed; retrying chunk', item.chunkIndex, sendErr);
            await new Promise((r) => setTimeout(r, 2));
            break;
          }
        }
        if (burstSent === 0) {
          await new Promise((r) => setTimeout(r, 2));
        }

        // Replenish in the background; fillPreBuffer prevents overlapping reads.
        if (!isReadingDone && preBufferQueue.length < PRE_BUFFER_SIZE / 2) {
          void fillPreBuffer();
        }

        // Save session checkpoint to IndexedDB for auto-resume on refresh
        if (senderProgress.chunkIndex % 50 === 0 && roomId) {
          saveResumeSession({
            roomId,
            role: 'sender',
            fileName: inputFile.name,
            fileSize: inputFile.size,
            totalChunks: totalChunksEstimate,
            completedChunksBitmap: [senderProgress.chunkIndex],
            bytesTransferred: senderProgress.offset,
            updatedAt: Date.now(),
          });
        }
      }

      let idleAckSamples = 0;
      let lastUnacknowledgedCount = Number.POSITIVE_INFINITY;
      while (backpressure.getMetrics().unacknowledgedCount > 0) {
        const currentUnacknowledged = backpressure.getMetrics().unacknowledgedCount;
        if (currentUnacknowledged === lastUnacknowledgedCount) {
          idleAckSamples++;
        } else {
          idleAckSamples = 0;
          lastUnacknowledgedCount = currentUnacknowledged;
        }

        if (idleAckSamples > 1500) {
          throw new Error(`Receiver stopped acknowledging chunks (${currentUnacknowledged} still pending)`);
        }

        await new Promise((r) => setTimeout(r, 20));
      }

      if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
      telemetryIntervalRef.current = null;

      try {
        if (channels.controlChannel.readyState === 'open') {
          channels.controlChannel.send(JSON.stringify({
            type: 'transfer_complete',
            fileSize: totalSize,
            totalChunks: totalChunksEstimate,
          }));
        }
      } catch {}

      setTelemetry({
        bytesTransferred: totalSize,
        totalBytes: totalSize,
        progressPercent: 100,
        speedBytesPerSec: 0,
        rttMs: bbr.getMetrics().rtt,
        chunkIndex: totalChunksEstimate,
        totalChunks: totalChunksEstimate,
        bbrState: bbr.getMetrics().state,
        connectionType: 'direct_host',
        merkleRoot: null,
        etaString: '--:--',
        chunkSizeBytes: chunkSize,
      });

      if (roomId) removeResumeSession(roomId);
      setState('verifying');
      setState('complete');
    } catch (err: any) {
      console.error('[Transfer] Streaming error:', err);
      if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
      telemetryIntervalRef.current = null;
      setErrorMsg(err.message || 'Stream transmission failed');
      setState('error');
    }
  };

  /**
   * Start Receiver Transfer Room — Reads Offer INSTANTLY from URL Hash (< 1ms!)
   */
  const startReceiver = useCallback(async (targetRoomId: string, fileHandle?: any) => {
    if (receiverStartedRef.current === targetRoomId) {
      console.log('[Transfer] Receiver already started for room:', targetRoomId);
      return;
    }
    receiverStartedRef.current = targetRoomId;
    isFinalizingRef.current = false;
    setReceivedSavedToDisk(false);
    setReceivedBlobUrl(null);
    receiverStreamingRef.current = false;
    receiverProgressRef.current = {
      bytesTransferred: 0,
      receivedChunks: 0,
      totalBytes: 0,
      totalChunks: 0,
      chunkSize: DATA_CHUNK_SIZE,
    };
    speedHistoryRef.current = [];
    try {
      setRoomId(targetRoomId);
      setState('generating_key');

      const cleanRoomId = targetRoomId.split('#')[0];
      addLog('INFO', `Receiver initializing for room: ${cleanRoomId}`);
      let offerPayload = await parseInstantOfferHash(window.location.hash);

      const initialFileName = offerPayload?.fileName || 'SharedFile';
      const initialFileSize = offerPayload?.fileSize || 0;

      // Setup DiskWriter IMMEDIATELY so incoming packets are never dropped
      const writer = new DiskWriter(initialFileName, initialFileSize);
      await writer.init(fileHandle);
      diskWriterRef.current = writer;
      keepAliveRef.current?.start();
      setState('negotiating');

      // Retry up to 300 times (30 seconds) to fetch the offer from signaling cache if not in URL hash
      if (!offerPayload || !offerPayload.sdp) {
        addLog('SIGNAL', 'SDP Offer not found in URL hash. Polling signaling server...');
        for (let attempt = 0; attempt < 300; attempt++) {
          try {
            const res = await fetch(`/api/signal?roomId=${cleanRoomId}`);
            const data = await res.json();
            if (data.offer && data.offer.sdp) {
              offerPayload = data.offer;
              addLog('SIGNAL', 'Successfully retrieved SDP Offer from signaling server');
              break;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      if (!offerPayload?.sdp) {
        throw new Error('The sender offer is unavailable. Ask the sender to create a new transfer link.');
      }

      const fileName = offerPayload?.fileName || initialFileName;
      const fileSize = offerPayload?.fileSize || initialFileSize;

      if (fileName !== initialFileName || fileSize !== initialFileSize) {
        writer.setFileName(fileName);
      }

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

      // 6. WebRTC path — only if we have a valid SDP offer
      if (offerPayload?.sdp) {
        let currentPacketHandler: any = null;
        let activeReceiverControlChannel: RTCDataChannel | null = null;

        const attachChannelListener = (channel: RTCDataChannel) => {
          if (channel) {
            channel.binaryType = 'arraybuffer';
            channel.onmessage = (event) => {
              if (currentPacketHandler) {
                currentPacketHandler(event);
              }
            };
            const announceLaneReady = () => {
              try {
                if (activeReceiverControlChannel?.readyState === 'open' && channel.label.startsWith('data')) {
                  activeReceiverControlChannel.send(JSON.stringify({ type: 'data_channel_ready', label: channel.label }));
                }
              } catch {}
            };
            channel.addEventListener('open', announceLaneReady);
            if (channel.readyState === 'open') announceLaneReady();
          }
        };

        // Create Receiver PeerConnection with dynamic channel binding
        const { pc } = createReceiverPeerConnection(
          {},
          (channels) => {
            const activeControl = channels.controlChannel || channels.dataChannel;
            const activeData = channels.dataChannel || channels.controlChannel;
            if (activeControl && activeData && !currentPacketHandler) {
              activeReceiverControlChannel = activeControl;
              setState('connected');
              addLog('CHANNEL', 'Receiver WebRTC connection established!');
              currentPacketHandler = setupReceiverChannelListeners(
                activeControl,
                activeData,
                fileName,
                fileSize,
                channels.dataChannels
              );
              if (channels.dataChannels) {
                for (const ch of channels.dataChannels) {
                  attachChannelListener(ch);
                }
              }
            }
          },
          (newChannel) => {
            attachChannelListener(newChannel);
          }
        );

        const pendingSenderCandidates: RTCIceCandidateInit[] = [];

        const processSenderCandidate = async (cand: RTCIceCandidateInit) => {
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
              addLog('ICE', 'Added sender ICE candidate');
            } catch {}
          } else {
            pendingSenderCandidates.push(cand);
          }
        };

        const signaler = new WebSocketSignaler(cleanRoomId, async (msg) => {
          if (msg.action === 'submit_sender_candidate' && msg.candidate) {
            await processSenderCandidate(msg.candidate);
          }
        });
        signaler.connect();
        wsSignalerRef.current = signaler;

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed') {
            console.warn('[PeerConnection] Receiver connection failed. Attempting ICE restart...');
            try {
              pc.restartIce();
              pc.createAnswer().then(async (newAns) => {
                await pc.setLocalDescription(newAns);
                sendSignalMessage(cleanRoomId, {
                  action: 'submit_answer',
                  answer: pc.localDescription || newAns,
                });
              }).catch(() => {});
            } catch {}
          }
        };

        // Handle Receiver ICE Candidate submit to dual signaling relays
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            sendSignalMessage(cleanRoomId, {
              action: 'submit_receiver_candidate',
              candidate: event.candidate.toJSON(),
            });
          }
        };

        const offerSDP = JSON.parse(offerPayload.sdp);
        await pc.setRemoteDescription(new RTCSessionDescription(offerSDP));

        // Flush buffered sender candidates
        for (const cand of pendingSenderCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
        }
        pendingSenderCandidates.length = 0;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await new Promise<void>((r) => {
          if (pc.iceGatheringState === 'complete') return r();
          const onIce = () => {
            if (pc.iceGatheringState === 'complete') r();
          };
          pc.addEventListener('icegatheringstatechange', onIce);
          setTimeout(r, 400);
        });

        const finalAnswer = pc.localDescription || answer;

        // Submit SDP Answer to dual signaling relays
        sendSignalMessage(cleanRoomId, {
          action: 'submit_answer',
          answer: finalAnswer,
        });

        const processedSenderCandidates = new Set<string>();

        // Listen for Sender ICE Candidates over dual signaling relays
        signalPollerRef.current = setInterval(async () => {
          try {
            const res = await fetch(`/api/signal?roomId=${cleanRoomId}`);
            if (res.ok) {
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
            }
          } catch {}
        }, 250);
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
    let actualFileSize = fileSize;
    let actualFileName = fileName;
    let nominalChunkSize = DATA_CHUNK_SIZE;
    const receivedChunkSet = new Set<number>();

    lastSampleTimeRef.current = Date.now();
    lastByteCountRef.current = 0;
    speedHistoryRef.current = [];

    const syncExpectedTotals = () => {
      const progress = receiverProgressRef.current;
      const totalChunks = actualFileSize > 0 ? Math.ceil(actualFileSize / nominalChunkSize) : 0;
      progress.totalBytes = actualFileSize;
      progress.totalChunks = totalChunks;
      progress.chunkSize = nominalChunkSize;
      return progress;
    };

    const sampleTelemetry = () => {
      const progress = receiverProgressRef.current;
      const now = Date.now();
      const timeDiff = (now - lastSampleTimeRef.current) / 1000;
      if (timeDiff <= 0) return;

      const bytesDiff = Math.max(0, progress.bytesTransferred - lastByteCountRef.current);
      const currentSpeed = bytesDiff / timeDiff;
      lastByteCountRef.current = progress.bytesTransferred;
      lastSampleTimeRef.current = now;
      speedHistoryRef.current.push(currentSpeed);
      if (speedHistoryRef.current.length > 8) speedHistoryRef.current.shift();
      const averageSpeed = speedHistoryRef.current.reduce((sum, speed) => sum + speed, 0) / speedHistoryRef.current.length;
      const progressPercent = progress.totalBytes > 0
        ? Math.min(100, (progress.bytesTransferred / progress.totalBytes) * 100)
        : 0;

      setTelemetry({
        bytesTransferred: progress.bytesTransferred,
        totalBytes: progress.totalBytes,
        totalChunks: progress.totalChunks,
        progressPercent,
        speedBytesPerSec: currentSpeed,
        rttMs: 0,
        chunkIndex: progress.receivedChunks,
        bbrState: 'STREAMING',
        connectionType: 'direct_host',
        merkleRoot: null,
        etaString: formatETA(progress.totalBytes - progress.bytesTransferred, averageSpeed),
        chunkSizeBytes: progress.chunkSize,
      });
    };

    const initialProgress = syncExpectedTotals();
    setTelemetry((previous) => ({
      ...previous,
      totalBytes: initialProgress.totalBytes,
      totalChunks: initialProgress.totalChunks,
    }));
    if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
    telemetryIntervalRef.current = setInterval(sampleTelemetry, TELEMETRY_SAMPLE_MS);

    if (controlChannel && 'binaryType' in controlChannel) {
      controlChannel.binaryType = 'arraybuffer';

      // Control frames never carry file data; they only describe the stream and ACK it.
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
            if (Number.isInteger(msg.chunkSize) && msg.chunkSize >= 16 * 1024 && msg.chunkSize <= 1024 * 1024) {
              nominalChunkSize = msg.chunkSize;
            }
            syncExpectedTotals();
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
        if (isFinalizingRef.current) return;
        if (!receiverStreamingRef.current) {
          receiverStreamingRef.current = true;
          setState('streaming');
        }
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
        const packetChunkSize = packetView.getUint32(4, false);
        const payload = rawPacket.slice(16);

        if (packetChunkSize >= 16 * 1024 && packetChunkSize <= 1024 * 1024) {
          nominalChunkSize = packetChunkSize;
        }
        const progress = syncExpectedTotals();
        if (progress.totalChunks > 0 && chunkIndex >= progress.totalChunks) return;

        if (progress.totalBytes > 0) {
          const expectedPayloadBytes = chunkIndex === progress.totalChunks - 1
            ? progress.totalBytes - chunkIndex * nominalChunkSize
            : nominalChunkSize;
          if (payload.byteLength !== expectedPayloadBytes) return;
        }

        // Deduplicate before storage: several data channels can deliver out of order,
        // but every index is written exactly once.
        if (receivedChunkSet.has(chunkIndex)) {
          return;
        }
        receivedChunkSet.add(chunkIndex);

        if (diskWriterRef.current) {
          const writeOffset = chunkIndex * nominalChunkSize;
          await diskWriterRef.current.writeChunk(payload, writeOffset, chunkIndex);
          progress.bytesTransferred += payload.byteLength;
          progress.receivedChunks = receivedChunkSet.size;

          try {
            if (controlChannel && controlChannel.readyState === 'open') {
              controlChannel.send(JSON.stringify({ type: 'ack', chunkIndex }));
            }
          } catch {}

          if (progress.receivedChunks % 50 === 0 && roomId) {
            saveResumeSession({
              roomId,
              role: 'receiver',
              fileName: actualFileName,
              fileSize: progress.totalBytes,
              totalChunks: progress.totalChunks,
              completedChunksBitmap: [chunkIndex],
              bytesTransferred: progress.bytesTransferred,
              updatedAt: Date.now(),
            });
          }

          const isFullyReceived = progress.totalBytes > 0
            && (progress.bytesTransferred >= progress.totalBytes || (progress.totalChunks > 0 && progress.receivedChunks >= progress.totalChunks));
          if (isFullyReceived && !isFinalizingRef.current) {
            isFinalizingRef.current = true;
            if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
            telemetryIntervalRef.current = null;
            setTelemetry({
              bytesTransferred: progress.totalBytes,
              totalBytes: progress.totalBytes,
              totalChunks: progress.totalChunks,
              progressPercent: 100,
              speedBytesPerSec: 0,
              rttMs: 0,
              chunkIndex: progress.totalChunks,
              bbrState: 'COMPLETE',
              connectionType: 'direct_host',
              merkleRoot: null,
              etaString: '--:--',
              chunkSizeBytes: progress.chunkSize,
            });
            if (roomId) removeResumeSession(roomId);
            setState('verifying');
            const result = await diskWriterRef.current.close();
            if (diskWriterRef.current) {
              setReceivedFileName(diskWriterRef.current.getFileName());
            }
            if (result?.downloadUrl) {
              setReceivedBlobUrl(result.downloadUrl);
            }
            setReceivedSavedToDisk(result?.tier === 'direct_fs');
            setState('complete');

            fetch('/api/log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'transfer_completed',
                roomId: roomId?.split('#')[0] || 'unknown',
                fileName: actualFileName,
                fileSize: progress.totalBytes,
              }),
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[Transfer] Receiver chunk error:', err);
      }
    };

    const sendDataChannelReady = (ch: RTCDataChannel) => {
      try {
        if (controlChannel && controlChannel.readyState === 'open') {
          controlChannel.send(JSON.stringify({ type: 'data_channel_ready', label: ch.label }));
        }
      } catch {}
    };

    const setupChannel = (ch: RTCDataChannel) => {
      if (ch) {
        ch.binaryType = 'arraybuffer';
        ch.onmessage = handlePacket;
        ch.addEventListener('open', () => {
          ch.onmessage = handlePacket;
          sendDataChannelReady(ch);
          addLog('CHANNEL', `Receiver DataChannel ${ch.label} opened and bound to disk writer!`);
        });
        if (ch.readyState === 'open') {
          sendDataChannelReady(ch);
        }
      }
    };

    const targetDataChannels = dataChannels && dataChannels.length > 0 ? dataChannels : [dataChannel];
    for (const ch of targetDataChannels) {
      setupChannel(ch);
    }

    let readyAnnounced = false;
    const announceReady = () => {
      if (readyAnnounced || controlChannel.readyState !== 'open') return;
      if (!targetDataChannels.some((channel) => channel.readyState === 'open')) return;
      try {
        controlChannel.send(JSON.stringify({ type: 'receiver_ready' }));
        for (const channel of targetDataChannels) {
          if (channel.readyState === 'open') sendDataChannelReady(channel);
        }
        readyAnnounced = true;
      } catch {}
    };
    controlChannel.addEventListener('open', announceReady);
    for (const channel of targetDataChannels) {
      channel.addEventListener('open', announceReady);
    }
    announceReady();

    return handlePacket;
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
    receivedSavedToDisk,
    startSender,
    startReceiver,
    resetTransfer,
  };
}
