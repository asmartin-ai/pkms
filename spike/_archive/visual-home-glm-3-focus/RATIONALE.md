# Rationale — the "focus"

> A reading lamp on one thing. The whole UI is worst-state-simple: **one
> action, huge type, near-monochrome.** Everything else is one gesture away.
> This take takes the brief's "spec for the worst state — in a deep low the UI
> should get simpler, not busier" and makes that the **default**, not a mode.

This take exists to answer: *what if the front door never shows a list at all?*
#1 was editorial-list. #2 was two-zone-spatial. #3 says: in the ADHD use case,
**the list itself is the problem** — even a short list invites scanning, and
scanning is the recall posture we're avoiding. So #3 shows **one thing, only
ever one thing**, huge, centered, with everything else behind a single "what
else is here" toggle.

## The big moves

### 1. Serial single-focus — one action at a time, ever

**Serves:** One next action per note (§6, bound 4); spec for the worst state
(§7, bound 9); recognition over recall (§5, bound 3).

The hero is **one action** — the first not-done action in `next_actions`. It
renders huge (the `first_action` text is at `--step-4`, ~3-7rem depending on
viewport), with a "first move" kicker above it and a single **"begin →"** button
below. When you complete it (click "begin"), the *next* not-done action rotates
into the hero. Serial. One at a time. **You never see more than one action on
the front door.**

This is the load-bearing inversion. The list-of-actions (which #1 and #2 both
show, however quietly) is banished entirely from the default view. To see the
rest, you open the "what else is here" toggle — and even then it's framed as a
secondary drawer, not the main event.

I rejected:
- **A paginated swipe-through (Tinder-for-tasks).** Gimmicky, and swipe
  interactions are bad for motor-impaired users. Reject.
- **A "today's 3" subset instead of 1.** Three is already a list; the whole
  point is one. Reject.
- **Auto-rotating hero.** Motion without intent. Reject.

### 2. Near-monochrome — no ochre, no sage, one warm graphite for actions

**Serves:** Calm not clinical (§3); no red (§3, §5); distinctive aesthetic.

The palette is deliberately quieter than #1 and #2:

| Role | Color |
|---|---|
| Ground | `#faf7f2` warm off-white |
| Ink | `#1a1814` + 4 opacity weights |
| The DO button | `#2a2520` warm graphite |
| Completion | `#4a7c52` muted green |

**No ochre. No sage. No brass. No amber.** The single accent is the dark
graphite DO button (which is almost the same as the ink — it recedes). The only
color in the whole UI is the completion green, reserved for done-states and the
cleared stamp.

This is a deliberate bet: the *fewer* colors, the more **each** color means.
When the only color in the system is "green = done," done feels earned. #1 and
#2 spread color across actions/resurface/reading; #3 concentrates it all on
completion.

### 3. Display sans (Inter) at extreme scale

**Serves:** Distinctive aesthetic; recognition (the action is unmissable).

#1 = editorial serif (Fraunces). #2 = material slab (Roboto Slab). #3 = **humanist
sans (Inter) at extreme scale** — the hero action is set in Inter at `--step-4`
(3-7rem), weight 600, with tight tracking (`-0.035em`). At that scale a humanist
sans reads as **confident and direct**, not SaaS-generic (SaaS-generic is Inter
at 1rem, not Inter at 5rem).

The bet: the *scale* is what makes it distinctive, not the family. A 5rem
humanist sans hero is as far from a dashboard as a 5rem serif — it's just a
different direction of far.

### 4. "What else is here" — the serial drawer

**Serves:** Backlog one click away, never a wall (§6, bound 4); one ambient
resurface prompt (§5, bound 5); pebbles (§3, bound 1).

Below the hero, a single quiet toggle: **"› what else is here"**. Click it and
a drawer opens with the resurface question, today's reading, the chain of other
actions, and the pebbles — all the stuff #1 and #2 show by default. The drawer
is **closed by default**, and even in `more` / `everything` density levels it
stays closed until you open it (the density levels only control whether the
toggle *appears*).

