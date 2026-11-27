// Cache only a static, non-personalized offline document and PWA metadata.
// Never cache app navigations, API data, map archives, uploads or user media.
const CACHE_NAME = 'hola-maps-shell-v6';
const APP_SHELL = ['/offline.html', '/manifest.webmanifest', '/pwa-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    APP_SHELL.map(path => new Request(path, { credentials: 'omit', cache: 'reload' }))
  )).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('hola-maps-') && key !== CACHE_NAME).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.mode !== 'navigate') return;
  // In particular, never substitute an old logged-in route on connection loss.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/maps/')) return;
  event.respondWith(fetch(request, { cache: 'no-store' }).catch(async () => {
    const cache = await caches.open(CACHE_NAME);
    const offline = await cache.match('/offline.html');
    return offline || new Response('HOLA Maps đang ngoại tuyến.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }));
});
