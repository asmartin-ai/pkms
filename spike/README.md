# PKMS visual-home

Web frontend mockup for the PKMS daily "today" view. **Chosen design: #1 Daily
Edition** — editorial serif on warm paper, single-column, bounded and authored.

The three other design directions explored during selection are preserved as
reference in `_archive/` (workbench / focus / bloom).

## Status

- **#1 Daily Edition** (`visual-home-glm/`) — **active**, desktop. Open
  `index.html` in a browser; no build, no server, no fetch.
- Mobile layout — **backlogged** (parked, not started).
- #2 Workbench, #3 Focus, #4 The Bloom — **archived** in `_archive/` as design
  history. Mine for ideas, not active.

## What's in `visual-home-glm/`

```
visual-home-glm/
├── index.html        ← app shell; 6 surfaces; hash-route nav; salience knob
├── styles.css        ← full design system (tokens, type, layout, motion)
├── app.js            ← inlined fake JSON + render functions + interactions
├── RATIONALE.md      ← the big moves, which hard-bound each serves
├── DATA-CONTRACT.md  ← proposed read-only endpoints with shapes + derivation
├── HONESTY.md        ← bends/interpretations + forbidden-pattern checklist
└── README.md         ← run instructions + file map
```

## The vision

The front door reads like a short, finite, hand-edited morning briefing — a
chief-of-staff memo, not a dashboard. The aesthetic bet that kills the SaaS
read: **editorial serif (Fraunces) on warm cream paper, one muted ochre accent,
one loud moment reserved for completion (PAGE CLEARED).**

Open `index.html`. Toggle `calm / more / everything` in the top-right. Mark
actions done and watch a pebble appear; clear them all and the stamp fires.

## Provenance

- Brief: `vault/projects/pkms-design/frontend-design-brief-glm.md`
- Binding design language: `K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md`
- Data contract source: `src/pkms/today.py`, `resurface.py`, `tasks.py`

## Backlog

- **Mobile-tuned layout** for `visual-home-glm/`. (A mobile-override CSS was
  drafted during exploration and is preserved in `_archive/_mobile.css` as a
  starting point — bottom-anchored nav, touch targets, single-col collapse.)
