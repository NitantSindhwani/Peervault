'use client';

import { QRCodeSVG } from 'qrcode.react';
import { QrCode, DeviceMobile, Check } from '@phosphor-icons/react';

export interface QRCodeViewerProps {
  url: string;
  size?: number;
}

export function QRCodeViewer({ url, size = 160 }: QRCodeViewerProps) {
  // Use short room URL for QR code so density is low and any phone camera scans in < 0.1s
  const cleanQrUrl = url.includes('#offer=') ? url.split('#offer=')[0] : url;

  return (
    <div className="flex flex-col items-center space-y-3 font-mono">
      <div className="p-4 bg-white rounded-2xl border-4 border-[var(--accent)] shadow-[0_0_30px_rgba(234,140,40,0.25)] flex items-center justify-center transition-all hover:scale-105">
        <QRCodeSVG
          value={cleanQrUrl}
          size={size}
          level="M"
          includeMargin={true}
          bgColor="#FFFFFF"
          fgColor="#0D0F14"
        />
      </div>

      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)] text-[11px] text-[var(--accent)] font-bold">
        <DeviceMobile className="w-3.5 h-3.5" />
        <span>Scan with Any Phone Camera</span>
      </div>
    </div>
  );
}
