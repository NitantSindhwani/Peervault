'use client';

import { useEffect } from 'react';
import { Warning, ArrowClockwise } from '@phosphor-icons/react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[PeerVault Error Boundary]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-8 text-center space-y-6 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mx-auto">
          <Warning className="w-8 h-8" weight="bold" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] font-display">
            Connection or Transport Failure
          </h2>
          <p className="text-xs font-mono text-[var(--text-secondary)]">
            {error.message || 'An unexpected error disrupted the P2P DataChannel connection.'}
          </p>
        </div>

        <button
          onClick={() => reset()}
          className="w-full py-3.5 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-mono text-xs font-bold hover:opacity-90 transition-opacity glow-amber flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowClockwise className="w-4 h-4" weight="bold" />
          Reconnect & Retry State Machine
        </button>
      </div>
    </div>
  );
}
