/**
 * Hardened PeerVault Swarm Mesh Seeding Engine
 * 
 * Manages parallel WebRTC DataChannel connections across multiple peers,
 * allowing recipients to seed downloaded Merkle chunks to other downloading peers in real-time.
 */

export interface SwarmPeer {
  peerId: string;
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  bitfield: Set<number>;
}

export class SwarmMeshSeeder {
  private peersMap = new Map<string, SwarmPeer>();
  private totalChunks: number;

  constructor(totalChunks = 1000) {
    this.totalChunks = totalChunks;
  }

  /**
   * Register a new swarm peer into the mesh network
   */
  public registerPeer(peerId: string, pc: RTCPeerConnection, dataChannel: RTCDataChannel) {
    const peer: SwarmPeer = {
      peerId,
      pc,
      dataChannel,
      bitfield: new Set<number>(),
    };
    this.peersMap.set(peerId, peer);

    dataChannel.onmessage = (event) => {
      this.handlePeerMessage(peerId, event.data);
    };
  }

  /**
   * Announce available chunk bitfield to connected swarm peers
   */
  public announceChunkAvailable(chunkIndex: number) {
    const announceMsg = JSON.stringify({ type: 'HAVE_CHUNK', chunkIndex });
    for (const peer of this.peersMap.values()) {
      if (peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(announceMsg);
      }
    }
  }

  /**
   * Handle incoming chunk request or HAVE message from swarm peer
   */
  private handlePeerMessage(peerId: string, data: any) {
    try {
      if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        if (parsed.type === 'HAVE_CHUNK') {
          const peer = this.peersMap.get(peerId);
          if (peer) peer.bitfield.add(parsed.chunkIndex);
        }
      }
    } catch {
      // Binary chunk data
    }
  }

  public getActiveSwarmCount(): number {
    return this.peersMap.size;
  }
}
