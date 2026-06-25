# Rationale — the "daily edition"

> The front door reads like a short, finite, hand-edited morning briefing —
> a chief-of-staff's memo — not a dashboard. The single aesthetic bet that
> kills the "AI dashboard" read: **editorial serif display type on warm paper,
> one ochre accent, one loud moment reserved for completion.**

This doc walks the big moves, names the binding rule each serves, and calls out
the alternatives I rejected. Rule references use the design-language section
numbers (§1–§9) and the brief's HARD BOUNDS (1–10) interchangeably — they align.

---

## The big moves

### 1. Editorial serif (Fraunces) on warm cream paper

**Serves:** Recognition over recall (§5, bound 3); "feels designed" (brief);
authored/finite read (§7, bound 9).

The single biggest aesthetic move away from SaaS is the type. Every productivity
tool of the last decade uses a humanist sans (Inter, SF, Segoe) at a humanist
scale. That's the visual signature of "app." A serif at display sizes is the
visual signature of "document someone wrote for you" — a briefing, a letter, an
edition. The product is a permanent prosthesis for a performance disorder; the
patient is being handed a note, not a console. The serif earns that read in
~200ms, before any layout is parsed.

I considered three alternatives and rejected each:

- **Inter-only, tighter hierarchy.** Reads as Linear/Notion. The brief explicitly
  forbids the generic AI-dashboard aesthetic. Reject.
- **A monospace-forward face (Berkeley/Graphik Mono).** Reads as "terminal for
  hackers" — a power-tool vibe that conflicts with "you are being briefed."
  Reject.
- **A geometric sans (Söhne/Inter Display) at huge sizes.** Fashionable, but
  reads as "startup landing page." Reject.

Fraunces specifically because it has an optical-size axis (`opsz`) and a
"SOFT"/"WONK" warmth axis — at display sizes it gets characterful, at body sizes
it stays readable. I set `opsz` per use (24 body / 36 lede / 144 stamp) so the
same family spans the whole range coherently.

### 2. Warm "bond" cream ground + a single muted ochre accent

**Serves:** Shame-free, no failure read (§3, bound 2); no red badges (§3, §5,
bound 2); calm not clinical.

The ground is `#F6F1E8` — paper, not screen-white. White backgrounds read as
"blank slate waiting for input," which is exactly the recall-demanding posture
the design language forbids (§5). Cream reads as "something's already here for
you."

The accent palette is deliberately narrow:

| Role | Color | Used for |
|---|---|---|
| Ground | `#F6F1E8` cream | page |
| Ink | `#2A2520` warm near-black | all text |
| **Ochre** | `#B8762B` | the next thing to do (actions, lead action hover) |
| Sage | `#6B8E7F` | the curious question (resurface) |
| Green-gold | `#3F8F5B` | completion only |

**There is no red anywhere, ever.** That's a load-bearing absence — red is the
color of debt and alarm, and the design language bans red badges, overdue
counters, and "you haven't…" copy wholesale (§3, §5, bound 2). A red I never
include is worth more than ten features.

I considered and rejected:

- **A blue/violet accent (the SaaS default).** Reads as Slack/Notion/Linear.
  Reject.
- **Multiple accents per surface.** Fragments the hierarchy; ochre-only for
  actions means "anything ochre = the next thing to do" — a one-to-one mapping
  the user learns in a glance. Reject multi-accent.
- **A dark mode.** Genuinely tempting (ADHD users often work at night), but a
  second theme is a settings-surface liability (§8, bound 8). Defer to a
  follow-up; not in this mockup.

### 3. The re-entry lede — breadcrumb rendered as prose

**Serves:** Re-entry beats organization (§7, bound 9); spec for the worst state
(§7, bound 9); shame-free copy (§3, bound 2).

This is the centerpiece of the front door, and the brief asks for detail here.
The first thing the user reads on load is not "Welcome back" or a widget. It's a
concrete sentence:

> Yesterday you were in **Alpha**, drafting the intro.

