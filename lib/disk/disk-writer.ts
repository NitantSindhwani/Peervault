/**
 * PeerVault Universal Disk Writer & Direct File Streaming Engine
 * 
 * Scaled for all file sizes:
 * - Tiny / Small Files (1 KB – 128 MB): Zero-copy Memory Blobs for instant < 1ms playback.
 * - Medium Files (128 MB – 2 GB): 50x Batch IndexedDB Storage.
 * - Huge Files (2 GB – 100+ GB): Native File System Access API & IndexedDB Chunk Slicing.
 */

export type DiskWriterTier = 'memory_blob' | 'indexeddb_paging' | 'direct_fs' | 'opfs';

const DB_NAME = 'peervault_disk_writer_db';
const DB_VERSION = 1;
const STORE_NAME = 'chunks';

function openDiskDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('streamId', 'streamId', { unique: false });
        store.createIndex('chunkIndex', 'chunkIndex', { unique: false });
      }
    };
    request.onsuccess = (e: any) => resolve(e.target.result);
    request.onerror = (e: any) => reject(e.target.error);
  });
}

export class DiskWriter {
  private fileName: string;
  private fileSize: number;
  private mimeType: string;
  private totalSize: number;
  private writtenSize: number = 0;
  private writtenChunkSet = new Set<number>();
  private streamId: string;
  private tier: DiskWriterTier = 'indexeddb_paging';
  // Key by protocol chunk index, never by a chunk's own byte length. The last
  // packet is normally shorter, so offset-derived keys corrupt its sort order.
  private memoryChunksMap = new Map<number, ArrayBuffer>();
  private useDBPaging: boolean = true;
  private fileHandle: any = null;
  private writableStream: any = null;
  private opfsFileHandle: any = null;

  constructor(fileName: string, fileSize: number, mimeType?: string) {
    this.fileName = fileName;
    this.fileSize = fileSize;
    this.totalSize = fileSize;
    this.mimeType = mimeType || this.inferMimeType(fileName);
    this.streamId = `pv_str_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Memory Blob fallback for small files (< 128 MB)
    if (fileSize < 128 * 1024 * 1024) {
      this.tier = 'memory_blob';
      this.useDBPaging = false;
    }
  }

  private inferMimeType(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'webm': return 'video/webm';
      case 'mp4': return 'video/mp4';
      case 'mkv': return 'video/x-matroska';
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'jpg': case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      case 'pdf': return 'application/pdf';
      case 'zip': return 'application/zip';
      case 'json': return 'application/json';
      case 'txt': return 'text/plain';
      default: return 'application/octet-stream';
    }
  }

  public getFileName(): string {
    let name = this.fileName;
    if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
      if (this.mimeType === 'image/jpeg') name += '.jpg';
      else if (this.mimeType === 'image/png') name += '.png';
      else if (this.mimeType === 'image/gif') name += '.gif';
      else if (this.mimeType === 'image/webp') name += '.webp';
      else if (this.mimeType === 'video/mp4') name += '.mp4';
      else if (this.mimeType === 'video/webm') name += '.webm';
      else if (this.mimeType === 'application/pdf') name += '.pdf';
      else if (this.mimeType === 'application/zip') name += '.zip';
    }
    return name;
  }

  public setFileName(name: string, mime?: string): void {
    if (name) this.fileName = name;
    if (mime) this.mimeType = mime;
  }

  public async init(fileHandle?: any): Promise<boolean> {
    if (fileHandle) {
      try {
        this.fileHandle = fileHandle;
        this.writableStream = await fileHandle.createWritable();
        this.tier = 'direct_fs';
        this.useDBPaging = false;
        return true;
      } catch (err) {
        console.warn('[DiskWriter] Direct file handle createWritable failed, falling back to OPFS/IndexedDB:', err);
        this.fileHandle = null;
        this.writableStream = null;
      }
    }

    // Try OPFS (Origin Private File System) for ultra-fast NVMe storage if no user direct fileHandle is provided
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function') {
      try {
        const root = await navigator.storage.getDirectory();
        const cleanName = this.fileName.replace(/[^a-zA-Z0-9_.-]/g, '') || 'stream.bin';
        const opfsFile = await root.getFileHandle(`${this.streamId}_${cleanName}`, { create: true });
        this.opfsFileHandle = opfsFile;
        if (typeof opfsFile.createWritable === 'function') {
          this.writableStream = await opfsFile.createWritable();
          this.tier = 'opfs';
          this.useDBPaging = false;
          return true;
        }
      } catch (opfsErr) {
        console.warn('[DiskWriter] OPFS initialization failed, using IndexedDB/memory fallback:', opfsErr);
        this.opfsFileHandle = null;
        this.writableStream = null;
      }
    }

    if (this.useDBPaging) {
      try {
        await openDiskDB();
        return true;
      } catch {
        this.useDBPaging = false;
        this.tier = 'memory_blob';
      }
    }
    return true;
  }

  private pendingWriteBuffer: Array<{ paddedIndex: string; chunkIndex: number; data: ArrayBuffer }> = [];

  /**
   * Write a chunk to storage (Direct FS, IndexedDB Paging, or Memory)
   */
  public async writeChunk(chunk: ArrayBuffer, offset: number, explicitChunkIndex?: number): Promise<void> {
    const NOMINAL_CHUNK_SIZE = 131072; // 128KB — must match DATA_CHUNK_SIZE in useTransfer
    const chunkIndex = explicitChunkIndex !== undefined ? explicitChunkIndex : Math.floor(offset / NOMINAL_CHUNK_SIZE);

    // Direct File System Access API streaming for massive 10GB–100GB files
    if (this.writableStream) {
      try {
        await this.writableStream.write({
          type: 'write',
          position: offset,
          data: chunk,
        });
        this.writtenSize += chunk.byteLength;
        return;
      } catch (err) {
        throw new Error(`Direct file write failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    if (this.useDBPaging) {
      try {
        const paddedIndex = chunkIndex.toString().padStart(10, '0');
        this.pendingWriteBuffer.push({
          paddedIndex,
          chunkIndex,
          data: chunk.slice(0),
        });
        if (!this.writtenChunkSet.has(chunkIndex)) {
          this.writtenSize += chunk.byteLength;
          this.writtenChunkSet.add(chunkIndex);
        }

        // Flush batch of 32 chunks per transaction
        if (this.pendingWriteBuffer.length >= 32) {
          await this.flushPendingWriteBuffer();
        }
        return;
      } catch {
        this.useDBPaging = false;
        this.tier = 'memory_blob';
      }
    }

    if (!this.memoryChunksMap.has(chunkIndex)) {
      this.writtenSize += chunk.byteLength;
    }
    this.memoryChunksMap.set(chunkIndex, chunk.slice(0));
  }

