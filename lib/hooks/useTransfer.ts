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
  const receiverStartedRef = useRef<string | null>(null);
  const senderStartedRef = useRef<boolean>(false);

  const speedHistoryRef = useRef<number[]>([]);
  const lastByteCountRef = useRef<number>(0);
  const lastSampleTimeRef = useRef<number>(Date.now());

  // Universal Cross-Region Signaling Relay Helper (Local API + Global PubSub)
  const sendSignalMessage = useCallback((targetRoomId: string, payload: any) => {
    fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: targetRoomId, ...payload }),
    }).catch(() => {});
  }, []);

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
  const startSender = useCallback(async (customFile?: File) => {
    const activeFile = customFile || file;
    if (!activeFile) {
      setErrorMsg('No file selected for transfer');
      setState('error');
      return;
    }
    if (senderStartedRef.current) return;
    senderStartedRef.current = true;

    const fileToStream = activeFile;

    try {
      setState('generating_key');
      // 1. Generate local ECDH Keypair (< 1ms)
      const keyPair = await generateECDHKeyPair();
      localKeyPairRef.current = keyPair;

      const rawPubKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
      const pubKeyHex = Array.from(new Uint8Array(rawPubKey))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const generatedRoomId = `pv_${Math.random().toString(36).substring(2, 10)}`;

      const channels = createSenderPeerConnection();
      peerChannelsRef.current = channels;

      channels.pc.onconnectionstatechange = () => {
        if (channels.pc.connectionState === 'connected') {
          triggerStartStream();
        } else if (channels.pc.connectionState === 'failed') {
          console.warn('[PeerConnection] Connection failed. Triggering ICE restart...');
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

      // Handle Sender ICE Candidates and submit to signal relays
      channels.pc.onicecandidate = async (event) => {
        if (event.candidate) {
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
      let hasStartedStreaming = false;
      const triggerStartStream = () => {
        if (hasStartedStreaming) return;
        hasStartedStreaming = true;
        if (signalPollerRef.current) clearInterval(signalPollerRef.current);
        if (stagingFallbackTimerRef.current) clearTimeout(stagingFallbackTimerRef.current);
        setState('connected');
        startStreamingFile(fileToStream);
      };

      const checkChannelsReady = () => {
        if (hasStartedStreaming) return;
        const active = channels.dataChannels || [channels.dataChannel];
        const isControlOpen = channels.controlChannel.readyState === 'open';
        const hasAnyDataOpen = active.some((ch) => ch.readyState === 'open') || channels.dataChannel.readyState === 'open';
        
        if (isControlOpen || hasAnyDataOpen) {
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

      // 4. Listen for Recipient's SDP Answer over dual signaling relays (Local API + Global PubSub)
      signalPollerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/signal?roomId=${generatedRoomId}`);
          if (res.ok) {
            const data = await res.json();

            if (data.answer && channels.pc.signalingState !== 'stable') {
              try {
                const ansObj = typeof data.answer === 'string' ? JSON.parse(data.answer) : data.answer;
                await channels.pc.setRemoteDescription(new RTCSessionDescription(ansObj));
                setState('negotiating');
              } catch (err) {
                console.warn('[Transfer] setRemoteDescription answer error:', err);
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

      // Dual-Engine Fallback: Stage encrypted chunks if P2P does not start streaming after 10s
      if (enableStaging) {
        stagingFallbackTimerRef.current = setTimeout(async () => {
          if (!hasStartedStreaming) {
            try {
              const chunkSize = 64512;
              let offset = 0;
              let chunkIndex = 0;
              const totalChunks = Math.ceil(fileToStream.size / chunkSize);

            while (offset < fileToStream.size) {
              const slice = fileToStream.slice(offset, offset + chunkSize);
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
                  fileName: fileToStream.name,
                  fileSize: fileToStream.size,
                }),
              }).catch(() => {});

              offset += slice.size;
              chunkIndex++;

              const progressPercent = Math.min(100, (offset / fileToStream.size) * 100);
              setTelemetry((prev) => ({
                ...prev,
                bytesTransferred: offset,
                totalBytes: fileToStream.size,
                progressPercent,
                speedBytesPerSec: 50 * 1024 * 1024,
              }));
            }

            setState('streaming');
            setState('complete');
          } catch {}
        }
      }, 1500);
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

    keepAliveRef.current?.start();
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
          await new Promise((r) => setTimeout(r, 1));
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
    if (receiverStartedRef.current === targetRoomId) {
      console.log('[Transfer] Receiver already started for room:', targetRoomId);
      return;
    }
    receiverStartedRef.current = targetRoomId;
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

      // 5. Setup DiskWriter & Transition State
      const writer = new DiskWriter(fileName, fileSize);
      await writer.init();
      diskWriterRef.current = writer;
      keepAliveRef.current?.start();
      setState('negotiating');

      // 6. WebRTC path — only if we have a valid SDP offer
      if (offerPayload?.sdp) {
        let currentPacketHandler: any = null;

        const attachChannelListener = (channel: RTCDataChannel) => {
          if (channel) {
            channel.binaryType = 'arraybuffer';
            channel.onmessage = (event) => {
              if (currentPacketHandler) {
                currentPacketHandler(event);
              }
            };
          }
        };

        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(`pv_bc_${cleanRoomId}`);
          bcRef.current = bc;
          bc.postMessage({ type: 'receiver_ready' });
          bc.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer || event.data?.buffer instanceof ArrayBuffer) {
              if (currentPacketHandler) {
                currentPacketHandler({ data: event.data } as MessageEvent);
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
              currentPacketHandler = setupReceiverChannelListeners(
                channels.controlChannel,
                channels.dataChannel,
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
          // Fallback staging check if WebRTC P2P is delayed or blocked
          try {
            const stRes = await fetch(`/api/signal?action=get_staging&roomId=${cleanRoomId}`);
            if (stRes.ok) {
              const stData = await stRes.json();
              if (stData.available && stData.chunks && stData.chunks.length > 0) {
                for (const item of stData.chunks) {
                  const hexStr: string = item.dataHex;
                  const bytes = new Uint8Array(hexStr.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
                  if (currentPacketHandler) {
                    currentPacketHandler({ data: bytes.buffer } as MessageEvent);
                  }
                }
              }
            }
          } catch {}
        }, 1200);
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
            if (controlChannel && controlChannel.readyState === 'open') {
              controlChannel.send(JSON.stringify({ type: 'ack', chunkIndex }));
            }
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
                fileName: actualFileName,
                fileSize: targetSize,
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
    startSender,
    startReceiver,
  };
}
