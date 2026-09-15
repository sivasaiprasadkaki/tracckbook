const CACHE_VERSION = 'trackbook-app-shell-v1';
const DYNAMIC_CACHE = 'trackbook-dynamic-v1';
const FONT_CACHE = 'trackbook-fonts-v1';
const VALID_CACHES = [CACHE_VERSION, DYNAMIC_CACHE, FONT_CACHE];

// Check if running in a development environment (e.g. AI Studio preview dev server or localhost)
const isDev = 
  self.location.hostname === 'localhost' || 
  self.location.hostname === '127.0.0.1' || 
  self.location.hostname.includes('ais-dev-');

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

// Install: precache application shell in production, or skip in development
self.addEventListener('install', (event) => {
  self.skipWaiting();
  if (isDev) {
    return;
  }
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
            // Silently ignore any missing assets during precache
          }
        })
      );
      // Ensure root '/' is mapped if '/index.html' was successfully cached
      try {
        const indexResponse = await cache.match('/index.html');
        if (indexResponse) {
          await cache.put('/', indexResponse.clone());
        }
      } catch (_) {}
    })
  );
});

// Activate: clean obsolete caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (isDev) {
        // In development, automatically unregister so it doesn't conflict with Vite
        try {
          await self.registration.unregister();
        } catch (_) {}
      }
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (!VALID_CACHES.includes(name)) {
            return caches.delete(name);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Allow app to trigger skipWaiting on demand
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: intercept and serve from cache when offline (Production only)
if (!isDev) {
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

    // Ignore dev/Vite tooling and WebSockets
    if (
      url.pathname.startsWith('/@') ||
      url.pathname.startsWith('/src/') ||
      url.pathname.startsWith('/node_modules/') ||
      url.pathname.includes('vite') ||
      url.pathname.includes('hot-update') ||
      url.search.includes('import')
    ) {
      return;
    }

    // NEVER cache private APIs, auth calls, Supabase database, or Cloudinary uploads
    if (
      url.pathname.startsWith('/api/') || 
      url.hostname.includes('supabase.co') || 
      url.hostname.includes('cloudinary.com') ||
      url.hostname.includes('accounts.google.com') ||
      (url.hostname.includes('googleapis.com') && !url.hostname.includes('fonts.googleapis.com'))
    ) {
      return;
    }

    // 1. Offline Navigation Strategy: Return cached index.html for page navigation
    if (event.request.mode === 'navigate') {
      event.respondWith(
        (async () => {
          try {
            // When online, attempt network request first to get latest updates
            const networkResponse = await fetch(event.request);
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              const cache = await caches.open(CACHE_VERSION);
              cache.put('/index.html', clone);
              return networkResponse;
            }
            // Fall back to cached shell
            const cached = await caches.match('/index.html') || await caches.match('/');
            return cached || networkResponse;
          } catch (err) {
            // Device is OFFLINE: Serve the cached application shell!
            const cached = await caches.match('/index.html') || await caches.match('/');
            if (cached) {
              return cached;
            }
            const fallback = await caches.match('/index.html', { ignoreSearch: true });
            if (fallback) {
              return fallback;
            }
            // Graceful offline fallback page instead of throwing Failed to fetch
            return new Response(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><title>TrackBook</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;text-align:center;padding:48px 20px;background:#0f172a;color:#f8fafc;"><h2>TrackBook is Offline</h2><p style="color:#94a3b8;margin-top:12px;">Please connect to the internet to load TrackBook for the first time.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
        })()
      );
      return;
    }

    // 2. Google Fonts (CSS & Font binaries)
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
            return cached || new Response('', { status: 408, statusText: 'Request timed out / offline' });
          }
        })()
      );
      return;
    }

    // 3. Static Assets: Bundles, CSS, Images, Icons, Manifest
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
              const fallback = await caches.match(url.pathname);
              if (fallback) return fallback;
              // Never throw an uncaught error: return 404 response
              return new Response('', { status: 404, statusText: 'Asset not found in offline cache' });
            }
          })()
        );
        return;
      }
    }

    // If not matched, do NOT call event.respondWith: let browser handle natively
  });
}
