import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Cloudflare Workers & Serverless Universal In-Memory Signaling Cache
const globalForSignal = globalThis as unknown as {
  signalCache: Map<string, { offer?: any; answer?: any; senderCandidates?: any[]; receiverCandidates?: any[]; updatedAt: number }>;
  stagingCache: Map<string, { chunks: Map<number, any>; updatedAt: number; totalChunks: number; fileName: string; fileSize: number }>;
};

const signalCache = globalForSignal.signalCache || new Map();
const stagingCache = globalForSignal.stagingCache || new Map();

globalForSignal.signalCache = signalCache;
globalForSignal.stagingCache = stagingCache;

function readSignalState(roomId: string) {
  let state = signalCache.get(roomId);
  return state || { senderCandidates: [], receiverCandidates: [], updatedAt: Date.now() };
}

function writeSignalState(roomId: string, state: any) {
  state.updatedAt = Date.now();
  signalCache.set(roomId, state);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');
  const action = searchParams.get('action');

  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
  }

  const cleanId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');

  if (action === 'get_staging') {
    const stage = stagingCache.get(cleanId);
    if (!stage) {
      return NextResponse.json({ available: false });
    }

    const chunkArray = Array.from(stage.chunks.values());
    return NextResponse.json({
      available: true,
      fileName: stage.fileName,
      fileSize: stage.fileSize,
      totalChunks: stage.totalChunks,
      receivedCount: stage.chunks.size,
      chunks: chunkArray,
    });
  }

  const state = readSignalState(cleanId);
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, action, offer, answer, candidate, chunkIndex, chunkDataB64, chunkDataHex, totalChunks, fileName, fileSize } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    const cleanId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
    const state = readSignalState(cleanId);

    if (action === 'submit_offer' && offer) {
      state.offer = offer;
      writeSignalState(cleanId, state);
      return NextResponse.json({ success: true, message: 'Offer registered' });
    }

    if (action === 'submit_answer' && answer) {
      state.answer = answer;
      writeSignalState(cleanId, state);
      return NextResponse.json({ success: true, message: 'Answer registered' });
    }

    if (action === 'submit_sender_candidate' && candidate) {
      if (!state.senderCandidates) state.senderCandidates = [];
      const key = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
      const exists = state.senderCandidates.some((c: any) => (typeof c === 'string' ? c : JSON.stringify(c)) === key);
      if (!exists) {
        state.senderCandidates.push(candidate);
        writeSignalState(cleanId, state);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'submit_receiver_candidate' && candidate) {
      if (!state.receiverCandidates) state.receiverCandidates = [];
      const key = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
      const exists = state.receiverCandidates.some((c: any) => (typeof c === 'string' ? c : JSON.stringify(c)) === key);
      if (!exists) {
        state.receiverCandidates.push(candidate);
        writeSignalState(cleanId, state);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'submit_staging' && typeof chunkIndex === 'number') {
      let stage = stagingCache.get(cleanId);
      if (!stage) {
        stage = {
          chunks: new Map(),
          updatedAt: Date.now(),
          totalChunks: totalChunks || 0,
          fileName: fileName || 'file',
          fileSize: fileSize || 0,
        };
        stagingCache.set(cleanId, stage);
      }

      stage.chunks.set(chunkIndex, {
        index: chunkIndex,
        dataB64: chunkDataB64,
        dataHex: chunkDataHex,
      });
      stage.updatedAt = Date.now();

      return NextResponse.json({ success: true, count: stage.chunks.size });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
