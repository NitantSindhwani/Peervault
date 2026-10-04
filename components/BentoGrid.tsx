'use client';

import {
  ChartLineUp,
  Cpu,
  ArrowsClockwise,
  Key,
  Lightning,
  Gauge,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { TiltCard } from '@/components/TiltCard';

export function BentoGrid() {

  const bentoItems = [
    {
      colSpan: 'md:col-span-2',
      archNo: '#01',
      title: 'Dynamic BBR Congestion Control',
      desc: 'Monitors packet round-trip time continuously to stream data at maximum channel capacity without congesting your Wi-Fi or dropping packets.',
      icon: <ChartLineUp className="w-6 h-6" weight="bold" />,
      colorClass: 'text-[var(--accent)]',
      borderGlow: 'hover:border-[var(--accent)] glow-amber/10',
      footerLeft: 'Smart Congestion Control',
      footerRight: 'BBR Algorithm',
      accentBg: false,
    },
    {
      colSpan: '',
      archNo: '#02',
      title: 'Hardware-Accelerated WebCrypto',
      desc: 'Files are processed directly in Web Worker threads using native AES-256-GCM so your UI stays at 60fps even under heavy multi-gigabyte transfers.',
      icon: <Cpu className="w-6 h-6" weight="bold" />,
      colorClass: 'text-[var(--success)]',
      borderGlow: 'hover:border-[var(--success)]',
      footerLeft: 'Zero UI Lag',
      footerRight: 'AES-256-GCM',
      accentBg: true,
    },
    {
      colSpan: '',
      archNo: '#03',
      title: 'Lossless Auto-Resume & Recovery',
      desc: 'Survives closed tabs, connection drops, and browser restarts. Resumes transfers chunk-by-chunk using IndexedDB bitmap verification.',
      icon: <ArrowsClockwise className="w-6 h-6" weight="bold" />,
      colorClass: 'text-amber-400',
      borderGlow: 'hover:border-amber-400',
      footerLeft: 'Zero Data Loss',
      footerRight: 'IndexedDB Bitmaps',
      accentBg: false,
    },
    {
      colSpan: '',
      archNo: '#04',
      title: '100% Private & Passphrase Locked',
      desc: 'Zero-knowledge architecture ensures your files, room tokens, and data never touch any server. Ephemeral room signaling self-destructs.',
      icon: <Key className="w-6 h-6" weight="bold" />,
      colorClass: 'text-sky-400',
      borderGlow: 'hover:border-sky-400',
      footerLeft: 'End-to-End Encrypted',
      footerRight: 'Zero Cloud Storage',
      accentBg: false,
    },
    {
      colSpan: 'md:col-span-2',
      archNo: '#05',
      title: 'Direct Multi-Lane WebRTC Data Pipes',
      desc: 'Bypasses single-lane bottlenecks by multiplexing file streams across 12 concurrent unordered SCTP channels for saturation throughput.',
      icon: <Lightning className="w-6 h-6" weight="bold" />,
      colorClass: 'text-[var(--accent)]',
      borderGlow: 'hover:border-[var(--accent)]',
      footerLeft: '12 Parallel Channels',
      footerRight: 'Direct P2P Mesh',
      accentBg: true,
    },
    {
      colSpan: '',
      archNo: '#06',
      title: 'Low Memory Disk Streaming',
      desc: 'Direct File System Access API streaming keeps browser RAM under 128MB even for massive 50GB+ transfers, preventing mobile browser crashes.',
      icon: <Gauge className="w-6 h-6" weight="bold" />,
      colorClass: 'text-emerald-400',
      borderGlow: 'hover:border-emerald-400',
      footerLeft: 'RAM Protection',
      footerRight: 'Direct Disk I/O',
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
              initial={false}
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
