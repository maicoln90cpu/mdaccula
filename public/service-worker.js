// ============================================
// MDAccula Service Worker v10
// Cache First with TTL + Egress Tracking
// ============================================

const BUILD_TIMESTAMP = Date.now();
const CACHE_VERSION = 'v10';
const STATIC_CACHE = `mdaccula-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `mdaccula-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `mdaccula-images-${CACHE_VERSION}`;
const API_CACHE = `mdaccula-api-${CACHE_VERSION}`;

// TTL per API path (in milliseconds) — aggressive caching
const API_TTL = {
  '/rest/v1/site_settings': 60 * 60 * 1000,   // 60 min
  '/rest/v1/events': 30 * 60 * 1000,           // 30 min
  '/rest/v1/blog_posts': 30 * 60 * 1000,       // 30 min
  '/rest/v1/link_groups': 15 * 60 * 1000,      // 15 min
};

const PRECACHE_URLS = ['/', '/offline.html'];
const STATIC_PATTERNS = [/\.woff2?$/, /\.ttf$/, /\.otf$/, /\/assets\/.*\.(js|css)$/];
const IMAGE_PATTERNS = [/\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$/];

const CACHEABLE_API_PATHS = [
  '/rest/v1/link_groups',
  '/rest/v1/site_settings',
  '/rest/v1/blog_posts',
  '/rest/v1/events',
];

// ============================================
// EGRESS TRACKING
// ============================================
const egressMetrics = {}; // key: "path|hour" → { cache_hits, cache_misses, egress_bytes }
const EGRESS_FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes
let supabaseProjectUrl = null; // detected dynamically

// Extract table path from full URL (e.g. "/rest/v1/events?select=..." → "/rest/v1/events")
function extractApiPath(url) {
  const match = url.pathname.match(/^\/rest\/v1\/([a-z_]+)/);
  return match ? `/rest/v1/${match[1]}` : url.pathname;
}

// Get current hour as ISO string (rounded to hour)
function getCurrentHourISO() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.toISOString();
}

// Record an egress metric
function recordEgress(url, isHit, bytes) {
  const apiPath = extractApiPath(url);
  const hour = getCurrentHourISO();
  const key = `${apiPath}|${hour}`;

  if (!egressMetrics[key]) {
    egressMetrics[key] = { api_path: apiPath, period_start: hour, cache_hits: 0, cache_misses: 0, egress_bytes: 0 };
  }

  if (isHit) {
    egressMetrics[key].cache_hits++;
  } else {
    egressMetrics[key].cache_misses++;
    egressMetrics[key].egress_bytes += bytes;
  }
}

// Detect Supabase URL from intercepted requests
function detectSupabaseUrl(url) {
  if (!supabaseProjectUrl && url.hostname.includes('supabase.co')) {
    supabaseProjectUrl = `${url.protocol}//${url.hostname}`;
  }
}

