# Rationale — the "bloom"

> A warm pastel, sensory-calibrated, bounded daily edition. The front door is
> "today's bloom" — a finite, edited, friendly edition with one thing at its
> heart, a clock-free rhythm partition, ambient peripheral cards, and a
> wins-only logbook. Built from real research on apps for attention-impacted
> users. See RESEARCH.md for provenance.

This take exists to answer: *what does the research point to that the first
three aesthetic visions didn't?* #1 was editorial, #2 was material, #3 was
minimalist. The research (Tiimo, Goblin Tools, Inflow, Readwise, Things 3,
Calm Tech) pointed at a fourth direction: **warm, pastel, gentle,
sensory-calibrated, bounded.** Hence "the bloom."

## The big moves

### 1. Tiimo-inspired pastel palette — explicitly sensory-calibrated
**Serves:** Shame-free tone (§3); calm not clinical (§3); no red (§3, §5);
GAAD accessibility.

The biggest aesthetic move: a **low-saturation pastel palette** with one soft
accent per surface:

| Role | Color | Surface |
|---|---|---|
| Blossom (dusty rose) | `#d9a8b8` | the one thing (hero) |
| Sky | `#a8c4d9` | the curious question (resurface) |
| Sage | `#b8cca8` | reading |
| Honey | `#e8c98a` | Fresh rhythm |
| Lavender | `#c5b8d9` | Later rhythm |
| Mint | `#9bc9a8` | completion only |

