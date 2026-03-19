/* ============================================
   NOTABLE SERVICE WORKER
   Version: 1.0.0
   Handles: Offline caching, background sync
   ============================================ */

const CACHE_NAME = 'notable-v1';
const STATIC_CACHE = 'notable-static-v1';
const DYNAMIC_CACHE = 'notable-dynamic-v1';

/* Files to cache on install */
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/* ── INSTALL ── */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Notable Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[SW] Static assets cached');
      return self.skipWaiting();
    }).catch((err) => {
      console.warn('[SW] Cache failed for some assets:', err);
      return self.skipWaiting();
    })
  );
});

/* ── ACTIVATE ── */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Notable Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Service Worker activated');
      return self.clients.claim();
    })
  );
});

/* ── FETCH — Cache First then Network ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET and cross-origin requests */
  if (request.method !== 'GET') return;
  if (!url.origin.startsWith(self.location.origin) &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) return;

  /* Google Fonts — network first, cache fallback */
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch {
          return cache.match(request);
        }
      })
    );
    return;
  }

  /* App assets — cache first, network fallback */
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        /* Update cache in background */
        fetch(request).then((networkResponse) => {
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, networkResponse.clone());
          });
        }).catch(() => {});
        return cachedResponse;
      }

      /* Not in cache — fetch from network */
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        /* Offline fallback — return index.html for navigation */
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

/* ── MESSAGE — Handle updates ── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
