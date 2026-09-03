import { NextResponse } from 'next/server';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET() {
  const nets = os.networkInterfaces();
  let lanIp: string | null = null;

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Find IPv4 non-internal address
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
    if (lanIp) break;
  }

  return NextResponse.json({ lanIp: lanIp || '127.0.0.1' });
}
