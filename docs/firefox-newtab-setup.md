# Firefox new-tab setup (PKMS desktop front door)

The PKMS today-view lives as your Firefox new-tab page — an ambient briefing
seen on every tab-open. This doc sets it up.

> **Delivery shape (decision G-N2):** redirector-only. The extension points the
> new tab at your running `pkms serve` instance; no page is bundled. This keeps
> the source of truth in one place (`src/pkms/web/`) and lets edits ship without
> re-signing an add-on.

## Prerequisites

- `pkms serve` running (the "PKMS capture service" startup shortcut handles this).
- Your capture token in `.secrets/capture-token` (default port `8765`).

Quick liveness check — should return `ok` with no token:

```
curl http://localhost:8765/health
```

## 1. Load the redirector extension

See [`src/pkms/web_ext/README.md`](../src/pkms/web_ext/README.md) — load
`manifest.json` as a temporary add-on via `about:debugging`. (For a permanent
install, sign it through [AMO](https://addons.mozilla.org/developers/) or load
an unsigned dev build in Firefox Developer Edition / via Enterprise policy.)

## 2. Set the URL

The redirector reads `pkmsUrl` from extension local storage. Set it once in the
Browser Console (Ctrl+Shift+J):

```js
browser.storage.local.set({ pkmsUrl: "http://localhost:8765/web/?token=YOUR_TOKEN" })
```

Replace `YOUR_TOKEN` with the contents of `.secrets/capture-token`.

Open a new tab (Ctrl+T). You should see the today-view poster with the
re-entry lede and live data from `/api/today`, `/api/reading-queue`, and
`/api/recognition-cards`.

## Mobile (Pixel 6, over tailnet)

The same page is the PWA. Browse to
`http://<tailnet-host>:8765/web/?token=…` on the phone, then **"Add to Home
Screen"** in Firefox — it installs as a standalone app with the offline shell
(cache-first static assets; `/api/*` data and action routes always use the
network).

## Troubleshooting

- **"token required"** — the stored `pkmsUrl` is missing `?token=…`. Re-run the
  storage snippet with the full URL including the query string.
- **Blank tab / redirect loop** — `pkms serve` isn't running, or the URL is
  wrong. Check `http://localhost:8765/health`.
- **Stale data after a capture** — the page re-fetches `/api/today` on save; if
  it doesn't, hard-refresh once (the SW may be serving a cached *shell* — but
  data is always fetched live, never cached).
- **Reading/resurface actions do nothing** — check that the stored URL includes
  the token. The shell loads without it, but `/api/reading-queue`,
  `/api/recognition-cards`, `/api/resurface`, `/api/today`, and `/capture` are
  token-gated.
- **"temporary add-on" disappears on restart** — expected for load-unpacked.
  Re-load from `about:debugging`, or move to a signed/Developer Edition install.

## How the pieces fit

```
Firefox new tab
   │  chrome_url_overrides.newtab → newtab.html
   ▼
newtab.html ──loads──► newtab.js
   │  reads storage.local.pkmsUrl → location.replace(...)
   ▼
http://localhost:8765/web/?token=…   (capture_service serves src/pkms/web/)
   │  page fetches /api/today + read-only queues; POSTs capture/resurface actions
   ▼
PKMS today-view poster  ◄── sw.js caches the shell only (offline-ready)
```
