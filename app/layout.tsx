import type { Metadata } from 'next';
import { orbitron, jetbrainsMono } from './fonts';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Hardened PeerVault — Zero-Knowledge P2P Streaming',
  description: 'Browser-to-browser, zero-knowledge binary file-streaming platform powered by WebRTC DataChannels, WASM crypto, and BBR congestion control.',
  keywords: ['WebRTC', 'P2P', 'Zero Knowledge', 'WASM', 'BBR', 'File Transfer', 'Encrypted Streaming'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${orbitron.variable} ${jetbrainsMono.variable} font-mono antialiased bg-[var(--bg-main)] text-[var(--text-primary)] min-h-screen flex flex-col`}>
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
