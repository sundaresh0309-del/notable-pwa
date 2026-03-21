/* ============================================
   M Paper SERVICE WORKER v2
   Network-first for app assets so new builds
   always load correctly. No more 404 on old JS.
   ============================================ */

const CACHE_VERSION = 'mpaper-v5';

/* ── INSTALL — skip waiting immediately ── */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v5...');
  event.waitUntil(self.skipWaiting());
});

/* ── ACTIVATE — delete ALL old caches ── */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v5, clearing old caches...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        console.log('[SW] Deleting cache:', key);
        return caches.delete(key);
      }))
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH — Network first, cache fallback ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Only handle GET */
  if (request.method !== 'GET') return;

  /* Google Fonts — network first */
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  /* App JS/CSS assets — ALWAYS network first so new builds load */
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  /* HTML and other pages — network first, cache fallback */
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then((cached) =>
          cached || (request.mode === 'navigate'
            ? caches.match('/M-Paper-pwa/index.html')
            : new Response('Offline', { status: 503 }))
        )
      )
  );
});

/* ── MESSAGE ── */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
