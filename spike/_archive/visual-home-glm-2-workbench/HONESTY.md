# Honesty — the "workbench"

Same framework as #1's HONESTY.md. Flags the bends, then the forbidden-pattern
absence checklist.

## Interpretations and bends

### 1. Two-zone layout on wide screens collapses to one column on narrow
The two-zone spatial layout only kicks in at `min-width: 64rem`. On mobile or
narrow windows, it stacks (vise first, then tray). **Flag:** the workbench
metaphor is *weaker* in the stacked-mobile posture — the "peripheral tray"
becomes "the stuff below the vise," which is closer to #1's linear feel. If the
real product is mobile-first, this take loses some of its distinctive edge on
small screens.

### 2. Pebble color variation (3 colors) — does it imply hierarchy?
The pebbles cycle through patina / brass / amber. **Flag:** this is purely
aesthetic (breaks visual monotony), but a strict reading might argue pebbles
should be uniform since they're all "equal wins." I judged that 3 muted
variations of warm-spectrum colors don't imply ranking — they read as "a tray of
mixed pieces," which suits the workbench. Review if you disagree.

### 3. "Strike it →" verb — too playful?
The lead-action button says "strike it →" (maker-verb). **Flag:** this is more
informal than #1's implicit action. It suits the workshop voice, but if the
tone feels too cute, it's a one-word change. Alternative considered: "do it →"
(too generic); "clamp down" (too obscure).

### 4. Amber resurface glow — does the "lamp" draw too much eye?
The resurface card has a radial-gradient amber glow in its top-right corner.
**Flag:** the design language says resurfacing should be rationed and subtle
(§5). The glow is warm, not alarming, and the card is on the peripheral tray
(not the vise), but it *is* the visually warmest spot on the page. I judged
this as "the curious question gets a gentle lamp on it" — inviting, not
demanding. But if you read it as too attention-grabbing, drop the gradient.

### 5. Slab serif at display sizes — legibility bet
Roboto Slab is less stylistically distinctive than Fraunces, and at very large
sizes slabs can read as "tech-y" rather than "material." **Flag:** I picked it
for the material-weight feel, but it's a quieter aesthetic bet than #1's
Fraunces. If you want the workbench to feel more distinctive, a more
characterful slab (e.g. Aleo, Bitter, or a paid face like Tisa) would do more.

### 6–10. Shared with #1
The fold-in numerator/denominator composition, `goal` default-off, 5s undo on
let-it-go, salience knob placement, and capture filename slug interpretations
are **identical to #1** — see `spike/visual-home-glm/HONESTY.md` items 1, 2, 3,
4, 9. Not re-flagged here.

---

## Forbidden-pattern absence checklist

| Forbidden pattern | Present? | Confirmation |
|---|---|---|
| Vault graph | ❌ | No canvas/svg graph anywhere. |
| Wall/grid of every item | ❌ | Tray cards are ≤3 (recognition cap); chain shows ≤8 by default. |
| Unread counters | ❌ | `inbox_new` only in fold-in progress chip. |
| Overdue counters | ❌ | None. Gap-day lede negates: "Nothing's overdue." |
| Streaks | ❌ | No streak field/logic. |
| Red badges / red dots | ❌ | 17 color tokens, all walnut/brass/amber/patina. No red. |
| "You haven't…" copy | ❌ | Grep confirms. |
| Shame copy | ❌ | "strike it," "the bench will be here," "go rest the hands." |
| Settings screen | ❌ | One knob (dial). |
| Blank search as front door | ❌ | Search is bottom affordance + "find" nav link. |
| Time-based resurfacing | ❌ | Session/event-initiated. |
| Synthetic deadlines | ❌ | Sizes are effort (`⏱ 30m`), not deadlines. |
| Visible deletion | ❌ | "Let it go" has 5s undo. |
| Modals/alerts | ❌ | Toast only. |
| Review debt | ❌ | Structurally impossible. |
| Harsh mechanic names | ❌ | "Let it go" is the harshest. |
