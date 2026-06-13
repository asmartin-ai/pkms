---
name: resume
description: Re-entry breadcrumbs for the PKMS — read back where Kenja left off at session start, or write the breadcrumb at session end. Use when the user says /resume, "where was I", "what was I doing", or signals wrapping up ("done for today", "stopping here", "wrapping up").
---

# /resume — breadcrumb at the breakpoint

The killer cost is "Monday with zero memory of Friday" (§7). This skill has two
modes; pick by context, never ask which.

## Read mode (session start, "where was I")

1. Run `pkms today` — its breadcrumb block is the newest daily note's `## breadcrumb`
   section (today's own note counts; same-day re-entry is normal).
2. Present, briefly: where things stopped, then **ONE suggested next action** — the
   smallest concrete ▶ from the breadcrumb or the today-view next-actions list.
   Never enumerate everything; the backlog stays one command away (`pkms tasks`).
3. End with an invitation, not an assignment ("whenever you're ready", not "you
   should"). You may include **at most one** "still interested in X?" question (G8)
   and only when something specific is actually pending — zero is fine and usual.
   The strongest candidate for that one question is a **reshape offer**: check
   `pkms tasks --stale` (tasks untouched 14+ days); if any, pick ONE and offer it
   with a *smaller* ▶ first action you write yourself, as a pick:
   **smaller** (apply the new ▶ — edit the task line) / **not-now** (flip marker
   to `[~]`) / **stash** (flip to `[i]`). Editing the line resets its clock
   automatically. Never present more than one, never mention how many are stale,
   never use the word "overdue". A reshape offer and a still-interested question
   share the same budget of one.
4. If there is no breadcrumb anywhere: that is a fresh start, not a failure — say so
   in one line and offer the today-view as the door.

## Write mode (session end, "wrapping up")

1. Ensure today's note exists: `pkms daily --no-open`.
2. Replace the content under `## breadcrumb` in today's daily note (keep the heading;
   the slot holds the *latest* state, not a log) with 2–4 plain lines:
   - what was in motion, in Kenja's words not jargon;
   - the exact stopping point ("stopped at: …");
   - `▶ ` one concrete ~10-minute first action for next time (task-initiation beats
     task-importance — make it startable, not impressive).
3. If work was finished this session, note it under `## folded today` or the
   breadcrumb's first line — done things stay visible (§6).
4. Confirm in one quiet line: "breadcrumb set — next time opens here." Do not
   summarize the whole session back; the breadcrumb is for re-entry, not record.

## Copy rules (constraints, not style)

- Never mention elapsed time since the last session; gaps are welcomed back, never
  billed (§3).
- The suggested next action is an offer, not homework. No urgency words, no
  deadlines, no "just" ("just finish X" reads as billed effort).
- Plain language over completeness — a breadcrumb that takes 10 seconds to read
  beats a thorough one.
