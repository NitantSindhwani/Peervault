'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lightning, ShareNetwork, Copy, ChartLineUp, LockKey, List, X } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-main)]/80 border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center group-hover:border-[var(--accent)] transition-colors">
            <LockKey className="w-5 h-5 text-[var(--accent)]" weight="bold" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-base font-bold tracking-tight text-[var(--text-primary)] font-display">
              PeerVault<span className="text-[var(--accent)]">.io</span>
            </span>
            <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">
              Zero-Knowledge P2P
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-[var(--bg-surface)] p-1 rounded-lg border border-[var(--border-color)]">
          <Link
            href="/send"
            className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 ${
              isActive('/send')
                ? 'bg-[var(--accent)] text-[var(--bg-main)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShareNetwork className="w-3.5 h-3.5" weight="bold" />
            Send File
          </Link>

          <Link
            href="/clip"
            className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 ${
              isActive('/clip')
                ? 'bg-[var(--accent)] text-[var(--bg-main)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Copy className="w-3.5 h-3.5" weight="bold" />
            ClipVault
          </Link>

          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 ${
              isActive('/dashboard')
                ? 'bg-[var(--accent)] text-[var(--bg-main)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ChartLineUp className="w-3.5 h-3.5" weight="bold" />
            Telemetry Node
          </Link>
        </nav>

        {/* System Integrity Badge & CTAs */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[11px] font-mono text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            <span>WebRTC Mesh Active</span>
          </div>

          <Link
            href="/send"
            className="hidden sm:flex px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-mono text-xs font-semibold hover:opacity-90 transition-opacity glow-amber items-center gap-1.5 cursor-pointer"
          >
            <Lightning className="w-4 h-4" weight="fill" />
            Quick Transfer
          </Link>

          {/* Mobile Hamburger Trigger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <List className="w-5 h-5" />}
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
            className="md:hidden border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-4 space-y-3 font-mono text-xs overflow-hidden"
          >
            <Link
              href="/send"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--bg-main)] text-[var(--text-primary)] font-semibold"
            >
              <ShareNetwork className="w-4 h-4 text-[var(--accent)]" />
              Send File
            </Link>

            <Link
              href="/clip"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--bg-main)] text-[var(--text-primary)] font-semibold"
            >
              <Copy className="w-4 h-4 text-[var(--accent)]" />
              ClipVault P2P Clipboard
            </Link>

            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--bg-main)] text-[var(--text-primary)] font-semibold"
            >
              <ChartLineUp className="w-4 h-4 text-[var(--accent)]" />
              Telemetry Node & History
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
