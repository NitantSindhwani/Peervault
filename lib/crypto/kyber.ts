import { ml_kem1024 } from '@noble/post-quantum/ml-kem.js';

export interface KyberKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface KyberEncapsulation {
  cipherText: Uint8Array;
  sharedSecret: Uint8Array;
}

/**
 * Generate ML-KEM-1024 (Kyber-1024) Post-Quantum Keypair
 */
export function generateKyberKeyPair(): KyberKeyPair {
  const seed = window.crypto.getRandomValues(new Uint8Array(64));
  const keys = ml_kem1024.keygen(seed);
  return {
    publicKey: keys.publicKey,
    secretKey: keys.secretKey,
  };
}

/**
 * Encapsulate shared secret against recipient's Kyber-1024 public key
 */
export function encapsulateKyberSecret(recipientPublicKey: Uint8Array): KyberEncapsulation {
  const seed = window.crypto.getRandomValues(new Uint8Array(32));
  const res = ml_kem1024.encapsulate(recipientPublicKey, seed);
  return {
    cipherText: res.cipherText,
    sharedSecret: res.sharedSecret,
  };
}

/**
 * Decapsulate shared secret using recipient's Kyber-1024 secret key
 */
export function decapsulateKyberSecret(cipherText: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return ml_kem1024.decapsulate(cipherText, secretKey);
}

/**
 * Combine ECDH P-256 Shared Secret with Kyber-1024 Shared Secret using HKDF-SHA256
 */
export async function deriveHybridMasterKey(
  ecdhSecret: Uint8Array,
  kyberSecret: Uint8Array
): Promise<CryptoKey> {
  const combined = new Uint8Array(ecdhSecret.length + kyberSecret.length);
  combined.set(ecdhSecret, 0);
  combined.set(kyberSecret, ecdhSecret.length);

  const hkdfKey = await window.crypto.subtle.importKey(
    'raw',
    combined,
    'HKDF',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('peervault_pqc_kyber1024_salt'),
      info: new TextEncoder().encode('peervault_hybrid_aes256_key'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Convert Uint8Array to Hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert Hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
