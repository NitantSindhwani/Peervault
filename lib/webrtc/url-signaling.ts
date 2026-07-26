/**
 * Hardened PeerVault 0ms URL-Embedded Direct Signaling Engine
 * 
 * Compresses WebRTC SDP Offers, ECDH Public Keys, and File Metadata directly into
 * the URL Hash Fragment (#offer=...) using browser CompressionStream (gzip) & Base64URL.
 * 
 * - Time to generate share link: < 3ms (100% client-side, zero HTTP requests)
 * - Server infrastructure required: 0 (Zero DB, 100% Free Serverless)
 */

export interface InstantOfferPayload {
  fileName: string;
  fileSize: number;
  pubKeyHex: string;
  sdp: string;
  passphraseRequired?: boolean;
  ttlHours?: number;
  maxDownloads?: number;
  timestamp: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compress Offer Payload into a URL-Safe Base64 String (< 3ms execution)
 */
export async function createInstantOfferHash(payload: InstantOfferPayload): Promise<string> {
  const jsonStr = JSON.stringify(payload);
  
  if (typeof CompressionStream !== 'undefined') {
    try {
      const blob = new Blob([new TextEncoder().encode(jsonStr)]);
      const compressedStream = blob.stream().pipeThrough(new CompressionStream('gzip'));
      const buffer = await new Response(compressedStream).arrayBuffer();
      return base64UrlEncode(new Uint8Array(buffer));
    } catch (err) {
      console.warn('[URL Signaling] CompressionStream fallback:', err);
    }
  }

  // Fallback Base64 URL encoding
  return base64UrlEncode(new TextEncoder().encode(jsonStr));
}

/**
 * Parse & Decompress Offer Payload from URL Hash Fragment
 */
export async function parseInstantOfferHash(hashStr: string): Promise<InstantOfferPayload | null> {
  try {
    let cleanHash = hashStr;
    const match = cleanHash.match(/#offer=([^&]*)/);
    if (match && match[1]) {
      cleanHash = match[1];
    } else {
      cleanHash = cleanHash.replace(/^#offer=/, '').replace(/^#/, '');
    }
    cleanHash = decodeURIComponent(cleanHash);
    if (!cleanHash) return null;

    const bytes = base64UrlDecode(cleanHash);

    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        writer.write(bytes.buffer as ArrayBuffer);
        writer.close();

        const buffer = await new Response(stream.readable).arrayBuffer();
        const jsonText = new TextDecoder().decode(buffer);
        return JSON.parse(jsonText) as InstantOfferPayload;
      } catch {
        // Fallback if not compressed with gzip
      }
    }

    const fallbackText = new TextDecoder().decode(bytes);
    return JSON.parse(fallbackText) as InstantOfferPayload;
  } catch (err) {
    console.warn('[URL Signaling] Failed to parse offer hash:', err);
    return null;
  }
}
