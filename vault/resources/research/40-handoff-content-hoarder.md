---
title: Handoff — PKMS research takeaways for content-hoarder
tags: [pkms-design, research, adhd, handoff, content-hoarder]
created: 2026-06-10
modified: 2026-06-10
status: sent
---

# HANDOFF: ADHD-PKMS research findings → content-hoarder updates

**Context (you have none from the source session — this is self-contained):** Aaron just completed a multi-sweep research program (community anecdotes from HN/Reddit/YouTube/GitHub, Barkley executive-function theory, academic literature, and read-only mining of content-hoarder's own DB) to design an ADHD-friendly PKMS at `K:\Projects\PKMS`. Several findings bear directly on content-hoarder. Your job in this chat: review these takeaways with Aaron and plan which to adopt in content-hoarder itself. The PKMS is a separate sibling system — content-hoarder stays the triage inbox / system of record for raw saves.

**Evidence on disk (read as needed, all in `K:\Projects\PKMS\vault\resources\research\`):** `17-hoarder-mining.md` (findings CH1–CH14 from content-hoarder's own DB), `10-synthesis.md` (full synthesis, six research questions), `32-theme-retrieval.md`, `33-theme-inbox-pipeline.md`. Finding IDs below refer to those files.

## The headline facts from content-hoarder's own DB (verified read-only this week)

- **97.55% of 84,250 items have never left `status='inbox'`** — only ~2,060 items were ever triaged in the app's lifetime (CH1). Per-item review of the backlog has never happened and never will.
- **~80% of the hoard is entertainment** (NonCredibleDefense ~4k, anime/hololive ~5.5k, gaming…) while knowledge-relevant subs are a thin slice (CH11).
- **Saving is Aaron's only durable behavior** — 55/55 months active on HN favoriting since Nov 2021; processing never stuck (CH10, CH2). The one-tap save path is sacred.
- **The thread archive is half of Aaron's #1 wish:** `reddit_threads` already caches 672 full post+comment-tree JSONs, and he saved 9,593 individual comments — he wants to deep-read discussions later, and they currently get buried (CH6).

## Takeaways to consider adopting (strongest first)

1. **Stop treating the inbox as processable.** Design for promote-on-demand (search/pull when a need arises) + guilt-free bulk decay. No per-item review queue, no "82,190 unprocessed" framing anywhere in the UI — backlog counts read as failure and drive abandonment (CH1; synthesis RQ6).
2. **Source-level prefilter:** score/partition by subreddit/source so triage attention never lands on the ~80% entertainment bulk; entertainment gets a separate, shame-free fate (auto-archive) (CH11).
3. **Resurfacing as a curious question, never a count badge.** A small "Still interested in X?" card beats any unread counter. Recognition beats recall for ADHD (academic: encoding is impaired, retrieval intact) — show candidates, don't rely on Aaron searching (32-theme-retrieval #1, #3).
4. **A bounded "surprise me" card** (random old save, tiny fixed sample) converts the rare rediscovery-joy that already sustains his saving habit into a deliberate retention loop. Variable, bounded, user-pulled (32-theme-retrieval #4).
5. **Swipe-grade triage if/when triage UI is touched:** one item at a time, keep / promote / let-go, with an LLM pre-suggesting the destination so the human only confirms. Never a form, never a folder picker, never the full list (SD11 in 19-seed-links.md).
6. **Classify identity/meme vs actionable at ingest or triage** — resurfacing a 3-year-old meme as if it were a task is noise; the 30 ADHD_Programmers strategy posts are the signal (CH3).
7. **Promote pipeline to the PKMS vault (coordination point, don't build yet):** the PKMS will want to pull a saved thread and render post+comment-tree JSON to markdown at promote time. content-hoarder's side is mostly done (reddit_threads); what's missing is a clean read/export path (CH6). Also: Reddit's native saves silently cap at ~1000, so hydration cadence matters — the archive, not Reddit, is the system of record (12-reddit.md F20).
8. **Never display re-open rates or read-percentage as health metrics.** The act of saving is itself cognitive offload with lab backing; a 0% re-open rate is not failure (SD9).
9. **If notifications/digests exist or get added: ration hard.** Alert acceptance drops ~30% per repeat; one ambient surface, varied form, silently-decaying queues, no accumulating debt (16-academic.md SC8, RT6).
10. **Progress feedback that survives ADHD use: finishable progress ("3 of 7 triaged") and instant completion feedback. What decays in a week: points, streaks, leaderboards** (13-youtube.md F4).

## Guardrails

- The one-tap capture path must not gain a single decision or millisecond — capture friction is the documented #1 abandonment cause and the save habit is the only proven-durable behavior.
- `app.db` is the system of record; any schema change must be migration-safe and reversible. The PKMS research only ever read it read-only.
- No guilt mechanics anywhere: no streaks, no overdue counters, no red badges, no "you haven't…" copy.
- Don't build the PKMS promote pipeline inside content-hoarder yet — it's a Phase 3 decision on the PKMS side; just keep the thread JSON accessible.
- One open coordination question (Aaron decides later, fine to discuss): whether the PKMS's mobile `/capture` endpoint should live inside content-hoarder's Flask app (same tailnet host) or as a sibling service (20-mobile-sync.md).

## Suggested first action

Read `17-hoarder-mining.md` in full (~10 min), then propose to Aaron a short decision-gated TODO (his ⏱ size / ▶ first action / ✓ done-when convention) covering takeaways 1–4 — the no-new-UI subset first (status/decay/prefilter changes), UI work behind a gate.
