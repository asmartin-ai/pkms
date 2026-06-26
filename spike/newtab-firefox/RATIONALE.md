# RATIONALE — the new-tab pivot

The thesis in one line: **the desktop view of PKMS lives as the Firefox new-tab
page — a full-bleed ambient briefing-poster — and the same document is the mobile
PWA, reflowed.** Not a Momentum descendant; not a dashboard. An editorial poster
that does the re-entry job every time a tab opens.

This spike carries forward the daily-edition's aesthetic spine (warm paper, single
ochre accent, Fraunces serif, one loud moment reserved for completion). What
changed is the **delivery vehicle** — *where and when* the user meets the today-view.

## The big moves

### 1. The re-entry lede IS the glance-anchor (not a greeting/clock/focus-word)

Momentum's new-tab idiom is a hero salutation: big weekday, a greeting, a clock, a
focus word, a photo. We explicitly rejected all of that. The page's top-of-fold
anchor is instead the **breadcrumb-as-prose lede** from the daily-edition:

> *Yesterday you were in **Alpha**, drafting the intro.*

This is the on-language re-entry moment (§7: "Monday with zero memory of Friday"
is the killer cost). It does the welcome-back job *without* a salutation — it tells
you where you were, not how the day should feel. On a new-tab page, which loads
dozens of times a day, a greeting would be auto-dismissed noise within a week
(§5's habituation warning, applied to the page itself). The lede carries real,
per-load-changing information instead.

**Serves:** §7 (re-entry first-class), §5 (subtle / no-habituation), §3 (shame-free
— gap days soften to "it's been a few days, nothing's overdue," never billed).

**Rejected alternative:** a Momentum-style nameplate (weekday + greeting + clock).
Rejected because (a) the greeting is content-free at new-tab frequency, (b) a clock
duplicates the OS clock and the browser chrome, (c) it would make this a Momentum
descendant, which the user explicitly declined.

### 2. The lead action is sized to compete with the address bar

On a new-tab page the browser's address bar is the dominant affordance — it's where
the user's hand already goes. For PKMS to earn the tab, the **single lead action**
(the dark ochre-on-ink button, "▶ open the outline file · ⏱ 30m") has to be the
second-most-obvious thing to click. It's full-width within the prose measure, the
warmest affordance on the page, and sits immediately under the lede.

This is the one place the page tries to *redirect* the tab rather than surrender it
to whatever the user was going to search. If nothing sparks, the user types a URL
and the tab is gone — which is fine. The poster is ambient; it doesn't demand a
session (§7: engagement is episodic).

**Serves:** §6 (one next action), §7 (suggested first action prominent).

### 3. The ambient shelf — fold-in / pebbles / resurface, lower visual weight

Below the lead action, a three-cell shelf carries the forward-only mechanics: "to
fold in" (inbox as progress, 1/3, never a count-as-debt), today's pebbles (wins
only, reset without debt), and the single resurface question (sage, never red,
with not-now / let-it-go). These are quieter than the lede+action — glancable but
not demanding. On wide viewports they sit in a row; on mobile they stack into a
card list.

**Serves:** §3 (no counts-as-debt; pebbles not streaks), §5 (one ambient surface,
rationed; forever-exit as cheap as accept), §4 (silent toward debt).

### 4. Density knob stays — calm is the default, and the worst-state spec

The one sanctioned personalization surface (§8) carries over unchanged:
**calm / more / everything**. Calm (default) shows lede + lead action + shelf only.
In a deep low the page gets *simpler*, not busier (§7 worst-state spec). This
matters more on a new-tab page than on a destination app, because the user sees it
at every cognitive state, dozens of times a day.

**Serves:** §8 (zero settings sprawl; the one bounded knob), §7 (worst-state gets
dumber).

### 5. Capture stays a separate ramp — never loads the app (§1)

Capture is its own hash route (`#capture`), autofocus, ⌘/Ctrl+Enter saves, instant
"✓ saved." It never opens a feed. On desktop this is also the Win+N global hotkey's
target; on mobile it's reachable from the PWA nav. The new-tab vehicle does not
change the capture contract.

**Serves:** §1 (<2s, zero decisions, never opens a feed, instant confirmation).

### 6. One document, two surfaces — desktop poster + mobile PWA

The same `index.html` is the Firefox new-tab page (wide: full-bleed poster) AND the
installable mobile PWA (narrow: card-stack reflow). There is no separate mobile
codebase. A `@media (max-width: 48rem)` block collapses the shelf to one column,
steps the lede down a size, and stacks the top bar. The PWA manifest +
`viewport-fit=cover` + `theme-color` make it installable on the Pixel over tailnet,
matching slice 7's intent.

**Serves:** G1 (ambient hybrid — desktop touchpoint + phone PWA), G10 (PWA in
slice 1), §9 (one codebase over plain files; novelty at the view layer).

## The G1 reconciliation (the load-bearing argument)

