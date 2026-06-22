---
title: Frontend design brief — GLM-5.2 (visual-home, blind take)
tags: [pkms-design, design-brief, handoff, glm, frontend, adhd]
created: 2026-06-18
status: ready
---

# Frontend design brief for GLM-5.2

A self-contained handoff to GLM-5.2: design the whole PKMS web frontend from scratch,
mockup-first, using its own judgment on the aesthetics within the binding ADHD design
language. The brief itself (everything under **"--- BRIEF (paste below) ---"**) is meant
to be pasted to GLM verbatim.

## Using this brief

- **It is deliberately "blind."** The current web today-view's look is withheld so GLM
  produces an independent design to compare against, not a refinement of the existing one
  (Kenja's "compare, don't refine" preference). To instead have it build on the current UI,
  add a pointer to `capture_service.py`'s `TODAY_APP`.
- **Self-contained.** The frontend-binding rules from the design language are distilled
  inline so the prompt works in any GLM interface. Full source (with research provenance):
  `K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md` — if GLM runs in a harness with file
  access, add "read that file for the complete rules."
- **If run via Aider / Claude-Code-with-GLM in this repo,** add one line telling it to write
  deliverables to `spike/visual-home-glm/` so it never touches `vault/` or the live
  `capture_service.py`.
- **Scope locked with Kenja (2026-06-18):** mockup + rationale first · plain HTML/CSS/JS, no
  build step · full frontend from scratch · read-only data additions OK (language-agnostic).

---

--- BRIEF (paste below) ---

# Design brief: reimagine the frontend for a personal ADHD knowledge system (PKMS)

You are an expert product/frontend designer with strong visual judgment. I want you to
design — from scratch, your own vision — the entire web frontend for a personal knowledge
management system built for someone with ADHD. Be ambitious, opinionated, and distinctive.
I am explicitly asking you to USE YOUR JUDGMENT on the look, layout, motion, typography,
color, and interaction model. Avoid the generic "AI dashboard" aesthetic. I want a design
that feels designed.

This is a single-user personal tool — no auth screens, onboarding funnels, marketing,
teams, or billing. Just the working surfaces, below.

## What the product is (read this twice)

A permanent prosthesis for a *performance* disorder, not a knowledge one. Storing
information changes nothing; only what reaches the point of action matters. The vault is
plain markdown files; a SQLite index is a regenerable view over them. The frontend's job
is to make the user **recognize and act**, never to make them **manage a backlog**. The
user lapses for days at a time — re-entry after a gap is the single most important moment.

## Your creative latitude (own all of this)

The visual system, layout, hierarchy, density, motion/transitions, iconography, typography,
color, empty/celebration states, and the interaction model for each surface. Give me ONE
coherent, confident vision (not three timid variants). Where you considered an alternative
and rejected it, say so in the rationale.

## HARD BOUNDS — non-negotiable (this is the part your taste can't infer)

These come from a binding research-backed ADHD design language. Violating them produces the
exact patterns that make ADHD users abandon tools. Treat them as invariants:

1. **No raw backlog counts, anywhere.** "47 unread / 12 overdue" reads as failure. Allowed
   progress mechanics, both forward-only: finishable batch progress ("3 of 7") and
   wins-only "pebbles" (today's completions, reset daily with no debt). Inbox is shown as
   *progress to fold in*, never as debt.
2. **No streaks, no overdue counters, no red badges, no "you haven't…" copy.** Copy is
   shame-free; a return after a gap is welcomed, never billed. Briefings end with an
   invitation, not an assignment.
3. **Recognition over recall. Search is the fallback, NEVER the front door.** Show
   candidates the user can point at ("that one"); never make a blank search box the primary
   surface.
4. **One next action per note; the backlog is one click away, never a wall by default.**
   Never enumerate all steps of a project. Each task can show: ⏱ a size, ▶ a concrete
   ~10-minute first action, ✓ a done-when. Consumable items (reading) show a consume-cost
   pill ("~12 min").
5. **Resurfacing is machine-initiated, rationed, and shaped as a curious question**
   ("Still interested in X?") — never a count, dot, or pile. At most one ambient resurface
   prompt at a time. Each offer carries a quiet "not now" (no re-nag) and a guilt-free
   "let it go" (forever-exit). Only knowledge resurfaces — never identity/entertainment.
6. **The empty state is the reward.** Clearing a batch earns a real celebration moment;
   emptiness reads as a win, never a void or error. Completion is the one place the UI is
   loud.
7. **Decay is silent and reversible; the machine never accuses.** When the system rests/
   sweeps old items it discloses ambiently — a quiet, dismissable line, never a modal,
   badge, or alert. Nothing looks deleted.
8. **Opinionated and finished — zero settings sprawl.** The settings screen is a documented
   death. The ONE sanctioned personalization knob is a salience/density control
   (e.g. "calm / more / everything") — decluttering, not tinkering. A fuller/board view, if
   you design one, is gated behind that control and is NEVER the default.
9. **Re-entry is first-class.** A breadcrumb of where they left off + a suggested first
   action must be prominent. Spec for the worst state: in a deep low the UI should get
   simpler, not busier.
10. **Transparent ranking.** Anything the system surfaces or orders can answer "why this?"
    in one quiet line ("short · in your reading queue").

**Never produce:** an Obsidian-style graph of the whole vault (the canonical abandonment
artifact), a wall/grid of every item, unread/overdue counters, streak flames, red
notification badges, or a settings-heavy preferences screen.

## Surfaces to cover (as ONE coherent app)

- **Today / front door** — the home. Breadcrumb (re-entry), what's new to fold in (as
  progress), one next action per note, a curated recognition row (reading + resurfacing),
  today's win pebbles, the single resurface question. This is the centerpiece.
- **Capture** — a separate, instant, near-zero-chrome surface: cursor already in the box,
  confirms "saved ✓" immediately, never opens a feed or loads the full app.
- **Reading queue** — promoted long-reads, each with a consume-cost pill.
- **Next actions / tasks** — one-per-note by default; backlog reachable in one click; task
  states: open / done / stuck / not-now / paused / iceboxed.
- **Resurfacing** — the curious-question surface with not-now / let-it-go.
- **Search** — present but clearly the fallback, not the front door.

## The real data you're designing against

The backend already serves `GET /api/today` returning this JSON (use these exact field
names in your fake data so the mockup maps cleanly to reality):

```json
{
  "date": "2026-06-22",
  "breadcrumb": {"name": "2026-06-21", "lines": ["...up to 4 lines..."]},
  "inbox_new": 3,
  "done_today": 2,
  "next_read": {"title": "...", "minutes": 12, "promoted": "2026-06-18"},
  "resurface": {"title": "...", "question": "Still chewing on X?", "why": "short · r/sub you clear often", "path": "resources/foo.md"},
  "next_actions": [
    {"note": "projects/alpha.md", "title": "Alpha", "text": "draft the intro", "size": "30m", "first_action": "open the outline file"}
  ],
  "more_notes": 4
}
```

There is also a `recognition_cards()` data source: a curated list (≤3) of
`{"kind": "reading"|"resurface", "title", "why", "minutes?"}`. Note paths are forward-slash
and URL-safe. The live app is token-gated (`?token=…`), so a real page would carry a token —
ignore that for the mockup.

**You MAY propose additional READ-ONLY data the design needs** (e.g. area tiles, win-pebble
detail, search results). Specify it as a small data-contract: endpoint name, shape, and
where it derives from. Implementation language is open — it does NOT have to be Python; for
the mockup, stub it with realistic fake JSON. You must NOT propose changes to the capture
path or to the underlying files — those are sacred/regenerable.

## Deliverables (this run is design-only — do NOT wire to the live app)

1. **A self-contained mockup**: vanilla HTML/CSS/JS, no build step, runnable by opening the
   file(s) in a browser. Inline realistic fake data; client-side nav between the surfaces.
   No frameworks, no node deps. Make it look production-grade, not wireframe.
2. **A design-rationale doc (markdown)**: the big moves and, for each, WHICH hard-bound rule
   it serves and why. Be concrete about the front-door layout and the re-entry moment.
3. **A proposed read-only data contract**: the endpoints/fields beyond `/api/today` your
   design assumes, each with shape + derivation.
4. **An honesty section**: anywhere you bent, were unsure about, or had to interpret a hard
   bound — flag it explicitly so it can be reviewed.

## How this will be judged

Does it make the user recognize-and-act rather than manage-a-pile? Is the re-entry moment
genuinely reassuring? Is every surface clean of the forbidden patterns? Is the aesthetic
distinctive and finished? Is the rationale honest about trade-offs? Design boldly within the
bounds — the bounds are where ADHD tools live or die; the aesthetic above them is yours.
