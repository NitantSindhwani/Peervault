import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-Memory Signaling Cache (Auto-cleans expired entries after 120s)
const signalCache = new Map<
  string,
  { offer?: any; answer?: any; iceCandidates?: any[]; updatedAt: number }
>();

// Cleanup stale entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [roomId, item] of signalCache.entries()) {
    if (now - item.updatedAt > 120000) {
      signalCache.delete(roomId);
    }
  }
}, 30000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, action, offer, answer, candidate } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    const current = signalCache.get(roomId) || { iceCandidates: [], updatedAt: Date.now() };

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

    if (action === 'submit_candidate') {
      if (candidate) {
        current.iceCandidates = current.iceCandidates || [];
        current.iceCandidates.push(candidate);
        current.updatedAt = Date.now();
        signalCache.set(roomId, current);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
  }

  const signal = signalCache.get(roomId);

  if (!signal) {
    return NextResponse.json({ waiting: true });
  }

  return NextResponse.json({
    offer: signal.offer || null,
    answer: signal.answer || null,
    iceCandidates: signal.iceCandidates || [],
  });
}
