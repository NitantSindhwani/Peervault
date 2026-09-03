import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_SIGNAL_BODY_BYTES = 128 * 1024;

import fs from 'fs';
import path from 'path';
import os from 'os';

// Cloudflare Workers / Serverless fallback + Local File System Cache
// Using the file system guarantees that multiple Next.js dev workers share the same state.
const CACHE_DIR = path.join(os.tmpdir(), 'peervault_signals');
try {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch {}

// Garbage Collection: Remove rooms older than 24 hours to prevent disk bloat
if (!(globalThis as any).gcInterval) {
  (globalThis as any).gcInterval = setInterval(() => {
    try {
      const now = Date.now();
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {}
  }, 60 * 60 * 1000); // Run every hour
}

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
  const filePath = path.join(CACHE_DIR, `${roomId}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch {}
  return { senderCandidates: [], receiverCandidates: [], updatedAt: Date.now() };
}

function writeSignalState(roomId: string, state: any) {
  state.updatedAt = Date.now();
  const filePath = path.join(CACHE_DIR, `${roomId}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(state));
  } catch {}
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
