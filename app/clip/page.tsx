'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Copy, Check, Code, Lightning, ShieldCheck, QrCode } from '@phosphor-icons/react';
import { QRCodeViewer } from '@/components/QRCodeViewer';
import { useClipVault } from '@/lib/hooks/useClipVault';
import { soundEngine } from '@/lib/audio/sound-engine';

function ClipVaultInner() {
  const searchParams = useSearchParams();
  const queryPair = searchParams.get('pair') || undefined;
  const [copied, setCopied] = useState(false);
  const { pairId, content, status, startPairing, sendContent } = useClipVault(queryPair);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    soundEngine.playHoverClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentPairUrl = typeof window !== 'undefined' && pairId
    ? `${window.location.origin}/clip?pair=${pairId}`
    : '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 font-mono">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--accent)]">
          <Copy className="w-3.5 h-3.5" weight="bold" />
          <span>ClipVault • Zero-Knowledge Real-Time Sync</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)] font-display">
          Encrypted P2P Clipboard
        </h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-[65ch]">
          Synchronize code snippets, passwords, and tokens between your phone and laptop instantly over hardware-encrypted WebRTC DataChannels.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Code Editor Panel (8 cols) */}
        <div className="lg:col-span-8 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3 text-xs">
            <span className="text-[var(--text-primary)] font-bold flex items-center gap-2 font-display">
              <Code className="w-4 h-4 text-[var(--accent)]" />
              Live Synced Clipboard Buffer
            </span>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1.5 ${
                status === 'synced'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : status === 'pairing'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status === 'synced' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {status}
              </span>
              <button
                onClick={handleCopy}
                disabled={!content}
                className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-[var(--bg-main)] text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer transition-opacity"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <textarea
            value={content}
            placeholder={status === 'synced' ? 'Type or paste content here to sync live across devices...' : 'Pair a second device using the QR code to begin real-time sync...'}
            onChange={(e) => sendContent(e.target.value)}
            rows={12}
            className="w-full p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-y font-mono leading-relaxed placeholder:text-[var(--text-secondary)]/50"
          />

          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--success)]" />
              E2EE AES-256-GCM Hardware Encrypted
            </span>
            <span>{content.length} characters</span>
          </div>
        </div>

        {/* Device Pairing Panel (4 cols) */}
        <div className="lg:col-span-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6 text-center shadow-xl">
          <div className="space-y-1">
            <span className="text-xs text-[var(--accent)] uppercase tracking-wider font-bold">Device Pairing</span>
            <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Instant Pair QR</h3>
            <p className="text-xs text-[var(--text-secondary)]">Scan from your mobile camera or another browser window.</p>
          </div>

          {pairId ? (
            <div className="space-y-4">
              <div className="flex justify-center p-3 bg-white rounded-xl w-fit mx-auto shadow-md">
                <QRCodeViewer url={currentPairUrl} size={160} />
              </div>
              <div className="bg-[var(--bg-main)] p-3 rounded-xl border border-[var(--border-color)] text-xs text-left space-y-2 text-[var(--text-secondary)]">
                <div className="flex justify-between items-center text-[11px]">
                  <span>Room ID:</span>
                  <span className="text-[var(--text-primary)] font-bold">{pairId}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>Connection:</span>
                  <span className="text-[var(--success)] font-bold uppercase">{status}</span>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={startPairing}
              className="w-full py-3.5 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] text-xs font-bold hover:opacity-90 transition-opacity glow-amber flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Lightning className="w-4 h-4" weight="fill" />
              Generate P2P Pairing Code
            </button>
          )}

          <div className="pt-2 border-t border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] text-left space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
              <QrCode className="w-3.5 h-3.5 text-[var(--accent)]" />
              How Pairing Works:
            </div>
            <p>1. Open this page on Device A and click Generate Code.</p>
            <p>2. Scan the QR code or share the URL with Device B.</p>
            <p>3. Text typed on either device syncs automatically.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClipVaultPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-20 text-center font-mono text-sm text-[var(--text-secondary)]">
        Loading ClipVault secure session...
      </div>
    }>
      <ClipVaultInner />
    </Suspense>
  );
}
