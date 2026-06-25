# spike/visual-home-glm — the "daily edition"

A from-scratch, blind design take on the PKMS web frontend, by GLM-5.2, per
`vault/projects/pkms-design/frontend-design-brief-glm.md`.

The vision in one line: **the front door reads like a short, finite, hand-edited
morning briefing (a chief-of-staff memo), not a dashboard.** Editorial serif on
warm paper, one ochre accent, one loud moment reserved for completion.

## Run it

Open `index.html` in a browser. That's it.

- No build step. No node deps. No server. No fetches.
- All data is inlined fake JSON in `app.js` using the **exact** `/api/today`
  field names (verified against `src/pkms/today.py:172-184`).
- Fonts load from Google Fonts CDN; if offline, the CSS stacks fall back to local
  serifs/sans/mono gracefully.

```
spike/visual-home-glm/
├── index.html        ← app shell; 6 surfaces; hash-route nav; salience knob
├── styles.css        ← full design system (tokens, type, layout, motion)
├── app.js            ← inlined fake JSON + render functions + interactions
├── RATIONALE.md      ← the big moves, which hard-bound each serves, rejected alternatives
├── DATA-CONTRACT.md  ← proposed read-only endpoints with shapes + derivation
├── HONESTY.md        ← bends/interpretations + forbidden-pattern absence checklist
└── README.md         ← this file
```

## Surfaces

| Hash route | Surface | What it is |
|---|---|---|
| `#today` (default) | **Today / front door** | The centerpiece. Lede (re-entry breadcrumb-as-prose) → one lead action → "to fold in" (forward-only progress) → recognition rail → the single resurface question → next actions → pebbles → invitation. |
| `#capture` | **Capture** | Its own ramp. One textarea, autofocus, ⌘/Ctrl+Enter saves, Esc clears. Never loads the app. Confirms `✓ saved` instantly. |
| `#reading` | **Reading queue** | Promoted long-reads with consume-cost pills. No queue-length count. |
| `#actions` | **Next actions** | Full one-per-note list with the ⏱ ▶ ✓ anatomy. |
| `#search` | **Search** | Explicitly the fallback. Recognition-first picker (recent notes), free-text secondary. |

## The one knob

Top-right of the masthead: **calm / more / everything**.

- `calm` (default): lede + lead action + fold-in + pebbles. Strips the rail and
  actions list. The worst-state spec — in a deep low the UI gets simpler.
- `more`: adds the recognition rail and the actions list.
- `everything`: reveals the full backlog and the search affordance. Never the
  default.

This is the *only* personalization surface (design-language §8). There is no
settings screen.

## Things to try

- **Mark the lead action done** (click the big dark button) → a pebble appears,
  a toast confirms, and if you clear all visible actions the **PAGE CLEARED**
  stamp fires (the one loud moment).
- **Dismiss the resurface question** — "not now" (silent) or "let it go"
  (forever-exit with 5s undo).
- **Capture** — go to `#capture`, type, hit ⌘/Ctrl+Enter.
- **Toggle the salience knob** — watch the today view get simpler or fuller.
- **Find** — `#search` opens the recognition-first picker; click a candidate.

## What this is NOT

- **Not wired to the live app.** Design-only. All mutations are simulated.
- **Not a refinement of the existing today-view.** Deliberately blind — an
  independent take to compare against, not a polish of what's there.
- **Not a settings screen, plugin slot, graph view, or board default.** All
  explicitly out of scope or forbidden by the design language.

## Provenance

- **Brief:** `vault/projects/pkms-design/frontend-design-brief-glm.md`
- **Binding design rules:** `K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md`
- **Data contract source:** `src/pkms/today.py`, `resurface.py`, `tasks.py`,
  `indexer.py`, `capture_service.py`