// Flush metrics to the track-egress edge function
async function flushEgressMetrics() {
  const keys = Object.keys(egressMetrics);
  if (keys.length === 0 || !supabaseProjectUrl) return;

  const metrics = keys.map(k => ({ ...egressMetrics[k], source: 'sw' }));

  // Clear immediately to avoid double-sending
  keys.forEach(k => delete egressMetrics[k]);

  try {
    await fetch(`${supabaseProjectUrl}/functions/v1/track-egress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics),
    });
  } catch (err) {
    // On failure, put metrics back so they're retried next flush
    for (const m of metrics) {
      const key = `${m.api_path}|${m.period_start}`;
      if (!egressMetrics[key]) {
        egressMetrics[key] = { api_path: m.api_path, period_start: m.period_start, cache_hits: 0, cache_misses: 0, egress_bytes: 0 };
      }
      egressMetrics[key].cache_hits += m.cache_hits;
      egressMetrics[key].cache_misses += m.cache_misses;
      egressMetrics[key].egress_bytes += m.egress_bytes;
    }
    console.warn('[SW] Failed to flush egress metrics, will retry');
  }
}

// Periodic flush timer
setInterval(flushEgressMetrics, EGRESS_FLUSH_INTERVAL);

// ============================================
// INSTALL / ACTIVATE
// ============================================
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

// ============================================
// HELPERS
// ============================================
const matchesPatterns = (url, patterns) => patterns.some(p => p.test(url.pathname));

const isCacheableApiRequest = (url) => {
  if (!url.hostname.includes('supabase.co')) return false;
  return CACHEABLE_API_PATHS.some(path => url.pathname.includes(path));
};

const getApiTTL = (url) => {
  for (const [path, ttl] of Object.entries(API_TTL)) {
    if (url.pathname.includes(path)) return ttl;
  }
  return 15 * 60 * 1000;
};

const shouldBypassCache = (url) => {
  const isExternal = url.origin !== self.location.origin;
  const isAnalytics = url.hostname.includes('googletagmanager.com') ||
                      url.hostname.includes('google-analytics.com') ||
                      url.hostname.includes('hotjar.com') ||
                      url.hostname.includes('facebook.net');
  const isHotReload = url.pathname.includes('/@vite') ||
                      url.pathname.includes('/__vite') ||
                      url.pathname.includes('/node_modules/');
  return isExternal || isAnalytics || isHotReload;
};

// ============================================
// CACHE STRATEGIES (with egress tracking)
// ============================================
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

const cacheFirstWithTTL = async (request, cacheName, ttl) => {
  const url = new URL(request.url);
  detectSupabaseUrl(url);

  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const cachedDate = cachedResponse.headers.get('sw-cached-at');
    const age = cachedDate ? Date.now() - parseInt(cachedDate, 10) : Infinity;

    if (age < ttl) {
      // Cache HIT — no egress
      recordEgress(url, true, 0);
      return cachedResponse;
    }

    // Stale — try network
    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.status === 200) {
        // Measure bytes
        const cloned = networkResponse.clone();
        const buffer = await cloned.arrayBuffer();
        const bytes = buffer.byteLength;
        recordEgress(url, false, bytes);

        const headers = new Headers(networkResponse.headers);
        headers.set('sw-cached-at', String(Date.now()));
        const timedResponse = new Response(buffer, {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers,
        });
        cache.put(request, timedResponse);

        // Return a fresh response from the same buffer
        return new Response(buffer, {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers: networkResponse.headers,
        });
      }
      return cachedResponse;
    } catch (error) {
      console.log('[SW] Network failed, serving stale cache:', request.url);
      recordEgress(url, true, 0); // served from stale cache = no egress
      return cachedResponse;
    }
  }

  // No cache — must fetch
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cloned = networkResponse.clone();
      const buffer = await cloned.arrayBuffer();
      const bytes = buffer.byteLength;
      recordEgress(url, false, bytes);

      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cached-at', String(Date.now()));
      const timedResponse = new Response(buffer, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers,
      });
      cache.put(request, timedResponse);

      return new Response(buffer, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: networkResponse.headers,
      });
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache First with TTL failed:', request.url);
    throw error;
  }
};

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

// ============================================
// FETCH HANDLER
// ============================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // --- Supabase traffic (all methods) ---
  if (url.hostname.includes('supabase.co')) {
    detectSupabaseUrl(url);

    // Don't intercept the track-egress function itself
    if (url.pathname.includes('track-egress')) return;

    // Cacheable GET API requests — Cache First with TTL
    if (event.request.method === 'GET' && isCacheableApiRequest(url)) {
      const ttl = getApiTTL(url);
      event.respondWith(cacheFirstWithTTL(event.request, API_CACHE, ttl));
      return;
    }

    // All other Supabase requests (POST/PUT/DELETE, auth, functions, rpc, non-cached GET)
    // Measure response bytes for egress tracking
    event.respondWith(
      fetch(event.request).then(async (response) => {
        try {
          const cloned = response.clone();
          const buffer = await cloned.arrayBuffer();
          recordEgress(url, false, buffer.byteLength);
        } catch (e) { /* ignore measurement errors */ }
        return response;
      }).catch((err) => { throw err; })
    );
    return;
  }

  // --- Non-Supabase traffic (GET only for caching) ---
  if (event.request.method !== 'GET') return;

  if (shouldBypassCache(url)) return;

  if (matchesPatterns(url, STATIC_PATTERNS)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  if (matchesPatterns(url, IMAGE_PATTERNS)) {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE));
    return;
  }

  event.respondWith(networkFirst(event.request, DYNAMIC_CACHE));
});

// ============================================
// MESSAGE HANDLER
// ============================================
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
  if (event.data?.type === 'FLUSH_EGRESS') {
    event.waitUntil(flushEgressMetrics());
  }
  if (event.data?.type === 'GET_EGRESS_STATS') {
    const stats = { ...egressMetrics };
    event.ports[0]?.postMessage({ stats });
  }
});

// ============================================
// VISIBILITY CHANGE — flush on tab close
// ============================================
self.addEventListener('visibilitychange', () => {
  if (self.document?.visibilityState === 'hidden') {
    flushEgressMetrics();
  }
});

// Also flush when clients disconnect (best effort)
self.addEventListener('clientdisconnect', () => {
  flushEgressMetrics();
});

// ============================================
// PERIODIC SYNC
// ============================================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupExpiredCaches());
  }
  if (event.tag === 'egress-flush') {
    event.waitUntil(flushEgressMetrics());
  }
});

async function cleanupExpiredCaches() {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, API_CACHE];
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => name.startsWith('mdaccula-') && !currentCaches.includes(name));
  await Promise.all(oldCaches.map(name => caches.delete(name)));
  console.log('[SW] Cleanup complete, removed:', oldCaches.length, 'old caches');
}
