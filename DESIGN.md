# Design

## System Overview

PKMS uses an editorial product interface: a Firefox new-tab/PWA poster that behaves like a calm briefing rather than a dashboard. The source UI lives in `src/pkms/web/` and is packaged into the Firefox extension under `src/pkms/web_ext/`.

The design is intentionally not a generic productivity app. It uses a warm paper ground, restrained accent colors, serif-led hierarchy for re-entry prose, and compact product controls for actions. The page should feel like a trusted desk note: readable, finite, and forgiving.

## Design Principles

- Glance first: the first read should answer "where was I?" and "what is the next thing?" without scanning a task wall.
- Warm but not decorative: texture, type, and color should support authored calm, not become visual noise.
- One loud moment: completion can celebrate; everything else stays quiet.
- Density is user-controlled: calm is the default, more/everything are opt-in.
- Shame-free affordances: no red urgency, overdue treatment, streak pressure, or raw backlog badges.

## Color

Current tokens are defined in `src/pkms/web/styles.css`.

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Ground | `--ground` | `#f6f1e8` | Main paper background |
| Raised ground | `--ground-raised` | `#fbf7ee` | Panels, cards, elevated surfaces |
| Sunken ground | `--ground-sunken` | `#efe8da` | Secondary fills and inset surfaces |
| Primary ink | `--ink` | `#2a2520` | Main text |
| Soft ink | `--ink-soft` | `#5c534a` | Secondary text |
| Faint ink | `--ink-faint` | `#8a7f73` | Low-emphasis labels |
| Rule | `--rule` | `#ddd3c2` | Borders and dividers |
| Action accent | `--ochre` | `#b8762b` | Primary action and next-step accent |
| Deep action accent | `--ochre-deep` | `#8f5a1d` | Links, hover, stronger action text |
| Action wash | `--ochre-wash` | `#f3e6cf` | Soft action backgrounds |
| Resurface accent | `--sage` | `#6b8e7f` | Curious question / resurface surface |
| Deep resurface accent | `--sage-deep` | `#4f6e61` | Resurface text and borders |
| Resurface wash | `--sage-wash` | `#e0e8e3` | Resurface backgrounds |
| Completion | `--celebrate` | `#3f8f5b` | Completion pebbles and page-cleared state |
| Deep completion | `--celebrate-deep` | `#2d6b43` | Strong completion text |
| Completion wash | `--celebrate-wash` | `#d8ead9` | Completion backgrounds |

Never introduce red for normal task or backlog states. Error messages should use the existing ochre warning pattern unless a true destructive/error state requires a separate semantic treatment.

## Typography

Current font tokens:

- Serif/display: `Cormorant Garamond`, falling back to Iowan/Georgia/serif.
- Sans/product UI: `Barlow`, falling back to system sans.
- Mono/metadata: `Fira Code`, falling back to SF Mono/Cascadia/Consolas.

Usage:

- The re-entry lede and card titles can use the serif to preserve the authored/editorial feel.
- Controls, nav, labels, task rows, and dense metadata use the sans or mono.
- Keep display letter-spacing at or above `-0.04em`; current headings use `-0.01em` and should stay restrained.
- Body prose should stay within `--measure` where possible.

## Layout

Primary shell:

- `.poster` centers content with `--poster-max: 64rem` and responsive `--gutter`.
- Top bar has quiet masthead metadata and a single salience control.
- Hash-route nav exposes `today`, `capture`, `reading`, `actions`, and `find`.
- Today surface prioritizes lede, lead action, shelf, optional recognition rail, optional actions, and completion stamp.

Responsive behavior:

- Wide viewport: editorial poster with shelf columns and optional rails.
- Narrow/mobile: card stack with capture as a full-screen-feeling surface.
- Avoid adding persistent sidebars or dashboard chrome unless a future surface truly needs it.

## Components

### Lede

The lede is the glance anchor. It restores context without a generic greeting. It should read like a humane breadcrumb, not a motivational banner.

### Lead action

The lead action is the primary affordance for "the next thing." It should remain visually stronger than lists and rails. Its copy should start with a concrete first action when available.

### Shelf

The shelf holds quiet secondary state: fold-in progress, win pebbles, and at most one resurface prompt. Shelf cells should remain low-pressure and non-dashboard-like.

### Recognition cards

Cards may show reading and resurface candidates, but should not become a generic card grid. Each card needs a specific reason or cost signal.

### Capture

Capture must be fast, focused, and feed-free. The textarea gets the attention; everything else is secondary. Confirmation copy should reinforce that the system owns later.

### Reading queue

Reading items show title, consume-cost, why, and queue date. Clicking opens the markdown note locally. Do not show unread counts or pile language.

### Actions

Actions are one per note by default. Full backlog views are allowed, but one click away and framed as recoverable context, not obligation.

### Toasts

Toasts are ambient disclosure, not alert modals. Use them for save confirmation, undo, and local open feedback.

## Motion

Existing motion is restrained and stateful. Keep transitions around the existing `--dur-fast`, `--dur`, and `--dur-stamp` tokens. Completion can have a stronger stamp/pebble animation, but ordinary navigation should not choreograph page-load sequences.

Always honor `prefers-reduced-motion`.

## Interaction Rules

- Capture save supports Ctrl/Cmd+Enter.
- Density controls are the one sanctioned personalization surface.
- Resurface actions must remain cheap and guilt-free: not now, let go, undo where relevant.
- Opening a note is a local action routed through the token-gated service.
- Extension new tab sends the token as `X-Capture-Token`; served PWA mode can use `?token=…`.

## Anti-patterns To Avoid

- Raw backlog or unread counters.
- Red urgency for self-imposed tasks.
- Motivational productivity copy.
- Generic dashboard widgets or hero metrics.
- Decorative glass, gradients, or identical card grids.
- Settings screens that expose unnecessary knobs.
- Modals as the first solution.

## Source Files

- Main PWA/new-tab source: `src/pkms/web/index.html`, `src/pkms/web/styles.css`, `src/pkms/web/app.js`
- Packaged Firefox extension copy: `src/pkms/web_ext/newtab.html`, `src/pkms/web_ext/styles.css`, `src/pkms/web_ext/app.js`
- Backend data/actions: `src/pkms/capture_service.py`, `src/pkms/today.py`

## Detector Scope

The Impeccable detector ignores are intentionally minimal and project-local. Each entry in `.impeccable/config.json` covers a path that would otherwise produce noise or duplicate design findings:

- `.agents/**` — agent-specific records not part of the codebase.
- `.venv/**` — regenerable virtual environment.
- `spike/**` — experimental files not under design review.
- `src/pkms/web_ext/` — packaged copy of the source surface in `src/pkms/web/`. Detecting both would produce duplicate findings. As long as the extension remains a copy, this ignore entry stays. When the extension gets independent UI beyond packaging/settings, revisit this decision.
