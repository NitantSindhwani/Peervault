'use client';

import Link from 'next/link';
import { Check, Lightning, ShieldCheck, Crown } from '@phosphor-icons/react';

export function PricingSection() {
  return (
    <section className="py-20 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-3 max-w-[65ch] mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent)]">
            <Crown className="w-3.5 h-3.5" />
            <span>Infrastructure & SaaS Tiers</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
            Transparent $0 Baseline Infrastructure
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Unlimited browser-to-browser P2P transfers are free forever. Upgrade for dedicated cloud TURN relays and asynchronous staging.
          </p>
        </div>

        {/* 3 Pricing Bento Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          
          {/* Free Tier */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-8 flex flex-col justify-between hover:border-[var(--text-secondary)] transition-all">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-wider">Core Essentials</span>
                <h3 className="text-2xl font-bold text-[var(--text-primary)]">Free Tier</h3>
                <p className="text-xs text-[var(--text-secondary)]">100% direct browser-to-browser file transfers.</p>
              </div>

              <div className="text-3xl font-bold font-mono text-[var(--text-primary)]">$0 <span className="text-xs text-[var(--text-secondary)] font-normal">/ month</span></div>

              <ul className="space-y-3 text-xs font-mono text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <span>Unlimited Dataset File Transfer Size</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <span>Custom BBR Congestion Control Pacing</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <span>BLAKE3 Merkle Resume Verification</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <span>Client-Side Metadata Stripping</span>
                </li>
              </ul>
            </div>

            <Link
              href="/send"
              className="mt-8 w-full py-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] font-bold text-center hover:border-[var(--accent)] transition-colors block"
            >
              Start Free Transfer
            </Link>
          </div>

          {/* Security+ Tier (Featured) */}
          <div className="bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-main)] border-2 border-[var(--accent)] rounded-2xl p-8 flex flex-col justify-between relative shadow-2xl glow-amber">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--bg-main)] text-[10px] font-mono font-bold uppercase tracking-wider">
              Most Popular Security Mode
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider">Privacy & Power-User</span>
                <h3 className="text-2xl font-bold text-[var(--text-primary)]">Security+</h3>
                <p className="text-xs text-[var(--text-secondary)]">OPAQUE PAKE zero-knowledge auth & clip sync.</p>
              </div>

              <div className="text-3xl font-bold font-mono text-[var(--text-primary)]">$9 <span className="text-xs text-[var(--text-secondary)] font-normal">/ month</span></div>

              <ul className="space-y-3 text-xs font-mono text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-6">
                <li className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
                  <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <span>RFC 9807 OPAQUE PAKE Zero-Knowledge</span>
                </li>
                <li className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
                  <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <span>ClipVault P2P Clipboard & Code Sync</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <span>5GB Ephemeral Cloud Staging Buffer</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <span>Client-Side SRI & CSP Attestation</span>
                </li>
              </ul>
            </div>

            <Link
              href="/send"
              className="mt-8 w-full py-3 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-mono text-xs font-bold text-center hover:opacity-90 transition-opacity block"
            >
              Enable Security+
            </Link>
          </div>

          {/* Enterprise Tier */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-8 flex flex-col justify-between hover:border-[var(--text-secondary)] transition-all">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-wider">Enterprise & SaaS</span>
                <h3 className="text-2xl font-bold text-[var(--text-primary)]">Enterprise Hub</h3>
                <p className="text-xs text-[var(--text-secondary)]">Custom portals, dedicated TURN, & signed receipts.</p>
              </div>

              <div className="text-3xl font-bold font-mono text-[var(--text-primary)]">$19 <span className="text-xs text-[var(--text-secondary)] font-normal">/ month</span></div>

              <ul className="space-y-3 text-xs font-mono text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <span>White-Label Custom Branded Portals</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <span>Dedicated TURN Relay (100% Firewall Uptime)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <span>Delivery Webhooks (Slack/Discord/REST)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <span>Ed25519 Signed Delivery PDF Receipts</span>
                </li>
              </ul>
            </div>

            <Link
              href="/dashboard"
              className="mt-8 w-full py-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] font-bold text-center hover:border-[var(--accent)] transition-colors block"
            >
              Configure Hub
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
