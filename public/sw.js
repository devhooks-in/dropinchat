const CACHE_NAME = 'dropinchat-cache-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      
      const fetchedResponsePromise = fetch(event.request).then((networkResponse) => {
        // Don't cache non-OK responses
        if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => {
          // fetch failed, maybe offline
          return cachedResponse; // return cached response if fetch fails
      });
      
      return cachedResponse || fetchedResponsePromise;
    })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
