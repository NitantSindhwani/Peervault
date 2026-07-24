'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Lightning, ShieldCheck, ArrowRight, Cpu, CheckCircle } from '@phosphor-icons/react';

export function LandingHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Keep hero CTA buttons 100% visible and robust without GSAP opacity mutations
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 500);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 400);

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);

    interface Packet {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      color: string;
      burstUntil: number;
    }

    const packets: Packet[] = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      size: 1.5 + Math.random() * 2.5,
      opacity: 0.2 + Math.random() * 0.8,
      color: Math.random() > 0.3 ? '#ea8c28' : '#22c55e',
      burstUntil: 0,
    }));

    const burstInterval = setInterval(() => {
      const p = packets[Math.floor(Math.random() * packets.length)];
      p.burstUntil = Date.now() + 600;
    }, 3000);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < packets.length; i++) {
        for (let j = i + 1; j < packets.length; j++) {
          const dx = packets[i].x - packets[j].x;
          const dy = packets[i].y - packets[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(234, 140, 40, ${0.15 * (1 - dist / 110)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(packets[i].x, packets[i].y);
            ctx.lineTo(packets[j].x, packets[j].y);
            ctx.stroke();
          }
        }
      }

      const now = Date.now();
      packets.forEach((p) => {
        const mdx = mouseX - p.x;
        const mdy = mouseY - p.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 80) {
          p.x += mdx * 0.02;
          p.y += mdy * 0.02;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const isBurst = p.burstUntil > now;
        ctx.fillStyle = isBurst ? '#ffffff' : p.color;
        ctx.globalAlpha = isBurst ? 1.0 : p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isBurst ? p.size * 2 : p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      clearInterval(burstInterval);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <section ref={heroRef} className="relative overflow-hidden pt-12 pb-20 border-b border-[var(--border-color)] bg-grid-pattern">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column (55% Content) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Free & Open Source Pill */}
            <div data-hero-badge className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--success)]">
              <CheckCircle className="w-4 h-4" weight="fill" />
              <span>100% Free • Open Source • Zero Cloud Upload Waiting</span>
            </div>

            {/* Headline */}
            <h1 data-hero-title className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-tight text-[var(--text-primary)] font-display">
              Instant Direct <br className="hidden sm:inline" />
              <span className="text-[var(--accent)]">P2P Sharing</span>
            </h1>

            {/* Subtext */}
            <p data-hero-sub className="text-sm sm:text-lg text-[var(--text-secondary)] leading-relaxed max-w-[52ch]">
              No file size limits. No server uploads. Files stream directly between browsers over end-to-end encrypted peer-to-peer channels.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
              <Link
                data-hero-cta
                href="/send"
                className="px-6 py-3.5 rounded-xl bg-[var(--accent)] text-[var(--bg-main)] font-mono text-sm font-bold hover:opacity-90 transition-opacity glow-amber flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Lightning className="w-5 h-5" weight="fill" />
                Share File Instantly
              </Link>

              <a
                data-hero-cta
                href="#architecture"
                className="px-5 py-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-2"
              >
                <span>How It Works</span>
                <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]" />
              </a>
            </div>

            {/* Tech Badges Row */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 border-t border-[var(--border-color)] text-xs font-mono text-[var(--text-secondary)]">
              <div className="bg-[var(--bg-surface)]/50 p-2.5 rounded-lg border border-[var(--border-color)] sm:border-0 sm:p-0">
                <span className="text-[var(--text-primary)] font-bold block">Instant Sharing</span>
                <span className="text-[11px]">Zero Upload Delay</span>
              </div>
              <div className="bg-[var(--bg-surface)]/50 p-2.5 rounded-lg border border-[var(--border-color)] sm:border-0 sm:p-0">
                <span className="text-[var(--accent)] font-bold block">100% Private</span>
                <span className="text-[11px]">End-to-End Encrypted</span>
              </div>
              <div className="bg-[var(--bg-surface)]/50 p-2.5 rounded-lg border border-[var(--border-color)] sm:border-0 sm:p-0">
                <span className="text-[var(--success)] font-bold block">Zero Cloud Cost</span>
                <span className="text-[11px]">Direct Peer-to-Peer</span>
              </div>
            </div>

          </div>

          {/* Right Column (45% Interactive P2P Stream Simulator) */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 shadow-2xl overflow-hidden h-[420px] flex flex-col justify-between">
              
              {/* Canvas Particle Background */}
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />

              {/* Panel Header */}
              <div className="relative z-10 flex items-center justify-between border-b border-[var(--border-color)] pb-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--success)] animate-pulse" />
                  <span className="text-[var(--text-primary)] font-semibold font-display">P2P Stream Monitor</span>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/30 text-[9px] uppercase font-bold">
                    DIRECT LAN
                  </span>
                </div>
                <span className="text-[var(--text-secondary)]">Zero Server Relay</span>
              </div>

              {/* Central Telemetry Engine Output */}
              <div className="relative z-10 space-y-4 my-auto font-mono text-xs">
                <div className="bg-[var(--bg-main)]/90 backdrop-blur p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[var(--text-secondary)]">WebRTC DataChannel:</span>
                    <span className="text-[var(--success)] font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-ping" />
                      ACTIVE READY
                    </span>
                  </div>
                  
                  {/* Connection Architecture Status */}
                  <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)] flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-secondary)] font-mono">P2P Channel Throughput:</span>
                    <span className="text-[var(--accent)] font-mono font-bold">1,000 Mbps Capable</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[10px] text-[var(--text-secondary)] pt-1">
                    <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                      <span className="block text-[9px] uppercase">Transfer Latency</span>
                      <strong className="text-[var(--success)] text-xs font-bold tabular-nums">&lt; 1.0 ms (LAN)</strong>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                      <span className="block text-[9px] uppercase">Server Cloud Cost</span>
                      <strong className="text-[var(--accent)] text-xs font-bold tabular-nums">₹0 / $0 Free</strong>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                      <span className="block text-[9px] uppercase">Encryption</span>
                      <strong className="text-[var(--text-primary)] text-xs font-bold">AES-256-GCM</strong>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                      <span className="block text-[9px] uppercase">Integrity Check</span>
                      <strong className="text-[var(--text-primary)] text-xs font-bold">BLAKE3 Merkle</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel Footer */}
              <div className="relative z-10 flex justify-between items-center border-t border-[var(--border-color)] pt-3 font-mono text-[10px] text-[var(--text-secondary)]">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Hardware AES Accelerated</span>
                </div>
                <span>Zero Server Storage</span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
