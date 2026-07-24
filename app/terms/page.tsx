'use client';

import Link from 'next/link';
import { ShieldCheck, LockKey, ArrowLeft, Scales, Warning } from '@phosphor-icons/react';

export default function TermsOfServicePage() {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--accent)] font-bold">
          <Scales className="w-4 h-4" />
          <span>Legal Agreement & Terms of Service</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] font-display">
          Terms of Service & Usage Policy
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Effective Date: July 24, 2026 • Version 2.0 (Open Source P2P Software License)
        </p>
      </div>

      {/* Legal Protection Alert Box */}
      <div className="bg-[var(--bg-surface)] border border-[var(--accent)]/40 rounded-2xl p-6 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-[var(--accent)] font-bold text-sm font-display">
          <Warning className="w-5 h-5" weight="fill" />
          <span>Important Notice: Software Provided "AS IS" Without Warranty</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          By accessing, deploying, or using PeerVault, you acknowledge and agree that this software is provided strictly on an <strong>"AS IS" and "AS AVAILABLE"</strong> basis. The platform maintainers and host providers hold zero liability for data transfers, content, or network availability.
        </p>
      </div>

      {/* Terms Content */}
      <div className="space-y-8 text-[var(--text-primary)] leading-relaxed">
        
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            1. Automatic Binding Agreement & Privacy Policy Consent
          </h2>
          <p className="text-[var(--text-secondary)]">
            By visiting, accessing, uploading, downloading, or using Hardened PeerVault in any capacity, you <strong>automatically, implicitly, and unconditionally agree to be bound by all terms, conditions, disclaimers, and provisions set forth in these Terms of Service and our Privacy Policy</strong>.
          </p>
          <p className="text-[var(--text-secondary)]">
            Your continued use of PeerVault constitutes full legal acceptance. If you do not agree to every clause, you are strictly prohibited from accessing or using the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            2. Acceptable Use Policy (Strictly Prohibited Conduct)
          </h2>
          <p className="text-[var(--text-secondary)]">
            PeerVault is designed strictly for lawful, peer-to-peer data transfers. You explicitly agree <strong>NOT</strong> to use PeerVault to transmit, stream, or distribute:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[var(--text-secondary)] pl-2">
            <li>Illegal material, copyright-infringing works, or unauthorized intellectual property.</li>
            <li>Malicious code, ransomware, spyware, or harmful software payloads.</li>
            <li>Content that violates international privacy, harassment, or child protection laws.</li>
            <li>Automated bot traffic intended to disrupt or execute Denial-of-Service (DDoS) attacks against third parties.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            3. Disclaimer of Liability & Warranties
          </h2>
          <p className="text-[var(--text-secondary)] uppercase font-bold text-[11px] text-amber-400">
            Limitation of Liability Clause:
          </p>
          <p className="text-[var(--text-secondary)]">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE DEVELOPERS, MAINTAINERS, HOSTING PROVIDERS, AND CONTRIBUTORS OF HARDENED PEERVAULT SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[var(--text-secondary)] pl-2">
            <li>Loss of data, file corruption, or network transmission failures.</li>
            <li>Interruption of business or browser tab termination during streaming.</li>
            <li>Unauthorized access resulting from user failure to protect passphrase locks.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            4. DMCA & Copyright Infringement Policy
          </h2>
          <p className="text-[var(--text-secondary)]">
            Because PeerVault operates entirely as a client-side peer-to-peer protocol, central servers do not store, host, or index transferred file contents. Maintainers have no technical ability to access, inspect, or remove files in transit between peer devices. However, maintainers comply with valid legal notices regarding service misuse.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            5. User Indemnification
          </h2>
          <p className="text-[var(--text-secondary)]">
            You agree to defend, indemnify, and hold harmless Hardened PeerVault maintainers, developers, and platform hosts from and against any claims, liabilities, damages, losses, or expenses (including legal fees) arising out of or in any way connected with your access to or use of the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-display border-b border-[var(--border-color)] pb-2">
            6. Governing Law & Open Source License
          </h2>
          <p className="text-[var(--text-secondary)]">
            PeerVault source code is licensed under the <strong>MIT License</strong>. These terms shall be governed by and construed in accordance with applicable global open-source software regulations.
          </p>
        </section>

      </div>

      {/* Footer link */}
      <div className="pt-8 border-t border-[var(--border-color)] flex justify-between items-center text-xs text-[var(--text-secondary)]">
        <span>© 2026 Hardened PeerVault Legal Terms</span>
        <Link href="/privacy" className="text-[var(--accent)] hover:underline">
          Read Privacy Policy →
        </Link>
      </div>

    </div>
  );
}
