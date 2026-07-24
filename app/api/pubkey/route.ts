import { NextResponse } from 'next/server';

export async function GET() {
  const pubkey = process.env.PEERVAULT_PUBLIC_KEY_HEX || 'e8a94b12f8c37d10ab67e9124a8723bc9910a34b2190f842d';

  return NextResponse.json({
    pubkey,
    algorithm: 'Ed25519',
    issued_at: new Date().toISOString(),
  });
}
