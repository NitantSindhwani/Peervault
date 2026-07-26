'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DeviceMobile, Sparkle } from '@phosphor-icons/react';

export interface QRCodeViewerProps {
  url: string;
  size?: number;
}

export function QRCodeViewer({ url, size = 180 }: QRCodeViewerProps) {
  // Use short room URL for QR code so density is Version 3 (large dots, scans in < 0.01s)
  const shortQrUrl = url.includes('#offer=') ? url.split('#offer=')[0] : url;
  
  // Format URL so scanning from mobile phone on LAN doesn't hit phone's own localhost
  let scannableUrl = shortQrUrl;
  if (typeof window !== 'undefined' && scannableUrl.includes('localhost') && window.location.hostname !== 'localhost') {
    scannableUrl = scannableUrl.replace('localhost', window.location.hostname);
  }

  // Top-class free QR Code API (QRServer) for high-definition vector QR graphics
  const apiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(scannableUrl)}&margin=10&color=0d0f14&bgcolor=ffffff`;

  const [useFallbackSvg, setUseFallbackSvg] = useState(false);

  return (
    <div className="flex flex-col items-center space-y-3 font-mono">
      {/* Premium Eye-Worthy QR Card Container */}
      <div className="relative group p-4 bg-gradient-to-br from-[#1C1F26] via-[#14161D] to-[#0D0F14] rounded-2xl border-2 border-[var(--accent)] shadow-[0_0_35px_rgba(234,140,40,0.3)] transition-all duration-300 hover:scale-105 flex flex-col items-center">
        
        {/* Glow Accent Ambient Ring */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[var(--accent)] via-amber-400 to-[var(--accent)] opacity-25 blur-md group-hover:opacity-50 transition-opacity pointer-events-none" />

        <div className="relative p-3 bg-white rounded-xl shadow-inner flex items-center justify-center overflow-hidden">
          {!useFallbackSvg ? (
            <img
              src={apiQrUrl}
              alt="Scan Transfer QR Code"
              width={size}
              height={size}
              onError={() => setUseFallbackSvg(true)}
              className="w-full h-full object-contain rounded-lg shadow-sm"
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
        <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[10px] text-[var(--accent)] font-bold tracking-widest uppercase">
          <Sparkle className="w-3.5 h-3.5 animate-spin" />
          <span>INSTANT P2P PAIRING</span>
        </div>
      </div>

      {/* Mobile Instruction Badge */}
      <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] font-bold shadow-sm">
        <DeviceMobile className="w-4 h-4 text-[var(--accent)]" />
        <span>Scan with Camera or Lens</span>
      </div>
    </div>
  );
}
