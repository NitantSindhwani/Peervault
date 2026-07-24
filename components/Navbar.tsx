'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lightning, ShareNetwork, Copy, ChartLineUp, LockKey, List, X, SpeakerHigh, SpeakerSimpleSlash } from '@phosphor-icons/react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import { soundEngine } from '@/lib/audio/sound-engine';
import { ShinyText } from '@/components/TextAnimations';
import { MagneticButton } from '@/components/MagneticButton';

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const isActive = (path: string) => pathname === path;

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-main)]/80 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center group-hover:border-[var(--accent)] transition-colors shadow-md">
              <LockKey className="w-5 h-5 text-[var(--accent)]" weight="bold" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-base font-bold tracking-tight text-[var(--text-primary)] font-display">
                PeerVault<span className="text-[var(--accent)]">.io</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">
                Zero-Knowledge P2P
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links with Sliding Indicator */}
          <nav className="hidden md:flex items-center gap-1 bg-[var(--bg-surface)] p-1 rounded-lg border border-[var(--border-color)] relative">
            {[
              { href: '/send', label: 'Send File', icon: <ShareNetwork className="w-3.5 h-3.5" weight="bold" /> },
              { href: '/clip', label: 'ClipVault', icon: <Copy className="w-3.5 h-3.5" weight="bold" /> },
              { href: '/dashboard', label: 'Dashboard', icon: <ChartLineUp className="w-3.5 h-3.5" weight="bold" /> }
            ].map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3.5 py-1.5 rounded-md text-xs font-mono transition-colors flex items-center gap-1.5 z-10 ${
                    active ? 'text-[var(--bg-main)] font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 bg-[var(--accent)] rounded-md -z-10 shadow"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Action Controls */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setIsMuted(soundEngine.toggleMute());
              }}
              className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer shadow"
              title={isMuted ? 'Unmute Audio Feedback' : 'Mute Audio Feedback'}
            >
              {isMuted ? <SpeakerSimpleSlash className="w-4 h-4 text-red-400" /> : <SpeakerHigh className="w-4 h-4 text-[var(--accent)]" />}
            </button>

            <MagneticButton>
              <Link
                href="/send"
                className="hidden sm:flex px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-mono text-xs font-bold hover:opacity-90 transition-opacity glow-amber items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Lightning className="w-4 h-4" weight="fill" />
                Quick Send
              </Link>
            </MagneticButton>

            {/* Mobile Hamburger Trigger */}
            <button
              onClick={() => {
                soundEngine.playHoverClick();
                setMobileOpen(!mobileOpen);
              }}
              className="md:hidden p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer shadow"
              aria-label="Toggle Navigation Menu"
            >
              {mobileOpen ? <X className="w-5 h-5 text-[var(--accent)]" /> : <List className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-5 space-y-3 font-mono text-xs overflow-hidden shadow-2xl"
            >
              <Link
                href="/send"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isActive('/send')
                    ? 'bg-[var(--accent)] text-[var(--bg-main)] font-bold border-[var(--accent)]'
                    : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-primary)] font-semibold'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <ShareNetwork className="w-4 h-4" weight="bold" />
                  Send File / Folder
                </span>
                <Lightning className="w-4 h-4" weight="fill" />
              </Link>

              <Link
                href="/clip"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isActive('/clip')
                    ? 'bg-[var(--accent)] text-[var(--bg-main)] font-bold border-[var(--accent)]'
                    : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-primary)] font-semibold'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Copy className="w-4 h-4" weight="bold" />
                  ClipVault Clipboard
                </span>
              </Link>

              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isActive('/dashboard')
                    ? 'bg-[var(--accent)] text-[var(--bg-main)] font-bold border-[var(--accent)]'
                    : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-primary)] font-semibold'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <ChartLineUp className="w-4 h-4" weight="bold" />
                  My Transfer Dashboard
                </span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
