# Honesty — the "focus"

## Interpretations and bends

### 1. THE FLAG: this take might be too minimal to read as "finished"
**The brief asked for "production-grade, not wireframe."** #3 is the most
subtractive of the four — no texture, no shadows, no decoration, near-mono
palette, one hero element. There's a real risk this reads as "a minimalist
wireframe" rather than "a confident finished product" if the viewer expects
visual density as a signal of done-ness.

**My mitigation:** extreme type scale (hero at step-4/step-5), generous
whitespace, and the one choreographed moment (the cleared stamp's letter-
spacing settle). These are meant to make the subtraction feel deliberate. **But
this is genuinely uncertain — your eye will tell me in 2 seconds whether it
lands as "confident" or "empty."**

If it reads as too empty, the lowest-cost fix is: restore the paper grain from
#1 (one low-opacity layer) and add a single subtle drop-shadow on the DO button.
That's ~10 lines of CSS and would restore "physical object" feel without
abandoning the minimalism.

### 2. Serial hero with no way to skip the current item
The hero shows the first not-done action. If the user doesn't want to do *that*
one, they have to open "what else is here" and mark something else done (or
mark the hero done to rotate it). **Flag:** there's no "not now" on the hero
itself. I judged this as correct — the hero is the machine's best guess at the
one thing, and "not now" lives on the resurface card (where the design language
puts it). But a user who repeatedly doesn't want to do the hero item has no
graceful way to advance it without either doing it or opening the drawer.
**Review whether the hero needs a quiet "next" affordance.**

### 3. "Begin →" as the verb
The DO button says "begin →" — the lightest possible action verb. **Flag:**
considered alternatives were "do it" (too generic), "start" (fine but flat),
"→" alone (too cryptic). "Begin" has a slight formal/archaic tone that suits
the stripped-back aesthetic but might read as precious. One-word change if it
lands wrong.

### 4. Display sans at hero scale — the "scale not family" bet
I'm using Inter (the SaaS default) but at step-4/step-5, where it reads
completely differently than it does at 1rem. **Flag:** this is a real bet, not
a safe one. If you read the hero and it still feels "SaaS," the fix is to swap
to a more characterful humanist sans (Söhne, Inter Display, or a paid face) —
the scale alone may not be enough to escape the Inter association for some
viewers.

### 5. The "what else" drawer defaults closed even at `everything` density
Even at `everything`, the drawer starts closed and the user must open it.
**Flag:** this is the strictest possible reading of "backlog one click away,
never a wall by default" — but it means `everything` doesn't really mean
"everything visible," it means "the toggle to reveal everything is available."
An alternative reading: at `everything`, the drawer should auto-open. I judged
that defeats the point of this take (serial single-focus). **Review.**

### 6–10. Shared with #1
The fold-in composition, `goal` default-off, 5s undo on let-it-go, salience
knob placement, and capture filename slug interpretations are **identical to
#1** — see `spike/visual-home-glm/HONESTY.md`. Not re-flagged.

---

## Forbidden-pattern absence checklist

| Forbidden pattern | Present? | Confirmation |
|---|---|---|
| Vault graph | ❌ | None. |
| Wall/grid of every item | ❌ | **No list visible by default at all** — strictest possible. |
| Unread counters | ❌ | `inbox_new` only in fold chip. |
| Overdue counters | ❌ | None. Gap lede: "Nothing's overdue." |
| Streaks | ❌ | None. |
| Red badges / dots | ❌ | 4 color tokens only: void, ink, graphite, green. No red, no ochre, no sage. |
| "You haven't…" copy | ❌ | Grep confirms. |
| Shame copy | ❌ | "nothing owed. go well," "that's fine." |
| Settings screen | ❌ | One knob. |
| Blank search as front door | ❌ | Bottom affordance + "find" nav. |
| Time-based resurfacing | ❌ | Session-initiated. |
| Synthetic deadlines | ❌ | Effort sizes only. |
| Visible deletion | ❌ | Let-it-go has 5s undo. |
| Modals/alerts | ❌ | Toast only. |
| Review debt | ❌ | Impossible. |
| Harsh mechanic names | ❌ | "let it go" is the harshest. |

**Note on the "no list" property:** #3 is the only one of the four mockups
where the actions list is *literally not in the DOM's visible flow by default*.
That's this take's distinctive contribution to the set.
