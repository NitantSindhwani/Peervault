/**
 * Hardened PeerVault Auto-Resume Token Store (IndexedDB)
 * 
 * Persists transfer session progress, chunk bitmaps, and encrypted session keys
 * to recover gracefully from browser crashes, tab closes, or network drops.
 */

export interface ResumeSession {
  roomId: string;
  role: 'sender' | 'receiver';
  fileName: string;
  fileSize: number;
  totalChunks: number;
  completedChunksBitmap: number[]; // Array of 32-bit integers acting as bitfields
  bytesTransferred: number;
  merkleRoot?: string;
  encryptedSessionKeyHex?: string;
  updatedAt: number;
}

const DB_NAME = 'peervault_resume_db';
const STORE_NAME = 'transfer_sessions';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB unavailable'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'roomId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveResumeSession(session: ResumeSession): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({
        ...session,
        updatedAt: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[ResumeStore] Failed to save session:', err);
  }
}

export async function getResumeSession(roomId: string): Promise<ResumeSession | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(roomId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[ResumeStore] Failed to fetch session:', err);
    return null;
  }
}

export async function removeResumeSession(roomId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(roomId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[ResumeStore] Failed to delete session:', err);
  }
}
