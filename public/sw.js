// Healers Music Platform Service Worker for Offline Playback
const CACHE_NAME = 'healers-static-cache-v1';
const ACTION_CACHE_NAME = 'healers-audio-cache';

// Assets to cache immediately on SW install for reliable offline startup
const PRE_CACHE_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  '/src/App.tsx',
  '/metadata.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('🌸 Service Worker: Pre-caching Core shell...');
      return cache.addAll(PRE_CACHE_ASSETS).catch(err => {
        console.warn('⚠️ Service Worker pre-cache warning (some files may compile dynamically in dev mode):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name !== ACTION_CACHE_NAME) {
            console.log('Cleaning up obsolete cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch interception strategy
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. Audio and stream handling - Cache first
  if (
    event.request.destination === 'audio' || 
    requestUrl.pathname.endsWith('.mp3') || 
    requestUrl.pathname.endsWith('.m4a') ||
    event.request.headers.get('Accept')?.includes('audio') ||
    requestUrl.href.includes('soundhelix.com')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('⚡ SW: Serving audio from cache:', requestUrl.pathname);
          return cachedResponse;
        }

        // If not cached, fetch from network and dynamically cache if downloaded
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200 || networkResponse.status === 206) {
            const responseToCache = networkResponse.clone();
            caches.open(ACTION_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Absolute offline fallback for audio (return a friendly dummy file or fail gracefully)
          console.error('❌ SW: Audio cache miss and network offline:', requestUrl.href);
          return new Response('Offline audio resource unavailable', { status: 503, statusText: 'Offline Audio Unavailable' });
        });
      })
    );
    return;
  }

  // 2. Curated API lists handling - Network First, fallback to cache
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If a successful GET request, cache it dynamically for offline list fallback
          if (event.request.method === 'GET' && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails (offline), try fetching the cached list
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('⚡ SW: Serving API fallback from cache:', requestUrl.pathname);
              return cachedResponse;
            }
            // Return failure body
            return new Response(JSON.stringify({ error: 'Offline fallback active', requests: [], songs: [] }), {
              headers: { 'Content-Type': 'application/json' },
              status: 200 // Mock successful list response so app doesn't crash
            });
          });
        })
    );
    return;
  }

  // 3. General static app shell resource rendering - Stale While Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Log quietly or handle failures
        return cachedResponse || Promise.reject(err);
      });

      return cachedResponse || fetchPromise;
    }).catch(() => {
      // Offline fallback for html requests
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
