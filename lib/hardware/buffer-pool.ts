/**
 * High-Speed Zero-Allocation ArrayBuffer Recycling Pool
 * 
 * Prevents V8 Garbage Collection pauses by reusing pre-allocated 256KB ArrayBuffers.
 */

export class BufferPool {
  private pool: ArrayBuffer[] = [];
  private chunkSize: number = 262144; // 256 KB
  private maxPoolSize: number = 256; // Pool capacity: 64 MB

  constructor(chunkSize: number = 262144, maxPoolSize: number = 256) {
    this.chunkSize = chunkSize;
    this.maxPoolSize = maxPoolSize;
  }

  public acquire(): ArrayBuffer {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return new ArrayBuffer(this.chunkSize);
  }

  public release(buffer: ArrayBuffer): void {
    if (buffer.byteLength === this.chunkSize && this.pool.length < this.maxPoolSize) {
      this.pool.push(buffer);
    }
  }

  public clear(): void {
    this.pool = [];
  }
}
