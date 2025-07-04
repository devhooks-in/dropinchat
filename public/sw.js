const CACHE_NAME = 'temptalk-cache-v1';

// On install, activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // On activation, claim all clients to take control immediately
  event.waitUntil(self.clients.claim());
});

// Use a stale-while-revalidate strategy for all requests.
// This will serve from cache first for speed, then update the cache in the background.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // If the request is successful, update the cache
          if (event.request.method === 'GET' && networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });

        // Return the cached response immediately if available, otherwise wait for the network response
        return cachedResponse || fetchPromise;
      }).catch(() => {
        // If both cache and network fail, this part can be used to show a generic offline fallback
        // For now, we just let the browser's default offline error show.
      })
    })
  );
});
