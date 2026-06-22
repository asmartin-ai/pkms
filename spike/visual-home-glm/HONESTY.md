# Honesty section — bends, interpretations, and the forbidden-pattern audit

The brief asks for an explicit honesty pass: anywhere I bent, was unsure, or had
to interpret a hard bound, flag it so it can be reviewed. This doc also carries
the per-item checklist confirming each forbidden pattern is absent from the
mockup.

---

## Interpretations and bends

### 1. `inbox_new` rendered only as forward-only progress — deliberate non-use

**The hard bound (1, §3):** "No raw backlog counts, anywhere. Allowed progress
mechanics, both forward-only: finishable batch progress ('3 of 7') and wins-only
pebbles."

**What the API gives me:** `inbox_new: 3` — a raw integer (`today.py:178`).

**What I did:** rendered it exclusively as `[ 2 / 5 ] 3 new to fold in` — a
finishable batch progress chip. The numerator is `done_today + session dones`,
the denominator is `inbox_new + done_today`. I never display `3` as a standalone
count or badge.

**Flag:** the numerator/denominator composition is my interpretation. The design
language specifies the *form* ("3 of 7") but not which numbers compose it. An
alternative reading: numerator = items folded in *from today's inbox specifically*,
denominator = `inbox_new` only. My version (`done_today + inbox_new` as the
batch) treats the day's work as one finite batch, which I think reads more
finite/inviting, but it's a judgment call. **Review this.**

### 2. Daily `goal` on pebbles — default OFF

**The hard bound (8, §8):** "Zero settings sprawl. The ONE sanctioned
personalization knob is a salience/density control."

**What I did:** the `pebbles` payload includes an optional `goal` field, but
it's `null` by default. The UI renders pure wins-only ("2 wins today") unless a
goal is set, and there's **no UI to set a goal** — that would be a second
personalization knob, which is forbidden.

**Flag:** even *having* the field in the data contract flirts with the ban. My
rationale: a daily goal is honor-system and forward-only (resets without debt,
§3), so it's not *sprawl* in the streak/overdue sense — but if you want to be
strict, drop the field entirely and the mockup loses nothing. **Defer to your
read.**

### 3. 5s undo on "let it go" — a small extra confirmation

**The hard bound (5, §5):** "Every machine offer carries a guilt-free 'let it go'
(forever-exit)… declining forever must be as cheap as accepting, with no extra
confirmation beyond the standard undo."

**What I did:** clicking "let it go" immediately dismisses the resurface card
(no confirm modal) and shows a 5s undo toast ("let go. you can undo if not.").

**Flag:** the toast is the "standard undo" mechanism I use everywhere (done
toggles, capture). But it does mean the user sees a *tiny* acknowledgment after
"let it go," which could be read as a quasi-confirmation. I think it's within
bounds — the action has already happened, the toast is reversible, and it's the
same channel used for every other undo in the app (so it's not singling out
"let it go" as drastic). **But this is exactly the kind of thing the design
language is precise about, so flagging it.** Alternative: no toast at all on
"let it go" — silent forever-exit. I found that scarier in usability (no visible
feedback that the dismiss took effect), but it's arguably more rule-pure.

### 4. Salience knob placement — does top-right invite tinkering?

**The hard bound (8, §8):** "Ship opinionated and finished-feeling, with zero
settings sprawl."

**What I did:** put `calm / more / everything` top-right in the masthead.

