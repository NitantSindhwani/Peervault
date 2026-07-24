import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const limit = 30; // 30 requests per minute

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

export const config = {
  matcher: '/api/:path*',
};