This is deliberately not cream (#1), not dark (#2), not stark white (#3). It's
**Tiimo's sensory-calibrated palette** — explicitly designed to reduce visual
stress for neurodivergent users (per Tiimo's 2025 GAAD work), not just "pretty."
Low contrast, rounded shapes, warm hue family throughout.

### 2. Nunito (rounded sans) — the gentle typeface
**Serves:** Distinctive aesthetic; Goblin Tools' gentle tone.

Fraunces (#1, editorial), Roboto Slab (#2, material), Inter (#3, confident
humanist) — each was a deliberate personality choice. #4 uses **Nunito**, a
rounded humanist sans whose rounded terminals read as **friendly and gentle**,
the typographic equivalent of a soft voice. It's the typeface that matches
Goblin Tools' playful-but-respectful tone.

### 3. Rounded shape language — soft corners everywhere
**Serves:** Sensory-calibration; distinctive aesthetic.

`--r-sm: 8px`, `--r: 14px`, `--r-lg: 20px`, `--r-xl: 28px`, `--r-pill: 100px`.
The whole UI uses generous border radii — pill buttons, rounded cards, rounded
inputs. Sharp corners read as "serious tool"; rounded corners read as
"approachable." Tiimo and Inflow both commit to this; #4 does too.

### 4. Rhythm partition — Fresh / Later (clock-free)
**Serves:** No fake deadlines (§6); shape without clock (§5); one next action
per note (§6).

A two-column grid below the bloom: **Fresh** (honey-wash, ☀) for short
high-energy actions, **Later** (lavender-wash, ☽) for longer settle-in work.
Each action carries a `rhythm` field. This is Things 3's "This Evening" idea
generalized — a way to give the day a *shape* without assigning clock times
(which would create de-facto deadlines, violating §6).

The hero (the bloom itself) is always the first not-done Fresh action —
short/high-energy first, when energy is highest. Later items wait in the
lavender column, guilt-free.

### 5. Ambient peripheral cards (Calm Tech)
**Serves:** One ambient resurface prompt (§5, bound 5); recognition over recall
(§5, bound 3); periphery→center transition (Calm Tech).

Two small cards below the rhythm partition:
- **Sky card** — the single resurface question, with a half-life indicator
  (`"recall dipping · ready to resurface"`), the transparent `why`, and the two
  peer-weighted exits (not now / let it go).
- **Sage card** — today's reading, with consume-cost pill.

These live in the **periphery** — small, pastel, to the side. They don't
compete with the bloom for the first read. They become the focus only when you
engage them. That's Weiser/Brown's peripheral→center transition, applied.

### 6. Half-life indicator on resurface — Readwise-inspired, clock-free
**Serves:** No time-based resurfacing (§5); transparent ranking (§9).

The resurface card carries a small pill: `"recall dipping · ready to
resurface"`. This label *replaces* what would otherwise be a clock-based
"last touched 14 days ago" — it frames the resurface as probability-based
(Readwise's half-life model), not clock-based. The `halflifeLabel()` helper
derives the label from the promoted date, simulating the algorithm.

### 7. Logbook — Things 3 inspired wins-only archive
**Serves:** Wins-only pebbles (§3, bound 1); no streaks (§3, §7); empty =
reward (§3, bound 6).

The pebbles render as **named pills** in a soft mint card titled *"today's
logbook — wins only"*:
```
[ • folded the F6 promote fix ]  [ • drafted the GLM brief ]  2 wins today
```
Each win is labeled (not just a dot), like a Things 3 Logbook entry. They're
past successes archived, never debt. The logbook never re-presents as a count
to satisfy.

### 8. BLOOM CLEARED — the bounded edition's satisfied end
**Serves:** Empty = reward (§3, bound 6); completion is the one loud place (§3);
finite-edition feeling (The Browser pattern).

When all visible actions are done, the bloom is replaced by:
```
            ❀ ❀ ❀
        edition complete.
   you've done what mattered today. rest well.
   [all the day's pebbles]
```
The mint card, the slow bloom-open animation (gentle overshoot), the ornamental
❀ glyphs. It reads as "you finished today's edition" — not "you cleared your
task list." The framing matters: editions end satisfied; task lists just empty.

### 9. The closing — a clear end to the edition
**Serves:** Bounded-edition pattern (The Browser); finite not infinite (NNG).

At the bottom of today: a small closing card — *"that's today's edition. come
back tomorrow — it'll be a fresh bloom."* This is the explicit "the document
ended" signal NNG says infinite feeds destroy. There's a bottom; you reached
it; you can stop.

### 10. Friendly coaching tone throughout
**Serves:** Shame-free copy (§3); gentle tone (Goblin Tools/Inflow).

The copy is the gentlest of the four mockups:
- "the **garden** keeps it" (capture confirmation)
- "whatever just **bloomed**…" (capture placeholder)
- "come back tomorrow — it'll be a **fresh bloom**"
- "nothing in the logbook yet — **that's fine**."
- "nothing fresh left — **nice**."

No assignment language, no urgency, no "you should…". Coaching, not
monitoring.

---

## What's genuinely different from #1, #2, #3

| Axis | #1 daily edition | #2 workbench | #3 focus | **#4 the bloom** |
|---|---|---|---|---|
| Palette | cream + ochre | walnut + brass | near-mono | **pastel (rose/sky/sage/honey/lavender/mint)** |
| Typeface | Fraunces serif | Roboto Slab | Inter huge | **Nunito (rounded sans)** |
| Shape language | tight radii | material + shadows | flat, sharp | **rounded everywhere (8–28px + pills)** |
| Rhythm partition | no | no | no | **Fresh / Later (clock-free)** |
| Half-life indicator | no | no | no | **yes (Readwise-inspired)** |
| Pebbles as | dots | dots | dots | **named pills (Logbook)** |
| Tone | editorial | workshop | silent | **gentle coaching** |
| Grounding | pure vision | pure vision | pure vision | **research-backed** |

#4 is the only one that's explicitly sensory-calibrated and research-grounded.

---

## Self-check

| Criterion | How #4 delivers |
|---|---|
| Recognize-and-act > manage-a-pile? | Bloom = one thing; rhythm = bounded 2-col; logbook = wins. No pile. |
| Re-entry reassuring? | Lede + bloom + gentle gap-day ("Nothing's overdue"). |
| Clean of forbidden patterns? | Grep-verified: no red, no streaks, no overdue, no clock, no graph. See HONESTY.md. |
| Distinctive + finished? | Pastel + rounded + Nunito + rhythm partition = no SaaS tells; research-backed. |
| Honest? | See HONESTY.md — rhythm field is the top proposed-data flag. |
