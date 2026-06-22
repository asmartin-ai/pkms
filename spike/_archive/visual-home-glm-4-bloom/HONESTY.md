# Honesty — the "bloom"

## Interpretations and bends

### 1. THE FLAG: proposed `rhythm` field on next_actions
The Fresh/Later partition requires each action to carry a `rhythm: "fresh"|"later"`
field. **This field does not exist in the real `/api/today` contract** —
`next_actions[]` has `note/title/text/size/first_action` only
(`today.py:64-68`). I added `rhythm` to the mockup's fake data to exercise the
partition UI.

**To ship this for real**, `tasks.next_action_per_note` would need to derive a
rhythm classification. Options: (a) parse a frontmatter `rhythm:` field per
note, (b) derive from `size` (≤15m = fresh, >15m = later — crude but automatic),
(c) derive from tags. None of these are in scope for this design pass. **The
partition is the single biggest new-data ask in any of the four mockups.**
Review whether it's worth it.

**Fallback if you don't want a new field:** drop the partition entirely and
the bloom UI still works (just a single actions list, like #1/#2). The pastel
aesthetic stands on its own without it.

### 2. Half-life label is a mock — the algorithm doesn't exist
The `halflifeLabel()` helper derives a friendly string from the promoted date
(`"recall fading gently"` for <7d, `"ready to resurface"` for 14–28d). **This
is a deterministic mock of what should be a probabilistic algorithm.** Readwise
actually computes recall probability per item; I'm just bucketing by age. To
ship this for real, you'd need a real half-life model over the notes (which
touches the index). **Flagging as a design aspiration, not a contract.**

### 3. Pastel saturation — sensory-calibrated, but not for everyone
The palette is deliberately low-saturation (Tiimo-influenced). **Flag:** some
users (especially users with certain color-vision deficiencies or simply
different aesthetic preferences) may find the rose/sky/sage/honey/lavender mix
*muddy* or hard to distinguish. I tested the hue spread mentally (rose≈350°,
sky≈210°, sage≈90°, honey≈45°, lavender≈270°, mint≈135°) — they're spread
enough to be distinguishable in normal vision, but deuteranopia would compress
rose/sage/honey. **Review with CVD sim if this becomes the chosen take.**

### 4. "The garden" framing — metaphor consistency
I use garden/bloom language throughout ("the garden keeps it," "fresh bloom,"
"🌱 ornamental glyphs"). **Flag:** this is the most metaphor-heavy of the four
takes. If you find it cloying, the metaphor strips out cheaply (one-word swaps:
"garden" → "system," "bloom" → "edition," drop the 🌸/✿ glyphs). I judged it as
matching the gentle/research-backed tone, but it's a real bet — see #1's
HONESTY.md for the same "precious vs. authored" risk, amplified here.

### 5. Pebbles as named pills — visual weight vs. dots
#1/#2/#3 render pebbles as small dots (very quiet). #4 renders them as **named
pills** with a dot + label ("• folded the F6 promote fix"). **Flag:** this
gives wins more visual weight, which suits the Things 3 Logbook pattern — but
it also means a day with 10 wins produces a large-ish pill row, where 10 dots
would be compact. I judged named wins as more *legible as success* (you can
read what you accomplished), at the cost of footprint. **Review.**

### 6. The 🌸 glyph in breadcrumb sub-list — emoji risk
I used `🌸` as the bullet for the breadcrumb sub-list lines. **Flag:** emoji in
a "production-grade" UI is risky — rendering varies across platforms, and it
can read as cute rather than designed. I picked a single low-opacity flower to
match the bloom metaphor, but this is the one place I'd reach for a custom SVG
glyph in a real build. **Review or replace.**

### 7–11. Shared with #1
The fold-in numerator/denominator composition, `goal` default-off, 5s undo on
let-it-go, salience knob placement, and capture filename slug interpretations
are **identical to #1** — see `spike/visual-home-glm/HONESTY.md` items 1, 2, 3,
4, 9. Not re-flagged here.

---

## Forbidden-pattern absence checklist

| Forbidden pattern | Present? | Confirmation |
|---|---|---|
| Vault graph | ❌ | None. |
| Wall/grid of every item | ❌ | Bloom = 1 hero; rhythm = bounded 2-col with ≤4 items each; ambient = 2 cards. |
| Unread counters | ❌ | `inbox_new` only in fold chip. |
| Overdue counters | ❌ | None. Gap lede: "Nothing's overdue." |
| Streaks | ❌ | None. Logbook is wins-only, no consecutive logic. |
| Red badges / dots | ❌ | 11 color tokens: dawn + 6 pastels (blossom/sky/sage/honey/lavender/mint) + ink + mint. **No red.** No saturated colors. |
| "You haven't…" copy | ❌ | Grep confirms. |
| Shame copy | ❌ | "the garden keeps it," "that's fine," "rest well." |
| Settings screen | ❌ | One knob. |
| Blank search as front door | ❌ | Bottom affordance + "find" nav. |
| **Time/clock-based resurfacing** | ❌ | **Half-life label explicitly replaces clock-based disclosure.** The Fresh/Later partition is also non-clock. |
| Synthetic deadlines | ❌ | Effort sizes only; rhythm is energy-based, not deadline-based. |
| Visible deletion | ❌ | Let-it-go has 5s undo. |
| Modals/alerts | ❌ | Toast only. |
| Review debt | ❌ | Impossible. |
| Harsh mechanic names | ❌ | "let it go" is the harshest. |

**Note on the "no clock" property:** #4 is the only one of the four mockups
that *explicitly* addresses the no-clock rule with a replacement mechanism (the
half-life indicator). That's the research-informed contribution.
