/**
 * Hardened PeerVault Ephemeral Cloud Staging Manager
 * 
 * Resolves the "Persistence Paradox": if sender tab is closing before stream completion,
 * un-transferred chunk queue is automatically encrypted client-side and staged in
 * Supabase Ephemeral Storage with a 24-hour self-destruct TTL.
 */

import { supabase } from './client';

export interface StagedManifest {
  roomId: string;
  totalChunks: number;
  chunkSize: number;
  fileName: string;
  fileSize: number;
  fileMime: string;
  merkleRoot: string;
  createdTime: string;
}

/**
 * Upload an encrypted chunk to Ephemeral Storage
 */
export async function stageEncryptedChunk(
  roomId: string,
  chunkIndex: number,
  encryptedBuffer: ArrayBuffer
): Promise<boolean> {
  try {
    const fileName = `${roomId}/${chunkIndex}.bin`;
    const { error } = await supabase.storage
      .from('ephemeral')
      .upload(fileName, encryptedBuffer, {
        contentType: 'application/octet-stream',
        upsert: true,
      });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Download a staged encrypted chunk from Ephemeral Storage
 */
export async function fetchStagedChunk(roomId: string, chunkIndex: number): Promise<ArrayBuffer | null> {
  try {
    const fileName = `${roomId}/${chunkIndex}.bin`;
    const { data, error } = await supabase.storage.from('ephemeral').download(fileName);
    if (error || !data) return null;
    return await data.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Upload staged transfer manifest
 */
export async function stageManifest(manifest: StagedManifest): Promise<boolean> {
  try {
    const fileName = `${manifest.roomId}/manifest.json`;
    const jsonStr = JSON.stringify(manifest);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const { error } = await supabase.storage.from('ephemeral').upload(fileName, blob, {
      upsert: true,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetch staged manifest
 */
export async function fetchStagedManifest(roomId: string): Promise<StagedManifest | null> {
  try {
    const fileName = `${roomId}/manifest.json`;
    const { data, error } = await supabase.storage.from('ephemeral').download(fileName);
    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text) as StagedManifest;
  } catch {
    return null;
  }
}
