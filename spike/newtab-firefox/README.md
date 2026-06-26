# spike/newtab-firefox — the "ambient poster" (new-tab edition)

A pivot of the PKMS desktop frontend: instead of a web app you open, the
today-view lives as the **Firefox new-tab page** — a full-bleed editorial
briefing-poster seen passively on every tab-open. The same document is the
mobile PWA, reflowed. Built on the daily-edition's aesthetic spine; the delivery
vehicle is what changed.

> Momentum was cited only as the only new-tab extension the user knew. This is
> **not** a Momentum descendant — no greeting, clock, focus word, or photo
> background. See RATIONALE.md §1.

## Run it

Open `index.html` in a browser. That's it.

- No build step. No node deps. No server. No fetches.
- All data is inlined fake JSON in `app.js` using the **exact** `/api/today`
  field names (verified against `src/pkms/today.py:172-184`).
- Fonts load from Google Fonts CDN; the CSS stacks fall back gracefully offline.
- Render-test screenshots are in `_shots/` (desktop + mobile, all densities).

```
spike/newtab-firefox/
├── index.html              ← poster shell; 5 surfaces; hash-route nav; density knob
├── styles.css              ← full design system (tokens, type, poster layout, mobile reflow)
├── app.js                  ← inlined fake JSON + render functions + interactions
├── manifest.webmanifest    ← PWA manifest (installable on the Pixel)
├── icon.svg                ← PWA icon (ochre check on warm paper)
├── RATIONALE.md            ← the big moves, G1 reconciliation, decision gates G-N1..N3
├── DATA-CONTRACT.md        ← /api/today (unchanged) + proposed read-only endpoints
├── HONESTY.md              ← bends/interpretations + forbidden-pattern absence checklist
├── README.md               ← this file
├── _shots.py               ← Playwright render-test script
└── _shots/                 ← captured PNGs (desktop poster + mobile PWA)
```

## The surfaces

| Hash route | Surface | What it is |
|---|---|---|
| `#today` (default) | **Today / the poster** | Lede (re-entry breadcrumb-as-prose — THE glance anchor) → lead action → ambient shelf (fold-in / pebbles / resurface) → [density-gated: recognition rail, actions] → invitation. |
| `#capture` | **Capture** | Separate ramp. Autofocus, ⌘/Ctrl+Enter saves, Esc clears. Never loads the app. "✓ saved" instantly. |
| `#reading` | **Reading queue** | Promoted long-reads with consume-cost pills. No queue-length count. |
| `#actions` | **Next actions** | Full one-per-note list with the ⏱ ▶ ✓ anatomy. |
| `#search` | **Search** | Explicitly the fallback. Recognition-first picker, free-text secondary. |

## The one knob

Top-right: **calm / more / everything** (the daily-edition's knob, unchanged).

- `calm` (default): lede + lead action + shelf. The worst-state spec.
- `more`: + recognition rail + actions list.
- `everything`: + full backlog + search affordance. Never the default.

## Things to try

- **Toggle density** — watch the poster get simpler or fuller; calm is the default.
- **Mark the lead action done** (the dark button) → a pebble appears, a toast
  confirms, and if you clear all visible actions the **PAGE CLEARED** stamp fires.
- **Dismiss the resurface question** — "not now" (silent) or "let it go"
  (forever-exit with 5s undo).
- **Capture** — `#capture`, type, ⌘/Ctrl+Enter.
- **Resize narrow** (≤768px) — the poster reflows to the mobile PWA card-stack.

## The G1 reconciliation (read this)

G1 (CLOSED) chose "ambient hybrid" and warned against "local web app as primary
UI" because it becomes a *destination* app. A Firefox new-tab page is the
opposite of a destination — it loads passively per tab-open, zero decision to
visit. So this pivot realizes G1's intent (point-of-performance, ambient) *more
faithfully* than the PWA-as-home direction, not less. **This argument is
unconfirmed until Kenja reacts** — it's decision gate G-N1 in RATIONALE.md, and
the whole pivot hinges on it.

## Firefox new-tab delivery (research-confirmed)

- Native `browser.newtab.url` was **removed in Firefox 41** — can't set a custom
  URL via `about:config`. ([Superuser](https://superuser.com/questions/985227/),
  [r/firefox](https://www.reddit.com/r/firefox/comments/1gh3fep/))
- The supported path is a **WebExtension** with
  `chrome_url_overrides: { "newtab": "…" }` — identical in MV2 and MV3.
  ([MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_url_overrides),
  [MV3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/))
- Two sub-shapes (decision gate G-N2): **(a)** bundle the page in the extension,
  or **(b)** a redirector pointed at `pkms serve`'s localhost URL. The mockup is
  agnostic between them.

## Inspiration surveyed (none inherited as a design language)

- **Momentum** — cited by the user; studied then explicitly declined (no
  greeting/clock/focus-word/photo). ([momentumdash.com](https://momentumdash.com/))
- **Bonjourr** — iOS-inspired minimalism; confirmed the "calm, glancable"
  direction is well-trodden, which is a reason to stay editorial-distinctive.
  ([bonjourr.fr](https://bonjourr.fr/))
- **Tabliss** — ~50ms load, open-source; informs the perf budget for a real build.
- **NightTab** — minimal + fast; same lesson.
- The lesson taken from all three: **calm + glancable + one-glance hierarchy**.
  The editorial-paper aesthetic stays PKMS's own.

## What this is NOT

- **Not wired to the live app.** Design-only; all mutations simulated.
- **Not a Momentum descendant.** See RATIONALE.md §1.
- **Not a replacement for capture ramps or the terminal briefing.** Those stay.
- **Not a settings screen, graph view, or board default.** All forbidden.

## Provenance

- **Prior mockup (aesthetic spine):** `spike/_archive/visual-home-glm/` (the "daily edition")
- **Brief:** `vault/projects/pkms-design/frontend-design-brief-glm.md`
- **Binding design rules:** `K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md`
- **Decisions reconciled:** `vault/projects/pkms-design/decisions.md` (G1, G10)
- **Data contract source:** `src/pkms/today.py`, `resurface.py`, `tasks.py`,
  `indexer.py`, `capture_service.py`
