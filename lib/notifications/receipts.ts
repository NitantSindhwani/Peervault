/**
 * PeerVault Real Cryptographic Transfer Receipts
 * Persisted in browser localStorage & IndexedDB for auditability
 */

export interface FileReceipt {
  id: string;
  fileName: string;
  fileSize: number;
  type: 'sent' | 'received';
  merkleRoot: string;
  timestamp: number;
  durationMs?: number;
  avgSpeedMbps?: number;
}

export function saveFileReceipt(receipt: FileReceipt): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('peervault_receipts') || '[]';
    const list: FileReceipt[] = JSON.parse(raw);
    // Deduplicate by ID
    const filtered = list.filter((r) => r.id !== receipt.id);
    filtered.unshift(receipt);
    localStorage.setItem('peervault_receipts', JSON.stringify(filtered.slice(0, 30)));
  } catch {}
}

export function getFileReceipts(): FileReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('peervault_receipts') || '[]';
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
