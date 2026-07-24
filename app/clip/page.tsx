'use client';

import { useState } from 'react';
import { Copy, Check, Code, Lightning } from '@phosphor-icons/react';
import { QRCodeViewer } from '@/components/QRCodeViewer';
import { useClipVault } from '@/lib/hooks/useClipVault';

export default function ClipVaultPage() {
  const [copied, setCopied] = useState(false);
  const { pairId, content, status, startPairing, sendContent } = useClipVault();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent)]">
          <Copy className="w-3.5 h-3.5" />
          <span>ClipVault P2P Sync</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] font-display">
          Zero-Knowledge Clipboard Sync
        </h1>
        <p className="text-sm text-[var(--text-secondary)] font-mono">
          Synchronize code snippets, links, and tokens in real time between paired devices over WebRTC DataChannel.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Code Editor Panel (8 cols) */}
        <div className="lg:col-span-8 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3 font-mono text-xs">
            <span className="text-[var(--text-primary)] font-bold flex items-center gap-2 font-display">
              <Code className="w-4 h-4 text-[var(--accent)]" />
              Live Synced P2P Clipboard
            </span>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-[var(--bg-main)] font-mono text-xs font-bold hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
          </div>

          <textarea
            value={content}
            placeholder="Type or paste text here to synchronize live across paired P2P devices..."
            onChange={(e) => sendContent(e.target.value)}
            rows={10}
            className="w-full p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] font-mono text-xs text-[var(--accent)] focus:outline-none focus:border-[var(--accent)] resize-y"
          />
        </div>

        {/* Device Pairing Panel (4 cols) */}
        <div className="lg:col-span-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6 text-center shadow-xl">
          <div className="space-y-1 font-mono">
            <span className="text-xs text-[var(--accent)] uppercase tracking-wider font-bold">Device Pairing QR</span>
            <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Scan to Pair Device</h3>
            <p className="text-xs text-[var(--text-secondary)]">Pair mobile or desktop tab to sync clipboard live.</p>
          </div>

          {pairId ? (
            <div className="flex justify-center">
              <QRCodeViewer
                url={`${typeof window !== 'undefined' ? window.location.origin : ''}/clip?pair=${pairId}`}
                size={160}
              />
            </div>
          ) : (
            <button
              onClick={startPairing}
              className="w-full py-3.5 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-mono text-xs font-bold hover:opacity-90 transition-opacity glow-amber flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lightning className="w-4 h-4" weight="fill" />
              Generate P2P Pairing Code
            </button>
          )}

          {pairId && (
            <div className="bg-[var(--bg-main)] p-3 rounded-xl border border-[var(--border-color)] font-mono text-xs text-left space-y-1 text-[var(--text-secondary)]">
              <div className="flex justify-between text-[11px]">
                <span>Pair ID:</span>
                <span className="text-[var(--text-primary)] font-bold">{pairId}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Sync State:</span>
                <span className="text-[var(--success)] font-bold uppercase">{status}</span>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
