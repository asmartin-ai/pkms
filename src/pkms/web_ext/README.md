# PKMS new-tab redirector (Firefox)

Overrides the Firefox new-tab page with your running `pkms serve` instance.
This is the redirector-only delivery (G-N2): no page is bundled — the extension
just points the new tab at whichever `pkms serve` URL you've configured.

## Install (load unpacked — temporary, no signing needed)

1. Ensure `pkms serve` is running (the startup shortcut, or `pkms serve`).
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **"This Firefox" → Load Temporary Add-on…**
4. Select `src/pkms/web_ext/manifest.json`.

New tabs now open the PKMS today-view.

> Temporary add-ons are removed when Firefox closes. For a permanent install,
> sign the extension via [addons.mozilla.org](https://addons.mozilla.org/developers/)
> or load it through an [Enterprise policy](https://mozilla.github.io/policy-templates/).

## Set the URL (with token)

The redirector reads `pkmsUrl` from extension local storage. Set it once by
opening the Browser Console (Ctrl+Shift+J) on any page and running:

```js
browser.storage.local.set({ pkmsUrl: "http://localhost:8765/web/?token=YOUR_TOKEN" })
```

(For a tailnet/remote host, use that URL instead. The token is required by
`pkms serve` — find it in `.secrets/capture-token`.)

Without a stored URL, new tabs fall back to `http://localhost:8765/web/` and
will hit the token-required page until you set one.

## How it works

`chrome_url_overrides.newtab` (Firefox's supported override path — native
`browser.newtab.url` was removed in FF41) points at `newtab.html`, which loads
`newtab.js`. That script reads the stored URL and `location.replace`s to it, so
the new tab becomes the PKMS poster with full history/navigation behavior.

## Files

| file            | role                                                  |
| --------------- | ----------------------------------------------------- |
| `manifest.json` | MV3 WebExtension manifest; declares the new-tab override |
| `newtab.html`   | minimal shell; shows a hint while the redirect runs  |
| `newtab.js`     | reads `storage.local.pkmsUrl`, then `location.replace`|
