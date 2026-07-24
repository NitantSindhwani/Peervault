// Hardened PeerVault Service Worker (Firefox / Safari Stream Intercept Fallback)
const CACHE_NAME = 'peervault-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept stream download requests for Firefox StreamSaver fallback
  if (url.pathname.startsWith('/api/stream-download/')) {
    event.respondWith(
      new Response(
        new ReadableStream({
          start(controller) {
            // Signal stream ready
          },
        }),
        {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': 'attachment; filename="dataset.bin"',
          },
        }
      )
    );
  }
});
