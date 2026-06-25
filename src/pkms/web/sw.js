// Minimal service worker for the PKMS new-tab/PWA shell.
// Strategy: cache-first for static assets (instant tab-open, works offline),
// network-only for /api/today (always-fresh data; if offline, the page shows
// its error banner — sync is never load-bearing for correctness, §9).
const CACHE = "pkms-shell-v1";
const SHELL = [
  "/web/",
  "/web/index.html",
  "/web/styles.css",
  "/web/app.js",
  "/web/manifest.webmanifest",
  "/web/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never cache the live data endpoint or capture POSTs.
  if (url.pathname.startsWith("/api/") || e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      // cache newly-fetched static assets opportunistically
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match("/web/index.html")))
  );
});
