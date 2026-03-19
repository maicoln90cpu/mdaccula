// ============================================
// MDAccula Service Worker v8
// Cache First with TTL for APIs + Edge Caching
// ============================================

const BUILD_TIMESTAMP = Date.now();
const CACHE_VERSION = 'v8';
const STATIC_CACHE = `mdaccula-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `mdaccula-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `mdaccula-images-${CACHE_VERSION}`;
const API_CACHE = `mdaccula-api-${CACHE_VERSION}`;

// TTL per API path (in milliseconds)
const API_TTL = {
  '/rest/v1/site_settings': 15 * 60 * 1000,  // 15 min (rarely changes)
  '/rest/v1/events': 5 * 60 * 1000,           // 5 min
  '/rest/v1/blog_posts': 5 * 60 * 1000,       // 5 min
  '/rest/v1/link_groups': 2 * 60 * 1000,      // 2 min (changes more often)
};

const PRECACHE_URLS = ['/', '/offline.html'];

const STATIC_PATTERNS = [/\.woff2?$/, /\.ttf$/, /\.otf$/, /\/assets\/.*\.(js|css)$/];
const IMAGE_PATTERNS = [/\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$/];

// Supabase API paths that should be cached for resilience
const CACHEABLE_API_PATHS = [
  '/rest/v1/link_groups',
  '/rest/v1/site_settings',
  '/rest/v1/blog_posts',
  '/rest/v1/events',
];

// Install
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing v${CACHE_VERSION}`);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => console.log('[SW] Installation complete'))
      .catch((error) => console.error('[SW] Installation failed:', error))
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating v${CACHE_VERSION}`);
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('mdaccula-') && !currentCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    ).then(() => console.log('[SW] Activation complete'))
  );
  self.clients.claim();
});

const matchesPatterns = (url, patterns) => patterns.some(p => p.test(url.pathname));

// Check if this is a cacheable Supabase API request (public data only)
const isCacheableApiRequest = (url) => {
  if (!url.hostname.includes('supabase.co')) return false;
  return CACHEABLE_API_PATHS.some(path => url.pathname.includes(path));
};

// Get TTL for a given API URL
const getApiTTL = (url) => {
  for (const [path, ttl] of Object.entries(API_TTL)) {
    if (url.pathname.includes(path)) return ttl;
  }
  return 2 * 60 * 1000; // default 2 min
};

// Check if request should bypass cache entirely
const shouldBypassCache = (url) => {
  if (isCacheableApiRequest(url)) return false;
  
  const isExternal = url.origin !== self.location.origin;
  const isSupabaseAPI = url.hostname.includes('supabase.co');
  const isAnalytics = url.hostname.includes('googletagmanager.com') || 
                      url.hostname.includes('google-analytics.com') ||
                      url.hostname.includes('hotjar.com') ||
                      url.hostname.includes('facebook.net');
  const isHotReload = url.pathname.includes('/@vite') || 
                      url.pathname.includes('/__vite') ||
                      url.pathname.includes('/node_modules/');
  
  return isExternal || isSupabaseAPI || isAnalytics || isHotReload;
};

// Strategy: Cache First
const cacheFirst = async (request, cacheName) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache First failed:', request.url);
    throw error;
  }
};

// Strategy: Cache First with TTL
// Serves from cache if fresh, otherwise fetches from network.
// If cache is stale but network fails, still serves stale cache.
const cacheFirstWithTTL = async (request, cacheName, ttl) => {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    const cachedDate = cachedResponse.headers.get('sw-cached-at');
    const age = cachedDate ? Date.now() - parseInt(cachedDate, 10) : Infinity;
    
    if (age < ttl) {
      // Cache is fresh — serve it, no network call
      return cachedResponse;
    }
    
    // Cache is stale — try network, fall back to stale cache
    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.status === 200) {
        const headers = new Headers(networkResponse.headers);
        headers.set('sw-cached-at', String(Date.now()));
        const timedResponse = new Response(await networkResponse.clone().blob(), {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers,
        });
        cache.put(request, timedResponse);
        return networkResponse;
      }
      return cachedResponse; // network returned non-200, use stale
    } catch (error) {
      console.log('[SW] Network failed, serving stale cache:', request.url);
      return cachedResponse;
    }
  }
  
  // No cache at all — must fetch from network
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cached-at', String(Date.now()));
      const timedResponse = new Response(await networkResponse.clone().blob(), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers,
      });
      cache.put(request, timedResponse);
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache First with TTL failed:', request.url);
    throw error;
  }
};

// Strategy: Network First with Cache Fallback
const networkFirst = async (request, cacheName) => {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network First failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    if (request.mode === 'navigate') return caches.match('/offline.html');
    throw error;
  }
};

// Fetch handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cacheable Supabase API requests — Cache First with TTL
  if (isCacheableApiRequest(url)) {
    const ttl = getApiTTL(url);
    event.respondWith(cacheFirstWithTTL(event.request, API_CACHE, ttl));
    return;
  }

  if (shouldBypassCache(url)) return;

  // Static assets - Cache First
  if (matchesPatterns(url, STATIC_PATTERNS)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Images - Cache First
  if (matchesPatterns(url, IMAGE_PATTERNS)) {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE));
    return;
  }

  // HTML and other dynamic content - Network First
  event.respondWith(networkFirst(event.request, DYNAMIC_CACHE));
});

// Message handler
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_VERSION,
      buildTimestamp: BUILD_TIMESTAMP,
      caches: { static: STATIC_CACHE, dynamic: DYNAMIC_CACHE, images: IMAGE_CACHE, api: API_CACHE }
    });
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
        .then(() => event.ports[0].postMessage({ success: true }))
    );
  }
});

// Periodic sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupExpiredCaches());
  }
});

async function cleanupExpiredCaches() {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, API_CACHE];
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => name.startsWith('mdaccula-') && !currentCaches.includes(name));
  await Promise.all(oldCaches.map(name => caches.delete(name)));
  console.log('[SW] Cleanup complete, removed:', oldCaches.length, 'old caches');
}
