# HONESTY — bends, interpretations, and the forbidden-pattern absence checklist

Anywhere this design bent, was unsure, or had to interpret a hard bound is
flagged here. The forbidden-pattern checklist is run against the binding
`DESIGN-LANGUAGE.md`.

## Bends & interpretations

1. **The "new-tab page is ambient, not a destination" argument is an interpretation
   of G1, not a closed gate.** G1's Option A warned against "local web app as
   *primary* UI" on the grounds it becomes a destination app. I argue a Firefox
   new-tab page is the opposite of a destination (passive, per-tab-open, zero
   decision to visit) and so realizes G1's intent better than the PWA-home
   direction. **This is unconfirmed until Kenja reacts** — it's decision gate
   G-N1. The whole pivot hinges on it. If Kenja disagrees, the new-tab page
   becomes a *secondary* ambient surface and the terminal autostart stays primary.

2. **The Firefox new-tab technical path is research-confirmed, not build-verified.**
   `browser.newtab.url` removal (FF41+) and `chrome_url_overrides` support under
   MV2/MV3 are CONFIRMED against MDN + community sources (see README). But whether
   the *redirector* sub-shape (G-N2b) flashes or hits CSP issues against a
   localhost `pkms serve` URL is **unverified** — it needs a build-time spike.
   The mockup itself is agnostic and works under either shape.

3. **The lede's `max-width: 22ch` is an aesthetic constraint, not a data one.**
   I cap the re-entry lede to ~22 characters so it stays a single glanceable line
   at the widest viewport. Real breadcrumb titles may run longer; the line wraps
   gracefully but the "one-line glance anchor" intent could break on very long
   project names. Flagged as a polish concern, not a hard-bound violation.

4. **The mobile reflow uses a breakpoint, not a separate design.** One document
   reflows at `max-width: 48rem`. This keeps the "one codebase" invariant (§9) but
   means the mobile PWA inherits the poster's editorial density. If dogfooding
   shows the mobile view needs a different information architecture (e.g. capture
   even more dominant), a dedicated mobile composition may be warranted later.
   Not decided here.

5. **No service worker / offline shell in the mockup.** The manifest makes the page
   *installable*, but real offline support (cache-first, background sync for
   queued captures) is out of scope for the design spike. The capture contract
   (append-only, offline-queueable, §9) is unchanged; only the SW plumbing is
   deferred.

## Forbidden-pattern absence checklist (DESIGN-LANGUAGE.md)

Each forbidden pattern, confirmed absent (or explicitly flagged):

- [x] **No raw backlog counts** (§3). Inbox shows "3 new to fold in" + "1 / 3"
  forward-only progress, never "47 unread." `more_notes` renders as "4 more one
  click away," never a count in the shelf.
- [x] **No streaks, no overdue counters, no red badges, no "you haven't…" copy**
  (§3). Pebbles are wins-only and carry no goal by default. No red anywhere —
  `--celebrate` is green-gold, `--sage` is the resurface accent. Gap days soften
  to "it's been a few days, nothing's overdue."
- [x] **Search is the fallback, never the front door** (§5). The nav labels it
  "find" and the search surface opens with "find — the fallback, not the front
  door." Recognition candidates come first; free-text is secondary.
- [x] **One next action per note; backlog one click away, never a wall** (§6).
  Lead action is singular; the full list is density-gated and the overflow is an
  accordion ("4 more one click away").
- [x] **Resurfacing is one rationed curious question** (§5). At most one
  resurface cell in the shelf; not-now (silent) + let-it-go (forever-exit, 5s undo).
- [x] **Empty state is the reward** (§3). PAGE CLEARED stamp fires when all visible
  actions are done; pebbles--empty reads "nothing finished yet — that's fine."
- [x] **Decay is silent and reversible; machine never accuses** (§4). No decay
  mechanics rendered in this mockup (out of scope); when present they'll be quiet
  dismissable lines.
- [x] **Zero settings sprawl** (§8). The ONE knob is calm/more/everything. There
  is no settings screen. No graph view, no board default.
- [x] **Re-entry first-class** (§7). The lede is the glance-anchor; worst-state
  (calm) is simpler, not busier.
- [x] **Transparent ranking** (§9). Resurface carries "why · short · cited in 4 of
  your recent notes"; reading cards carry "next in your reading queue."

## Explicitly NOT present (the "Never produce" list)

- [x] No Obsidian-style graph of the whole vault.
- [x] No wall/grid of every item.
- [x] No unread/overdue counters.
- [x] No streak flames.
- [x] No red notification badges.
- [x] No settings-heavy preferences screen.
- [x] No Momentum idioms (greeting / clock / focus word / photo background /
  pomodoro / quote) — explicitly rejected by the user.
