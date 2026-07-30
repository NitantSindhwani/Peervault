'use client';

import { QRCodeSVG } from 'qrcode.react';
import { DeviceMobile, Sparkle } from '@phosphor-icons/react';

export interface QRCodeViewerProps {
  url: string;
  size?: number;
}

export function QRCodeViewer({ url, size = 200 }: QRCodeViewerProps) {
  // If running on localhost, swap to LAN IP so a phone on the same Wi-Fi
  // can actually reach the dev server.
  let scannableUrl = url;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    // Keep localhost – production deploys use a real domain which is always fine.
  }

  return (
    <div className="flex flex-col items-center space-y-3 font-mono">
      {/* QR Card */}
      <div className="relative group p-4 bg-gradient-to-br from-[#1C1F26] via-[#14161D] to-[#0D0F14] rounded-2xl border-2 border-[var(--accent)] shadow-[0_0_35px_rgba(234,140,40,0.3)] transition-all duration-300 hover:scale-105 flex flex-col items-center">
        
        {/* Glow ring */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[var(--accent)] via-amber-400 to-[var(--accent)] opacity-25 blur-md group-hover:opacity-50 transition-opacity pointer-events-none" />

        {/* White QR area */}
        <div className="relative p-3 bg-white rounded-xl shadow-inner flex items-center justify-center overflow-hidden">
          {/*
            Render directly using qrcode.react SVG — no external API call,
            always works offline. Level H = max error correction = easier to
            scan even in dim light or at an angle.
          */}
          <QRCodeSVG
            value={scannableUrl}
            size={size}
            level="H"
            includeMargin={false}
            bgColor="#FFFFFF"
            fgColor="#0D0F14"
          />
        </div>

        {/* Brand Tag */}
        <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[10px] text-[var(--accent)] font-bold tracking-widest uppercase">
          <Sparkle className="w-3.5 h-3.5 animate-spin" />
          <span>INSTANT P2P PAIRING</span>
        </div>
      </div>

      {/* URL preview — truncated so QR is short */}
      <div className="text-[10px] text-[var(--text-secondary)] font-mono px-2 text-center max-w-[220px] truncate opacity-60">
        {scannableUrl}
      </div>

      {/* Instruction */}
      <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] font-bold shadow-sm">
        <DeviceMobile className="w-4 h-4 text-[var(--accent)]" />
        <span>Scan with Camera or Lens</span>
      </div>
    </div>
  );
}