Below it, up to four lines from where they stopped — the actual content of the
prior day's daily note, set in a quiet mono sub-list with an ochre rule. The
whole thing reads as "your chief of staff left you a note about where you were."

**The gap-day logic** is the load-bearing edge case. When there's no breadcrumb
(no daily note yesterday), the lede softens rather than billing:

> It's been a few days. Nothing's overdue — here's where **Alpha** was when you
> last touched it.

Same anchor (the last-touched note + its last action), no shame, no "you've been
gone 5 days" counter. This is the direct application of "shame is a design input,
not a tone preference" (§3) and "gaps are welcomed back, never billed" (§3). I
rejected the alternative of a "welcome back!" widget — it reads as marketing, and
it doesn't tell the user anything actionable.

**The worst-state spec.** The `calm` density level (default) strips the
recognition rail and the actions list entirely, leaving only: masthead → lede →
lead action → fold-in progress → pebbles → invitation. In a deep low, the UI
gets dumber, not smarter — that's the direct spec from §7 ("design for the worst
state") and bound 9 ("in a deep low the UI should get simpler, not busier"). The
user can always bump to `more` or `everything`, but the default never piles on.

### 4. One lead action — the biggest, warmest affordance on the page

**Serves:** One next action per note (§6, bound 4); the backlog is one click
away, never a wall (§6, bound 4); starting is success (§6).

The first `next_actions` entry is promoted to a full-width dark button directly
below the lede. It shows:

- a quiet uppercase prompt ("THE NEXT THING"),
- the `▶ first_action` text (the concrete ~10-minute step) in serif,
- the `⏱ size` in mono beneath.

It's the single biggest target on the page on purpose: the most likely next
action is to do that one thing, so we make doing it one tap. Clicking it marks
the task done (pebble appears, micro-celebration).

I considered showing 3 lead actions and rejected it — three options is already a
list, and lists invite scanning, and scanning is the recall posture we're
avoiding. One. Then the rest in the actions block beneath.

### 5. "To fold in" — inbox as forward-only progress, never a count

**Serves:** No raw backlog counts (§3, bound 1); forward-only progress mechanics
(§3, bound 1).

`inbox_new` arrives from the API as a raw integer (`today.py:178`). The naive
rendering is "3 new" — which reads as debt. I render it exclusively as
forward-only batch progress:

> `[ 2 / 5 ]  3 new to fold in   ·   when something sparks`

The numerator is today's folded-in work (done_today + session dones); the
denominator is the finite batch (inbox_new + done_today). The chip is ochre
(progress), never red (debt). The copy is "to fold in" — an invitation, not an
assignment. The hint "when something sparks" explicitly de-urgencies it.

This is a faithful use of the two sanctioned progress mechanics from §3:
finishable batch progress ("3 of 7"). See HONESTY.md for the interpretation flag
on how the numerator/denominator is composed.

### 6. Recognition rail — curated candidates, never a blank search box

**Serves:** Recognition over recall (§5, bound 3); search is the fallback, never
the front door (§5, bound 3); at most ≤3 recognition cards (today.py:120,
`k=3`).

Below the fold-in block, a small grid of up to three cards from
`recognition_cards()` — the reading queue's next item + the resurface candidate,
round-robin'd exactly as `today.py:158-168` does. Each card shows a kind label
("reading" / "resurfacing"), a serif title, a consume-cost pill (`⏱ ~12 min`)
where applicable, and a transparent `why` line.

The point: the user can point at one and say "that one" without having to
remember what they were reading. This is the canonical recognition-first surface.
The free-text search box lives on a separate route (`#search`), reachable only
via a small italic affordance at the bottom of the today view — *"looking for
something specific?"* — explicitly framed as the fallback.

### 7. The single resurface question — italic-serif, sage, two guilt-free exits

**Serves:** Resurfacing is machine-initiated, shaped as a curious question (§5,
bound 5); one ambient prompt at a time (§5, bound 5); every offer carries a
forever-exit (§5, bound 5); no red badges / dots (§3, §5, bound 2).

