// A basic service worker for PWA offline functionality
self.addEventListener('install', (event) => {
  // Caching essential assets
  event.waitUntil(
    caches.open('dropinchat-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/favicon.ico',
        '/manifest.json',
        '/icons/icon-192x192.svg',
        '/icons/icon-512x512.svg'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Serve from cache, fall back to network
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
