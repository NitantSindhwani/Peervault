/**
 * Hardened PeerVault Multi-Channel WebRTC Factory
 * 
 * Sets up 3 dedicated RTCDataChannels per peer connection:
 * - Control channel: ordered, reliable ACKs & BBR pacing pings
 * - Data channel: unordered, maxPacketLifeTime for high throughput payload
 * - Telemetry channel: ordered, 500ms real-time metric stream
 */

export interface PeerConnectionConfig {
  iceServers?: RTCIceServer[];
}

export interface PeerChannels {
  pc: RTCPeerConnection;
  controlChannel: RTCDataChannel;
  dataChannel: RTCDataChannel;
  dataChannels?: RTCDataChannel[];
  telemetryChannel: RTCDataChannel;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

/**
 * Create a fully configured multi-channel RTCPeerConnection for sender
 */
export function createSenderPeerConnection(config?: PeerConnectionConfig): PeerChannels {
  const pc = new RTCPeerConnection({
    iceServers: config?.iceServers || DEFAULT_ICE_SERVERS,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10,
  });

  // Channel 0: Control (ordered, reliable)
  const controlChannel = pc.createDataChannel('control', {
    ordered: true,
    maxRetransmits: 10,
  });
  controlChannel.binaryType = 'arraybuffer';

  // 8 Parallel Striped DataChannels for 8x Throughput Multi-Channel P2P Engine
  const dataChannels: RTCDataChannel[] = [];
  for (let i = 0; i < 8; i++) {
    const ch = pc.createDataChannel(`data_${i}`, {
      ordered: false,
      maxPacketLifeTime: 3000,
    });
    ch.binaryType = 'arraybuffer';
    dataChannels.push(ch);
  }

  // Channel 2: Telemetry (ordered, reliable metrics)
  const telemetryChannel = pc.createDataChannel('telemetry', {
    ordered: true,
    maxRetransmits: 5,
  });
  telemetryChannel.binaryType = 'arraybuffer';

  return {
    pc,
    controlChannel,
    dataChannel: dataChannels[0],
    dataChannels,
    telemetryChannel,
  };
}

/**
 * Create RTCPeerConnection for receiver (listens for incoming data channels)
 */
export function createReceiverPeerConnection(
  config?: PeerConnectionConfig,
  onChannelsReady?: (channels: Partial<PeerChannels>) => void
): { pc: RTCPeerConnection } {
  const pc = new RTCPeerConnection({
    iceServers: config?.iceServers || DEFAULT_ICE_SERVERS,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10,
  });

  const channels: Partial<PeerChannels> = { pc, dataChannels: [] };
  let fired = false;

  pc.ondatachannel = (event: RTCDataChannelEvent) => {
    const channel = event.channel;
    channel.binaryType = 'arraybuffer';

    if (channel.label === 'control') {
      channels.controlChannel = channel;
    } else if (channel.label.startsWith('data')) {
      if (!channels.dataChannel) channels.dataChannel = channel;
      channels.dataChannels = channels.dataChannels || [];
      channels.dataChannels.push(channel);
    } else if (channel.label === 'telemetry') {
      channels.telemetryChannel = channel;
    }

    const checkReady = () => {
      if (
        channels.controlChannel &&
        channels.dataChannel &&
        (channels.controlChannel.readyState === 'open' || channels.controlChannel.readyState === 'connecting') &&
        (channels.dataChannel.readyState === 'open' || channels.dataChannel.readyState === 'connecting') &&
        !fired
      ) {
        fired = true;
        if (onChannelsReady) {
          onChannelsReady(channels);
        }
      }
    };

    channel.onopen = checkReady;
    checkReady();

    let attempts = 0;
    const readyPoller = setInterval(() => {
      attempts++;
      if (fired || attempts > 200 || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        clearInterval(readyPoller);
        return;
      }
      checkReady();
    }, 50);
  };

  return { pc };
}

/**
 * Helper to inspect current selected candidate pair type (Host vs Reflected vs Relay)
 */
export async function getSelectedCandidatePairType(pc: RTCPeerConnection): Promise<'direct_host' | 'stun_reflected' | 'turn_relay' | 'unknown'> {
  try {
    const stats = await pc.getStats();
    let selectedPair: any = null;

    stats.forEach((report) => {
      if (report.type === 'transport' && report.selectedCandidatePairId) {
        selectedPair = stats.get(report.selectedCandidatePairId);
      }
    });

    if (!selectedPair) {
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
          selectedPair = report;
        }
      });
    }

    if (selectedPair) {
      const localCand = stats.get(selectedPair.localCandidateId);
      const remoteCand = stats.get(selectedPair.remoteCandidateId);

      if (localCand && remoteCand) {
        if (localCand.candidateType === 'relay' || remoteCand.candidateType === 'relay') {
          return 'turn_relay';
        }
        if (localCand.candidateType === 'srflx' || remoteCand.candidateType === 'srflx') {
          return 'stun_reflected';
        }
        if (localCand.candidateType === 'host' && remoteCand.candidateType === 'host') {
          return 'direct_host';
        }
      }
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}
