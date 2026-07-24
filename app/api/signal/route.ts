import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Global Persistent In-Memory Signaling & Staging Caches
const globalForSignal = globalThis as unknown as {
  signalCache: Map<string, { offer?: any; answer?: any; senderCandidates?: any[]; receiverCandidates?: any[]; updatedAt: number }>;
  stagingCache: Map<string, { chunks: Map<number, string>; updatedAt: number; totalChunks: number; fileName: string; fileSize: number }>;
};

const signalCache = globalForSignal.signalCache || new Map();
const stagingCache = globalForSignal.stagingCache || new Map();

globalForSignal.signalCache = signalCache;
globalForSignal.stagingCache = stagingCache;

// Cleanup stale entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [roomId, item] of signalCache.entries()) {
    if (now - item.updatedAt > 600000) { // 10 minutes for signaling
      signalCache.delete(roomId);
    }
  }
  for (const [roomId, item] of stagingCache.entries()) {
    if (now - item.updatedAt > 24 * 60 * 60 * 1000) { // 24 hours for staging
      stagingCache.delete(roomId);
    }
  }
}, 60000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, action, offer, answer, candidate, chunkIndex, chunkDataHex, totalChunks, fileName, fileSize } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    const current = signalCache.get(roomId) || { senderCandidates: [], receiverCandidates: [], updatedAt: Date.now() };

    if (action === 'submit_offer') {
      current.offer = offer;
      current.updatedAt = Date.now();
      signalCache.set(roomId, current);
      return NextResponse.json({ success: true });
    }

    if (action === 'submit_answer') {
      current.answer = answer;
      current.updatedAt = Date.now();
      signalCache.set(roomId, current);
      return NextResponse.json({ success: true });
    }

    if (action === 'submit_sender_candidate' || action === 'submit_candidate') {
      if (candidate) {
        current.senderCandidates = current.senderCandidates || [];
        current.senderCandidates.push(candidate);
        current.updatedAt = Date.now();
        signalCache.set(roomId, current);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'submit_receiver_candidate') {
      if (candidate) {
        current.receiverCandidates = current.receiverCandidates || [];
        current.receiverCandidates.push(candidate);
        current.updatedAt = Date.now();
        signalCache.set(roomId, current);
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

    // Only return chunks once ALL have been received to prevent partial file assembly
    if (receivedCount < totalCount) {
      return NextResponse.json({
        available: false,
        partial: true,
        receivedChunks: receivedCount,
        totalChunks: totalCount,
      });
    }

    // Sort chunks by index to guarantee correct byte order
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

  const signal = signalCache.get(roomId);

  if (!signal) {
    return NextResponse.json({ waiting: true });
  }

  return NextResponse.json({
    offer: signal.offer || null,
    answer: signal.answer || null,
    senderCandidates: signal.senderCandidates || [],
    receiverCandidates: signal.receiverCandidates || [],
  });
}
