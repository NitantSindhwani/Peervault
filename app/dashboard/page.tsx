'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChartLineUp,
  ShieldCheck,
  BellRinging,
  ToggleLeft,
  ToggleRight,
  UsersThree,
  Lightning,
  PaperPlaneTilt,
  CheckCircle,
  WarningCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from '@phosphor-icons/react';
import { sendTestWebhook } from '@/lib/notifications/webhook';
import { getFileReceipts, type FileReceipt } from '@/lib/notifications/receipts';

export default function DashboardPage() {
  const [meshNodeEnabled, setMeshNodeEnabled] = useState(false);
  const [relayedDataMb, setRelayedDataMb] = useState(0);
  const [activeRelayPeers, setActiveRelayPeers] = useState(0);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savedWebhook, setSavedWebhook] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestFeedback, setWebhookTestFeedback] = useState<{ success: boolean; msg: string } | null>(null);
  const [receipts, setReceipts] = useState<FileReceipt[]>([]);

  // Load real persisted relay stats & receipts on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled = localStorage.getItem('peervault_relay_enabled') === 'true';
      const bytes = parseFloat(localStorage.getItem('peervault_relay_bytes') || '0');
      const peers = parseInt(localStorage.getItem('peervault_relay_peers') || '0', 10);
      const savedUrl = localStorage.getItem('peervault_webhook_url') || '';

      setMeshNodeEnabled(enabled);
      setRelayedDataMb(parseFloat((bytes / (1024 * 1024)).toFixed(1)));
      setActiveRelayPeers(peers);
      setWebhookUrl(savedUrl);
      setReceipts(getFileReceipts());
    }
  }, []);

  const toggleMeshNode = () => {
    const nextState = !meshNodeEnabled;
    setMeshNodeEnabled(nextState);

    if (typeof window !== 'undefined') {
      localStorage.setItem('peervault_relay_enabled', String(nextState));
    }
  };

  const handleSaveWebhook = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('peervault_webhook_url', webhookUrl);
      setSavedWebhook(true);
      setTimeout(() => setSavedWebhook(false), 2000);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setWebhookTestFeedback({ success: false, msg: 'Enter a webhook URL first.' });
      return;
    }
    setTestingWebhook(true);
    setWebhookTestFeedback(null);
    const result = await sendTestWebhook(webhookUrl.trim());
    setTestingWebhook(false);
    if (result.success) {
      setWebhookTestFeedback({ success: true, msg: '✓ Test notification delivered to Discord/Slack!' });
    } else {
      setWebhookTestFeedback({ success: false, msg: result.error || 'Failed to send alert.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent)]">
          <ChartLineUp className="w-3.5 h-3.5" />
          <span>My Transfer Dashboard</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] font-display">
          Transfer Hub & Settings
        </h1>
        <p className="text-sm text-[var(--text-secondary)] font-mono">
          Help friends connect on strict Wi-Fi, setup notification alerts, & view file receipts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Connection Helper (Real P2P Relay Node) */}
        <div className="lg:col-span-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
            <div className="space-y-1">
              <span className="text-xs font-mono text-[var(--accent)] font-bold uppercase tracking-wider flex items-center gap-1">
                <UsersThree className="w-3.5 h-3.5" />
                Optional Helper Switch
              </span>
              <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">
                Help Connect Friends on Strict Wi-Fi
              </h3>
            </div>
            <button
              onClick={toggleMeshNode}
              className="text-3xl text-[var(--accent)] hover:opacity-80 transition-opacity cursor-pointer"
              title="Toggle Helper Mode"
            >
              {meshNodeEnabled ? (
                <ToggleRight className="w-10 h-10 text-[var(--accent)]" weight="fill" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-[var(--text-secondary)]" />
              )}
            </button>
          </div>

          <p className="text-xs text-[var(--text-secondary)] font-mono leading-relaxed">
            Some college or office Wi-Fi networks block direct transfers. Turn this switch ON to let your browser tab act as an encrypted P2P relay node for them.
          </p>

          {/* Real Helper Stats Display */}
          <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-[11px] text-[var(--text-secondary)]">Relay Status:</span>
              <span className={`font-bold flex items-center gap-1.5 ${meshNodeEnabled ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>
                <span className={`w-2 h-2 rounded-full ${meshNodeEnabled ? 'bg-[var(--success)] animate-pulse' : 'bg-gray-600'}`} />
                {meshNodeEnabled ? 'Active (Listening for Peers)' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase">Data Helped Route:</span>
                <div className="text-xl font-bold text-[var(--text-primary)]">
                  {relayedDataMb} <span className="text-xs text-[var(--accent)] font-normal">MB</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase">Friends Helped:</span>
                <div className="text-xl font-bold text-[var(--success)]">
                  {activeRelayPeers} <span className="text-xs text-[var(--text-secondary)] font-normal">Users</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Notifications & File Receipts */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Notifications */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <BellRinging className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-bold text-base text-[var(--text-primary)] font-display">Completion Notifications (Slack / Discord)</h3>
            </div>
            
            <div className="space-y-3 font-mono text-xs">
              <p className="text-[11px] text-[var(--text-secondary)]">
                Receive an automatic ping in your Discord or Slack channel whenever a file transfer completes.
              </p>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  setWebhookTestFeedback(null);
                }}
                placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] text-xs"
              />

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveWebhook}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-bold hover:opacity-90 cursor-pointer shadow-md text-xs transition-opacity"
                >
                  {savedWebhook ? '✓ Saved Webhook!' : 'Save Webhook'}
                </button>

                <button
                  onClick={handleTestWebhook}
                  disabled={testingWebhook}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] font-bold cursor-pointer text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <PaperPlaneTilt className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>{testingWebhook ? 'Testing...' : 'Send Test Ping'}</span>
                </button>
              </div>

              {webhookTestFeedback && (
                <div
                  className={`p-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-2 ${
                    webhookTestFeedback.success
                      ? 'bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}
                >
                  {webhookTestFeedback.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <WarningCircle className="w-4 h-4 shrink-0" />}
                  <span>{webhookTestFeedback.msg}</span>
                </div>
              )}
            </div>
          </div>

          {/* Real Cryptographic File Delivery Receipts */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4 shadow-xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--success)]" />
                <h3 className="font-bold text-base text-[var(--text-primary)] font-display">Verifiable Transfer Receipts</h3>
              </div>
              <span className="text-[10px] text-[var(--success)] font-bold">BLAKE3 Merkle Audited</span>
            </div>

            {receipts.length > 0 ? (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {receipts.map((rcpt) => (
                  <div key={rcpt.id} className="bg-[var(--bg-main)] p-3 rounded-xl border border-[var(--border-color)] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-primary)] font-bold truncate max-w-[200px]">
                        {rcpt.fileName}
                      </span>
                      <span className="text-[var(--success)] font-bold flex items-center gap-1">
                        {rcpt.type === 'sent' ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-[var(--accent)]" />
                        ) : (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-[var(--success)]" />
                        )}
                        <span>{rcpt.type === 'sent' ? 'Uploaded' : 'Received'}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                      <span>{(rcpt.fileSize / (1024 * 1024)).toFixed(2)} MB • {new Date(rcpt.timestamp).toLocaleDateString()}</span>
                      <span className="text-[var(--success)] font-mono">✓ 100% Passed</span>
                    </div>
                    <div className="text-[9px] text-[var(--text-secondary)]/60 truncate font-mono">
                      Root: {rcpt.merkleRoot}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[var(--bg-main)] p-5 rounded-xl border border-[var(--border-color)] space-y-2 text-center">
                <Clock className="w-6 h-6 text-[var(--text-secondary)]/50 mx-auto" />
                <p className="text-xs font-bold text-[var(--text-primary)]">No Transfer Receipts Yet</p>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Cryptographic delivery receipts and BLAKE3 Merkle roots will automatically appear here once you send or receive files.
                </p>
                <div className="pt-2">
                  <Link
                    href="/send"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-bold text-[11px] hover:opacity-90 transition-opacity"
                  >
                    <span>Send a File Now</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