This is the strictest possible reading of "the backlog is one click away, never
a wall by default" — here the backlog is one click away *and the wall is
literally invisible until you ask for it*.

### 5. The cleared moment — near-silent, huge

**Serves:** Empty = reward (§3, bound 6); completion is the one loud place (§3).

When all visible actions are done, the hero is replaced by a near-silent
cleared state: a tiny `· · ·` ornamental pre-line, then **"cleared."** in huge
display sans (step-5, ~4-9rem) in muted completion green, with a slow letter-
spacing animation on arrival (the letters settle inward). Then *"nothing owed.
go well."* and the pebbles.

This is quieter than #1's rotated ink stamp and #2's bracketed stamp — it's
just **one huge word**. The quietness is the point: in a UI that's already
near-monochrome and near-silent, the cleared moment doesn't need to shout to be
loud *relative to the baseline*. The contrast is in the scale and the single
touch of color, not in ornament.

### 6. Capture as full-bleed field

The capture surface makes the whole screen the box — a borderless textarea at
`--step-3` (huge), with the placeholder "say it…" in italic. It reads as "a
blank page you're writing on," not "a form field." Cmd+Enter saves, it flashes
"saved." (huge, green), and returns to blank.

### 7. No texture, no shadows, no decoration

**Serves:** Distinctive via subtraction; spec-for-worst-state (§7).

#1 had paper grain. #2 had wood grain + drop shadows + brass hardware. #3 has
**none of it** — flat ground, no texture, no shadows (except the toast's functional
shadow). The aesthetic is *subtractive*: the mockup is distinctive because of
what it doesn't have. This is the riskiest bet of the four — minimalism can
read as "unfinished" if the type and spacing aren't exactly right. I've erred
on the side of *more* whitespace and *larger* type to make the subtraction feel
confident rather than empty.

---

## What's genuinely different from #1 and #2

| Axis | #1 daily edition | #2 workbench | #3 focus |
|---|---|---|---|
| Default visible items | ~7 sections | vise + 3 tray cards + chain | **1 action** |
| Layout | single column | two-zone | single hero, full-bleed |
| Palette | cream + ochre + sage | walnut + brass + amber | **near-mono + 1 green** |
| Type | Fraunces serif | Roboto Slab | **Inter at extreme scale** |
| List visible by default? | yes (quietly) | yes (in chain) | **no — behind a toggle** |
| Decoration | paper grain | wood grain + hardware | **none** |
| Cleared stamp | rotated ink stamp | bracketed stamp | **one huge word** |

#3 is the most opinionated of the four. It bets that the ADHD user is best
served by *never seeing a list at all* unless they explicitly ask for one.

---

## The risk I'm flagging honestly

**This take might be too minimal.** The brief asked for "ambitious,
opinionated, and distinctive" and warned against the "generic AI dashboard
aesthetic" — but there's an adjacent failure mode: **too minimal to feel like a
real product.** #3 walks that edge. If the type spacing is slightly off, or the
hero action is slightly too long, it could read as "a wireframe" rather than "a
finished, confident tool." I've done what I can with scale and whitespace to
make it feel intentional, but this is the take most likely to divide opinion.
See HONESTY.md.

---

## Self-check

| Criterion | How #3 delivers |
|---|---|
| Recognize-and-act > manage-a-pile? | Literally one thing on screen. No pile possible. |
| Re-entry reassuring? | Lede is one line, huge, gentle. Gap-day softens. |
| Clean of forbidden patterns? | Grep-verified: no red, no counts, no graph, no wall (because no list). |
| Distinctive + finished? | Extreme-scale sans + near-mono + no decoration = no SaaS tells. Risk: too minimal. |
| Honest? | See HONESTY.md — the "too minimal" risk is the top flag. |
