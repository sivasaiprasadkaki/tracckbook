const CACHE_VERSION = 'trackbook-app-shell-v1';
const DYNAMIC_CACHE = 'trackbook-dynamic-v1';
const FONT_CACHE = 'trackbook-fonts-v1';
const VALID_CACHES = [CACHE_VERSION, DYNAMIC_CACHE, FONT_CACHE];

const CORE_APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-16.png',
  '/favicon-32.png',
  '/favicon-48.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
  '/icon-transparent.svg',
  '/apple-touch-icon.png',
  '/version.json'
];

const BUILD_ASSETS = [/* INJECTED_AT_BUILD */];

// Install: precache application shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const allAssets = Array.from(new Set([...CORE_APP_SHELL_URLS, ...BUILD_ASSETS]));
      await Promise.all(
        allAssets.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn('[TrackBook SW] Precache skipped for:', url);
          }
        })
      );
      // Ensure / is mapped if /index.html was successfully cached
      try {
        const indexResponse = await cache.match('/index.html');
        if (indexResponse) {
          await cache.put('/', indexResponse.clone());
        }
      } catch (_) {}
    })
  );
});

// Activate: safely clean obsolete caches (NEVER touch IndexedDB or localStorage)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (!VALID_CACHES.includes(name)) {
            console.log('[TrackBook SW] Removing obsolete app cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Allow app to trigger skipWaiting on demand
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: intercept and serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests - Cache API throws error on non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Ignore non-http/https schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 1. NEVER cache private APIs, auth calls, Supabase database, or Cloudinary uploads
  if (
    url.pathname.startsWith('/api/') || 
    url.hostname.includes('supabase.co') || 
    url.hostname.includes('cloudinary.com')
  ) {
    return;
  }

  // 2. Offline Navigation Strategy: Return cached index.html for any navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // When online, attempt network request first
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            // Update cached app shell with fresh index.html
            const clone = networkResponse.clone();
            const cache = await caches.open(CACHE_VERSION);
            cache.put('/index.html', clone);
            return networkResponse;
          }
          // Server returned an error (e.g. 502/504), fall back to cached shell
          const cached = await caches.match('/index.html') || await caches.match('/');
          return cached || networkResponse;
        } catch (err) {
          // Device is OFFLINE: Serve the cached application shell!
          console.log('[TrackBook SW] Offline navigation fallback for:', url.pathname);
          const cached = await caches.match('/index.html') || await caches.match('/');
          if (cached) {
            return cached;
          }
          const fallback = await caches.match('/index.html', { ignoreSearch: true });
          if (fallback) {
            return fallback;
          }
          throw err;
        }
      })()
    );
    return;
  }

  // 3. Google Fonts (CSS & Font binaries)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      (async () => {
        const fontCache = await caches.open(FONT_CACHE);
        const cached = await fontCache.match(event.request);
        if (cached) return cached;
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            fontCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  // 4. Static Assets: Bundles, CSS, Images, Icons, Manifest
  if (url.origin === self.location.origin) {
    const isStaticAsset = 
      url.pathname.startsWith('/assets/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.ico') ||
      url.pathname.endsWith('.json') ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.woff2');

    if (isStaticAsset) {
      event.respondWith(
        (async () => {
          // Cache First: check if asset is in cache
          const cached = await caches.match(event.request, { ignoreSearch: true });
          if (cached) {
            return cached;
          }

          // If not in cache, fetch from network and dynamically cache
          try {
            const networkResponse = await fetch(event.request);
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              const dynCache = await caches.open(DYNAMIC_CACHE);
              dynCache.put(event.request, clone);
            }
            return networkResponse;
          } catch (err) {
            // Fallback match
            const fallback = await caches.match(url.pathname);
            if (fallback) return fallback;
            throw err;
          }
        })()
      );
      return;
    }
  }

  // 5. Default Network-First strategy for any remaining GET requests
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            try { cache.put(event.request, clone); } catch (_) {}
          });
        }
        return response;
      })
      .catch(async () => {
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
