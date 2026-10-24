// Bump this number whenever you change index.html, manifest.json, or any cached file.
// Users will get the new version on their next app open.
const CACHE_NAME = 'aavin-delivery-shell-v11';

// Files that live in your repo — cached on install.
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// CDN resources — cached the first time the app uses them, so offline still works.
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'accounts.google.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isCdn = CDN_HOSTS.includes(url.hostname);

  // Google sign-in endpoints must never be cached — they need live network.
  if (url.hostname === 'accounts.google.com' ||
      url.hostname.endsWith('.googleapis.com')) {
    return; // let the browser handle it normally
  }

  // App shell + CDN assets: cache-first, then network, and quietly update cache.
  if (isSameOrigin || isCdn) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            // Only cache successful, complete responses.
            if (res && res.status === 200 && res.type !== 'opaque' && !cached) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached); // if network fails, fall back to cache

        // Serve cache instantly if we have it; otherwise wait for network.
        return cached || networkFetch;
      })
    );
  }
  // Everything else: default browser behaviour.
});
