# S1 (notifications & reminders) — decision gates for Kenja

*Prepared 2026-07-06 (agent, autonomous run). S1 is blocked on design — these
are the unmade decisions, shaped as options so the design sitting starts with
picks, not essays. One question per sitting is fine; they're ordered.
Constraints already binding (from build-plan/synthesis): ration aggressively,
one ambient surface, varied form, event-anchored (never clocks), silently
decaying queue, zero guilt framing.*

## Q1 — Delivery channel (pick ONE ambient surface)

- **A. Today-view card** — a quiet slot in the surface you already open.
  Zero new infrastructure; only fires when you show up (self-rationing).
  Weakness: silent during away-days.
- **B. Discord DM** — the bot from slice 8 gains a send direction.
  Reaches the phone with no new app; you already live in Discord.
  Weakness: shares a channel with capture; away-day pings can feel like debt.
- **C. Phone push (PWA notification)** — most "ambient," most invasive,
  most new moving parts (service-worker push plumbing + a push service).

Recommendation: A now, revisit B only if away-day resurfacing proves to
matter during the Phase 5 window.

## Q2 — What EARNS a notification (cap the set hard)

Candidates (pick ≤2 to start):
- resurface pick of the day (already rationed to 3 by design)
- reading-queue nudge when something's been "next" for 14+ days
- reshape-clock events ([~] not-now items hitting their reactivation window)
- nothing at all until after the Phase 5 review (defer S1 entirely)

## Q3 — Interaction with the 14d reshape clock and [p] reactivation

- **A. Notifications ARE the reshape surface** — the clock's events become
  the only reminder source; nothing else pings.
- **B. Separate lanes** — reshape stays a today-view-only surface; reminders
  only carry resurface/reading picks.

## Non-decisions (already settled, do not reopen)

Event-anchored not clock-anchored · decaying queue (unacted reminders vanish
silently, never accumulate) · no streaks/counts/guilt copy · build is a
separate packet after this design lands in decisions.md + build-plan.md.
