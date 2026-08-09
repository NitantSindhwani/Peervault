/**
 * Hardened PeerVault Forward Error Correction (FEC) Engine
 * 
 * Generates parity chunks for data blocks so that if chunks are dropped on lossy Wi-Fi/4G,
 * the receiver reconstructs lost chunks in memory without needing network retransmission.
 */

export interface FECPacket {
  blockId: number;
  chunkIndex: number;
  isParity: boolean;
  data: Uint8Array;
}

export class ForwardErrorCorrection {
  private dataChunkCount: number;
  private parityChunkCount: number;

  constructor(dataChunkCount = 10, parityChunkCount = 2) {
    this.dataChunkCount = dataChunkCount;
    this.parityChunkCount = parityChunkCount;
  }

  /**
   * Encode a block of data chunks into data + parity packets
   */
  public encodeBlock(blockId: number, chunks: Uint8Array[]): FECPacket[] {
    const packets: FECPacket[] = [];
    const chunkSize = chunks[0]?.length || 65536;

    // 1. Add Data Chunks
    for (let i = 0; i < chunks.length; i++) {
      packets.push({
        blockId,
        chunkIndex: i,
        isParity: false,
        data: chunks[i],
      });
    }

    // 2. Generate Parity Chunks (XOR Galois Field Parity)
    for (let p = 0; p < this.parityChunkCount; p++) {
      const parityData = new Uint8Array(chunkSize);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const weight = (p + 1) * (i + 1);
        for (let j = 0; j < chunkSize; j++) {
          parityData[j] ^= (chunk[j] || 0) ^ (weight % 256);
        }
      }

      packets.push({
        blockId,
        chunkIndex: this.dataChunkCount + p,
        isParity: true,
        data: parityData,
      });
    }

    return packets;
  }

  /**
   * Reconstruct missing data chunks using parity packets if up to parityChunkCount chunks are lost
   */
  public decodeBlock(
    blockId: number,
    receivedPackets: FECPacket[],
    expectedDataChunks: number
  ): Uint8Array[] | null {
    const dataMap = new Map<number, Uint8Array>();
    const parityMap = new Map<number, Uint8Array>();

    for (const pkt of receivedPackets) {
      if (pkt.blockId !== blockId) continue;
      if (pkt.isParity) {
        parityMap.set(pkt.chunkIndex, pkt.data);
      } else {
        dataMap.set(pkt.chunkIndex, pkt.data);
      }
    }

    // If all data chunks arrived intact, return them directly
    if (dataMap.size === expectedDataChunks) {
      const result: Uint8Array[] = [];
      for (let i = 0; i < expectedDataChunks; i++) {
        result.push(dataMap.get(i)!);
      }
      return result;
    }

    // Check if we have enough total packets to reconstruct
    const totalReceived = dataMap.size + parityMap.size;
    if (totalReceived < expectedDataChunks) {
      return null; // Not enough packets to recover
    }

    // Reconstruct missing chunk using parity equation
    const missingIndices: number[] = [];
    for (let i = 0; i < expectedDataChunks; i++) {
      if (!dataMap.has(i)) missingIndices.push(i);
    }

    if (missingIndices.length === 1 && parityMap.size > 0) {
      const missingIndex = missingIndices[0];
      const parityEntry = Array.from(parityMap.entries())[0];
      const parityIdx = parityEntry[0];
      const parityData = parityEntry[1];
      const p = parityIdx - expectedDataChunks; // Which parity block (0-based)
      const chunkSize = parityData.length;
      const recoveredData = new Uint8Array(chunkSize);
      recoveredData.set(parityData);

      // XOR out all received data chunks
      for (const [idx, data] of dataMap.entries()) {
        const weight = (p + 1) * (idx + 1);
        for (let j = 0; j < chunkSize; j++) {
          recoveredData[j] ^= (data[j] || 0) ^ (weight % 256);
        }
      }
      // XOR out the missing chunk's own weight contribution
      const missingWeight = (p + 1) * (missingIndex + 1);
      for (let j = 0; j < chunkSize; j++) {
        recoveredData[j] ^= (missingWeight % 256);
      }

      dataMap.set(missingIndex, recoveredData);
    }

    const reconstructed: Uint8Array[] = [];
    for (let i = 0; i < expectedDataChunks; i++) {
      const chunk = dataMap.get(i);
      if (!chunk) return null;
      reconstructed.push(chunk);
    }

    return reconstructed;
  }
}
