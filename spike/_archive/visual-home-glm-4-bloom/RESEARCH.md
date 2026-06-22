# Research — provenance for "the bloom" (#4)

Unlike mockups #1–#3 (which were pure aesthetic vision), #4 is grounded in
research on how similar apps actually look and behave for attention-impacted
users. This doc records the patterns I stole, the patterns I explicitly
rejected, and the adjudicated direction that resulted.

The full research report (from a parallel research pass) surveyed:
**Readwise/Readwise Reader, Things 3, Bear/Mem.ai/Reflect, Goblin Tools, Tiimo,
Inflow, Numo/Focus Bear/Flow Club, Calm Technology (Amber Case), and editorial
"daily edition" patterns (The Browser, Heptabase).**

---

## Patterns I BUILT on (5)

### 1. Half-life probability resurfacing — **Readwise**
[Readwise Daily Review docs](https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights) ·
[Adding Intention to Spaced Repetition](https://blog.readwise.io/adding-intention-to-spaced-repetition/)

Readwise surfaces highlights when their **recall probability drops to ~50%**,
not on a clock. Their intervals are "soon = 7d / later = 14d / someday = 28d."
This *directly validates* the design language's "no time-based resurfacing"
rule (§5) — it's the non-clock mechanism that replaces the clock.

**Stole:** a half-life indicator on the resurface card — `"recall dipping ·
ready to resurface"` — instead of any clock-based label. The card shows up
because the machine judged recall is fading, not because "it's been 14 days."
The `halflifeLabel()` helper in `app.js` derives this label from the promoted
date, simulating the algorithm.

### 2. The Logbook — **Things 3**
[Things 3 features](https://culturedcode.com/things/features/) ·
[MacStories review](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)

Things 3's Logbook is a **wins-only, past-only archive** — completed items
disappear from the active view and land in a record that never re-presents as
debt. There is no "you have 47 completed tasks" counter mocking you.

**Stole:** the Pebbles render as **named pills** (not just dots) — each win is
labeled ("folded the F6 promote fix"), like a Logbook entry. They sit in a
soft mint "logbook" card titled *"today's logbook — wins only."* The
completion state is archived success, never debt.

### 3. Clock-free rhythm partition — **Things 3 "This Evening" + Tiimo visual flow**
[Things 3 This Evening](https://culturedcode.com/things/support/articles/4001304/) ·
[Tiimo](https://www.tiimoapp.com/)

Things 3 has a soft "This Evening" sub-section of Today — a way to say "later,
but still today" without assigning a clock time. Tiimo's visual timeline shows
activities as colored shapes in flow, sensory-calibrated.

**Stole + adapted:** a **Fresh / Later** rhythm partition. Actions carry a
`rhythm` field (`"fresh"` for short/high-energy, `"later"` for long/settle-in).
Rendered as two pastel columns (honey for fresh, lavender for later) with
gentle kickers — *"fresh — while energy is high"* / *"later — when it suits."*
This gives the day a shape *without anchoring to clock hours* (which would
violate §6's no-fake-deadlines rule).

### 4. Bounded daily edition — **The Browser + Heptabase + NNG**
[The Browser](https://thebrowser.com/) ·
[NNG on infinite scrolling](https://nngroup.n/articles/infinite-scrolling-tips/) ·
[Heptabase](https://heptabase.com/)

The Browser publishes ~5 curated stories/day — a finite, edited edition with a
clear end. NNG's research shows infinite feeds inhibit stopping and destroy
completion feelings. Heptabase uses the daily note as the front door (matches
this product's architecture).

**Stole:** the today view is framed as **"today's bloom"** — a bounded edition
with a named start (`today's edition · Jun 22`) and a clear end (the closing
card: *"that's today's edition. come back tomorrow — it'll be a fresh bloom."*).
The edition-complete state ("BLOOM CLEARED" / *"edition complete."*) is the
satisfied-end-of-edition feeling, not just "you did all the tasks."

### 5. Gentle, playful, coaching tone — **Goblin Tools + Inflow**
[Goblin Tools](https://goblin.tools/) ·
[Inflow](https://www.getinflow.io/post/inflow-adhd-management-app)

Goblin Tools uses a deliberately gentle, playful, single-purpose tone that
removes the "stern/punitive" feel of productivity tools. Inflow frames re-entry
as a small bounded action ("5 minutes today") with supportive coaching copy.

**Stole:** the copy throughout #4 is the gentlest of the four mockups:
- "whatever just **bloomed**…" (capture placeholder)
- "the **garden** keeps it" (capture confirmation)
- "come back tomorrow — it'll be a **fresh bloom**" (closing)
- "that's fine." (empty states)
- The kickers use ornamental glyphs (🌸 ☀ ☽ ✿) instead of the sharper
  typographic glyphs used in #1–#3.

---

## Patterns I REJECTED (3)

### R1. Tiimo's clock-anchored timeline — REJECTED
The *visual pastel flow* language is beautiful and sensory-calibrated, so I
stole the aesthetics. But Tiimo's actual timeline is anchored to clock hours
(9am, 10am, etc.), which would create de-facto deadlines and violate §6's
"no fake urgency / countdown theater" rule. **The Fresh/Later partition in #4
is strictly non-clock.**

### R2. Numo's points/gamification + Readwise's default streaks — REJECTED
[Saner.AI ADHD apps survey](https://saner.ai/blogs/best-adhd-note-taking-apps)

Numo's points/avatars and Readwise's default streak/mastery features are
textbook debt-shaped UI. The design language forbids streaks wholesale (§3,
§7). Even "positive" gamification creates daily-maintenance pressure and a
failure picture. #4's logbook is wins-only and carries no count that can read
as debt. The Things 3 Logbook is the sanctioned exception (past-only archive),
not a streak.

### R3. Mem-style auto-resurfacing graph + Obsidian-style vault graph — REJECTED
[Bear vs Mem 2025 critique](https://avare.medium.com/bear-2-0-vs-mem-2-0-in-2025-when-your-first-love-becomes-work-4d656b7cd938)

Mem auto-presents "related notes" in a graph; Obsidian visualizes the whole
vault's relationships. Both are tempting and both are **the canonical
abandonment artifact** the design language explicitly forbids (§9, brief).
On re-entry, the user would see *structure*, not *an action*. #4 keeps one
action as the front door; search remains the explicit fallback.

---

## The Calm Technology theoretical frame
[Calm Tech principles (Amber Case)](https://calmtech.com/) ·
[Georgia Tech peripheral-display research](https://faculty.cc.gatech.edu/~stasko/papers/ubicomp04.pdf) ·
[IDEO "The Ambient Revolution"](https://edges.ideo.com/posts/the-ambient-revolution-why-calm-technology-matters-more-in-the-age-of-ai)

The binding design language's rules ("quiet decay line," "one ambient resurface
prompt," "no modals/alerts as disclosure," "no red badges") *are literally*
Amber Case's Calm Technology principles. Weiser & Brown's peripheral→center
transition is the model for how #4's ambient cards work: they exist in the
periphery (small, pastel, off to the side) and only become the focus when you
engage with them. Nothing in #4 demands attention; importance is communicated
by position and weight, never by alarm.

---

## How the research shaped the aesthetic

The research pushed me off the three directions I'd already built:

| Take | Aesthetic | Why the research rejected it for #4 |
|---|---|---|
| #1 daily edition | Cream + Fraunces serif | The "editorial daily edition" *mechanism* is great (The Browser), but #1's *aesthetic* is "taken" — building #4 in the same look would just be a refinement, not an independent take. |
| #2 workbench | Walnut + brass + slab serif | Material/dark is a strong direction but reads as "serious tool" — the research (Goblin Tools, Inflow) says ADHD users do better with gentle/playful than with serious/stern. |
| #3 focus | Stark mono + extreme minimal | Minimalism is correct for worst-state spec, but research (Tiimo GAAD, sensory-calibration) says *too* minimal can read as clinical/empty. Warmth matters. |

The synthesis pointed at: **Tiimo's soothing pastels + Nunito (rounded sans) +
Goblin Tools' gentle tone + Things 3's Logbook + Readwise's half-life + The
Browser's bounded edition** = #4 "the bloom." It's the only one of the four
that's explicitly sensory-calibrated and research-grounded, which is its
distinctive contribution to the set.

---

## Sources (load-bearing)

- Readwise Daily Review intervals/algorithm: https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights
- Readwise "Adding Intention to Spaced Repetition": https://blog.readwise.io/adding-intention-to-spaced-repetition/
- Things 3 features + This Evening: https://culturedcode.com/things/features/, https://culturedcode.com/things/support/articles/4001304/
- MacStories Things 3 review (delight): https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/
- Goblin Tools (spiciness slider, estimator): https://goblin.tools/
- Tiimo (visual timeline, GAAD accessibility): https://www.tiimoapp.com/, https://www.tiimoapp.com/resource-hub/accessibility-gaad-2025
- Inflow (daily CBT micro-modules): https://www.getinflow.io/post/inflow-adhd-management-app
- Calm Technology six principles (Amber Case): https://calmtech.com/
- IDEO "The Ambient Revolution": https://edges.ideo.com/posts/the-ambient-revolution-why-calm-technology-matters-more-in-the-age-of-ai
- Georgia Tech peripheral-display research: https://faculty.cc.gatech.edu/~stasko/papers/ubicomp04.pdf
- Bear vs Mem 2025 (auto-graph critique): https://avare.medium.com/bear-2-0-vs-mem-2-0-in-2025-when-your-first-love-becomes-work-4d656b7cd938
- The Browser (daily edition cap): https://thebrowser.com/
- NNG infinite scrolling critique: https://nngroup.com/articles/infinite-scrolling-tips/
- Heptabase (daily note as front door): https://heptabase.com/
