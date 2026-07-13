# S1 (notifications & reminders) — decision gates for Kenja

*Prepared 2026-07-06 (agent, autonomous run). Updated 2026-07-12 (M2 ruff pass
session): added implementation implications and next-step framing.*

**Quick summary:** S1 is the notification/reminder layer — the system gently
nudging you about resurface picks, reading-queue items, or reshape-clock events.
It's blocked on design: three decisions you make before any code is written.
One question per sitting is fine; they're ordered.

**Constraints already binding** (from build-plan + 10-synthesis + design language):
ration aggressively (alert acceptance drops ~30% per repeat), one ambient
surface, varied form, event-anchored (never clocks), silently-decaying queue,
zero guilt framing. No streaks, no counts, no "you haven't…".

---

## Q1 — Delivery channel (pick ONE ambient surface)

| Option | What it is | Build cost | 
|---|---|---|
| **A. Today-view card** | Quiet slot in the surface you already open. Zero new infrastructure; only fires when you show up (self-rationing). | XS — a new `#notifications` block in `app.js` + a data source |
| **B. Discord DM** | The slice-8 bot gains a send direction. Reaches your phone with no new app; you already live in Discord. | Medium — `discord.py` send path + per-user DM routing |
| **C. Phone push (PWA)** | Most "ambient," most invasive, most new moving parts (service-worker push plumbing + a push service). | Heavy — SW push API, push service integration, permission flow |

**Recommendation:** A now (zero-infra, self-rationing). Revisit B only if
away-day resurfacing proves to matter during the Phase 5 dogfood window.

**▶ Kenja: which channel?** A / B / C / defer-all

---

## Q2 — What EARNS a notification (cap the set hard)

Pick ≤2 to start. The build cost scales with the data source.

| Candidate | Rationale | Data source |
|---|---|---|
| **Resurface pick of the day** | Already rationed to ≤3 by design; the most natural notification source. | `today.resurface_offers()` — already exists |
| **Reading-queue nudge** | When something's been "next" for 14+ days — a quiet "still interested?" | `today.reading_queue()` — already exists |
| **Reshape-clock events** | `[~]` not-now items hitting their reactivation window. Most event-anchored option. | `tasks.stale_tasks()` — already exists |
| **Defer all** | No notifications until after Phase 5 review — let the dogfood window tell us what's missed. | Zero build cost |

**▶ Kenja: which ≤2 earn a ping?** resurface / reading / reshape / defer-all

---

## Q3 — Interaction with the reshape clock

| Option | What it means |
|---|---|
| **A. Notifications ARE the reshape surface** | The 14d clock's events become the only reminder source. Reshape items surface through the notification channel instead of the today-view. Simpler: one surface for time-sensitive things. |
| **B. Separate lanes (recommended)** | Reshape stays a today-view-only surface (as it is now). Notifications only carry resurface/reading picks — items that benefit from an ambient nudge. Less coupling, easier to tune each independently. |

**▶ Kenja: A or B?**

---

## Non-decisions (already settled — do not reopen)

Event-anchored not clock-anchored · decaying queue (unacted reminders vanish
silently, never accumulate) · no streaks/counts/guilt copy · one notification
at a time (the desk is quiet) · build is a separate packet after these
decisions land in `decisions.md` + `build-plan.md`.

---

## Next step after decisions

Agent writes a slice-shaped spec into `build-plan.md` (S1 row). Build is a
separate packet — spec-first per the delegation-roadmap §6 rule.
