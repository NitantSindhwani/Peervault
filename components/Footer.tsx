'use client';

import Link from 'next/link';
import { ShieldCheck, LockKey } from '@phosphor-icons/react';

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-color)] bg-[var(--bg-main)] py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                <Link href="/send" className="hover:text-[var(--accent)] transition-colors">Instant Send</Link>
              </li>
              <li>
                <Link href="/clip" className="hover:text-[var(--accent)] transition-colors">Instant Clipboard Sync</Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-[var(--accent)] transition-colors">My Transfer Dashboard</Link>
              </li>
              <li>
                <Link href="/#architecture" className="hover:text-[var(--accent)] transition-colors">How It Works</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--text-primary)] mb-3">Security & Attestation</h4>
            <ul className="space-y-2 text-xs font-mono text-[var(--text-secondary)]">
              <li className="flex items-center gap-1.5 text-[var(--success)] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                100% Private (E2EE)
              </li>
              <li>AES-256-GCM Hardware Encrypted</li>
              <li>ML-KEM-1024 Post-Quantum Proof</li>
              <li>BLAKE3 Merkle Checksum Verified</li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[var(--text-secondary)] gap-4">
          <div>
            © 2026 Hardened PeerVault Systems. 100% Free & Open Source Forever.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[var(--accent)] transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-[var(--accent)] transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
