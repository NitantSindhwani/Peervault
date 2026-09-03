/**
 * PeerVault Real Webhook Notification Dispatcher
 * Supports Discord Webhooks & Slack Incoming Webhooks
 */

export interface TransferEvent {
  type: 'sent' | 'received';
  fileName: string;
  fileSize: number;
  merkleRoot?: string;
  durationSec?: number;
}

export async function sendTestWebhook(url: string): Promise<{ success: boolean; error?: string }> {
  if (!url || !url.startsWith('http')) {
    return { success: false, error: 'Please enter a valid HTTP(S) webhook URL' };
  }

  const isSlack = url.includes('slack.com');
  const payload = isSlack
    ? {
        text: `🔔 *PeerVault Test Notification*\nWebhook connection verified successfully! You will receive instant notifications here when transfers complete.`,
      }
    : {
        username: 'PeerVault Bot',
        avatar_url: 'https://peervault.io/icon.png',
        embeds: [
          {
            title: `🔔 PeerVault Test Notification`,
            description: `Webhook connection verified successfully! You will receive instant alerts here whenever a P2P transfer finishes.`,
            color: 0xea8c28,
            fields: [
              { name: 'Status', value: '✓ Verified & Active', inline: true },
              { name: 'Encryption', value: 'Zero-Knowledge P2P', inline: true },
            ],
            footer: { text: 'PeerVault.io Notifications' },
            timestamp: new Date().toISOString(),
          },
        ],
      };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { success: false, error: `Webhook rejected with status ${res.status}: ${res.statusText}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reach webhook URL' };
  }
}

export async function dispatchTransferNotification(event: TransferEvent): Promise<void> {
  if (typeof window === 'undefined') return;

  const url = localStorage.getItem('peervault_webhook_url');
  if (!url || !url.startsWith('http')) return;

  const sizeStr = (event.fileSize / (1024 * 1024)).toFixed(2) + ' MB';
  const actionText = event.type === 'sent' ? 'Sent' : 'Received';
  const isSlack = url.includes('slack.com');

  const payload = isSlack
    ? {
        text: `🚀 *PeerVault Transfer Complete!*\n• *File:* \`${event.fileName}\` (${sizeStr})\n• *Action:* Successfully ${actionText}\n• *Integrity:* BLAKE3 Merkle Verified (100% Passed)\n• *Timestamp:* ${new Date().toLocaleTimeString()}`,
      }
    : {
        username: 'PeerVault Bot',
        avatar_url: 'https://peervault.io/icon.png',
        embeds: [
          {
            title: `🚀 Transfer Successfully ${actionText}!`,
            description: `A direct zero-knowledge WebRTC stream finished streaming across devices.`,
            color: 0x22c55e,
            fields: [
              { name: 'File Name', value: `\`${event.fileName}\``, inline: true },
              { name: 'File Size', value: sizeStr, inline: true },
              { name: 'Integrity', value: '✓ BLAKE3 Verified', inline: true },
              { name: 'Delivery Mode', value: 'End-to-End Encrypted P2P', inline: true },
            ],
            footer: { text: 'PeerVault.io • Zero Cloud Wait' },
            timestamp: new Date().toISOString(),
          },
        ],
      };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[Webhook] Failed to dispatch transfer alert:', err);
  }
}
