'use client';

import {
  ChartLineUp,
  Cpu,
  CloudArrowUp,
  Key,
  GitFork,
  Gauge,
} from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { TiltCard } from '@/components/TiltCard';

export function BentoGrid() {
  const reduce = useReducedMotion();

  const bentoItems = [
    {
      colSpan: 'md:col-span-2',
      archNo: '#01',
      title: 'Maximum Speed Control',
      desc: 'Monitors your network connection continuously to send data at peak speed without lagging your Wi-Fi or dropping connection.',
      icon: <ChartLineUp className="w-6 h-6" weight="bold" />,
      colorClass: 'text-[var(--accent)]',
      borderGlow: 'hover:border-[var(--accent)] glow-amber/10',
      footerLeft: 'Smart Speed Control',
      footerRight: 'Peak Rate',
      accentBg: false,
    },
    {
      colSpan: '',
      archNo: '#02',
      title: 'Fast Browser Encryption',
      desc: 'Files are encrypted directly inside your browser background threads so your laptop stays fast and smooth while sending.',
      icon: <Cpu className="w-6 h-6" weight="bold" />,
      colorClass: 'text-[var(--success)]',
      borderGlow: 'hover:border-[var(--success)]',
      footerLeft: 'Zero Lag',
      footerRight: 'AES-256 Encrypted',
      accentBg: true,
    },
    {
      colSpan: '',
      archNo: '#03',
      title: '24-Hour Offline Backup',
      desc: 'If your browser tab closes early, your recipient can still finish downloading from temporary self-destructing staging storage.',
      icon: <CloudArrowUp className="w-6 h-6" weight="bold" />,
      colorClass: 'text-amber-400',
      borderGlow: 'hover:border-amber-400',
      footerLeft: 'Auto Self-Destruct',
      footerRight: 'Tab-Close Proof',
      accentBg: false,
    },
    {
      colSpan: '',
      archNo: '#04',
      title: '100% Private & Password Locked',
      desc: 'Zero-knowledge encryption ensures your files, passwords, and data are never sent to or stored on any central server.',
      icon: <Key className="w-6 h-6" weight="bold" />,
      colorClass: 'text-sky-400',
      borderGlow: 'hover:border-sky-400',
      footerLeft: 'End-to-End Encrypted',
      footerRight: '100% Private',
      accentBg: false,
    },
    {
      colSpan: 'md:col-span-2',
      archNo: '#05',
      title: 'Auto-Resume Interrupted Downloads',
      desc: 'If your internet disconnects for a moment, PeerVault automatically picks up exactly where it left off without re-downloading.',
      icon: <GitFork className="w-6 h-6" weight="bold" />,
      colorClass: 'text-[var(--accent)]',
      borderGlow: 'hover:border-[var(--accent)]',
      footerLeft: 'Checksum Verified',
      footerRight: 'Auto Resume',
      accentBg: true,
    },
    {
      colSpan: '',
      archNo: '#06',
      title: 'Low Memory Protection',
      desc: 'Smart memory management keeps browser RAM usage tiny even when sending 50GB+ large video files, preventing tab crashes.',
      icon: <Gauge className="w-6 h-6" weight="bold" />,
      colorClass: 'text-emerald-400',
      borderGlow: 'hover:border-emerald-400',
      footerLeft: 'RAM Protection',
      footerRight: 'No Tab Crashes',
      accentBg: false,
    },
  ];

  return (
    <section id="architecture" className="py-20 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)]/80 backdrop-blur border border-[var(--border-color)] text-xs font-mono text-[var(--accent)]">
            <Cpu className="w-3.5 h-3.5" />
            <span>High-Performance File Sharing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] font-display">
            Built for Speed, Privacy, and Zero Costs
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-[65ch]">
            Direct browser-to-browser streaming with zero size limits, zero server uploads, and end-to-end encryption.
          </p>
        </div>

        {/* Asymmetric Bento Grid with Motion Reveal & 3D Tilt Interaction */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {bentoItems.map((item, index) => (
            <motion.div
              key={index}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`${item.colSpan} flex`}
            >
              <TiltCard
                className={`p-6 flex flex-col justify-between group w-full h-full relative ${
                  item.accentBg
                    ? 'bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-main)]'
                    : 'bg-[var(--bg-surface)]'
                }`}
                spotlightColor={
                  item.archNo === '#01' || item.archNo === '#05'
                    ? 'rgba(234, 140, 40, 0.06)'
                    : item.archNo === '#02'
                    ? 'rgba(34, 197, 94, 0.06)'
                    : item.archNo === '#03'
                    ? 'rgba(251, 191, 36, 0.06)'
                    : item.archNo === '#04'
                    ? 'rgba(56, 189, 248, 0.06)'
                    : 'rgba(52, 211, 153, 0.06)'
                }
                borderColor={
                  item.archNo === '#01' || item.archNo === '#05'
                    ? 'rgba(234, 140, 40, 0.15)'
                    : item.archNo === '#02'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : item.archNo === '#03'
                    ? 'rgba(251, 191, 36, 0.15)'
                    : item.archNo === '#04'
                    ? 'rgba(56, 189, 248, 0.15)'
                    : 'rgba(52, 211, 153, 0.15)'
                }
              >
                {/* Organic grain noise effect inside accent cards */}
                {item.accentBg && <div className="absolute inset-0 noise-overlay rounded-2xl" />}

                <div className="space-y-4 relative z-10 flex-grow flex flex-col justify-between">
                  <div>
                    <div
                      className={`w-10 h-10 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center ${item.colorClass} group-hover:scale-110 transition-transform duration-300`}
                    >
                      {item.icon}
                    </div>
                    <div className="mt-4">
                      <span className={`text-[10px] font-mono ${item.colorClass} uppercase tracking-wider`}>
                        Feature {item.archNo}
                      </span>
                      <h3 className="text-lg font-bold text-[var(--text-primary)] mt-1 font-display">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed font-mono">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border-color)] flex justify-between items-center text-xs font-mono text-[var(--text-secondary)] relative z-10">
                  <span>{item.footerLeft}</span>
                  <span className={`${item.colorClass} font-semibold`}>{item.footerRight}</span>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