G1 (CLOSED 2026-06-12) chose **Option A "ambient hybrid"** and explicitly warned
against **Option B "local web app as primary UI"** because it "becomes a
destination app (BK2 failure)." A naive read of "make PKMS the Firefox new-tab
page" sounds like B. It is not — and the distinction is the whole point of this
spike.

**A destination app** is something you must *remember to visit*. BK1/BK2: help must
live at the point of performance, not in a place you have to go to. The PWA-home
direction (slice 7) flirts with this — you have to open the PWA, which is a
decision.

**A new-tab page is the opposite.** It loads *passively*, every time you open a
tab, without any decision to visit. It is ambient by construction — it meets the
definition of "at the point of performance" better than any destination can. The
Firefox new-tab page is arguably the *most* point-of-performance surface on the
desktop: it's the blank moment between tasks, exactly when a breadcrumb or a
next-action would land.

So this pivot does not reopen G1. It realizes G1's *intent* (ambient, at-the-point-
of-performance, not a destination) more faithfully than the PWA-as-home direction
did. The terminal autostart (`pkms today` at session start) and the global capture
hotkey remain; the new-tab poster is an *additional* ambient surface that costs
zero decisions to encounter. This is squarely within Option A's "ambient hybrid."

**This is the decision gate that needs Kenja's reaction** — see Decision Gates, G-N1.

## Firefox new-tab delivery (the technical gate)

Research-confirmed (sources in README.md):

- **Native `browser.newtab.url` was removed in Firefox 41** (2015). You cannot set
  a custom new-tab URL via `about:config` anymore. (CONFIRMED — Superuser, r/firefox.)
- **The supported path is a WebExtension** using
  `chrome_url_overrides: { "newtab": "..." }`. Works identically in MV2 and MV3.
  (CONFIRMED — MDN, Firefox Extension Workshop MV3 migration guide.)
- **Two sub-shapes**, both viable — this is **G-N2**:
  - **(a) Bundled:** the poster HTML/CSS/JS ships *inside* the extension;
    `newtab.html` is the override. Self-contained, offline, no server dependency.
    Trade-off: the page can't `fetch()` the live `/api/today` without extra
    permissions/host permissions, and data freshness needs a mechanism (extension
    storage sync, or a fetch to localhost with a host permission).
  - **(b) Redirector:** a tiny extension whose override just does
    `location.replace("http://localhost:8765/?token=…")` (or the tailnet URL).
    The page stays served by `pkms serve` exactly as today. Trade-off: needs the
    service running; slight redirect flash.

The mockup is deliberately **agnostic** between these — it's plain HTML/CSS/JS that
works under either. G-N2 picks the shape at build time.

## Decision gates (for Kenja)

These are the unmade decisions this pivot surfaces. None blocks the mockup; all
block a build plan.

### G-N1 — Does the new-tab-as-front-door reconcile with G1? *(blocks everything)*
The argument above says yes — a new-tab page is ambient, not a destination, so it
realizes G1's Option A *better* than the PWA-home direction. Kenja's call: accept
the reconciliation, or treat the new-tab page as a *secondary* ambient surface
(terminal autostart remains the primary desktop front door)?

### G-N2 — Bundled extension vs redirector-to-localhost? *(blocks the build slice)*
(a) bundle the page in the extension (offline, self-contained; data-freshness needs
work) vs (b) a redirector extension pointed at `pkms serve` (page stays server-served,
needs service up). Rec leans (b) for slice 1 — it reuses the served today-view
verbatim and adds ~20 lines of extension; (a) is the polish step once the page is
stable.

### G-N3 — Does the daily-edition mockup retire, or stay as a comparison?
The two share an aesthetic spine but differ in vehicle. Options: (i) new-tab
becomes the canonical desktop frontend, daily-edition archives; (ii) both stay,
daily-edition is the "open the app intentionally" surface, new-tab is ambient. Rec
(i) — two front doors is a decision the user shouldn't have to make (§8 spirit).

## What this is NOT

- **Not a Momentum descendant.** No greeting, clock, focus word, photo background,
  pomodoro, or quote. The user cited Momentum only as the new-tab extension they
  knew; the design is its own thing, continuous with the daily-edition.
- **Not a dashboard.** No grid of widgets, no counts-as-debt, no graph. The forbidden
  patterns from the design language (§3, §5, §8) are all absent — see HONESTY.md.
- **Not a replacement for capture ramps or the terminal briefing.** Those stay; the
  new-tab poster is an additional ambient surface.
- **Not wired to the live app.** Design-only; all data is inlined fake JSON using
  the exact `/api/today` field names.

## Provenance

- **Prior mockup (aesthetic spine):** `spike/_archive/visual-home-glm/` (the "daily edition")
- **Binding design rules:** `K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md`
- **Decisions reconciled:** `vault/projects/pkms-design/decisions.md` (G1, G10)
- **Build plan updated by this pivot:** `vault/projects/pkms-design/build-plan.md` (slice 7)
- **Firefox new-tab research:** sources listed in README.md
