import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Global Persistent In-Memory Signaling & Staging Caches
const globalForSignal = globalThis as unknown as {
  signalCache: Map<string, { offer?: any; answer?: any; senderCandidates?: any[]; receiverCandidates?: any[]; updatedAt: number }>;
  stagingCache: Map<string, { chunks: Map<number, string>; updatedAt: number; totalChunks: number; fileName: string; fileSize: number }>;
  cleanupInterval?: any;
};

const signalCache = globalForSignal.signalCache || new Map();
const stagingCache = globalForSignal.stagingCache || new Map();

globalForSignal.signalCache = signalCache;
globalForSignal.stagingCache = stagingCache;

function getTmpFilePath(roomId: string): string {
  const cleanId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(os.tmpdir(), `pv_sig_${cleanId}.json`);
}

async function readSignalState(roomId: string) {
  let state = signalCache.get(roomId);
  if (!state) {
    try {
      const filePath = getTmpFilePath(roomId);
      if (fs.existsSync(filePath)) {
        const raw = await fs.promises.readFile(filePath, 'utf-8');
        state = JSON.parse(raw);
        if (state) signalCache.set(roomId, state);
      }
    } catch {}
  }
  return state || { senderCandidates: [], receiverCandidates: [], updatedAt: Date.now() };
}

async function writeSignalState(roomId: string, state: any) {
  state.updatedAt = Date.now();
  signalCache.set(roomId, state);
  try {
    const filePath = getTmpFilePath(roomId);
    await fs.promises.writeFile(filePath, JSON.stringify(state), 'utf-8');
  } catch {}
}

// Cleanup stale entries every 60 seconds
if (!globalForSignal.cleanupInterval) {
  globalForSignal.cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [roomId, item] of signalCache.entries()) {
      if (now - item.updatedAt > 600000) { // 10 minutes for signaling
        signalCache.delete(roomId);
        try {
          const filePath = getTmpFilePath(roomId);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }
    }
  }, 60000);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, action, offer, answer, candidate, chunkIndex, chunkDataHex, totalChunks, fileName, fileSize } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    const current = await readSignalState(roomId);

    if (action === 'submit_offer') {
      current.offer = offer;
      await writeSignalState(roomId, current);
      return NextResponse.json({ success: true });
    }

    if (action === 'submit_answer') {
      current.answer = answer;
      await writeSignalState(roomId, current);
      return NextResponse.json({ success: true });
    }

    if (action === 'submit_sender_candidate' || action === 'submit_candidate') {
      if (candidate) {
        current.senderCandidates = current.senderCandidates || [];
        if (current.senderCandidates.length < 50) {
          current.senderCandidates.push(candidate);
        }
        await writeSignalState(roomId, current);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'submit_receiver_candidate') {
      if (candidate) {
        current.receiverCandidates = current.receiverCandidates || [];
        if (current.receiverCandidates.length < 50) {
          current.receiverCandidates.push(candidate);
        }
        await writeSignalState(roomId, current);
      }
      return NextResponse.json({ success: true });
    }

    // Ephemeral Ciphertext Staging (Offline Fallback)
    if (action === 'submit_staging') {
      let staging = stagingCache.get(roomId);
      if (!staging) {
        staging = {
          chunks: new Map<number, string>(),
          updatedAt: Date.now(),
          totalChunks: totalChunks || 1,
          fileName: fileName || 'file.bin',
          fileSize: fileSize || 0,
        };
        stagingCache.set(roomId, staging);
      }

      if (typeof chunkIndex === 'number' && chunkDataHex) {
        staging.chunks.set(chunkIndex, chunkDataHex);
        staging.updatedAt = Date.now();
      }
      return NextResponse.json({ success: true, storedChunks: staging.chunks.size });
    }

    // Self-destruct staging cache on completion
    if (action === 'clear_staging') {
      stagingCache.delete(roomId);
      return NextResponse.json({ success: true, destroyed: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');
  const action = searchParams.get('action');

  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
  }

  // Get staging ciphertext chunks for offline receiver
  if (action === 'get_staging') {
    const staging = stagingCache.get(roomId);
    if (!staging) {
      return NextResponse.json({ available: false });
    }

    const receivedCount = staging.chunks.size;
    const totalCount = staging.totalChunks;

    if (receivedCount < totalCount) {
      return NextResponse.json({
        available: false,
        partial: true,
        receivedChunks: receivedCount,
        totalChunks: totalCount,
      });
    }

    const chunksArray: { index: number; dataHex: string }[] = [];
    for (const [index, dataHex] of staging.chunks.entries()) {
      chunksArray.push({ index, dataHex });
    }
    chunksArray.sort((a, b) => a.index - b.index);

    return NextResponse.json({
      available: true,
      fileName: staging.fileName,
      fileSize: staging.fileSize,
      totalChunks: staging.totalChunks,
      chunks: chunksArray,
    });
  }

  const signal = await readSignalState(roomId);

  if (!signal || (!signal.offer && !signal.answer)) {
    return NextResponse.json({ waiting: true });
  }

  return NextResponse.json({
    offer: signal.offer || null,
    answer: signal.answer || null,
    senderCandidates: signal.senderCandidates || [],
    receiverCandidates: signal.receiverCandidates || [],
  });
}
