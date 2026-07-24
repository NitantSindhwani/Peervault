import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export interface AuditLogEvent {
  id: string;
  event: 'room_created' | 'peer_connected' | 'transfer_progress' | 'transfer_completed' | 'room_expired';
  roomId: string;
  fileName: string;
  fileSize: number;
  progressPercent?: number;
  speedBytesPerSec?: number;
  ip: string;
  country: string;
  city: string;
  userAgent: string;
  timestamp: string;
}

// In-Memory System Telemetry Store (Holds last 200 events)
const adminLogsQueue: AuditLogEvent[] = [];
const activeRoomsMap = new Map<string, AuditLogEvent>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, roomId, fileName, fileSize, progressPercent, speedBytesPerSec } = body;

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || 'US';
    const city = request.headers.get('x-vercel-ip-city') || 'Localhost';
    const userAgent = request.headers.get('user-agent') || 'Unknown Browser';

    const logEntry: AuditLogEvent = {
      id: `log_${Math.random().toString(36).substring(2, 9)}`,
      event: event || 'room_created',
      roomId: roomId || 'unknown',
      fileName: fileName || 'unknown',
      fileSize: fileSize || 0,
      progressPercent: progressPercent || 0,
      speedBytesPerSec: speedBytesPerSec || 0,
      ip,
      country,
      city,
      userAgent,
      timestamp: new Date().toISOString(),
    };

    // Store in telemetry queue
    adminLogsQueue.unshift(logEntry);
    if (adminLogsQueue.length > 200) adminLogsQueue.pop();

    // Track active room state
    activeRoomsMap.set(roomId, logEntry);

    // 1. Structured Console Log for Server Monitoring
    console.log(`[SYSTEM LOG] ${logEntry.event.toUpperCase()} | File: ${logEntry.fileName} (${(logEntry.fileSize / 1048576).toFixed(2)} MB) | IP: ${logEntry.ip} (${logEntry.city}, ${logEntry.country}) | Room: ${logEntry.roomId}`);

    // 2. Webhook Notification Alert
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl && (event === 'room_created' || event === 'transfer_completed')) {
      const isComplete = event === 'transfer_completed';
      const color = isComplete ? 0x22C55E : 0xEA8C28;
      const title = isComplete ? '✅ P2P Transfer Completed' : '🚀 Instant P2P Room Created';

      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [
              {
                title,
                color,
                fields: [
                  { name: '📁 File Name', value: `\`${logEntry.fileName}\``, inline: true },
                  { name: '📦 Size', value: `\`${(logEntry.fileSize / (1024 * 1024)).toFixed(2)} MB\``, inline: true },
                  { name: '🌐 Client IP & Location', value: `\`${logEntry.ip}\` (${logEntry.city}, ${logEntry.country})`, inline: false },
                  { name: '🔑 Room ID', value: `\`${logEntry.roomId}\``, inline: true },
                  { name: '⏰ Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                ],
                footer: {
                  text: 'PeerVault System Telemetry',
                },
              },
            ],
          }),
        });
      } catch (err) {
        console.warn('[System Log] Webhook send failed:', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secretKey = searchParams.get('key');

  // Environment Variable Check (Zero hardcoded secrets in GitHub)
  const expectedKey = process.env.ADMIN_TELEMETRY_SECRET;

  if (!expectedKey || secretKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
  }

  const activeRooms = Array.from(activeRoomsMap.values());
  const totalBytesStreamed = adminLogsQueue
    .filter((l) => l.event === 'transfer_completed')
    .reduce((acc, l) => acc + l.fileSize, 0);

  return NextResponse.json({
    totalLogsCount: adminLogsQueue.length,
    activeTransfersCount: activeRooms.length,
    totalBytesStreamed,
    activeRooms,
    logs: adminLogsQueue,
  });
}
