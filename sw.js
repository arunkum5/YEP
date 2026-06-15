const CACHE_NAME = 'yep-cache-v3';
const ASSETS_TO_CACHE = [
  './',
  './join',
  './admin',
  './yep_leader_seal.png',
  './logo.png',
  './yep_logo.svg',
  './advocate_logo.svg',
  './leader_profile.jpg'
];

// Install Event - Pre-cache essential static files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network-First falling back to Cache
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip third-party/API URLs that shouldn't be cached
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Skip caching database requests/Supabase URLs or external non-static requests
  if (url.origin !== self.location.origin) {
    // For external assets like Google Fonts, attempt cache fallback if network fails
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match(event.request))
      );
    }
    return;
  }

  // Handle local app routes
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and save the updated response to cache
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fall back to local cache if network is unavailable
        console.log('[Service Worker] Network failed, serving from cache:', event.request.url);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If a request for HTML page fails, return index fallback
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./');
          }
        });
      })
  );
});
