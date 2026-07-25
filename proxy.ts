import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const isSignal = request.nextUrl.pathname.startsWith('/api/signal');
    const limit = isSignal ? 300 : 60; // 300/min for WebRTC signaling

    const current = rateLimitMap.get(ip);

    if (!current || now > current.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    } else {
      current.count += 1;
      if (current.count > limit) {
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
            },
          }
        );
      }
    }
  }

  return NextResponse.next();
}

export const runtime = 'edge';

export const config = {
  matcher: '/api/:path*',
};
