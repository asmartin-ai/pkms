# Pixel 6 PWA — install + slice-7 verification (⏱ ~10 min)

The phone PWA front door for `pkms serve`: install the today-view as a
standalone home-screen app on the Pixel 6, reached over the tailnet via
`tailscale serve`. Same page as the desktop new-tab poster (Lamplight),
mobile-first. Token rides in the URL (`?token=…`) — a future cleaner path
(a settings page that stores the token in `localStorage`) is icebox; the URL
form is fine for now because the PWA caches the URL at install time.

This doc closes slice 7 (build-plan.md): the live device proof the desktop
preview can't give. Slice 7's done-when is **on the Pixel, over tailnet,
Kenja opens the PWA → sees today-view, reads a promoted thread, captures a
thought from inside it — all three demonstrated**.

▶ **First action:** step 1 (one `tailscale serve` command on the desktop,
30 seconds).
✓ **Done when:** all three device actions in §4 are demonstrated by Kenja,
and any fallout is small enough to land as CSS/JS/doc-level fixes (anything
bigger becomes a new packet).

---

## 1. Desktop side — expose the service over HTTPS via tailscale serve

The capture service runs resident (startup shortcut "PKMS capture service")
on `127.0.0.1:8765`. `tailscale serve` maps it onto the tailnet with a real
TLS cert so Chrome on Android will allow Add-to-Home-Screen (HTTP only
allows "Add shortcut", not a true standalone PWA).

```powershell
tailscale up
tailscale serve --bg 8765
```

That maps `https://<tailnet-host>/` → `http://127.0.0.1:8765/` and serves
it over HTTPS with a Let's Encrypt cert from the Tailscale CA. Verify:

```powershell
tailscale serve status
Get-Content .secrets\capture-token   # you'll paste this into the phone URL
```

The tailnet DNS name (MagicDNS) is the cleanest URL — `tailscale status`'s
top line shows it (e.g. `keenan-z170.bee-tail.ts.net`). The raw tailnet IP
(`100.x.x.x`) also works if MagicDNS is off.

> **Why `tailscale serve` and not the raw `http://100.x.x.x:8765`?**
> Chrome on Android only allows true PWA install (standalone display, no
> browser chrome, offline shell) over HTTPS. The raw HTTP port works for
> the HTTP-Shortcuts capture tile (see `docs/pixel-capture-setup.md`) but
> not for the installable PWA. `tailscale serve` is the HTTPS ramp.

## 2. Phone side — install the PWA from Chrome on Android

On the Pixel 6:

1. Open **Chrome** (not Firefox — Chrome's Add-to-Home-Screen is the
   well-trodden path; Firefox-on-Android PWA install was deprecated in
   2023 and is unreliable on current builds).
2. Navigate to the today-view URL with the token in the query:
   ```
   https://<tailnet-host>/?token=<paste-from-.secrets/capture-token>
   ```
   E.g. `https://keenan-z170.bee-tail.ts.net/?token=abc123…`.
3. Wait for the page to render the today-view (the lede + lead action +
   context rail). The token is now cached in the URL.
4. **Install:** Chrome menu (⋮) → **Add to Home screen** → confirm the
   name (default `today · pkms` is fine). The installed icon opens in
   standalone display — no address bar, no browser chrome, the
   Lamplight dark umber room fills the screen.

## 3. Token handling — what's stored where

| Where | What | Visibility |
|---|---|---|
| PWA install manifest | The full URL **with `?token=`** | Cached at install; the standalone PWA reopens at that URL on every launch |
| `sw.js` cache | Static shell only (`app.js`, `styles.css`, `index.html`, `icon.svg`) | No token, no vault data — `/api/today` is network-only (the SW never caches it) |
| Service worker | Never sees the token (it doesn't intercept `/api/*`) | — |
| Browser history | The token-URL is in Chrome's history | Acceptable for a single-user tailnet-only PWA; clearable |

> **Future cleaner path (icebox, not now):** a `/settings` page in the PWA
> that stores the token in `localStorage` and lets the install URL be
> token-free. Worth doing if the token ever leaves the tailnet or if the
> URL gets shared. For now the URL-form is fine — the tailnet is private,
> the token is single-user, and the standalone PWA caches the URL anyway.

## 4. Verify — the three slice-7 device actions

Walk these on the Pixel after install. Each is one tap; if any fails, note
where (§5 captures the failure modes to watch for).

### (a) See the today-view

Open the installed PWA icon. Expect:
- The Lamplight dark umber room (no white flash — the SW v4+ shell is
  cached, so the background paints before the network lands).
- The lede (re-entry breadcrumb-as-prose) and the lead action card
  (one next action, the single lit object).
- The masthead date in quiet mono.

If you see the "token required" banner, the install URL lost its token
(re-install with `?token=`). If you see "couldn't reach the service",
`tailscale serve` isn't running or the tailnet is down.

### (b) Read a promoted thread

Tap the **next-read** card in the context rail (the "queued" reading item).
It opens the promoted thread inline. The slice-7 done-when is "reads a
promoted thread" — this is the action. If no reading card shows, no notes
are in the `reading: queued` state; promote one first (`pkms promote …`).

### (c) Capture a thought from inside the PWA

Tap the **capture** nav (the pencil/✎ icon in the command desk) → type a
thought → ⌘/Ctrl-Enter (or the submit button). Expect "saved ✓
<filename>" toast. On the desktop, `pkms today` shows "1 new to fold in".

This is the slice-7 capture action. The HTTP-Shortcuts tile
(`docs/pixel-capture-setup.md`) is a separate, faster ramp (one swipe from
anywhere); the PWA capture is the in-flow ramp for when you're already in
the today-view reading something.

## 5. Failure modes to watch for (and what to file)

These are the phone-PWA-specific gotchas Fable flagged in the P1 packet.
Any that bite become small fixes (CSS/JS/doc-level); anything bigger
becomes a new packet.

| Symptom | Likely cause | Fix shape |
|---|---|---|
| White flash before the room renders | SW cache miss (cache version not bumped, or first install before SW registers) | bump `sw.js` `CACHE`; verify SW v4+ is what's installed |
| Capture field hidden by the on-screen keyboard | No safe-area / viewport meta on the capture surface | `env(keyboard-inset-height)` or a scroll-into-view on focus |
| Tap targets at the very bottom edge don't respond | Android gesture-nav deadzone (the 4px swipe-handle strip) | add `env(safe-area-inset-bottom)` padding to the bottom nav |
| Status bar text is unreadable over the dark header | `theme-color` not honored or stale | verify `<meta name="theme-color" content="#211b15">` in `index.html` |
| "couldn't reach the service" intermittently | tailnet flake or `tailscale serve` not in `--bg` mode | `tailscale serve status`; re-run with `--bg` |
| PWA reopens to a blank page (lost token) | The install URL was the no-token root | re-install with `?token=<token>` in the URL |
| Reading card tap does nothing | No `reading: queued` notes exist | `pkms promote <url>` first; the card only renders when the queue is non-empty |

## 6. After verification

When all three device actions in §4 are demonstrated:

- Record the result in `vault/projects/pkms-design/build-plan.md`'s
  slice-7 row: flip to ✓ with a dated note ("demonstrated on Pixel 6 over
  tailnet, <date>").
- File any small fallout as a follow-up packet (CSS/JS/doc-level); the
  P1 packet's done-when is "fixes landed + build-plan row flipped."
- The cleaner token path (§3 icebox) gets filed in `build-plan.md`'s
  icebox with its reactivation condition ("when the token leaves the
  tailnet or the URL gets shared").
