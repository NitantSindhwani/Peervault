import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hardened PeerVault',
    short_name: 'PeerVault',
    description: 'Zero-knowledge browser-to-browser P2P binary file streaming platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0f14',
    theme_color: '#ea8c28',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
