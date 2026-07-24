'use client';

import { ShieldCheck, Cpu, LockKey, GitBranch } from '@phosphor-icons/react';

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-color)] bg-[var(--bg-main)] py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-mono font-bold text-sm text-[var(--text-primary)]">
              <LockKey className="w-4 h-4 text-[var(--accent)]" weight="bold" />
              Hardened PeerVault
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Zero-knowledge, browser-to-browser, peer-to-peer binary file streaming platform with WebAssembly SIMD crypto & BBR congestion control.
            </p>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--text-primary)] mb-3">Architecture</h4>
            <ul className="space-y-2 text-xs font-mono text-[var(--text-secondary)]">
              <li className="hover:text-[var(--accent)] cursor-pointer">BBR Pacing Engine</li>
              <li className="hover:text-[var(--accent)] cursor-pointer">WASM BLAKE3 Hashing</li>
              <li className="hover:text-[var(--accent)] cursor-pointer">OPAQUE PAKE Auth</li>
              <li className="hover:text-[var(--accent)] cursor-pointer">4-Tier Disk Assembly</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--text-primary)] mb-3">Security & SRI</h4>
            <ul className="space-y-2 text-xs font-mono text-[var(--text-secondary)]">
              <li className="flex items-center gap-1.5 text-[var(--success)]">
                <ShieldCheck className="w-3.5 h-3.5" />
                SRI Script Attestation
              </li>
              <li>CSP Shield Active</li>
              <li>ClientEXIF Metadata Stripper</li>
              <li>Memory-Only Ephemeral Pipeline</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--text-primary)] mb-3">System Matrix</h4>
            <div className="bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-color)] space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Signaling Spine:</span>
                <span className="text-[var(--accent)]">Supabase v2</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Transport:</span>
                <span className="text-[var(--text-primary)]">WebRTC DataChannel</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Key Exchange:</span>
                <span className="text-[var(--text-primary)]">ECDH / OPAQUE</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[var(--text-secondary)] gap-4">
          <div>
            © 2026 Hardened PeerVault Systems Engineering. Zero Cloud Storage Infrastructure.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-[var(--text-primary)] cursor-pointer">Privacy Attestation</span>
            <span>•</span>
            <span className="hover:text-[var(--text-primary)] cursor-pointer">Delivery Webhooks</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
