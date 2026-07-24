'use client';

import Link from 'next/link';
import { ShieldCheck, LockKey, CheckCircle, ArrowLeft, EyeClosed } from '@phosphor-icons/react';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12 font-mono text-xs">
      
      {/* Header */}
      <div className="space-y-4 border-b border-[var(--border-color)] pb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-[var(--accent)] hover:underline mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to PeerVault Home
        </Link>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--success)] font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>Zero-Knowledge Privacy Attestation</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] font-display">
          Privacy Policy & Data Principles
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Effective Date: July 24, 2026 • Version 2.0 (Zero-Knowledge Architecture)
        </p>
      </div>

      {/* Policy Core Principles Card */}
      <div className="bg-[var(--bg-surface)] border border-[var(--success)]/40 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-[var(--success)] font-bold text-sm font-display">
          <CheckCircle className="w-5 h-5" weight="fill" />
          <span>Core Privacy Guarantee: We Cannot Read, Store, or Intercept Your Files</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Hardened PeerVault operates on a strict <strong>Zero-Knowledge Peer-to-Peer (P2P) Architecture</strong>. Files stream directly between your browser and your recipient browser. Your unencrypted file contents, encryption keys, and file names never touch central cloud servers or disk storage.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8 text-[var(--text-primary)] leading-relaxed">
        
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2 flex items-center gap-2">
            <EyeClosed className="w-5 h-5 text-[var(--accent)]" />
            1. Zero-Storage File Protocol
          </h2>
          <p className="text-[var(--text-secondary)]">
            When you select a file or folder on PeerVault:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[var(--text-secondary)] pl-2">
            <li>Your file remains on your local device until a recipient connects.</li>
            <li>File data is encrypted on your device using <strong>AES-256-GCM</strong> with ephemeral key pairs derived via WebCrypto.</li>
            <li>Data packets stream over direct browser-to-browser WebRTC DataChannels.</li>
            <li>No file content, payload data, or unencrypted metadata is ever uploaded, cached, or saved to central server storage.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            2. System Metrics & Telemetry Logging
          </h2>
          <p className="text-[var(--text-secondary)]">
            To ensure system security, prevent bot abuse, and maintain network reliability, our servers automatically log basic connection metadata when a transfer room is established:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[var(--text-secondary)] pl-2">
            <li><strong>Network IP Address:</strong> Recorded for rate limiting, DDoS mitigation, and geographic routing optimization.</li>
            <li><strong>Transfer Metadata:</strong> Room ID, file byte size, and timestamp.</li>
            <li><strong>Device Context:</strong> Standard browser User-Agent header for protocol compatibility.</li>
          </ul>
          <p className="text-[var(--text-secondary)]">
            These system metrics do <strong>NOT</strong> contain decryption keys or readable file contents.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            3. WebAuthn Hardware Biometric Attestation
          </h2>
          <p className="text-[var(--text-secondary)]">
            If you choose to generate a WebAuthn Proof of Delivery certificate (via Touch ID, Face ID, or YubiKey):
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[var(--text-secondary)] pl-2">
            <li>Biometric verification happens 100% locally inside your device hardware (Secure Enclave / TPM).</li>
            <li>PeerVault only receives a signed cryptographic assertion token (ES256 signature).</li>
            <li>Your actual biometric data (fingerprint or face scan) is never accessible by PeerVault or transmitted over any network.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            4. Cookies & Tracking Technologies
          </h2>
          <p className="text-[var(--text-secondary)]">
            PeerVault uses <strong>zero third-party advertising cookies, zero tracking pixels, and zero cross-site analytics scripts</strong>.
          </p>
          <p className="text-[var(--text-secondary)]">
            We store session state locally in your browser using standard W3C <code>IndexedDB</code> and <code>localStorage</code> strictly to support auto-resuming interrupted transfers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            5. GDPR & CCPA Compliance Rights
          </h2>
          <p className="text-[var(--text-secondary)]">
            Under GDPR, CCPA, and global privacy regulations, users have rights regarding personal data. Because PeerVault does not store user accounts or personal files, we maintain zero persistent personal profile databases. Any temporary system logs are automatically purged on a rolling schedule.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            6. Contact & Data Officer
          </h2>
          <p className="text-[var(--text-secondary)]">
            For questions regarding this Privacy Policy or system security disclosures, please open an issue on our official GitHub repository or contact our security maintainers.
          </p>
        </section>

      </div>

      {/* Footer link */}
      <div className="pt-8 border-t border-[var(--border-color)] flex justify-between items-center text-xs text-[var(--text-secondary)]">
        <span>© 2026 Hardened PeerVault Systems</span>
        <Link href="/terms" className="text-[var(--accent)] hover:underline">
          Read Terms of Service →
        </Link>
      </div>

    </div>
  );
}
