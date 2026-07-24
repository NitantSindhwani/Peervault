'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileArrowUp,
  ShareNetwork,
  DownloadSimple,
  CheckCircle,
  Lightning,
  ShieldCheck,
  ArrowRight,
} from '@phosphor-icons/react';

export function ArchitectureDiagram() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    {
      step: 1,
      icon: <FileArrowUp className="w-6 h-6 text-[var(--accent)]" weight="bold" />,
      title: 'Pick Any File or Folder',
      subtitle: 'Zero Upload Waiting',
      desc: 'Select any file or game folder of any size. PeerVault creates an instant share link in 0.0 seconds without uploading your file to any cloud server.',
      tips: [
        'No file size limits (Send 10MB or 500GB+)',
        'Your file stays 100% on your device disk',
        'Optional password protection lock available',
      ],
    },
    {
      step: 2,
      icon: <ShareNetwork className="w-6 h-6 text-[var(--accent)]" weight="bold" />,
      title: 'Send Link or Scan QR',
      subtitle: 'Instant Recipient Access',
      desc: 'Copy your instant share link or let a friend scan the high-contrast QR code using their phone camera. No account or app download needed.',
      tips: [
        'Works on iPhones, Android, Windows, & Mac',
        '0.1-second instant phone camera QR scan',
        'Send via WhatsApp, Discord, Email, or Slack',
      ],
    },
    {
      step: 3,
      icon: <DownloadSimple className="w-6 h-6 text-[var(--success)]" weight="bold" />,
      title: 'Direct Fast Download',
      subtitle: 'Bit-for-Bit Exact Copy',
      desc: 'The moment your recipient opens the link, data streams directly browser-to-browser at maximum network speed with 100% privacy.',
      tips: [
        'Up to 1,000 Mbps speed on same Wi-Fi / LAN',
        'Executable files & 4K movies run natively',
        'Automatic resume if connection drops',
      ],
    },
  ];

  return (
    <section id="architecture" className="py-20 bg-[var(--bg-main)] border-b border-[var(--border-color)] bg-grid-pattern">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Header */}
        <div className="space-y-3 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent)]">
            <Lightning className="w-3.5 h-3.5" weight="fill" />
            <span>How PeerVault Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--text-primary)] font-display">
            3 Simple Steps to Share Anything
          </h2>
          <p className="text-sm text-[var(--text-secondary)] font-mono max-w-[65ch]">
            No cloud uploads, no file size limits, and no account required. Here is how easy it is to send files to anyone.
          </p>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((item) => (
            <div
              key={item.step}
              onClick={() => setActiveStep(item.step)}
              className={`cursor-pointer rounded-2xl p-6 border transition-all space-y-5 flex flex-col justify-between ${
                activeStep === item.step
                  ? 'bg-[var(--bg-surface)] border-[var(--accent)] glow-amber shadow-2xl scale-[1.01]'
                  : 'bg-[var(--bg-surface)]/60 border-[var(--border-color)] hover:border-[var(--text-secondary)]'
              }`}
            >
              <div className="space-y-4">
                {/* Step Badge & Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shadow-inner">
                    {item.icon}
                  </div>
                  <span className="font-mono text-xs text-[var(--accent)] font-bold px-2.5 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30">
                    Step 0{item.step}
                  </span>
                </div>

                <div className="space-y-1 font-mono">
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider block">
                    {item.subtitle}
                  </span>
                  <h3 className="text-xl font-bold text-[var(--text-primary)] font-display">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-1">
                    {item.desc}
                  </p>
                </div>
              </div>

              {/* Useful Highlights List */}
              <div className="pt-4 border-t border-[var(--border-color)] space-y-2 font-mono text-[11px]">
                {item.tips.map((tip, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[var(--text-primary)]">
                    <CheckCircle className="w-3.5 h-3.5 text-[var(--success)] shrink-0" weight="fill" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
