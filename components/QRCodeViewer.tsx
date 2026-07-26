'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DeviceMobile, Sparkle } from '@phosphor-icons/react';

export interface QRCodeViewerProps {
  url: string;
  size?: number;
}

export function QRCodeViewer({ url, size = 180 }: QRCodeViewerProps) {
  // Extract base room URL and replace localhost if necessary so mobile cameras hit the correct LAN IP / host
  const rawCleanUrl = url.includes('#offer=') ? url.split('#offer=')[0] : url;
  
  // Format URL so scanning from mobile phone on LAN doesn't hit phone's own localhost
  let scannableUrl = rawCleanUrl;
  if (typeof window !== 'undefined' && scannableUrl.includes('localhost') && window.location.hostname !== 'localhost') {
    scannableUrl = scannableUrl.replace('localhost', window.location.hostname);
  }

  // Top-class free QR Code API (QRServer / QuickChart) for ultra-high-definition vector QR graphics
  const apiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(scannableUrl)}&margin=10&color=0d0f14&bgcolor=ffffff`;

  const [useFallbackSvg, setUseFallbackSvg] = useState(false);

  return (
    <div className="flex flex-col items-center space-y-3 font-mono">
      {/* Premium Fabulous QR Card Container */}
      <div className="relative group p-3.5 bg-gradient-to-br from-[#1A1D24] via-[#13151C] to-[#0D0F14] rounded-2xl border-2 border-[var(--accent)] shadow-[0_0_35px_rgba(234,140,40,0.3)] transition-all hover:scale-105 flex flex-col items-center">
        
        {/* Glow Accent Rings */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[var(--accent)] via-amber-400 to-[var(--accent)] opacity-20 blur-md group-hover:opacity-40 transition-opacity pointer-events-none" />

        <div className="relative p-3 bg-white rounded-xl shadow-inner flex items-center justify-center overflow-hidden">
          {!useFallbackSvg ? (
            <img
              src={apiQrUrl}
              alt="Scan Transfer QR Code"
              width={size}
              height={size}
              onError={() => setUseFallbackSvg(true)}
              className="w-full h-full object-contain rounded-lg"
            />
          ) : (
            <QRCodeSVG
              value={scannableUrl}
              size={size}
              level="M"
              includeMargin={true}
              bgColor="#FFFFFF"
              fgColor="#0D0F14"
            />
          )}
        </div>

        {/* Brand Tag underneath QR code */}
        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-[var(--accent)] font-bold tracking-wider uppercase">
          <Sparkle className="w-3 h-3 animate-spin" />
          <span>INSTANT P2P PAIRING</span>
        </div>
      </div>

      {/* Mobile Instruction Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] font-bold">
        <DeviceMobile className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span>Scan with Camera or Lens</span>
      </div>
    </div>
  );
}
