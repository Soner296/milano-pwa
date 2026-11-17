const cacheName = 'milano-v6';
const files = ['./', './index.html', './style.css', './app.js', './data.js', './openplz-streets.js',
  './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './speisekarte.pdf'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('milano-') && key !== cacheName).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(cacheName).then(async cache => {
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      return await fetch(request);
    } catch (error) {
      if (request.mode === 'navigate') return cache.match('./index.html');
      throw error;
    }
  }));
});
