---
title: "Theme: Inbox pipeline (content-hoarder ⇄ vault)"
tags: [pkms-design, research, adhd, theme, triage, content-hoarder]
created: 2026-06-10
modified: 2026-06-12
status: reacted
---

# 33 — Theme: Inbox pipeline (content-hoarder ⇄ vault)

**Why this matters for the build:** this is RQ6 and your B11 win scenario — and the data says the inbox is *unprocessable by design*, which changes the whole architecture. Mark each: ✅ / ❌ / ❓.

*Reactions transferred verbatim from `exports/phase2-reading-bundle.md`, 2026-06-12.*

1. **Two stages with an explicit promote-or-purge gate:** transient triage inbox (content-hoarder) → persistent vault. Only things that earn it become vault notes ([[14-github]] F8, [[11-hn]] F12).
   **React:** ❓
2. **97.55% of your 84,250 saves never left 'inbox'. Per-item review will never happen.** Design promote-on-demand (search/pull when a need arises) + guilt-free bulk decay — never a review queue ([[17-hoarder-mining]] CH1).
   **React:** ❌ - I think per item review will happen, but i think promoting on demand is a good idea we should implement.
3. **~80% of the hoard is entertainment.** A source-level prefilter (subreddit/source scoring) keeps triage attention off it entirely; entertainment gets a separate, shame-free fate ([[17-hoarder-mining]] CH11).
   **React:** ✅
4. **The win scenario is half-built: content-hoarder already stores full post+comment-tree JSON (672 threads).** Build the promote pipeline that renders a thread to vault markdown — don't rebuild capture ([[17-hoarder-mining]] CH6, [[12-reddit]] F20).
   **React:** ✅
5. **The archive is the system of record, never the service.** Reddit saves silently cap at ~1000; Pocket is dead; full content gets stored locally at save time ([[12-reddit]] F20, [[18-landscape]] LS8).
   **React:** ✅
6. **Read-later trust requires scheduled consumption.** Pair the pipeline with a small recurring deep-reading surface (tiny sample shown, backlog hidden), or the queue dies the Pocket death ([[19-seed-links]] SD3, [[11-hn]] F13, F11).
   **React:** ✅ - Soft agree.
7. **Saved distillations (131-tip megaposts) need an extraction step** into small resurfaceable notes, or they become the deepest-buried items of all ([[17-hoarder-mining]] CH5).
   **React:** ✅ - Soft agree, could be a good idea.
8. **Career ops stays separate.** The hoard can't feed job-search-2026 (diffuse news/memes, no playbooks); they share conventions and promoted references, not a container ([[17-hoarder-mining]] CH12, [[21-job-search-distill]]).
   **React:** ✅ - Generally agree. I think some learning material that comes out of career ops could eventually migrate though.

Full evidence: [[10-synthesis]] → RQ6.
