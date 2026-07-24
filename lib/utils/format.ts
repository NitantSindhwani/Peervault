/**
 * Hardened PeerVault Formatting Utilities
 */

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0.0 MB/s';
  const mbps = bytesPerSec / (1024 * 1024);
  if (mbps >= 1) {
    return `${mbps.toFixed(1)} MB/s`;
  }
  const kbps = bytesPerSec / 1024;
  return `${kbps.toFixed(0)} KB/s`;
}

export function formatETA(remainingBytes: number, speedBytesPerSec: number): string {
  if (!speedBytesPerSec || speedBytesPerSec <= 0 || !remainingBytes || remainingBytes <= 0) {
    return '--:--';
  }
  const seconds = Math.ceil(remainingBytes / speedBytesPerSec);
  if (seconds < 60) {
    return `~${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) {
    return `~${minutes}m ${remSec}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `~${hours}h ${remMin}m`;
}

export function formatHash(hex: string | null | undefined): string {
  if (!hex) return '----------------';
  if (hex.length <= 16) return hex;
  return `${hex.substring(0, 8)}...${hex.substring(hex.length - 8)}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return `${mins}m ${remSec}s`;
}
