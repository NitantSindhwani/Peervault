'use client';

import { Check, X, Lightning, ShieldCheck, Heart } from '@phosphor-icons/react';
import Link from 'next/link';

export function PricingSection() {
  const comparisons = [
    { feature: 'Cloud File Upload Cost', peervault: '100% Free (₹0 / $0)', cloud: 'Paid Subscriptions ($12-$20/mo)' },
    { feature: 'File Size Limits', peervault: 'Unlimited (GB / TB Direct Stream)', cloud: 'Capped (2GB - 10GB limits)' },
    { feature: 'Cloud Storage Privacy', peervault: 'Zero Storage (Direct Peer-to-Peer)', cloud: 'Stored on Cloud Servers' },
    { feature: 'End-to-End Encryption', peervault: 'AES-256-GCM On-Device', cloud: 'Server-Side Decrypted' },
    { feature: 'Transfer Speed', peervault: 'Instant LAN / Direct Peer Rate', cloud: 'Throttled Upload Speeds' },
    { feature: 'Auto-Resume Interrupted Stream', peervault: 'IndexedDB Merkle Tree Auto-Resume', cloud: 'Must Restart From 0%' },
  ];

  return (
    <section className="py-20 bg-[var(--bg-surface)] border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-mono text-[var(--success)]">
            <Heart className="w-3.5 h-3.5 text-red-400" weight="fill" />
            <span>100% Free & Open Source Forever</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] font-display">
            Why Direct P2P Beats Cloud Uploads
          </h2>
          <p className="text-sm text-[var(--text-secondary)] font-mono">
            Zero subscription fees, zero server storage, and zero upload waiting time.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-2xl font-mono text-xs">
          <div className="grid grid-cols-12 bg-[var(--bg-surface)] border-b border-[var(--border-color)] p-4 font-bold text-[var(--text-primary)]">
            <div className="col-span-5">Feature Matrix</div>
            <div className="col-span-4 text-[var(--accent)] flex items-center gap-1.5">
              <Lightning className="w-4 h-4" weight="fill" />
              Hardened PeerVault (Free)
            </div>
            <div className="col-span-3 text-[var(--text-secondary)]">Traditional Cloud Storage</div>
          </div>

          <div className="divide-y divide-[var(--border-color)]/40">
            {comparisons.map((row, i) => (
              <div key={i} className="grid grid-cols-12 p-4 items-center hover:bg-[var(--bg-surface)]/50 transition-colors">
                <div className="col-span-5 font-semibold text-[var(--text-primary)]">{row.feature}</div>
                <div className="col-span-4 text-[var(--success)] font-bold flex items-center gap-1">
                  <Check className="w-4 h-4 shrink-0 text-[var(--success)]" weight="bold" />
                  <span>{row.peervault}</span>
                </div>
                <div className="col-span-3 text-[var(--text-secondary)] flex items-center gap-1">
                  <X className="w-3.5 h-3.5 shrink-0 text-red-400" />
                  <span>{row.cloud}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-4">
          <Link
            href="/send"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--accent)] text-[var(--bg-main)] font-mono text-sm font-bold hover:opacity-90 transition-opacity glow-amber shadow-xl"
          >
            <Lightning className="w-5 h-5" weight="fill" />
            Start Instant Free Transfer
          </Link>
        </div>

      </div>
    </section>
  );
}