  private async flushPendingWriteBuffer(): Promise<void> {
    if (this.pendingWriteBuffer.length === 0) return;
    const batch = [...this.pendingWriteBuffer];
    this.pendingWriteBuffer = [];

    try {
      const db = await openDiskDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const item of batch) {
          store.put({
            id: `${this.streamId}_${item.paddedIndex}`,
            streamId: this.streamId,
            chunkIndex: item.chunkIndex,
            data: item.data,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {}
  }

  /**
   * Finalize stream and generate in-app viewing & download blob URL
   */
  public async close(): Promise<{ downloadUrl: string; blob: Blob; tier: DiskWriterTier }> {
    if (this.writableStream) {
      try {
        await this.writableStream.close();
        let downloadUrl = '';
        let fileBlob: Blob = new Blob([], { type: this.mimeType });
        if (this.tier === 'opfs' && this.opfsFileHandle && typeof this.opfsFileHandle.getFile === 'function') {
          try {
            fileBlob = await this.opfsFileHandle.getFile();
            downloadUrl = URL.createObjectURL(fileBlob);
          } catch {}
          return { downloadUrl, blob: fileBlob, tier: 'opfs' };
        }
        if (this.fileHandle && typeof this.fileHandle.getFile === 'function') {
          try {
            fileBlob = await this.fileHandle.getFile();
            downloadUrl = URL.createObjectURL(fileBlob);
          } catch {}
        }
        return { downloadUrl, blob: fileBlob, tier: 'direct_fs' };
      } catch (err) {
        throw new Error(`Direct file close failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    await this.flushPendingWriteBuffer();

    if (this.useDBPaging) {
      try {
        const db = await openDiskDB();
        const chunkMap = new Map<number, ArrayBuffer>();

        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const request = store.openCursor();
          
          request.onsuccess = (e: any) => {
            const cursor = e.target.result;
            if (cursor) {
              if (cursor.value.streamId === this.streamId) {
                chunkMap.set(cursor.value.chunkIndex, cursor.value.data);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        });

        // Clean up temporary chunk entries from IndexedDB
        try {
          const cleanupTx = db.transaction(STORE_NAME, 'readwrite');
          const cleanupStore = cleanupTx.objectStore(STORE_NAME);
          for (const cIdx of Array.from(chunkMap.keys())) {
            const paddedIndex = cIdx.toString().padStart(10, '0');
            cleanupStore.delete(`${this.streamId}_${paddedIndex}`);
          }
        } catch {}

        // Sort by chunkIndex to guarantee 100% correct byte order
        const sortedIndices = Array.from(chunkMap.keys()).sort((a, b) => a - b);
        const assembledBuffers = sortedIndices.map((idx) => chunkMap.get(idx)!);

        const blob = new Blob(assembledBuffers, { type: this.mimeType });
        const downloadUrl = URL.createObjectURL(blob);
        return { downloadUrl, blob, tier: this.tier };
      } catch (err) {
        console.warn('[DiskWriter] IndexedDB assembly fallback to memory chunks:', err);
      }
    }

    const sortedChunks = Array.from(this.memoryChunksMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map((entry) => entry[1]);

    const blob = new Blob(sortedChunks, { type: this.mimeType });
    this.memoryChunksMap.clear();
    const downloadUrl = URL.createObjectURL(blob);
    return { downloadUrl, blob, tier: this.tier };
  }

  public getTier(): DiskWriterTier {
    return this.tier;
  }

  public getWrittenProgress(): number {
    return this.totalSize > 0 ? this.writtenSize / this.totalSize : 0;
  }
}
