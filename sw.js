// =====================================================================
// GHS ↔ NGN Rate Tool — Service Worker
//
// Strategy: Cache-first with network fallback.
// All app files are cached on first install so the app works fully
// offline after the first load.
//
// To force users to get a new version, bump CACHE_VERSION below.
// =====================================================================

const CACHE_VERSION = 'v1';
const CACHE_NAME    = `ghs-ngn-${CACHE_VERSION}`;

// All files the app needs to work offline
const ASSETS = [
    './',
    './index.html',
    './index.css',
    './index.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// ---- INSTALL ----
// Pre-cache all app assets. skipWaiting activates the new SW immediately.

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(
                ASSETS.map(url => cache.add(url).catch(() => {
                    // Non-fatal: PNG icons may not exist yet (see icon-gen.html)
                    console.warn(`[SW] Could not cache: ${url}`);
                }))
            );
        })
    );
    self.skipWaiting();
});

// ---- ACTIVATE ----
// Delete any old cache versions so stale files don't hang around.

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log(`[SW] Deleting old cache: ${key}`);
                        return caches.delete(key);
                    })
            )
        )
    );
    self.clients.claim();
});

// ---- FETCH ----
// Cache-first: serve from cache instantly, fall back to network.
// Only caches same-origin GET requests.

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== location.origin) return;  // Skip cross-origin (future API calls)

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                // Cache valid responses for future offline use
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
