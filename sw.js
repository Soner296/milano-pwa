const cacheName = 'milano-v13';
const files = ['./', './index.html', './style.css?v=13', './app.js?v=13', './data.js', './openplz-streets.js', './local-data.js?v=13',
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
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.status >= 500) throw new Error('Milano server unavailable');
      if (response.ok) {
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return cache.match('./index.html');
      throw error;
    }
  }));
});
