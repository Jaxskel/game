/* Global Conflict Monitor service worker.
 *
 * Carefully scoped:
 *  - Static assets (basemap data, icons): cache-first.
 *  - Briefings the user saved: served from the gcm-offline-briefings cache
 *    when the network is unavailable.
 *  - API and everything else: network-first; API responses are NEVER cached
 *    here (freshness and safety-gate changes must always win).
 */
const STATIC_CACHE = "gcm-static-v1";
const OFFLINE_CACHE = "gcm-offline-briefings";
const STATIC_ASSETS = ["/data/countries.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== OFFLINE_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never serve stale API data.
  if (url.pathname.startsWith("/api/")) return;

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request)),
    );
    return;
  }

  // Pages: network first, falling back to any explicitly saved copy.
  event.respondWith(
    fetch(event.request).catch(async () => {
      const saved = await caches.match(event.request);
      if (saved) return saved;
      return new Response(
        "<!doctype html><meta charset=utf-8><title>Offline</title><body style='font-family:system-ui;background:#0b0f14;color:#e6edf3;display:grid;place-items:center;height:100vh'><div><h1>Offline</h1><p>This page isn’t saved for offline reading. Saved briefings remain available.</p></div>",
        { headers: { "Content-Type": "text/html" }, status: 503 },
      );
    }),
  );
});
