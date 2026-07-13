# Design

## System Overview

PKMS uses **Lamplight**: a Firefox new-tab/PWA poster designed as a desk at night
with one lamp on. The room stays dim and warm; a soft amber glow falls on exactly
one object per surface — the lead action on today, the capture field on capture.
Light is the hierarchy, so "one next action" is enforced by the page's physics
rather than by copy. The source UI lives in `src/pkms/web/` and is packaged into
the Firefox extension under `src/pkms/web_ext/` (byte-identical copy, pinned by a
parity test).

The design is intentionally not a generic productivity app. It is a calm briefing
that foregrounds re-entry prose and one next action, with restraint everywhere
else. It should feel like a trusted desk note: readable, finite, and forgiving.

- **Design lineage.** Lamplight is the lamp-mode reference of the shared ADHD
  design language (`K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md`,
  `VISUAL-LANGUAGE.md` "Hearth" canon, accepted 2026-07-03). It lands unchanged
  as PKMS's visual layer. Build report: `docs/redesign/fable-report.md`;
  direction pick rationale: `docs/redesign/fable-directions.md`.
- **Scope.** This document describes the shipped Lamplight system on
  `feat/uiux-redesign` (post-2026-07-02 redesign). When tokens or components
  change, update this file in the same commit.

## Design Principles

- **Glance first:** the first read answers "where was I?" and "what is the next
  thing?" without scanning a task wall.
- **Light is hierarchy:** one lamp per surface. The lead action and the capture
  field are the only things fully lit; everything else holds still in the dim
  room.
- **Warm but not decorative:** texture, type, and color support authored calm,
  not become visual noise.
- **One loud moment:** completion can celebrate (fern stamp, pebbles); everything
  else stays quiet.
- **Density is user-controlled:** calm is the default; more/everything are
  opt-in.
- **Shame-free affordances:** no red urgency, overdue treatment, streak pressure,
  or raw backlog badges.

## Color

Tokens are defined in `src/pkms/web/styles.css` `:root`. The palette is a warm
umber night (`--night` family) with a single amber lamp (`--lamp` family), moss
resurface accents (`--moss`), and fern completion accents (`--fern`).

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Night ground | `--night` | `#211b15` | Main background — the dim room |
| Night raised | `--night-raised` | `#2b241c` | Panels, cards, elevated surfaces |
| Night sunken | `--night-sunken` | `#1a1510` | Inset surfaces, wells |
| Hairline | `--hairline` | `#3e352a` | Borders and dividers |
| Hairline strong | `--hairline-strong` | `#55483a` | Emphasized borders |
| Bone (primary text) | `--bone` | `#ede4d3` | Main text — the lit paper |
| Bone dim | `--bone-dim` | `#b3a48c` | Secondary text |
| Bone faint | `--bone-faint` | `#988b73` | Low-emphasis labels, inline long-read style |
| Lamp | `--lamp` | `#eab04c` | The one bright accent — lead action, lamp fill |
| Lamp bright | `--lamp-bright` | `#f6c979` | Hover/stronger lamp |
| Lamp ink | `--lamp-ink` | `#241a0d` | Text on lamp fills (8.6:1 contrast) |
| Lamp glow | `--lamp-glow` | `rgba(234,176,76,0.16)` | Soft lamp background wash |
| Lamp wash | `--lamp-wash` | `rgba(234,176,76,0.1)` | Lighter lamp background |
| Moss (resurface) | `--moss` | `#a3bd97` | Curious-question / resurface accent |
| Moss wash | `--moss-wash` | `rgba(163,189,151,0.12)` | Resurface backgrounds |
| Fern (completion) | `--fern` | `#8fce96` | Completion pebbles, page-cleared state |
| Fern wash | `--fern-wash` | `rgba(143,206,150,0.12)` | Completion backgrounds |

**Lamp discipline.** Only one element per surface should carry lamp fill or lamp
glow at a time. If two things are lit, the page is saying two things are next —
fix the spec, not the CSS.

Never introduce red for normal task or backlog states. Error messages should use
the lamp/bone warning pattern unless a true destructive/error state requires a
separate semantic treatment.

## Typography

Three families, each with offline-friendly fallback stacks. Loaded via Google
Fonts (pre-existing pattern); self-hosting is a separate deferred decision.

- **Display:** `Bricolage Grotesque` → Segoe UI / Helvetica Neue / Arial.
- **Body:** `Atkinson Hyperlegible` → -apple-system / Segoe UI / Roboto / Arial.
- **Mono/metadata:** `IBM Plex Mono` → Cascadia Code / SF Mono / Consolas.

Fluid type scale (clamp-based, mobile-first — Pixel 6 column is the base, wide
viewports are the enhancement):

| Token | Range |
| --- | --- |
| `--step--1` | `clamp(0.8rem, 0.78rem + 0.1vw, 0.86rem)` |
| `--step-0` | `clamp(0.98rem, 0.95rem + 0.15vw, 1.06rem)` |
| `--step-1` | `clamp(1.15rem, 1.1rem + 0.25vw, 1.32rem)` |
| `--step-2` | `clamp(1.4rem, 1.3rem + 0.5vw, 1.75rem)` |
| `--step-3` | `clamp(1.75rem, 1.55rem + 1vw, 2.45rem)` |
| `--step-4` | `clamp(2.2rem, 1.9rem + 1.6vw, 3.3rem)` |

Usage:

- The re-entry lede and card titles use the display face to preserve the
  authored/editorial feel.
- Controls, nav, labels, task rows, and dense metadata use the body or mono.
- Body prose should stay within `--measure: 38rem`.

## Layout

Primary shell:

- `.poster` centers content at `--desk-max: 44rem` with a responsive
  `--gutter: clamp(1.1rem, 0.6rem + 2.5vw, 2.5rem)`.
