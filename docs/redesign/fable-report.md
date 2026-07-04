# Lamplight redesign — build report

Author: Fable 5, 2026-07-02. Branch: `feat/uiux-redesign` (not merged).
Brief: `docs/redesign/fable-uiux-brief.md`. Directions + pick rationale:
`docs/redesign/fable-directions.md`.

## Direction chosen

**Lamplight.** The page is a desk at night with one lamp on: a warm umber
room (`#211b15`) where a soft amber glow falls on exactly one object per
surface — the lead action on today, the capture field on capture. Light is
the hierarchy, so "one next action" is enforced by the page's physics rather
than by copy. Type: Bricolage Grotesque (display) + Atkinson Hyperlegible
(body) + IBM Plex Mono (metadata). Two other directions (transit wayfinding,
manuscript marginalia) were developed and rejected in the directions doc.

## What changed

- `src/pkms/web/styles.css` — full rewrite: new tokens, mobile-first layout
  (Pixel-6 column is the base; wide viewports are the enhancement), the lamp
  glow signature, moss resurface / fern completion colors, safe-area padding.
- `src/pkms/web/index.html` — same DOM structure, IDs, data-attributes, and
  copy anchors; new head metadata (theme-color `#211b15`), new font loads,
  `--sage` kicker class renamed `--moss`.
- `src/pkms/web/app.js` — one line: the inline "long read" style re-pointed
  from `--ink-faint` to `--bone-faint`. All contracts untouched.
- `src/pkms/web/sw.js` — cache bumped `pkms-shell-v1` → `v2`; SHELL list and
  strategy unchanged.
- `src/pkms/web/manifest.webmanifest`, `icon.svg` — recolored to the palette
  (icon keeps its existing geometry; no new art).
- `src/pkms/web_ext/**` — regenerated per the packaging rule: app.js /
  styles.css / icon.svg byte-identical; newtab.html = index.html minus the
  manifest link and SW registration.
- Bug fixed in passing: `.surface--capture { display:flex }` overrode the
  router's `hidden` attribute, so the capture section rendered below today
  (pre-existing). A `[hidden] { display:none !important }` rule now wins.
- Tests added (4): SW cache version must be past v1; theme-color consistent
  across meta/manifest/CSS; reduced-motion + focus-visible present; web_ext
  is an exact packaged copy (byte-level).

## Verification

Confirmed (ran it, named check):

- `python -m pytest -q`: **368 passed** baseline before; **372 passed** after
  (368 + 4 new). No test deleted or weakened; no existing assertion changed.
- Preview MCP at 412×915 (Pixel 6): today (calm), capture, reading, actions,
  search, density toggle, PAGE CLEARED all rendered and exercised.
- Capture round-trip: filled the field, dispatched Ctrl+Enter, success toast
  fired, and the capture file appeared in the (synthetic) demo vault inbox.
- Resurface "not now": card hidden only after the POST; `resurface_offers`
  row persisted with `rest_until` +30d in the demo index.
- PAGE CLEARED: marking all actions done shows the fern stamp + pebbles.
- Search ramp: submit routes to `#search` and copies the query.
- web/web_ext parity verified byte-level (also pinned by the new test).
- SW stale-while-revalidate observed live: first reload served the cached
  shell, second reload picked up the edit.
- Contrast: all text tokens computed ≥ 6.3:1 on the ground (AA, mostly AAA);
  lamp-filled/bordered elements 8.6:1.
- No console errors or warnings on any exercised surface.

Inferred (not directly exercised):

- `prefers-reduced-motion` behavior: the media query neutralizes all
  animations (rule present, test-pinned), but the preview harness can't
  emulate the OS setting.
- `:focus-visible` lamp ring: rule present and test-pinned; keyboard-only
  focus wasn't driven in the preview.
- Real Firefox extension load and Android PWA install were not exercised
  (no device/browser harness in this environment).

All checks ran against a synthetic demo vault in the scratchpad; the real
`vault/`, `.index/`, and `.secrets/` were never read or touched.

## Open questions

- The lede shows breadcrumb lines verbatim; daily notes whose breadcrumb
  section uses `- ` bullets render a doubled marker ("— - text"). Existing
  behavior, visible in the new design too — worth a small strip in a
  follow-up if it bothers.
- Fonts still load from Google Fonts (the pre-existing pattern). Self-hosting
  would make the offline shell fully self-contained — separate decision.
- Search candidates (`RECENT_NOTES`) remain an empty client-side list, as
  before the redesign — the recognition-first picker is still waiting on a
  backend surface.
