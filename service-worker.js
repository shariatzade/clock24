const CACHE_NAME = "clock-cache-v1";
const VERSION = "2025.12.04";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "./",
        "./index.html",
        "./manifest.json",
        "./north_map.png",
        "./earth_shadow.png"
      ]);
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.url.endsWith('/index.html') || e.request.destination === 'document') {
    e.respondWith(
      updateIndexIfNewer(e.request)
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((response) => {
        return response || fetch(e.request);
      })
    );
  }
});

async function updateIndexIfNewer(request) {
  // Serve cached version first (stale-while-revalidate pattern)
  const cache = await caches.open(CACHE_NAME);
  let cachedResponse = await cache.match(request);
  
  // Always fetch network version for comparison
  let networkResponse;
  try {
    networkResponse = await fetch(request);
  } catch (err) {
    // Offline - serve cache only
    return cachedResponse || new Response('Offline', {status: 503});
  }
  
  // Clone for cache update
  const networkResponseClone = networkResponse.clone();
  
  if (cachedResponse) {
    // Compare ETag or Last-Modified headers first
    const cachedHeaders = cachedResponse.headers;
    const networkHeaders = networkResponse.headers;
    
    const cachedETag = cachedHeaders.get('etag');
    const networkETag = networkHeaders.get('etag');
    const cachedLastMod = cachedHeaders.get('last-modified');
    const networkLastMod = networkHeaders.get('last-modified');
    
    const isNewer = 
      (!cachedETag && !networkETag && cachedLastMod && networkLastMod && cachedLastMod !== networkLastMod) ||
      (cachedETag && networkETag && cachedETag !== networkETag);
    
    if (isNewer) {
      // Update cache and notify clients
      await cache.put(request, networkResponseClone);
      notifyClients();
    }
  } else {
    // No cache - store network response
    await cache.put(request, networkResponseClone);
  }
  
  return networkResponse;
}

function notifyClients() {
  self.clients.matchAll({includeUncontrolled: true}).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'UPDATE_AVAILABLE',
        version: VERSION,
        message: `Updated to version ${VERSION}`
      });
    });
  });
}
