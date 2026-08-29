const CACHE_NAME = 'trackbook-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg?v=6'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests - Cache API throws error on POST/PUT/DELETE
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  // Never cache API routes or dynamic external services
  if (
    url.pathname.startsWith('/api/') || 
    url.hostname.includes('supabase.co') || 
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('googleapis.com')
  ) {
    return;
  }

  // Network First strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful GET responses for offline fallback
        if (response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try {
              cache.put(event.request, responseClone);
            } catch (_) {
              // Ignore cache write errors
            }
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
  );
});