Exactly one resurface card, ever. It renders the `question` field as a literal
italic-serif sentence in sage — *"Still chewing on X?"* — with the transparent
`why` beneath in mono-muted ("short · cited in 4 of your recent notes"). Two
equally-weighted affordances:

- **not now** — silent dismiss, no-renag window. No toast; silence is the point.
- **let it go** — the forever-exit, guilt-free, with a 5s undo window.

The two buttons are visually peer-weighted (same shape, same size); neither is
the "primary." That symmetry is load-bearing — "declining forever must read as
cheap and guilt-free as accepting" (§5). I rejected the obvious alternative of
making "not now" the default-style button and "let it go" a ghost link; that
asymmetry would bill the forever-exit as the drastic option, which is the
opposite of the rule.

### 8. Next actions — one per note, ⏱ ▶ ✓ anatomy

**Serves:** One next action per note (§6, bound 4); every task carries size +
first action + done-when (§6, bound 4); backlog one click away, never a wall
(§6, bound 4); consume-cost pills (§6, bound 4).

Each action item renders:

- **title** (serif, the note's title)
- **⏱ size** (mono, top-right — "30m")
- **▶ first_action** (the concrete ~10-minute step — the most prominent
  sub-element, because starting is success)
- **✓ done_when** (mono-muted — the closure criterion)
- a quiet "mark done" toggle (rounded, mono — reduce-gesture pricing: cheapest
  in reach per §2)

The first item is also promoted to the lead-action button up top (no duplication
in the list — `renderActions(listEl, leadExcluded=true)` skips index 0).

**"4 more one click away"** — the `more_notes` overflow renders as a single
underlined mono line that expands an inline accordion. Never a wall by default.
The `everything` density level reveals it all, but `everything` is never the
default (§8, bound 8).

### 9. Pebbles — wins-only, forward-only, resets without debt

**Serves:** Wins-only pebbles (§3, bound 1); no streaks (§3, §7, bound 2);
empty = reward not void (§3, bound 6).

Today's completions render as small filled dots clustered left — literal
pebbles. The caption is `"2 wins today"` (or `"N of M today"` if a daily goal is
set). The goal is **off by default** — a daily goal flirts with the settings-sprawl
ban (§8) and risks reading as a streak-with-extra-steps. Pure wins-only is the
safe default; the goal is an honor-system opt-in that never bills a miss (§3:
"a goal missed yesterday leaves no trace today").

The empty state is `"nothing finished yet — that's fine."` — not a void, not an
error, not a nag.

### 10. PAGE CLEARED — the one loud moment

**Serves:** Empty state is the reward (§3, bound 6); completion is the one place
the UI is loud (§3).

When every visible action is marked done, the middle of the today view is
replaced by a large rotated ink-stamp — **PAGE CLEARED** — in saturated
green-gold, double-bordered, with a choreographed scale-and-settle animation
(the only choreographed beat in the whole UI). Beneath: today's pebbles shown
proudly, and a soft italic line — *"nothing owed. go well."*

This is the one place the UI is loud. Everywhere else it's quiet. That contrast
is what makes the celebration legible — if everything moved, nothing would feel
earned. (Content-hoarder's "PAGE CLEARED" stamp, per §3 locked 2026-06-11.)

I rejected:

- **Confetti.** Reads as SaaS onboarding theater. Reject.
- **A popup modal.** Modals are a forbidden disclosure channel (§4); also they
  interrupt rather than reward. Reject.
- **A streak counter ("2 days!")** — explicitly forbidden (§3, §7). Reject.

### 11. Capture — its own surface, near-zero chrome, never loads the app

**Serves:** Capture latency bar <2s, zero decisions (§1); capture surface never
opens a feed / never loads the full app (§1, bound 11 from the brief's surfaces
list); capture's product is the security feeling (§1).

`#capture` is a separate hash-route. It shows one centered textarea, autofocus,
nothing else. Cmd/Ctrl+Enter saves → the textarea swaps to a big quiet
`✓ saved <filename>` for 1.5s, then returns to an empty box. Esc clears.

It does **not** navigate to the feed. It does **not** load the today view. It is
bookmarkable as its own ramp (one ramp per context, §1). The capture value is
the security feeling — the save is confirmed instantly, and "the system owns
later" (§1).

### 12. Salience knob — the one sanctioned personalization

**Serves:** Zero settings sprawl (§8, bound 8); the one bounded exception is a
salience/density control (§8, bound 8); a fuller/board view is gated behind it
and is never the default (§8, bound 8).

Top-right of the masthead: three pill buttons — `calm / more / everything`.
`calm` is the default and strips the UI to its essentials (lede, lead action,
fold-in, pebbles). `more` adds the recognition rail and the actions list.
`everything` reveals the full backlog and the search affordance.

This is the *only* end-user personalization surface in the mockup. There is no
settings screen, no preferences page, no theme picker, no plugin slot. Anything
else the user wants to change, they tell the assistant (§8: the agent is the
customization interface).

See HONESTY.md for the flag on whether top-right placement invites tinkering.

### 13. Motion — default static, one choreographed beat

**Serves:** Completion is the one loud place (§3, bound 6); respect user
preferences.

The whole UI is default-static. Hovers are typographic only (underline, weight).
The only choreographed animation is the PAGE CLEARED stamp (scale-and-settle,
~520ms) and the pebble settle on done (~280ms). Everything respects
`prefers-reduced-motion` — under that media query, even the stamp lands without
animation.

I rejected:

- **Slide-in route transitions.** Dashboard-y. Reject.
- **Skeleton loaders / shimmer.** There's nothing to load (data is inline);
  adding fake loaders would be theater. Reject.
- **Number count-ups.** The numbers we show (pebble counts, fold-in progress)
  are small and shouldn't perform. Reject.

### 14. Search — explicitly the fallback, recognition-first when it does appear

**Serves:** Recognition over recall (§5, bound 3); search is the fallback,
never the front door (§5, bound 3).

Search is not in the primary nav as a hero element — it's a small italic
affordance at the bottom of the today view: *"looking for something specific?
find it"*. The search route itself opens with the recognition-first picker
(recent notes as candidates you point at) and the free-text input is positioned
as the secondary path, with an explicit note: *"free-text is the secondary path
— recognition usually beats recall here."*

This is the load-bearing inversion. Every other knowledge tool puts a search
bar at the top; that's the recall-demanding posture the design language
explicitly forbids. I put recognition candidates first and search second, and I
labeled that ordering in the UI so the user knows it's deliberate.

---

## What I rejected at the vision level

The brief asked for one confident vision, not three timid variants. But it also
asked me to name alternatives I considered and rejected. The biggest vision-level
rejection:

- **A spatial/graph canvas.** The design language names the Obsidian-style graph
  as "the canonical abandonment artifact" and explicitly forbids it. I did not
  even sketch one. The "daily edition" metaphor — finite, authored, linear-top-to-bottom
  — is the deliberate opposite of the infinite-graph posture.
- **A kanban/board default.** Boards are walls-of-items by another name; bound 4
  forbids the wall-by-default. A board view, if designed, would be gated behind
  the `everything` salience level and never the default — I note that in the
  data-contract doc as a possible future, not a present.
- **A "second brain" / PARA-style folder hierarchy UI.** That's a
  knowledge-disorder framing; this is a performance-disorder tool. The hierarchy
  is the machine's problem (§9: "the human dumps, the machine structures"), not
  the UI's.

---

## How this gets judged — self-check

| Criterion | How the mockup delivers |
|---|---|
| **Recognize-and-act > manage-a-pile?** | Lede + lead action = recognize + act in one screen. No pile is visible by default (calm mode). |
| **Re-entry genuinely reassuring?** | Breadcrumb-as-prose names the note + the action + up to 4 lines. Gap-day softens rather than bills. |
| **Every surface clean of forbidden patterns?** | See HONESTY.md's absence checklist — each forbidden pattern confirmed absent. |
| **Aesthetic distinctive and finished?** | Serif-on-cream + single ochre + one loud moment. No SaaS tells. |
| **Rationale honest about trade-offs?** | This doc + HONESTY.md flag every bend. |

