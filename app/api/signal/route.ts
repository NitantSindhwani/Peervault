import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const MAX_SIGNAL_BODY_BYTES = 128 * 1024;

// Cloudflare Workers & Serverless Universal In-Memory Signaling Cache
const globalForSignal = globalThis as unknown as {
  signalCache: Map<string, { offer?: any; answer?: any; senderCandidates?: any[]; receiverCandidates?: any[]; updatedAt: number }>;
};

const signalCache = globalForSignal.signalCache || new Map();

globalForSignal.signalCache = signalCache;

function signalResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      ...(init?.headers || {}),
    },
  });
}

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

  if (!roomId) {
    return signalResponse({ error: 'Missing roomId' }, { status: 400 });
  }

  const cleanId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) {
    return signalResponse({ error: 'Invalid roomId' }, { status: 400 });
  }

  const state = readSignalState(cleanId);
  return signalResponse(state);
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_SIGNAL_BODY_BYTES) {
      return signalResponse({ error: 'Signal payload is too large' }, { status: 413 });
    }

    const body = await request.json();
    const { roomId, action, offer, answer, candidate } = body;

    if (!roomId) {
      return signalResponse({ error: 'Missing roomId' }, { status: 400 });
    }

    const cleanId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId) {
      return signalResponse({ error: 'Invalid roomId' }, { status: 400 });
    }
    const state = readSignalState(cleanId);

    if (action === 'submit_offer' && offer) {
      state.offer = offer;
      writeSignalState(cleanId, state);
      return signalResponse({ success: true, message: 'Offer registered' });
    }

    if (action === 'submit_answer' && answer) {
      state.answer = answer;
      writeSignalState(cleanId, state);
      return signalResponse({ success: true, message: 'Answer registered' });
    }

    if (action === 'submit_sender_candidate' && candidate) {
      if (!state.senderCandidates) state.senderCandidates = [];
      const key = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
      const exists = state.senderCandidates.some((c: any) => (typeof c === 'string' ? c : JSON.stringify(c)) === key);
      if (!exists) {
        state.senderCandidates.push(candidate);
        writeSignalState(cleanId, state);
      }
      return signalResponse({ success: true });
    }

    if (action === 'submit_receiver_candidate' && candidate) {
      if (!state.receiverCandidates) state.receiverCandidates = [];
      const key = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
      const exists = state.receiverCandidates.some((c: any) => (typeof c === 'string' ? c : JSON.stringify(c)) === key);
      if (!exists) {
        state.receiverCandidates.push(candidate);
        writeSignalState(cleanId, state);
      }
      return signalResponse({ success: true });
    }

    return signalResponse({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return signalResponse({ error: err.message || 'Server error' }, { status: 500 });
  }
}
