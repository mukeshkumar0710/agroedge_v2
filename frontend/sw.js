/**
 * Service Worker: AgroEdge Triage PWA
 * Handles offline caching and Background Sync event dispatch.
 */

const CACHE_NAME = 'agro-edge-cache-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/app.css',
  '/js/app.js',
  '/js/idb-store.js',
  '/js/i18n.js',
  '/js/sync-engine.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-First strategy with network fallback for assets, Network-First for API
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Bypass non-http protocols (e.g., chrome-extension)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Bypass cache for API calls, SSE streams, and live government command dashboard
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/dashboard')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached and refresh cache in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).catch((err) => {
        // If navigation request for an HTML page, serve cached index.html
        if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
        throw err;
      });
    })
  );
});

// Background Sync API Handler (triggered when device regains connectivity)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-diagnoses') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        // Broadcast trigger to active client windows to execute sync engine flush
        clients.forEach((client) => {
          client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGERED' });
        });
      })
    );
  }
});
