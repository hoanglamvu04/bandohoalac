const CACHE_NAME = 'hola-maps-shell-v5';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/pwa-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('hola-maps-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API data and local map archives must always be network-driven.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/maps/')
  ) {
    return;
  }

  // Navigation, JS and CSS are network-first. This prevents an installed PWA
  // from continuing to run an old UI bundle after a production deployment.
  const mustBeFresh =
    request.mode === 'navigate' ||
    request.destination === 'script' ||
    request.destination === 'style';

  if (mustBeFresh) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          return (
            await caches.match(request) ||
            (request.mode === 'navigate' ? await caches.match('/') : undefined) ||
            new Response('Hola Maps đang ngoại tuyến.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            })
          );
        })
    );
    return;
  }

  const isStaticAsset =
    request.destination === 'font' ||
    request.destination === 'image';

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
