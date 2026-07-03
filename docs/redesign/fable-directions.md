# PKMS front-end redesign — design directions

Author: Fable 5 (executor), 2026-07-02.
Brief: `docs/redesign/fable-uiux-brief.md`. Constraint spine:
`K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md` (referenced, not copied).

The current look ("Log Book II": warm cream paper, Cormorant serif, ochre
accent) is being superseded. It is also, coincidentally, the single most common
AI-default aesthetic (cream + high-contrast serif + terracotta), which makes
replacing it both a brief requirement and a taste requirement.

Three directions were developed. One is chosen at the end.

---

## Direction 1 — Lamplight

**Thesis:** the page is a desk at night with one lamp on. The room stays dim
and settled; the only pool of light falls on the single next thing.

**Palette**

| Name | Hex | Role |
| --- | --- | --- |
| Night | `#211b15` | Ground — warm umber black, not neutral black |
| Raised night | `#2b241c` | Elevated surfaces |
| Bone | `#ede4d3` | Primary text |
| Dim bone | `#b3a48c` | Secondary text |
| Lamp | `#eab04c` | The light — action accent, one per surface |
| Moss | `#a3bd97` | Resurface question (plant on the desk) |
| Fern | `#8fce96` | Completion — wins catch the light |

**Type:** Bricolage Grotesque (display — a warm, slightly eccentric grotesque
with real personality at large sizes) + Atkinson Hyperlegible (body — a face
literally designed for low-vision legibility; an accessibility-first pick that
matches this product's reason to exist) + IBM Plex Mono (metadata).

**Layout:** one intimate column (a desk, not a poster). The lede sits dim at
the top like the room; the lead action is the lit object; the shelf is a set of
quiet dim rows below — objects on the desk, not dashboard cells.

```
│ today · pkms        wed jul 2 │  ← tiny dim mono masthead
│ [ find or capture …        ⌕ ]│
│                               │
│ Yesterday you were in Alpha,  │  ← lede: display face, dim room
│ drafting the intro.           │
│   ╭─────────────────────╮     │
│   │    ~ soft amber ~   │     │  ← THE LAMP: radial glow falls
│   │ continue            │     │    on the lead action card —
│   │ Open Alpha          │     │    brightest thing on the page
│   │ ▶ open the outline  │     │
│   ╰─────────────────────╯     │
│ on the desk ────────────────  │  ← dim shelf rows
│ to fold in · read next ·      │
│ still curious? · done today   │
```

**Signature:** the lamplight — one soft radial glow that falls on exactly one
object per surface (today → the lead action; capture → the text field). Light
*is* the hierarchy: "one next action" stops being a rule the copy follows and
becomes the physics of the page.

**Why it isn't the generic default:** the AI-default dark page is neutral
near-black with one acid accent and techy grotesque/mono type. This is a warm
umber room where light has falloff and texture, the body face is a humanist
accessibility face, and the accent is a light source, not a highlighter.

---

## Direction 2 — Platform 9 (wayfinding)

**Thesis:** every glance is a station sign — where you are, the one next
departure, nothing else on the board.

**Palette:** deep pine `#14332c`, chalk `#f4f6f0`, saffron line-badge
`#f0c93f`, slate `#7c8f89`, moss `#9fbf9a`.

**Type:** Archivo (expanded, signage display) + Public Sans (body) +
Space Grotesk (line badges).

**Layout:** horizontal signage bands — masthead band, one "next departure"
band with the task's ⏱ size in a circular line-badge chip, then small-print
rows for the shelf.

```
│ PKMS ▸ today            jul 2 │
│ ┌───────────────────────────┐ │
│ │ (30m)  ALPHA — draft intro│ │  ← the departure band
│ └───────────────────────────┘ │
│ fold in · read next · wins    │
```

**Signature:** the departure band with its line-badge chip.

**Why rejected:** signage authority reads institutional-managerial — the exact
register PRODUCT.md's brand personality forbids ("structured, but never
managerial"). Saffron flirts with urgency-yellow, and a "board" is one
metaphor-slip away from the banned dashboard.

---

## Direction 3 — Blueline Marginalia

**Thesis:** the vault is a manuscript in progress; the UI is the pencil-and-ink
marginalia a kind editor left overnight.

**Palette:** cool gesso `#f2f3ef`, graphite `#33383b`, iron-gall blue
`#35558a`, pencil `#8d949b`, leaf `#4a8f5d`.

**Type:** Newsreader (text serif with true italics) + a humanist sans + mono.

**Layout:** a text column with a real margin column; whys, sizes, and
breadcrumbs live in the margin as annotations with ink-blue underlines.

**Signature:** the living margin.

**Why rejected:** it is the closest to the banned cream+serif default — a
light serif page with the accent swapped from terracotta to blue reads as a
*refresh* of Log Book II, and the brief explicitly says reinvent, don't
refresh. The margin column also fights the Pixel-6-first constraint (412px
leaves no honest margin).

---

## The pick: Lamplight

Justified against the three required axes:

1. **ADHD single-user.** The design language demands calm-by-default, one next
   action, and a system that "gets dumber, not smarter" in a deep low. A dim
   room with one lit object is that spec rendered literally: salience is
   rationed by physics (brightness), not by policy. Nothing else on the page
   can compete with the lamp because nothing else is lit.
2. **Mobile-first.** The new tab / PWA is opened in bursts all day and at
   night on a phone. A warm dark surface lowers glare and stimulus on OLED,
   and the single-column desk layout is native to a 412px viewport instead of
   being a poster reflowed down to one.
3. **The design language.** Every keep-constraint maps cleanly: red never
   appears; wins are fern pebbles that catch the light (loud only at PAGE
   CLEARED); the resurface question is a moss whisper; counts stay curated;
   capture inherits the lamp (the field is the lit object), which honors
   "capture is sacred" visually.

Accessibility floor, checked at pick time (WCAG relative-luminance math,
normal text on Night `#211b15`): Bone 13.5:1, Dim bone 6.3:1, Lamp 8.6:1,
Moss 7.6:1, Fern 8.5:1 — all AA (most AAA). Lamp-filled controls carry
near-black ink at 8.6:1. `prefers-reduced-motion` collapses the glow to a
static state; focus rings are lamp-colored and 2px.

Boldness budget: spent once, on the light. Everything else — type scale,
spacing, shelf rows, lists — stays quiet and disciplined so the one lit object
keeps its meaning.
