# Rationale — the "workbench"

> A maker's workbench. The current piece is **clamped in the vise** (the lit
> focus pane, warm paper under the lamp); the ambient stuff — today's finished
> pieces, the curious question, today's read — sits on the **stock tray** to
> the right. Material, warm-dark, brass.

This take exists to answer: *what if the front door is spatial, not linear?*
#1 "daily edition" was a single-column editorial read. #2 says the user is a
maker walking up to a bench — they see the piece in the vise first (the one
thing to do), and the tray of ambient context in their peripheral vision.

## The big moves

### 1. Two-zone spatial layout (vise + tray)

**Serves:** One next action per note (§6, bound 4); re-entry beats organization
(§7, bound 9); recognition over recall (§5, bound 3).

The single biggest move vs. #1: a **two-column grid** on wide screens. The left
column is the **vise** — the lit focus pane (warm paper, brass corner brackets,
the lead action clamped in the dark inner piece). The right column is the
**tray** — the ambient periphery (pebbles, the resurface question glowing warm
amber, today's reading).

This is a *fundamentally* different posture from #1's single column. In #1 the
eye reads top-to-bottom like a memo. In #2 the eye lands on the vise (the one
thing) and the tray is *peripheral* — you know it's there, you can glance at
it, but it does not compete for the first read. That peripheral-vs-focus split
is the workbench metaphor's load-bearing move.

I rejected:
- **Three zones (vise + tray + a third "toolbox" rail).** Adds a third thing to
  parse. Two zones is the maximum before it stops reading as "a bench" and
  starts reading as "a dashboard." Reject.
- **A single full-width vise with the tray below.** Collapses back to #1's
  linear posture. Reject.

### 2. Stained walnut + brass + paper-under-lamp palette

**Serves:** No red badges (§3, §5); shame-free tone (§3); distinctive aesthetic.

The palette is *material* — it evokes physical stuff:

| Role | Color | Material |
|---|---|---|
| Workshop ground | `#1f1812` | stained walnut |
| Focus pane | `#f1e6cf` | paper under the lamp |
| Accent | `#c89b3c` | brass |
| Resurface glow | `#d4843c` | amber lamp glow |
| Completion | `#7da55f` | patina green |

This is a deliberate inversion of #1 (cream paper throughout). Here the
*default* is dark (the unlit workshop) and the *focus* is lit (paper under the
lamp). That inversion is the metaphor: the system is dark and quiet by default,
and it lights up the one thing that matters.

**Still no red.** The absence holds.

### 3. The vise — brass corner brackets, clamped dark inner piece

**Serves:** One next action (§6, bound 4); starting is success (§6).

The lead action isn't just a big button — it's a **clamped piece**. The focus
pane has brass corner brackets (CSS pseudo-elements, top-left and bottom-right)
that visually "clamp" it. Inside, the actual action sits in a dark inner block
(the "piece in the vise"), with the `▶ first_action` in slab serif, the `⏱ size`
as a brass pill, and a material brass **"strike it →"** button with a 3D pressed
feel (gradient + inset highlight + drop shadow).

The verb "strike it" is the workbench's word for "do the next thing" — it's
physical, maker-verb language, not productivity-SaaS language.

### 4. The tray — ambient periphery, pebbles as finished pieces

**Serves:** Wins-only pebbles (§3, bound 1); one ambient resurface prompt (§5,
bound 5); resurface shaped as a curious question (§5, bound 5).

The right column holds three things, top to bottom:

1. **Today's finished pieces** — the pebbles, rendered as small material dots
   with gradient + inset highlight (they look like physical pieces in a tray).
   Three color variations (patina / brass / amber) break the monotony without
   adding meaning.
2. **The resurface lamp** — a card with a warm amber glow at the top-right
   corner (a radial gradient), the italic-slab question, the transparent `why`,
   and the two peer-weighted affordances. The glow is the "lamp" — it's the
   warmest spot on the tray, drawing the eye gently without alarming.
3. **Today's reading** — the next-up long-read, quiet, with its consume-cost
   pill.

The tray is hidden in `calm` mode (except pebbles). It appears at `more` and
`everything`.

### 5. The chain — actions as a linked sequence

**Serves:** One next action per note (§6, bound 4); backlog one click away (§6,
bound 4).

Below the vise, the rest of the open actions render as a **chain** — a vertical
sequence of items, each with the `⏱ ▶ ✓` anatomy. The name "chain" (vs "list")
reinforces the workbench metaphor: these are sequential pieces, not a pile. The
"4 more in the drawer" accordion uses drawer language — the overflow lives in a
drawer of the bench, one gesture away.

### 6. BENCH CLEARED — the workshop's quiet pride

**Serves:** Empty = reward (§3, bound 6); completion is the one loud place (§3).

When all visible actions are done, the vise is replaced by a **BENCH CLEARED**
stamp — same ink-stamp feel as #1's PAGE CLEARED but with patina-green corners
and the workbench's voice: *"the vise is empty. go rest the hands."* The
pebbles tray shows proudly.

### 7. Slab serif (Roboto Slab) — material weight

**Serves:** Distinctive aesthetic; authored feel.

Fraunces (#1) is a stylish editorial serif. Roboto Slab (#2) is a **slab** —
the slabs give it material weight, the feel of something stamped or engraved
rather than written. It pairs with the workshop palette: a slab serif on a
dark workshop background reads as "engraved nameplate," not "morning newspaper."

### 8. The dial — brass 3-position switch

The salience knob is styled as a **brass dial** — a horizontal pill with three
positions, the active one lit with a brass gradient + inset highlight (it looks
like a physical switch in the engaged position). Same mechanic as #1's calm/
more/everything, different material metaphor.

---

## What's genuinely different from #1

| Axis | #1 daily edition | #2 workbench |
|---|---|---|
| Layout | single column | two-zone (vise + tray) |
| Palette | cream paper, light | walnut workshop, dark with lit focus |
| Typeface | Fraunces (editorial serif) | Roboto Slab (material slab) |
| Accent | ochre | brass + amber |
| Posture | read top-to-bottom | eye-on-vise, periphery-on-tray |
| Completion stamp | PAGE CLEARED | BENCH CLEARED |
| Voice | "come back when something sparks" | "the bench will be here when you come back" |

Both follow every binding rule. They feel like different rooms.

---

## Self-check

| Criterion | How #2 delivers |
|---|---|
| Recognize-and-act > manage-a-pile? | Vise = the one thing; tray = ambient, peripheral. No pile visible by default. |
| Re-entry reassuring? | Lede on the vise: "On the bench yesterday: **X**." Gap-day softens same as #1. |
| Clean of forbidden patterns? | Grep-verified: no red, no streaks, no overdue counters, no graph. |
| Distinctive + finished? | Walnut + brass + slab serif + brass-corner-bracket vise = no SaaS tells. |
| Honest? | See HONESTY.md. |