**Flag:** top-right placement is the conventional "settings" corner, and even
though this is the *one sanctioned* knob, putting it in the settings-spot might
cue "there are more settings here" to a user who scans for that pattern. Two
mitigations I considered: (a) move it to the bottom of the page (less
discoverable, less tinkering-cue), or (b) make it a footer link ("adjust how
much you see"). I kept top-right because the knob is genuinely useful on every
load and hiding it would harm the calm-level use case. **Review whether the
placement is a tinkering cue in practice.**

### 5. Serif display + warm cream — strong aesthetic bets

**Not a hard-bound issue, but an aesthetic-honesty flag.** The Fraunces-on-cream
direction is distinctive (the point), but "distinctive" cuts both ways: some
users will read it as "precious" or "twee" rather than "authored." I'm confident
in the call — the serif is what kills the SaaS read, and the brief explicitly
asked for a design that feels designed, not generic — but it's a real bet, not a
safe one. If you want a less committed version, swapping Fraunces for a quieter
serif (e.g. Source Serif) softens it without abandoning the editorial frame.

### 6. Recognition-search at page bottom — prominence interpretation

**The hard bound (3, §5):** "Search is the fallback, NEVER the front door."

**What I did:** search is not in the primary nav as a hero; it's a small italic
affordance at the bottom of the today view, plus a dedicated `#search` route
reachable from the nav as a tiny "find" link (right-aligned, after a spacer).

**Flag:** having *any* nav link to search is a prominence choice. I placed it
right-aligned and last, visually de-emphasized, and labeled it "find" rather
than "search" to soften the cue. But a strict reading of "search is the
fallback, never the front door" might argue for *no* nav link at all — only the
bottom-of-page affordance. I kept the nav link because the `#search` route is
also the recognition-picker surface, which *is* a recognition-first (not
recall-first) tool and thus in-bounds. **Review whether the nav link is too
prominent.**

### 7. Seven proposed endpoints — is that too many?

**The concern (§9):** "Automation must not silently grow a bigger look-at-later
pile." More broadly, every endpoint is a maintenance surface and a future
misuse-vector.

**What I did:** proposed 7 endpoints beyond `/api/today`, tiered by priority
(essential / nice-to-have / optional / edge).

**Flag:** only 2 are **essential** (`/api/today` already exists; `/api/recognition-cards`
is a one-line wrap of an existing function). The other 5 are explicitly marked
optional and gate only the `more`/`everything` density levels and the secondary
surfaces (reading queue, full actions list, search). The calm-default front door
needs only the essential tier. **If you want a stricter contract, drop tiers
🟠 and 🔵 from DATA-CONTRACT.md and the mockup still works at calm/more.**

### 8. `done_when` — a proposed new field

**The hard bound (4, §6):** "Each task can show: ⏱ a size, ▶ a concrete
~10-minute first action, ✓ a done-when."

**What the API gives me:** `next_actions[]` has `size` and `first_action`
(`today.py:66-67`) but **no `done_when`** — the `✓` extraction pattern isn't
implemented in `tasks.py:46-53` (only `⏱` and `▶`).

**What I did:** in the mockup's fake data I included `done_when` on each action
(to honor the brief's anatomy). In the real app I'd fall back to `text` if
`done_when` is absent (the code already does this: `a.done_when || a.text`).

**Flag:** to fully deliver the `✓ done-when` part of the anatomy, `tasks.py`
needs a new extraction rule parallel to the existing `⏱`/`▶` parse. This is a
small read-only addition (parses a `✓` marker from the task text) but it *is* a
code change, flagged in DATA-CONTRACT.md. **Not in scope for this design pass.**

### 9. Capture filename slug — minor fidelity choice

The real `/capture` endpoint returns `saved ✓ <filename>` (`capture_service.py`).
I fake the filename as `<ISO date>-<slug>.md` where slug is derived from the
first 30 chars of the captured text. The real slug algorithm may differ. **Pure
mockup fidelity issue, not a bound issue — flagging in case the real filename
format matters for the review.**

### 10. The `more_notes` accordion shows different items than the API implies

**Subtle correctness flag.** `today.py:183` computes `more_notes = max(0,
len(actions) - MAX_NOTES_SHOWN)`. The mockup's `renderMoreNotes()` slices
`TODAY.next_actions.slice(MAX_NOTES_SHOWN - more + 1)` to get the overflow items
— but since the mockup's `next_actions` array only has 8 items total (== MAX),
`more_notes` should be 0 by that formula, not 4. I hard-coded `more_notes: 4` in
the fake data to exercise the accordion UI. **This is a mockup-only
inconsistency — the real API's `more_notes` is always consistent with the array
length. Flagging so the reviewer doesn't read it as a logic bug in the design.**

---

## Forbidden-pattern absence checklist

The design language and the brief enumerate the patterns that must NOT appear.
For each, I confirm it's absent from the mockup and name the check.

| Forbidden pattern | Present? | How confirmed absent |
|---|---|---|
| **Obsidian-style vault graph** | ❌ absent | No `<canvas>`, `<svg>` graph, or graph component anywhere in `index.html`/`app.js`. The whole vision rejects it (RATIONALE.md §"What I rejected"). |
| **Wall/grid of every item** | ❌ absent | No grid-of-items layout. `cards` grid is for ≤3 recognition cards only (capped by `k=3`). The full backlog is never shown by default — only via the `everything` density level, never the default (bound 8). |
| **Unread counters** | ❌ absent | `inbox_new` is never rendered as a standalone number. Grep `app.js` for `inbox_new`: only used inside the fold-in batch-progress composition, never as a count display. |
| **Overdue counters** | ❌ absent | No `overdue` field is read or rendered. The word "overdue" appears only in the *negation* ("Nothing's overdue") in the gap-day lede. |
| **Streaks / streak flames** | ❌ absent | No `streak` field, no flame icon, no consecutive-day logic. Pebbles reset daily with no debt (§3). |
| **Red notification badges** | ❌ absent | **No red anywhere in `styles.css`.** The color tokens (lines 11–27) are: cream, ink, ochre, sage, green-gold. Red is documented as a deliberate absence (styles.css §1 comment: "Never used: red"). |
| **Red dots** | ❌ absent | Same as above — no red. The only dot-like elements are pebbles, which are green-gold (completion only). |
| **"You haven't…" copy** | ❌ absent | Grep the rendered strings in `app.js`: no "you haven't," no "it's been N days since…" The gap-day lede says "It's been a few days. Nothing's overdue…" — welcoming, not billing. |
| **Shame/criticism copy** | ❌ absent | All copy reviewed: "when something sparks," "come back when something sparks," "nothing owed. go well," "that's fine." No assignment language. |
| **Settings-heavy preferences screen** | ❌ absent | No `#settings` route. No preferences page. The salience knob is the single personalization surface (3 pill buttons), and it's a client-side toggle, not persisted. |
| **Plugin ecosystem UI** | ❌ absent | No plugin slot, marketplace, or extension surface. |
| **Blank search box as the front door** | ❌ absent | Search is not in the masthead or primary nav as a hero. It's a bottom-of-page affordance + a de-emphasized "find" nav link. The `#search` route opens with recognition candidates first, free-text input second. |
| **Time/clock-based resurfacing** | ❌ absent | Resurface is event/session-initiated in the mockup (shown once per load, dismissed → gone). No "review Friday 9am" or scheduled-prompt logic. |
| **Synthetic deadlines / countdown theater** | ❌ absent | No `due_date`, no countdown, no "expires in 3 hours" copy. Sizes are `⏱ 30m` (effort), not deadlines. |
| **Visible deletion without user control** | ❌ absent | "Let it go" is explicitly reversible (5s undo). No item is ever shown as deleted; the copy is "rest" language, not "delete." |
| **Badges/modals/alerts as disclosure** | ❌ absent | The only disclosure channel is the bottom-center toast (ambient, dismissable, auto-hide). No modals exist in `index.html`. No alert/prompt/confirm calls in `app.js`. |
| **Review debt** | ❌ structurally impossible | No "review queue" concept exists. Resurface is one prompt at a time, dismissible. Missed days produce no debt (gap-day lede softens). |
| **Raw "total" count of items** | ❌ absent (in UI) | The proposed `/api/next-actions` payload includes `total` for completeness, but the mockup UI never renders it. `more_notes` (the overflow count) is shown as "N more one click away" — an invitation, not a debt number. |
| **Harsh mechanic names in UI** | ❌ absent | No "bankruptcy," "purge," "expire." The harshest UI copy is "let it go" (gentle). |
| **Re-presenting identity/entertainment as work** | ❌ N/A | The mockup's fake data is all work/knowledge items (projects, reading, research). No memes/fandom in the fake payloads. |
| **Same content both nagged AND expired** | ❌ N/A | Only one resurface candidate exists in the fake data; it's either shown-once or let-go, never both. |

---

## What I'm genuinely unsure about

1. **Whether the serif reads as "authored" or "precious" to you.** This is the
   biggest aesthetic bet and the one I can't verify without your eye. (See
   honesty flag #5.)
2. **The fold-in numerator/denominator composition.** (See honesty flag #1.)
3. **Whether the salience knob's top-right placement cues tinkering.** (See
   honesty flag #4.)
4. **Whether `goal` on pebbles should exist at all, even defaulted off.** (See
   honesty flag #2.)
5. **Whether the "find" nav link is too prominent for "search is the fallback."**
   (See honesty flag #6.)

These five are the ones I'd most want your read on before any of this moves
toward production.

---

## What I did NOT do (and why)

- **Did not look at the current `TODAY_APP` or the `feat/visual-home` branch.**
  The brief was explicit: blind take, compare-don't-refine. I stayed strictly in
  the data layer to map the contract, and avoided all visual/HTML constants of
  the existing app.
- **Did not wire to the live app.** All data is inlined fake JSON; all
  mutations (done, dismiss, capture save) are client-side simulations. Per
  brief deliverable 1.
- **Did not propose any change to the capture path or the underlying vault
  files.** Those are sacred/regenerable. The proposed endpoints are all
  read-only over the existing index + frontmatter.
- **Did not add a dark mode, theme picker, or any second personalization
  surface.** One knob, full stop (bound 8).
- **Did not implement the board/graph view.** Gated behind `everything` in the
  data contract as a possible future, never the default — and not built in this
  mockup.

