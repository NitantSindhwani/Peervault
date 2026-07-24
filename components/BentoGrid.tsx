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

export function BentoGrid() {
  const reduce = useReducedMotion();

  const bentoItems = [
    {
      colSpan: 'md:col-span-2',
      archNo: '#01',
      title: 'BBR Speed Pacing & Congestion Control',
      desc: 'Monitors ping and network latency continuously, dynamically pacing byte transmission to achieve maximum throughput without clogging your router or dropping packets.',
      icon: <ChartLineUp className="w-6 h-6" weight="bold" />,
      colorClass: 'text-[var(--accent)]',
      borderGlow: 'hover:border-[var(--accent)] glow-amber/10',
      footerLeft: 'Sub-ms RTT Pacing',
      footerRight: 'Max Throughput',
      accentBg: false,
    },
    {
      colSpan: '',
      archNo: '#02',
      title: 'Off-Thread WASM Crypto',
      desc: 'Encryption and hashing run inside background Web Workers using hardware SIMD instructions so your browser UI stays smooth.',
      icon: <Cpu className="w-6 h-6" weight="bold" />,
      colorClass: 'text-[var(--success)]',
      borderGlow: 'hover:border-[var(--success)]',
      footerLeft: 'Zero UI Lag',
      footerRight: 'AES-256 Hardware',
      accentBg: true,
    },
    {
      colSpan: '',
      archNo: '#03',
      title: '24-Hour Offline Staging',
      desc: 'If a sender tab closes early, remaining encrypted chunks can optionally stage in temporary 24h self-destructing storage so the receiver finishes without interruption.',
      icon: <CloudArrowUp className="w-6 h-6" weight="bold" />,
      colorClass: 'text-amber-400',
      borderGlow: 'hover:border-amber-400',
      footerLeft: 'Self-Destruct TTL',
      footerRight: 'Tab-Close Proof',
      accentBg: false,
    },
    {
      colSpan: '',
      archNo: '#04',
      title: 'Zero-Knowledge OPAQUE Auth',
      desc: 'Zero-knowledge mutual authentication. Passwords, master keys, and file contents are never sent to or visible by any signaling server.',
      icon: <Key className="w-6 h-6" weight="bold" />,
      colorClass: 'text-sky-400',
      borderGlow: 'hover:border-sky-400',
      footerLeft: 'RFC 9807 Compliant',
      footerRight: '100% Private',
      accentBg: false,
    },
    {
      colSpan: 'md:col-span-2',
      archNo: '#05',
      title: 'IndexedDB Auto-Resume Engine',
      desc: 'Uses BLAKE3 Merkle integrity trees to track verified blocks. If connection drops, PeerVault automatically picks up exactly where it left off without re-downloading.',
      icon: <GitFork className="w-6 h-6" weight="bold" />,
      colorClass: 'text-[var(--accent)]',
      borderGlow: 'hover:border-[var(--accent)]',
      footerLeft: 'BLAKE3 Integrity',
      footerRight: 'Auto Resume',
      accentBg: true,
    },
    {
      colSpan: '',
      archNo: '#06',
      title: 'Memory RAM Guard (< 200MB)',
      desc: 'Active backpressure management keeps memory usage under 200MB even when transferring 50GB+ datasets, preventing browser tab crashes.',
      icon: <Gauge className="w-6 h-6" weight="bold" />,
      colorClass: 'text-emerald-400',
      borderGlow: 'hover:border-emerald-400',
      footerLeft: 'RAM Guard Protection',
      footerRight: 'No Tab Crashes',
      accentBg: false,
    },
  ];

  return (
    <section id="architecture" className="py-20 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent)]">
            <Cpu className="w-3.5 h-3.5" />
            <span>High-Performance P2P Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)] font-display">
            Built for Speed, Privacy, and Zero Costs
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-[65ch]">
            Combining browser WebAssembly, WebRTC DataChannels, and client-side encryption for instant transfers.
          </p>
        </div>

        {/* Asymmetric Bento Grid with Motion Reveal */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {bentoItems.map((item, index) => (
            <motion.div
              key={index}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`${item.colSpan} ${
                item.accentBg
                  ? 'bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-main)]'
                  : 'bg-[var(--bg-surface)]'
              } border border-[var(--border-color)] rounded-2xl p-6 transition-all flex flex-col justify-between group ${
                item.borderGlow
              }`}
            >
              <div className="space-y-4">
                <div
                  className={`w-10 h-10 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center ${item.colorClass} group-hover:scale-110 transition-transform`}
                >
                  {item.icon}
                </div>
                <div>
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
              <div className="mt-6 pt-4 border-t border-[var(--border-color)] flex justify-between items-center text-xs font-mono text-[var(--text-secondary)]">
                <span>{item.footerLeft}</span>
                <span className={`${item.colorClass} font-semibold`}>{item.footerRight}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
