'use client';

import { Cpu, ShieldCheck, Lightning, EyeClosed, GitMerge } from '@phosphor-icons/react';

export function TechnicalMarquee() {
  const items = [
    { text: 'ZERO CLOUD WAIT', icon: <Lightning className="w-4 h-4 text-[var(--accent)]" weight="fill" /> },
    { text: '100% PRIVATE P2P', icon: <ShieldCheck className="w-4 h-4 text-[var(--success)]" weight="fill" /> },
    { text: 'NO SIZE LIMITS', icon: <Cpu className="w-4 h-4 text-sky-400" /> },
    { text: 'E2EE AES-256-GCM', icon: <EyeClosed className="w-4 h-4 text-purple-400" /> },
    { text: 'POST-QUANTUM ML-KEM-1024', icon: <GitMerge className="w-4 h-4 text-amber-400" /> },
  ];

  // Repeat items thrice to support seamless looping width coverage
  const loopItems = [...items, ...items, ...items, ...items, ...items, ...items];

  return (
    <div className="w-full bg-[var(--bg-surface)]/30 border-y border-[var(--border-color)] py-5 overflow-hidden relative z-10 backdrop-blur-sm select-none">
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--bg-main)] to-transparent z-20 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--bg-main)] to-transparent z-20 pointer-events-none" />
      
      <div className="animate-marquee flex items-center gap-16">
        {loopItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 shrink-0 font-mono text-xs font-bold text-[var(--text-secondary)] tracking-wider">
            {item.icon}
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
