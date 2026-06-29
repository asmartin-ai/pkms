# Firefox new-tab setup (PKMS desktop front door)

The PKMS today-view lives as your Firefox new-tab page — an ambient briefing
seen on every tab-open. This doc sets it up.

> **Delivery shape:** packaged new-tab shell. The extension owns the top-level
> new-tab document so Firefox keeps the address bar clean, while live data still
> comes from your running `pkms serve` instance via token-gated JSON APIs.

## Prerequisites

- `pkms serve` running (the "PKMS capture service" startup shortcut handles this).
- Your capture token in `.secrets/capture-token` (default port `8765`).

Quick liveness check — should return `ok` with no token:

```
curl http://localhost:8765/health
```

## 1. Load the new-tab extension

See [`src/pkms/web_ext/README.md`](../src/pkms/web_ext/README.md) — load
`manifest.json` as a temporary add-on via `about:debugging`. (For a permanent
install, sign it through [AMO](https://addons.mozilla.org/developers/) or load
an unsigned dev build in Firefox Developer Edition / via Enterprise policy.)

## 2. Set the URL

The extension stores the PKMS base URL and token in extension local storage.
Set it once from the extension settings page:

1. Open `about:addons`.
2. Find **PKMS new-tab**.
3. Open **Preferences** / **Options**.
4. Paste the full URL:

   ```text
   http://localhost:8765/web/?token=YOUR_TOKEN
   ```

Replace `YOUR_TOKEN` with the contents of `.secrets/capture-token`.

Open a new tab (Ctrl+T). You should see the today-view poster with the
re-entry lede and live data from `/api/today`, `/api/reading-queue`, and
`/api/recognition-cards`. The URL bar stays on the extension new-tab page; the
token is sent as `X-Capture-Token`, not shown in the address.

## Mobile (Pixel 6, over tailnet)

The same page is the PWA. Browse to
`http://<tailnet-host>:8765/web/?token=…` on the phone, then **"Add to Home
Screen"** in Firefox — it installs as a standalone app with the offline shell
(cache-first static assets; `/api/*` data and action routes always use the
network).

## Troubleshooting

- **"token required"** — the stored token is missing. Re-open the extension
  settings page and save the full URL including `?token=…`.
- **Blank tab / service error** — `pkms serve` isn't running, or the URL is
  wrong. Check `http://localhost:8765/health`.
- **Stale UI after editing extension assets** — temporary add-ons need a reload
  from `about:debugging` after packaged `newtab.html`, `styles.css`, or `app.js`
  changes.
- **Reading/resurface actions do nothing** — check that the saved URL includes
  the token. `/api/reading-queue`, `/api/recognition-cards`, `/api/resurface`,
  `/api/today`, `/api/open-note`, and `/capture` are token-gated.
- **"temporary add-on" disappears on restart** — expected for load-unpacked.
  Re-load from `about:debugging`, or move to a signed/Developer Edition install.

## How the pieces fit

```
Firefox new tab
   │  chrome_url_overrides.newtab → packaged newtab.html
   ▼
moz-extension://…/newtab.html ──loads──► packaged app.js + styles.css
   │  reads storage.local.pkmsBaseUrl + pkmsToken
   │  fetches http://localhost:8765/api/* with X-Capture-Token
   ▼
PKMS today-view poster  ◄── live data from pkms serve
```
