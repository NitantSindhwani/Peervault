/**
 * Hardened PeerVault Network Topology Fallback State Machine
 * 
 * Hierarchy:
 * Direct Host P2P ──> STUN Reflected P2P ──> P2P Mesh Relay ──> Encrypted TURN Relay ──> Ephemeral Cloud Staging
 */

export type TopologyState =
  | 'direct_host'
  | 'stun_reflected'
  | 'mesh_relay'
  | 'turn_relay'
  | 'ephemeral_staging'
  | 'disconnected';

export interface TopologyStatus {
  currentState: TopologyState;
  rttMs: number;
  relayPeerId?: string;
  isEncrypted: boolean;
}

export class ConnectionManager {
  private currentState: TopologyState = 'disconnected';
  private onStateChange?: (status: TopologyStatus) => void;

  constructor(onStateChange?: (status: TopologyStatus) => void) {
    this.onStateChange = onStateChange;
  }

  /**
   * Update topology state based on peer candidate pair analysis
   */
  public updateState(state: TopologyState, rttMs: number = 0, relayPeerId?: string): void {
    this.currentState = state;
    if (this.onStateChange) {
      this.onStateChange({
        currentState: this.currentState,
        rttMs,
        relayPeerId,
        isEncrypted: true,
      });
    }
  }

  public getCurrentState(): TopologyState {
    return this.currentState;
  }

  /**
   * Get human-readable description for UI badge
   */
  public getStateLabel(): string {
    switch (this.currentState) {
      case 'direct_host':
        return 'Direct LAN/P2P';
      case 'stun_reflected':
        return 'STUN Reflected P2P';
      case 'mesh_relay':
        return 'Peer Mesh Relay';
      case 'turn_relay':
        return 'Encrypted Cloud TURN';
      case 'ephemeral_staging':
        return 'Ephemeral Cloud Staging';
      case 'disconnected':
        return 'Disconnected';
    }
  }
}
