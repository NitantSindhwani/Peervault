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
  });

  // Channel 0: Control (ordered, reliable)
  const controlChannel = pc.createDataChannel('control', {
    ordered: true,
    maxRetransmits: 10,
  });
  controlChannel.binaryType = 'arraybuffer';

  // Channel 1: Data (unordered, maxPacketLifeTime for ultra throughput)
  const dataChannel = pc.createDataChannel('data', {
    ordered: false,
    maxPacketLifeTime: 3000,
  });
  dataChannel.binaryType = 'arraybuffer';

  // Channel 2: Telemetry (ordered, reliable metrics)
  const telemetryChannel = pc.createDataChannel('telemetry', {
    ordered: true,
    maxRetransmits: 5,
  });
  telemetryChannel.binaryType = 'arraybuffer';

  return { pc, controlChannel, dataChannel, telemetryChannel };
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
  });

  const channels: Partial<PeerChannels> = { pc };
  let fired = false;

  pc.ondatachannel = (event: RTCDataChannelEvent) => {
    const channel = event.channel;
    channel.binaryType = 'arraybuffer';

    if (channel.label === 'control') {
      channels.controlChannel = channel;
    } else if (channel.label === 'data') {
      channels.dataChannel = channel;
    } else if (channel.label === 'telemetry') {
      channels.telemetryChannel = channel;
    }

    const checkReady = () => {
      if (channels.controlChannel && channels.dataChannel && !fired) {
        fired = true;
        if (onChannelsReady) {
          onChannelsReady(channels);
        }
      }
    };

    channel.onopen = checkReady;
    checkReady();
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