- Top bar has quiet masthead metadata and a single salience control (density).
- Hash-route nav exposes `today`, `capture`, `reading`, `actions`, and `find`.
- Today surface prioritizes lede, lead action, shelf, optional recognition rail,
  optional actions, and completion stamp.

Responsive behavior (mobile-first):

- Narrow/Pixel-6 base: single column, card stack, capture as a full-screen-
  feeling surface. Safe-area padding honored (`env(safe-area-inset-*)`).
- Wide viewport: editorial poster; the desk widens, lamp glow stretches.
- Avoid adding persistent sidebars or dashboard chrome unless a future surface
  truly needs it.

## Motion

Motion is restrained and stateful. Tokens:

- `--dur-fast: 140ms` (toggles, small state changes).
- `--dur: 280ms` (navigation, surface swaps).
- `--dur-warm: 700ms` (the lamp warming up on load — the one signature motion).
- `--dur-stamp: 520ms` (completion stamp / pebbles).
- `--ease: cubic-bezier(0.2, 0.7, 0.2, 1)`.

Completion can have a stronger stamp/pebble animation; ordinary navigation should
not choreograph page-load sequences. The lamp-warm on load is the one ambient
motion that's allowed to read as "atmosphere."

Always honor `prefers-reduced-motion` (test-pinned: the media query neutralizes
all animations when set).

## Components

### Lede

The lede is the glance anchor. It restores context without a generic greeting.
It should read like a humane breadcrumb, not a motivational banner.

### Lead action

The lead action is the primary affordance for "the next thing." It is the **lamp
element on the today surface** — the one object the lamp falls on. Its copy
should start with a concrete first action when available. Visually it must remain
stronger than lists and rails; nothing else on the surface competes with it.

### Shelf

The shelf holds quiet secondary state: fold-in progress, win pebbles, and at most
one resurface prompt. Shelf cells should remain low-pressure and
non-dashboard-like. Moss is the resurface accent here, never lamp.

### Recognition cards

Cards may show reading and resurface candidates, but should not become a generic
card grid. Each card needs a specific reason or cost signal.

### Capture

Capture must be fast, focused, and feed-free. The textarea is **the lamp element
on the capture surface** — the one thing the lamp falls on. Everything else is
secondary. Confirmation copy should reinforce that the system owns later.

### Reading queue

Reading items show title, consume-cost, why, and queue date. Clicking opens the
markdown note locally. Do not show unread counts or pile language.

### Actions

Actions are one per note by default. Full backlog views are allowed, but one
click away and framed as recoverable context, not obligation.

### Toasts

Toasts are ambient disclosure, not alert modals. Use them for save confirmation,
undo, and local open feedback.

## Interaction Rules

- Capture save supports Ctrl/Cmd+Enter.
- Density controls are the one sanctioned personalization surface.
- Resurface actions must remain cheap and guilt-free: not now, let go, undo
  where relevant.
- Opening a note is a local action routed through the token-gated service.
- Extension new tab sends the token as `X-Capture-Token`; served PWA mode can
  use `?token=…`.

## Anti-patterns To Avoid

- Raw backlog or unread counters.
- Red urgency for self-imposed tasks.
- Motivational productivity copy.
- Generic dashboard widgets or hero metrics.
- Decorative glass, gradients, or identical card grids.
- Settings screens that expose unnecessary knobs.
- Modals as the first solution.
- **Two lamp elements on one surface.** If the page is lighting two things, the
  spec has lost the "one next action" thread — fix the content, not the styles.

## Source Files

- Main PWA/new-tab source: `src/pkms/web/index.html`, `src/pkms/web/styles.css`,
  `src/pkms/web/app.js`, `src/pkms/web/sw.js`, `src/pkms/web/manifest.webmanifest`,
  `src/pkms/web/icon.svg`.
- Packaged Firefox extension copy: `src/pkms/web_ext/newtab.html`,
  `src/pkms/web_ext/styles.css`, `src/pkms/web_ext/app.js`, `src/pkms/web_ext/icon.svg`.
  Byte-identical to `src/pkms/web/` per the packaging rule (parity test-pinned).
- Backend data/actions: `src/pkms/capture_service.py`, `src/pkms/today.py`.

## Hearth Convergence (pending)

The Hearth visual language (`K:\Projects\adhd-design-language\VISUAL-LANGUAGE.md`,
ratified 2026-07-03, gate G-B) calls for two type swaps to converge PKMS with the
shared system:

| Token | Current (Lamplight) | Hearth target | 
|---|---|---|
| Body face | Atkinson Hyperlegible | Lexend |
| Mono face | IBM Plex Mono | JetBrains Mono |

Plus token renames to the Hearth schema. These ride the next scheduled front-end
packet (token-level, no dedicated repaint). The display face (Bricolage Grotesque)
and all color tokens stay. Until that packet lands, this document describes the
current Lamplight reality on `feat/uiux-redesign`.

**Gate status (2026-07-12):** K1 (device verdict) still blocks the Lamplight merge.
DESIGN.md rewrite (P0 scope) happens after merge approval.

## Detector Scope

The Impeccable detector ignores are intentionally minimal and project-local. Each
entry in `.impeccable/config.json` covers a path that would otherwise produce
noise or duplicate design findings:

- `.agents/**` — agent-specific records not part of the codebase.
- `.venv/**` — regenerable virtual environment.
- `spike/**` — experimental files not under design review.
- `src/pkms/web_ext/` — packaged copy of the source surface in `src/pkms/web/`.
  Detecting both would produce duplicate findings. As long as the extension
  remains a copy, this ignore entry stays. When the extension gets independent
  UI beyond packaging/settings, revisit this decision.
