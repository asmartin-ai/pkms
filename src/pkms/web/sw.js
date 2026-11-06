const CACHE = "pkms-shell-v12";

const AUTH_CACHE = "pkms-auth";

const SHELL = [
  "/web/",
  "/web/index.html",
  "/web/styles.css",
  "/web/htmx.min.js",
  "/web/ext/json-enc.js",
  "/web/shell.js",
  "/web/rag.js",
  "/web/auth-token.js",
  "/web/manifest.webmanifest",
  "/web/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE && k !== AUTH_CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

async function replayShareWithToken(request) {
  if (request.headers.get("x-capture-token")) return fetch(request);

  const auth = await caches.open(AUTH_CACHE);
  const stored = await auth.match("/__token");

  if (!stored) return fetch(request);

  const headers = new Headers(request.headers);

  headers.set("X-Capture-Token", await stored.text());

  const replayed = await fetch(new Request(request, { headers, redirect: "follow" }));

  if (replayed.redirected) return Response.redirect(replayed.url, 303);

  return replayed;
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  if (e.request.method === "POST" && url.pathname === "/web/share") {
    const origin = e.request.headers.get("origin");

    const sameOrigin =
      origin === null || origin === "null" || new URL(origin).origin === self.location.origin;

    e.respondWith(
      sameOrigin
        ? replayShareWithToken(e.request)
        : new Response("cross-origin share rejected", { status: 403 }),
    );

    return;
  }

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/partial/") ||
    e.request.method !== "GET"
  )
    return;

  e.respondWith(
    (async () => {
      const cached = await caches.match(e.request);

      const network = fetch(e.request)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches
              .open(CACHE)
              .then((c) => c.put(e.request, copy))
              .catch(() => {});
          }

          return r;
        })
        .catch(() => null);

      if (cached) {
        network.catch(() => {});

        return cached;
      }

      return (await network) || caches.match("/web/index.html");
    })(),
  );
});
