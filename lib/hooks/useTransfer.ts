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
import { compressChunk, decompressChunk } from '@/lib/crypto/compression';

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

const DATA_CHUNK_SIZE = 128 * 1024;  // 128 KB – optimal for WebRTC throughput
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
  const compressionEnabledRef = useRef<boolean>(true);
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
  const connectionTypeRef = useRef<string>('direct_host');
  const statsPollerRef = useRef<any>(null);

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

  const startConnectionStatsPoller = useCallback((pc: RTCPeerConnection) => {
    if (statsPollerRef.current) clearInterval(statsPollerRef.current);
    statsPollerRef.current = setInterval(async () => {
      if (pc.signalingState === 'closed') {
        clearInterval(statsPollerRef.current);
        return;
      }
      try {
        const stats = await pc.getStats();
        let isRelay = false;
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            const local = stats.get(report.localCandidateId);
            if (local && local.candidateType === 'relay') isRelay = true;
            const remote = stats.get(report.remoteCandidateId);
            if (remote && remote.candidateType === 'relay') isRelay = true;
          }
        });
        connectionTypeRef.current = isRelay ? 'relay' : 'direct_host';
      } catch (err) {}
    }, 2000);
  }, []);

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

  const wakeLockSentinelRef = useRef<any>(null);

  const acquireWakeLock = useCallback(async () => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockSentinelRef.current = await (navigator as any).wakeLock.request('screen');
      } catch {}
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockSentinelRef.current) {
      try {
        wakeLockSentinelRef.current.release();
      } catch {}
      wakeLockSentinelRef.current = null;
    }
  }, []);

  // Automatically acquire Screen WakeLock on active transfer states to prevent mobile CPU/Wi-Fi throttling
  useEffect(() => {
    if (state === 'streaming' || state === 'waiting_peer' || state === 'signaling') {
      acquireWakeLock();
    } else if (state === 'complete' || state === 'error' || state === 'aborted' || state === 'idle') {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (state === 'streaming' || state === 'waiting_peer')) {
        acquireWakeLock();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [state, acquireWakeLock, releaseWakeLock]);

  // Initialize WorkerPool and KeepAlive
  useEffect(() => {
    workerPoolRef.current = new WorkerPool(3);
    workerPoolRef.current.init();
    keepAliveRef.current = new KeepAliveManager();

    return () => {
      releaseWakeLock();
      workerPoolRef.current?.terminate();
      keepAliveRef.current?.stop();
      bbrRef.current?.stopPingLoop();
      if (signalPollerRef.current) clearInterval(signalPollerRef.current);
      if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
      if (statsPollerRef.current) clearInterval(statsPollerRef.current);
      peerChannelsRef.current?.pc.close();
    };
  }, [releaseWakeLock]);

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
    if (statsPollerRef.current) clearInterval(statsPollerRef.current);
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
      connectionType: connectionTypeRef.current,
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
    if (senderStartedRef.current && peerChannelsRef.current?.pc?.connectionState !== 'closed') {
      console.warn('[Transfer] startSender already active, ignoring duplicate call.');
      return;
    }
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
    compressionEnabledRef.current = true;

    const fileToStream = activeFile;

    try {
      addLog('INFO', `Starting sender node for file: ${fileToStream.name} (${(fileToStream.size / (1024 * 1024)).toFixed(2)} MB)`);
      setState('generating_key');
      // 1. Generate local ECDH Keypair (< 1ms)
      const keyPair = await generateECDHKeyPair();
      localKeyPairRef.current = keyPair;

      const pubKeyHex = Array.from(new Uint8Array(keyPair.rawPublicKey))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const generatedRoomId = `pv_${Math.random().toString(36).substring(2, 10)}`;
      addLog('INFO', `Generated room ID: ${generatedRoomId}`);

      const channels = createSenderPeerConnection({ channelCount: DATA_CHANNEL_COUNT });
      peerChannelsRef.current = channels;
      startConnectionStatsPoller(channels.pc);
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

      // Embed the compressed SDP offer directly into the URL hash so the receiver
      // can get it entirely client-side — zero dependency on a shared server cache.
      // This is the ONLY reliable method for cross-device signaling on serverless
      // deployments where each HTTP request may hit a different process instance.
      const offerHash = await createInstantOfferHash(offerPayload);
      const generatedShareUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/receive/${generatedRoomId}#offer=${offerHash}`
        : `/receive/${generatedRoomId}#offer=${offerHash}`;

      // Initialise the sender WebSocketSignaler NOW (before sendSignalMessage is
      // called) so the relay broadcast goes out and so the sender can receive the
      // receiver's SDP answer over WebSocket when HTTP-polling hits a cold instance.
      const senderSignaler = new WebSocketSignaler(generatedRoomId, async (msg: any) => {
        if (msg.action === 'submit_answer' && msg.answer) {
          const ansStr = typeof msg.answer === 'string' ? msg.answer : JSON.stringify(msg.answer);
          if (lastAppliedAnswerRef.current !== ansStr && !channels.pc.remoteDescription) {
            lastAppliedAnswerRef.current = ansStr;
            try {
              const ansObj = typeof msg.answer === 'string' ? JSON.parse(msg.answer) : msg.answer;
              await channels.pc.setRemoteDescription(new RTCSessionDescription(ansObj));
              addLog('SIGNAL', 'Received SDP Answer via WebSocket relay — connection live!');
              setState('negotiating');
              // Flush any ICE candidates that arrived before the answer
              for (const cand of pendingReceiverCandidates) {
                try { await channels.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
              }
              pendingReceiverCandidates.length = 0;
            } catch (err: any) {
              addLog('ERROR', `setRemoteDescription (ws relay): ${err.message}`);
            }
          }
        } else if (msg.action === 'submit_receiver_candidate' && msg.candidate) {
          await processReceiverCandidate(msg.candidate);
        }
      });
      senderSignaler.connect();
      wsSignalerRef.current = senderSignaler;

      setRoomId(generatedRoomId);
      setShareUrl(generatedShareUrl);
      setState('waiting_peer');
      
      // Also log actual file size now
      addLog('INFO', `File ready: ${fileToStream.name} (${(fileToStream.size / (1024 * 1024)).toFixed(2)} MB)`);
      setTelemetry((prev) => ({
        ...prev,
        totalBytes: fileToStream.size,
      }));

      // Submit offer to signaling relays (Local API + Global PubSub)
      // wsSignalerRef.current is now set, so this also broadcasts via WebSocket.
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

      // Stream starts when control + any data channel are open.
      // We do NOT wait for receiver_ready — if that message is lost, the transfer
      // would hang forever at "negotiating". Instead we use a generous 3-second
      // fallback: if channels are open but receiver_ready never arrives, start anyway.
      let readyFallbackTimer: ReturnType<typeof setTimeout> | null = null;

      const checkChannelsReady = () => {
        if (hasStartedStreaming) return;
        const active = channels.dataChannels || [channels.dataChannel];
        const isControlOpen = channels.controlChannel.readyState === 'open';
        const hasAnyOpenData = active.some((ch) => ch.readyState === 'open');

        if (isControlOpen && hasAnyOpenData) {
          if (receiverReady) {
            // Receiver confirmed it's listening — start immediately
            addLog('CHANNEL', 'Receiver ready confirmed. Starting stream.');
            if (readyFallbackTimer) clearTimeout(readyFallbackTimer);
            triggerStartStream();
          } else if (!readyFallbackTimer) {
            // Start a 3-second grace period. If receiver_ready never arrives, start anyway.
            addLog('CHANNEL', 'Channels open. Waiting up to 3s for receiver_ready...');
            readyFallbackTimer = setTimeout(() => {
              if (!hasStartedStreaming) {
                addLog('CHANNEL', 'receiver_ready timeout — starting stream anyway.');
                triggerStartStream();
              }
            }, 3000);
          }
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
            if (data.compressionSupported === false) {
              compressionEnabledRef.current = false;
              addLog('INFO', 'Receiver does not support CompressionStream. Disabling compression.');
            }
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

      let lastOfferPushTime = Date.now();
      const processedReceiverCandidates = new Set<string>();

      // 4. Listen for Recipient's SDP Answer over dual signaling relays (Local API + Global PubSub)
      signalPollerRef.current = setInterval(async () => {
        // Continuously refresh offer registration on signaling cache every 1.5s while waiting for recipient
        if (!channels.pc.remoteDescription && Date.now() - lastOfferPushTime > 1500) {
          lastOfferPushTime = Date.now();
          sendSignalMessage(generatedRoomId, {
            action: 'submit_offer',
            offer: offerPayload,
          });
        }

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
                  // Flush any ICE candidates that arrived before the answer
                  for (const cand of pendingReceiverCandidates) {
                    try { await channels.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
                  }
                  pendingReceiverCandidates.length = 0;
                } catch (err: any) {
                  addLog('ERROR', `setRemoteDescription answer error: ${err.message}`);
                }
              }
            }

            if (data.receiverCandidates && data.receiverCandidates.length > 0) {
              for (const cand of data.receiverCandidates) {
                const key = typeof cand === 'string' ? cand : JSON.stringify(cand);
                if (!processedReceiverCandidates.has(key)) {
                  processedReceiverCandidates.add(key);
                  await processReceiverCandidate(cand);
                }
              }
            }
          }
        } catch {}

        checkChannelsReady();
      }, 250);

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
    const metadataMsg = JSON.stringify({
      type: 'metadata',
      fileName: inputFile.name,
      fileSize: totalSize,
      mimeType: inputFile.type,
      chunkSize,
    });
    let metadataSent = false;
    for (let metaAttempt = 0; metaAttempt < 5 && !metadataSent; metaAttempt++) {
      try {
        if (channels.controlChannel.readyState === 'open') {
          channels.controlChannel.send(metadataMsg);
          metadataSent = true;
          addLog('INFO', 'File metadata sent to receiver.');
        }
      } catch {}
      if (!metadataSent) await new Promise(r => setTimeout(r, 200));
    }
    if (!metadataSent) addLog('ERROR', 'Failed to send metadata after 5 attempts.');

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
      
      let compressionSampled = false;

      // Disable compression for known incompressible formats
      if (
        inputFile.type.startsWith('video/') ||
        inputFile.type.startsWith('audio/') ||
        inputFile.type === 'image/jpeg' ||
        inputFile.type === 'image/png' ||
        inputFile.type === 'image/webp' ||
        inputFile.type === 'application/zip' ||
        inputFile.type === 'application/x-rar-compressed' ||
        inputFile.type === 'application/x-7z-compressed' ||
        inputFile.name.match(/\.(zip|rar|7z|gz|tar\.gz|mp4|mkv|mov|avi|mp3)$/i)
      ) {
        compressionEnabledRef.current = false;
        addLog('INFO', 'File type is incompressible. Auto-disabling chunk compression.');
      } else {
        addLog('INFO', 'File type appears compressible. Real-time compression enabled.');
      }

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
            let buffer = await slice.arrayBuffer();
            let isCompressed = 0;

            if (compressionEnabledRef.current) {
              try {
                const compressed = await compressChunk(buffer);
                if (!compressionSampled) {
                  compressionSampled = true;
                  if (compressed.byteLength > buffer.byteLength * 0.9) {
                    compressionEnabledRef.current = false;
                    addLog('INFO', 'First chunk compression ratio < 10%. Auto-disabling compression to save CPU.');
                  }
                }
                if (compressionEnabledRef.current && compressed.byteLength < buffer.byteLength) {
                  buffer = compressed;
                  isCompressed = 1;
                }
              } catch (err) {
                compressionEnabledRef.current = false;
              }
            }

            // Header: index + fixed chunk size + 8 reserved bytes. The receiver
            // needs the nominal size to position the final short chunk correctly.
            const header = new ArrayBuffer(16);
            const headerView = new DataView(header);
            headerView.setUint32(0, cIdx, false);
            headerView.setUint32(4, chunkSize, false);
            headerView.setUint8(8, isCompressed);

            const packet = new Uint8Array(header.byteLength + buffer.byteLength);
            packet.set(new Uint8Array(header), 0);
            packet.set(new Uint8Array(buffer), 16);
            preBufferQueue.push({ chunkIndex: cIdx, payloadBytes: slice.size, packet });
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
          if (bytesDiff === 0 && timeDiff < 1.0) return;
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
            connectionType: connectionTypeRef.current,
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
          const pcState = channels.pc.connectionState;
          if (pcState === 'failed' || pcState === 'closed' || pcState === 'disconnected') {
            throw new Error(`WebRTC connection ${pcState} — aborting transfer.`);
          }
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
        // ALWAYS yield the JS event loop. If we don't yield, the main thread freezes,
        // WebRTC cannot flush its SCTP buffers, ACKs get blocked, and speed drops to 0.
        await new Promise((r) => setTimeout(r, burstSent === 0 ? 5 : 1));

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

        // 100 samples * 20ms = 2 seconds of zero ACKs. WebRTC data channel is reliable,
        // so if the channel is still open but ACKs stopped, we assume completion.
        if (idleAckSamples > 100) {
          addLog('INFO', 'Sender assumes transfer complete despite unacknowledged packets (ACKs dropped).');
          break;
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
        connectionType: connectionTypeRef.current,
        merkleRoot: null,
        etaString: '--:--',
        chunkSizeBytes: chunkSize,
      });

      if (roomId) removeResumeSession(roomId);
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

      // ---------- Offer fetch: race HTTP polling vs. real-time relay broadcast ----------
      // The sender re-broadcasts the offer every 1.5s via BroadcastChannel, localStorage,
      // and WebSocket.  We must listen on ALL of those channels in parallel with the HTTP
      // poll so that whichever path delivers the offer first wins.  This fixes the
      // serverless multi-instance problem where HTTP GET hits a different cold instance
      // than the HTTP POST that stored the offer.
      if (!offerPayload || !offerPayload.sdp) {
        addLog('SIGNAL', 'SDP Offer not found in URL. Listening on all channels...');

        offerPayload = await new Promise<any>((resolve) => {
          let resolved = false;
          const tryResolve = (payload: any) => {
            if (resolved || !payload?.sdp) return;
            resolved = true;
            resolve(payload);
          };

          // --- Channel 1: BroadcastChannel (same-device instant) ---
          let bc: BroadcastChannel | null = null;
          if (typeof BroadcastChannel !== 'undefined') {
            try {
              bc = new BroadcastChannel(`pv_sig_bc_${cleanRoomId}`);
              bc.onmessage = (e) => {
                const d = e.data;
                if (d?.roomId === cleanRoomId && d?.action === 'submit_offer' && d?.offer?.sdp) {
                  addLog('SIGNAL', 'Got SDP Offer via BroadcastChannel!');
                  tryResolve(d.offer);
                }
              };
            } catch {}
          }

          // --- Channel 2: localStorage storage events (cross-tab) ---
          const onStorage = (e: StorageEvent) => {
            if (e.key === `pv_sig_evt_${cleanRoomId}` && e.newValue) {
              try {
                const d = JSON.parse(e.newValue);
                if (d?.action === 'submit_offer' && d?.offer?.sdp) {
                  addLog('SIGNAL', 'Got SDP Offer via localStorage event!');
                  tryResolve(d.offer);
                }
              } catch {}
            }
          };
          window.addEventListener('storage', onStorage);

          // --- Channel 3: Public WebSocket relay (cross-device) ---
          const relayUrls = [
            `wss://0.peerjs.com/peerjs?key=peerjs&id=pv_rx_${cleanRoomId}_${Math.random().toString(36).substring(2, 6)}`,
            `wss://socketsbay.com/wss/v2/1/${cleanRoomId}/`,
          ];
          const wsRefs: WebSocket[] = [];
          for (const url of relayUrls) {
            try {
              const ws = new WebSocket(url);
              wsRefs.push(ws);
              ws.onmessage = (e) => {
                try {
                  const d = JSON.parse(e.data);
                  if (d?.roomId === cleanRoomId && d?.action === 'submit_offer' && d?.offer?.sdp) {
                    addLog('SIGNAL', 'Got SDP Offer via WebSocket relay!');
                    tryResolve(d.offer);
                  }
                } catch {}
              };
            } catch {}
          }

          // --- Channel 4: HTTP polling (may hit different serverless instance) ---
          let httpDone = false;
          const httpPoll = async () => {
            for (let attempt = 0; attempt < 300 && !resolved; attempt++) {
              try {
                const res = await fetch(`/api/signal?roomId=${cleanRoomId}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.offer?.sdp) {
                    addLog('SIGNAL', 'Got SDP Offer via HTTP signaling API!');
                    tryResolve(data.offer);
                    break;
                  }
                }
              } catch {}
              await new Promise((r) => setTimeout(r, 200));
            }
            httpDone = true;
            // If HTTP exhausted and still no offer, resolve null so we can show an error
            if (!resolved) tryResolve(null);
          };
          void httpPoll();

          // Cleanup helper called after resolution
          const cleanup = setInterval(() => {
            if (!resolved && !httpDone) return;
            clearInterval(cleanup);
            window.removeEventListener('storage', onStorage);
            for (const ws of wsRefs) { try { ws.close(); } catch {} }
            if (bc) { try { bc.close(); } catch {} }
          }, 500);
        });
      }

      if (!offerPayload?.sdp) {
        throw new Error('The sender offer is unavailable. Ask the sender to create a new transfer link.');
      }

      const fileName = offerPayload?.fileName || initialFileName;
      const fileSize = offerPayload?.fileSize || initialFileSize;

      if (fileName !== initialFileName || fileSize !== initialFileSize) {
        writer.setFileName(fileName);
        setReceivedFileName(fileName);
      }

      if (fileSize > 0) {
        const estChunks = Math.ceil(fileSize / DATA_CHUNK_SIZE);
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

      const pubKeyHex = Array.from(new Uint8Array(keyPair.rawPublicKey))
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
                  try {
                    if (activeControl.readyState === 'open' && ch.label.startsWith('data')) {
                      activeControl.send(JSON.stringify({ type: 'data_channel_ready', label: ch.label }));
                    }
                  } catch {}
                }
              }
            }
          },
          (newChannel) => {
            attachChannelListener(newChannel);
          }
        );
        startConnectionStatsPoller(pc);

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

        // Submit SDP Answer — and keep re-sending every 2 s until the P2P connection
        // establishes. A single send is silently lost when the sender's WebSocket relay
        // hasn't opened yet or the relay drops the packet.
        // The sender's lastAppliedAnswerRef dedup makes duplicate answers a no-op.
        const sendAnswer = () =>
          sendSignalMessage(cleanRoomId, { action: 'submit_answer', answer: finalAnswer });
        sendAnswer();

        const answerHeartbeat = setInterval(() => {
          const s = pc.connectionState;
          if (s === 'connected' || s === 'closed' || s === 'failed') {
            clearInterval(answerHeartbeat);
            return;
          }
          sendAnswer();
        }, 2000);

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
        connectionType: connectionTypeRef.current,
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

    const finalizeReceiverTransfer = async () => {
      if (isFinalizingRef.current) return;
      isFinalizingRef.current = true;
      if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
      telemetryIntervalRef.current = null;
      const progress = receiverProgressRef.current;
      setTelemetry({
        bytesTransferred: progress.totalBytes || progress.bytesTransferred,
        totalBytes: progress.totalBytes || progress.bytesTransferred,
        totalChunks: progress.totalChunks || progress.receivedChunks,
        progressPercent: 100,
        speedBytesPerSec: 0,
        rttMs: 0,
        chunkIndex: progress.totalChunks || progress.receivedChunks,
        bbrState: 'COMPLETE',
        connectionType: connectionTypeRef.current,
        merkleRoot: null,
        etaString: '--:--',
        chunkSizeBytes: progress.chunkSize,
      });
      if (roomId) removeResumeSession(roomId);
      setState('verifying');
      const result = await diskWriterRef.current?.close();
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
    };

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
          } else if (msg.type === 'transfer_complete') {
            addLog('CHANNEL', 'Sender confirmed transfer_complete.');
            if (msg.fileSize && msg.fileSize > 0) actualFileSize = msg.fileSize;
            if (Number.isInteger(msg.totalChunks) && msg.totalChunks > 0) {
              nominalChunkSize = actualFileSize > 0 && msg.totalChunks > 0 ? Math.ceil(actualFileSize / msg.totalChunks) : nominalChunkSize;
            }
            syncExpectedTotals();
            // Wait 200ms to allow any in-flight chunk write operations to settle, then finalize
            setTimeout(() => {
              void finalizeReceiverTransfer();
            }, 200);
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
        const isCompressed = packetView.getUint8(8);
        let payload = rawPacket.slice(16);

        if (isCompressed === 1) {
          try {
            payload = await decompressChunk(payload);
          } catch (err: any) {
            addLog('ERROR', `Failed to decompress chunk ${chunkIndex}`);
            throw new Error(`Decompression failed on chunk ${chunkIndex}: ${err.message}`);
          }
        }

        if (packetChunkSize >= 16 * 1024 && packetChunkSize <= 1024 * 1024) {
          nominalChunkSize = packetChunkSize;
        }
        const progress = syncExpectedTotals();

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
              const isFinalChunk = progress.totalChunks > 0 && progress.receivedChunks >= progress.totalChunks;
              if (progress.receivedChunks % 16 === 0 || isFinalChunk) {
                controlChannel.send(JSON.stringify({ type: 'ack', chunkIndex }));
              }
            }
          } catch {}

          if (progress.receivedChunks % 50 === 0 && roomId) {
            saveResumeSession({
              roomId,
              role: 'receiver',
              fileName: actualFileName,
              fileSize: progress.totalBytes,
              totalChunks: progress.totalChunks,
              completedChunksBitmap: Array.from(receivedChunkSet),
              bytesTransferred: progress.bytesTransferred,
              updatedAt: Date.now(),
            });
          }

          const isFullyReceived = (progress.totalBytes === 0 && receivedChunkSet.size === 0 && actualFileSize === 0) || (progress.totalBytes > 0
            && (progress.bytesTransferred >= progress.totalBytes || (progress.totalChunks > 0 && progress.receivedChunks >= progress.totalChunks)));
          if (isFullyReceived) {
            void finalizeReceiverTransfer();
          }
        }
      } catch (err: any) {
        console.error('[Transfer] Receiver chunk error:', err);
        setErrorMsg(`Transfer failed: ${err.message || 'Corrupted packet or disk error'}`);
        setState('error');
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
      try {
        const hasCompression = typeof window !== 'undefined' && typeof window.DecompressionStream !== 'undefined';
        controlChannel.send(JSON.stringify({ 
          type: 'receiver_ready',
          compressionSupported: hasCompression
        }));
        for (const channel of targetDataChannels) {
          if (channel.readyState === 'open') sendDataChannelReady(channel);
        }
        readyAnnounced = true;
      } catch {}
    };

    const readyInterval = setInterval(() => {
      if (readyAnnounced) {
        clearInterval(readyInterval);
        return;
      }
      announceReady();
    }, 100);

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
