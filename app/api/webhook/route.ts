import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { url, payload } = await request.json();

    if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
      return NextResponse.json({ error: 'Valid HTTPS webhook URL is required' }, { status: 400 });
    }

    // Only allow known webhook domains for safety
    const parsedUrl = new URL(url);
    const allowedHosts = ['discord.com', 'discordapp.com', 'hooks.slack.com', 'webhook.office.com'];
    if (!allowedHosts.some((h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`))) {
      return NextResponse.json({ error: 'Webhook host must be Discord, Slack, or Teams' }, { status: 403 });
    }

    const upstreamRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream rejected with status ${upstreamRes.status}` },
        { status: upstreamRes.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Webhook dispatch failed' }, { status: 500 });
  }
}
