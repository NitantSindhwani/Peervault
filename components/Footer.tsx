'use client';

import Link from 'next/link';
import { ShieldCheck, LockKey } from '@phosphor-icons/react';
import { ShinyText } from '@/components/TextAnimations';

export function Footer() {
  return (
    <footer className="relative mt-20 bg-[var(--bg-main)]">
      {/* Premium Aurora Ambient Accent Divider Line */}
      <div className="h-[1.5px] bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent w-full opacity-80" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-mono font-bold text-sm text-[var(--text-primary)]">
              <LockKey className="w-4 h-4 text-[var(--accent)]" weight="bold" />
              PeerVault.io
            </div>
            <p className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed">
              Zero-knowledge, direct browser-to-browser P2P file streaming with WebAssembly encryption & zero server storage costs.
            </p>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--text-primary)] mb-3">Core Features</h4>
            <ul className="space-y-2 text-xs font-mono text-[var(--text-secondary)]">
              <li>
                <Link href="/send" className="hover:text-[var(--accent)] transition-colors duration-200">Instant Send</Link>
              </li>
              <li>
                <Link href="/clip" className="hover:text-[var(--accent)] transition-colors duration-200">Instant Clipboard Sync</Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-[var(--accent)] transition-colors duration-200">My Transfer Dashboard</Link>
              </li>
              <li>
                <Link href="/#architecture" className="hover:text-[var(--accent)] transition-colors duration-200">How It Works</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--text-primary)] mb-3">Security & Attestation</h4>
            <ul className="space-y-2 text-xs font-mono text-[var(--text-secondary)]">
              <li className="flex items-center gap-1.5 text-[var(--success)] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--success)] animate-pulse" />
                <ShinyText text="100% Private (E2EE)" className="text-[var(--success)] font-bold" />
              </li>
              <li className="hover:text-[var(--text-primary)] transition-colors duration-200">AES-256-GCM Hardware Encrypted</li>
              <li className="hover:text-[var(--text-primary)] transition-colors duration-200">ML-KEM-1024 Post-Quantum Proof</li>
              <li className="hover:text-[var(--text-primary)] transition-colors duration-200">BLAKE3 Merkle Checksum Verified</li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[var(--text-secondary)] gap-4">
          <div>
            © 2026 Hardened PeerVault Systems. 100% Free & Open Source Forever.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[var(--accent)] transition-colors duration-200">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-[var(--accent)] transition-colors duration-200">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
