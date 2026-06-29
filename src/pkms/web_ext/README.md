# PKMS new-tab extension (Firefox)

Overrides the Firefox new-tab page with a packaged PKMS today-view. The page is
served from the extension (`moz-extension://…/newtab.html`) so Firefox keeps the
new-tab address bar clean; it fetches live data from your running `pkms serve`
instance using the `X-Capture-Token` header.

## Install (load unpacked — temporary, no signing needed)

1. Ensure `pkms serve` is running (the startup shortcut, or `pkms serve`).
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **"This Firefox" → Load Temporary Add-on…**
4. Select `src/pkms/web_ext/manifest.json`.

New tabs now open the packaged PKMS today-view.

> Temporary add-ons are removed when Firefox closes. For a permanent install,
> sign the extension via [addons.mozilla.org](https://addons.mozilla.org/developers/)
> or load it through an [Enterprise policy](https://mozilla.github.io/policy-templates/).

## Set the URL (with token)

The extension stores the PKMS API base URL and token in extension local storage.
The settings page accepts the familiar full URL and splits it for you.

1. Open `about:addons`.
2. Find **PKMS new-tab**.
3. Open **Preferences** / **Options**.
4. Paste the full URL:

   ```text
   http://localhost:8765/web/?token=YOUR_TOKEN
   ```

The bundled manifest grants host permission for `localhost` / `127.0.0.1` on
port `8765`. If you want the desktop extension to fetch from a different host,
add that host to `host_permissions` in `manifest.json` before loading the add-on.
The token is required by `pkms serve` — find it in `.secrets/capture-token`.

The token is sent as `X-Capture-Token`, not placed in the new-tab address bar.

## How it works

`chrome_url_overrides.newtab` (Firefox's supported override path — native
`browser.newtab.url` was removed in FF41) points at packaged `newtab.html`.
That page loads packaged `styles.css` + `app.js`; `app.js` reads
`storage.local.pkmsBaseUrl` and `storage.local.pkmsToken`, then fetches live
JSON from `pkms serve`.

## Files

| file            | role                                                  |
| --------------- | ----------------------------------------------------- |
| `manifest.json` | MV3 WebExtension manifest; declares the new-tab override, localhost permissions, and options page |
| `newtab.html`   | packaged PKMS today-view shell |
| `styles.css`    | packaged view styles copied from `src/pkms/web/` |
| `app.js`        | packaged view logic; fetches localhost with `X-Capture-Token` |
| `options/`      | settings page for saving the PKMS URL with token |
