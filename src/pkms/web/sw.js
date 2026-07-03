// Minimal service worker for the PKMS new-tab/PWA shell.
// Strategy: stale-while-revalidate for static assets — serve cached on the
// request (instant tab-open, works offline) but fetch the network copy in the
// background and update the cache, so the NEXT tab-open always reflects the
// latest shell edit. (Pure cache-first served a stale shell forever when only
// app.js/styles.css changed and sw.js didn't — a footgun for an iterated tool.)
// /api/today is network-only (always-fresh data; if offline, the page shows
// its error banner — sync is never load-bearing for correctness, §9).
// v2: the "Lamplight" redesign (2026-07-02) — bump so installed PWAs pick up
// the new shell instead of serving the stale Log Book II look from cache.
const CACHE = "pkms-shell-v2";
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
  // Never intercept the live data endpoint or capture POSTs — always network.
  if (url.pathname.startsWith("/api/") || e.request.method !== "GET") return;

  // Stale-while-revalidate: serve the cached copy immediately (instant tab-open,
  // offline-capable) AND fetch the network copy in the background to refresh the
  // cache — so the next tab-open picks up shell edits without a manual version
  // bump. The cache is the fallback if the network fails (offline).
  e.respondWith(
    (async () => {
      const cached = await caches.match(e.request);
      const network = fetch(e.request).then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return r;
      }).catch(() => null);
      if (cached) {
        // Revalidate in the background; serve stale now.
        network.catch(() => {});
        return cached;
      }
      return (await network) || caches.match("/web/index.html");
    })()
  );
});
