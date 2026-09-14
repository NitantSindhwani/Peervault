import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const MAX_SIGNAL_BODY_BYTES = 128 * 1024;
// Signal state TTL: 2 hours in seconds (Cloudflare KV), in ms for in-memory fallback
const TTL_SECONDS = 7200;
const TTL_MS = TTL_SECONDS * 1000;

// ─── In-memory fallback for local dev (single process only) ─────────────────
// On Cloudflare Workers/Pages, KV is the sole shared store.
// Locally, we use a module-level Map so all API routes share one instance.
interface SignalState {
  offer?: any;
  answer?: any;
  senderCandidates: any[];
  receiverCandidates: any[];
  updatedAt: number;
}

const localCache = new Map<string, SignalState>();
const localCacheTimers = new Map<string, ReturnType<typeof setTimeout>>();

function localGet(roomId: string): SignalState {
  return localCache.get(roomId) ?? { senderCandidates: [], receiverCandidates: [], updatedAt: Date.now() };
}

function localSet(roomId: string, state: SignalState) {
  state.updatedAt = Date.now();
  localCache.set(roomId, state);
  // Auto-evict after TTL
  if (localCacheTimers.has(roomId)) clearTimeout(localCacheTimers.get(roomId)!);
  localCacheTimers.set(roomId, setTimeout(() => {
    localCache.delete(roomId);
    localCacheTimers.delete(roomId);
  }, TTL_MS));
}

// ─── Cloudflare KV helpers ───────────────────────────────────────────────────
// On Cloudflare Pages/Workers, the KV namespace is injected via `process.env`
// as a Workers KV binding named SIGNAL_KV.
// See wrangler.toml [[kv_namespaces]] or Pages dashboard KV binding.
function getKV(): KVNamespace | null {
  try {
    const env = process.env as any;
    return env?.SIGNAL_KV ?? null;
  } catch {
    return null;
  }
}

async function kvGet(kv: KVNamespace, roomId: string): Promise<SignalState> {
  try {
    const raw = await kv.get(roomId, 'text');
    if (raw) return JSON.parse(raw) as SignalState;
  } catch {}
  return { senderCandidates: [], receiverCandidates: [], updatedAt: Date.now() };
}

async function kvSet(kv: KVNamespace, roomId: string, state: SignalState) {
  state.updatedAt = Date.now();
  try {
    await kv.put(roomId, JSON.stringify(state), { expirationTtl: TTL_SECONDS });
  } catch {}
}

// ─── Unified read/write ──────────────────────────────────────────────────────
async function readState(roomId: string): Promise<SignalState> {
  const kv = getKV();
  if (kv) return kvGet(kv, roomId);
  return localGet(roomId);
}

async function writeState(roomId: string, state: SignalState) {
  const kv = getKV();
  if (kv) return kvSet(kv, roomId, state);
  localSet(roomId, state);
}

// ─── Response helper ─────────────────────────────────────────────────────────
function signalResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      ...(init?.headers || {}),
    },
  });
}

// ─── GET — read signal state for a room ─────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) return signalResponse({ error: 'Missing roomId' }, { status: 400 });
  const cleanId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) return signalResponse({ error: 'Invalid roomId' }, { status: 400 });

  const state = await readState(cleanId);
  return signalResponse(state);
}

// ─── POST — submit offer / answer / ICE candidates ──────────────────────────
export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_SIGNAL_BODY_BYTES) {
      return signalResponse({ error: 'Signal payload is too large' }, { status: 413 });
    }

    const body = await request.json();
    const { roomId, action, offer, answer, candidate } = body;

    if (!roomId) return signalResponse({ error: 'Missing roomId' }, { status: 400 });
    const cleanId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId) return signalResponse({ error: 'Invalid roomId' }, { status: 400 });

    const state = await readState(cleanId);

    if (action === 'submit_offer' && offer) {
      state.offer = offer;
      await writeState(cleanId, state);
      return signalResponse({ success: true, message: 'Offer registered' });
    }

    if (action === 'submit_answer' && answer) {
      state.answer = answer;
      await writeState(cleanId, state);
      return signalResponse({ success: true, message: 'Answer registered' });
    }

    if (action === 'submit_sender_candidate' && candidate) {
      if (!state.senderCandidates) state.senderCandidates = [];
      const key = JSON.stringify(candidate);
      if (!state.senderCandidates.some((c: any) => JSON.stringify(c) === key)) {
        state.senderCandidates.push(candidate);
        await writeState(cleanId, state);
      }
      return signalResponse({ success: true });
    }

    if (action === 'submit_receiver_candidate' && candidate) {
      if (!state.receiverCandidates) state.receiverCandidates = [];
      const key = JSON.stringify(candidate);
      if (!state.receiverCandidates.some((c: any) => JSON.stringify(c) === key)) {
        state.receiverCandidates.push(candidate);
        await writeState(cleanId, state);
      }
      return signalResponse({ success: true });
    }

    return signalResponse({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return signalResponse({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
// The KVNamespace type is provided by @cloudflare/workers-types.
// We inline a minimal interface here to avoid adding a devDependency.
interface KVNamespace {
  get(key: string, type: 'text'): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}
