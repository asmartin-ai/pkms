---
title: PKMS design decisions — Phase 3 gates
tags: [pkms-design, decisions, adhd]
created: 2026-06-10
modified: 2026-06-12
status: reaction-backed-gates-open
---

# PKMS Design Decisions (Phase 3)

> **Status: FULLY REACTION-BACKED — Phase 2 COMPLETE (2026-06-12).** All 8 themes reacted; both flagged decisions answered (31#8 urgency: settled; 34#7 sync: partial synced folder). Every gate below now carries "*Reactions*" annotations. **The one item still needing your words before gates close: your bare ❌ on [[36-theme-anti-perfectionism]] #1 and #2 (see G1).** Gates are ordered by what they block — close them top to bottom. Answer inline under "**Your call:**" (a sentence is enough; "go with rec" counts).

Legend per gate: ❓ the question · 📚 bearing research · options with trade-offs · 💡 provisional recommendation · 🔓 what closing it unblocks.

---

## G1 — Interface & platform shape *(blocks everything)*

❓ What IS the PKMS, physically — where do you touch it on desktop and on the Pixel 6?

📚 Help must live at the point of performance, not in a destination app you must remember to visit ([[15-barkley]] BK1–BK2; [[16-academic]] SC1, SC6). Mobile capture latency kills systems ([[18-landscape]] LS14; [[20-mobile-sync]] MS-06). AI survives as a layer over plain files, dies as an app ([[18-landscape]] LS2–LS6). Customization surface = perfectionism trap ([[36-theme-anti-perfectionism]] #1).

| Option | Trade-offs |
|---|---|
| **A. Ambient hybrid:** vault stays plain markdown; desktop touchpoints = terminal autostart (daily note + briefing), global capture hotkey, Obsidian as reader/editor; phone = tailnet PWA (triage/read) + HTTP-Shortcuts capture tile; PKMS itself is CLI + background indexer + agent layer, not a UI you "open" | Matches point-of-performance theory and your existing habits (terminal, Obsidian, Discord-style dumps). Cheapest to build. Risk: split across surfaces, no single "home". |
| **B. Local web app as the primary UI** (desktop + phone, same PWA, content-hoarder-style) | One surface everywhere, full UX control. Risk: it becomes a destination app (BK2 failure), and a big buildable surface = overengineering bait. |
| **C. Obsidian-plugin-centric** (PKMS = plugins + agent inside your existing vault app) | Leverages a tool that already survived for you. Risk: plugin ecosystem is the documented tinkering trap; mobile Obsidian fails the capture bar outright (MS-06). |

💡 **Provisional rec: A**, with B's PWA reserved for the phone-facing slice only. C ruled out by the tinkering evidence unless your reactions say otherwise.

*Refinement from [[22-kenja-resource-dump]] (KD2): "cap the customization surface" splits in two — structural/schema knobs stay at zero, but ship a small bounded set of salience controls (density, quiet level, how much the today-view shows). Personalization-as-decluttering is an ADHD need; personalization-as-tinkering is the trap.*

*Reactions 2026-06-12 ([[36-theme-anti-perfectionism]]):* you ❌'d both #1 (cap the customization surface) and #2 (anchor every feature to a named context) — **with no comment, against two of the most-evidenced findings in the corpus.** Before this gate closes, one sentence each on what the ❌ means: (a) "I want more knobs than the rec allows"? "I reject ship-opinionated"? Or "the KD2 split already covers me"? (b) For #2: is there a general-PKM surface you actively want, or did the framing just feel restrictive? Your reactions elsewhere (35 all-✅ on opinionated agent grammar, 36#3 ✅ on view-layer-as-novelty-outlet) suggest the disagreement may be narrower than the bare ❌ reads.

🔓 Unblocks: G2, G5, G9, build-slice ordering.

**Your call (incl. the two ❌ elaborations above):**

---

## G2 — Capture flow *(blocks build slice 1)*

❓ What are the exact ramps, per context, into the one inbox?

📚 <2s, zero decisions, textbox-already-open ([[30-theme-capture]] #1); per-context ramps required (BK3); append-only one-file-per-capture sidesteps sync conflicts ([[20-mobile-sync]] MS-13); must not open a feed or the full app ([[30-theme-capture]] #3).

| Context | Proposed ramp | Alternative |
|---|---|---|
| Desktop, anywhere | Global hotkey (AutoHotkey win+n style) → tiny always-ready input → appends timestamped file to `vault/inbox/` | `pkms capture "..."` in terminal (slower; keep as secondary) |
| Pixel 6 | HTTP Shortcuts widget/tile → POST `/capture` over tailnet → same inbox (validated by the spike in `spike/`) | PWA share-target (test later); Markor QuickNote on a synced folder if sync is adopted (G10) |
| Voice (either) | Pixel Recorder on-device transcript → share .txt into capture ramp; ingested at triage | Don't build custom voice infra ([[20-mobile-sync]] MS-14) |
| Existing habits (Keep/Discord/Reddit saves) | Don't fight them — content-hoarder + periodic ingestion remain valid side doors (G6) | — |

💡 **Provisional rec:** all captures land as separate timestamped markdown files in `vault/inbox/`; the agent (not you) folds them into daily notes/structure. Desktop hotkey + phone tile are slice 1.

*Reactions 2026-06-11 ([[30-theme-capture]]):* core spec confirmed — <2s zero-decision bar ✅, one-inbox-many-ramps ✅, machine-side dedupe/tagging ✅, no re-open shame ✅. Two refinements: (a) #3 ❓ — the *capture* ramp stays feed-free, but Kenja notes scroll-distraction sometimes helps digest the backlog → a feed-adjacent resurfacing surface is a feature, not a violation (feeds G5/G6, see the scroll-lacing idea there). (b) #6 ✅-begrudging — persistence friction accepted, but presentation must make "nothing is ever thrown away without my control" visible, or ADHD loss-aversion fights the mechanism.

🔓 Unblocks: first usable vertical slice; the spike test feeds this gate.

**Your call:**

---

## G3 — Organization scheme

❓ How is the vault structured, and who maintains the structure?

📚 Daily-note-as-sink with structure derived later is the proven shape ([[11-hn]] F10; [[18-landscape]] LS9, LS13); schema-on-write kills capture ([[12-reddit]] F4); structure is earned from observed patterns, never predesigned (LS13); every schema element is a liability (LS9).

- **A. Daily-note-first:** everything lands in inbox/daily stream; the agent extracts/links/files into `projects/areas/resources/archive` (current layout, unchanged); folders are landing zones, never capture decisions.
- **B. Inbox-only + search:** no folder filing at all; retrieval purely via index/links/embeddings.
- **C. Predesigned taxonomy** — ruled out by essentially the entire corpus.

💡 **Provisional rec: A**, with B's spirit: filing is cosmetic and automated; nothing ever depends on location ([[12-reddit]] F12 — retrieval must survive structure churn).

🔓 Unblocks: indexer/linker behavior, agent filing rules.

**Your call:**

---

## G4 — Task model

❓ How do tasks work — fields, queue, decay, and the urgency question?

📚 [[31-theme-tasks]] wholesale; opposite decay for notes vs tasks ([[11-hn]] F5); one-next-action with invisible backlog ([[14-github]] F6); ⏱▶✓ is your proven convention ([[21-job-search-distill]] JS1); Done/Stuck/Not-now grammar ([[19-seed-links]] SD12).

Sub-decisions *(reworked 2026-06-11 from your [[31-theme-tasks]] reactions; #1/#3/#5/#6 re-reacts landed 2026-06-12)*:
1. **Fields:** ⏱ size, ▶ first action, ✓ done-when on every task, "needs a first step" as a surfaced state — **CONFIRMED** (your ❓ flipped to "✅ AGREE" after the clarification).
2. **Decay policy — REWORKED after your ❌ on #1.** Plain fade-to-amnesty rejected: "letting it decay just builds guilt — tasks need to be reshaped to be more approachable." New rec: stale tasks get **reshaped before they fade** — at ~14 days untouched the agent re-offers the task with a smaller ▶ first step and a "still want this? (smaller / not-now / stash)" choice; only after that does it sink to the searchable stash. Nothing is ever deleted, and the stash must be visibly recoverable (same loss-aversion caveat as G2). **Pick N for the reshape trigger** *(rec: 14 days)*.
3. **States:** open / done / stuck (auto-subdivide) / not-now (back of queue) / paused (with written reactivation condition) / iceboxed — **CONFIRMED** (Done/Stuck/Not-now ✅; paused and decision-gates flipped to ✅ after clarifications).
4. **Urgency mechanics — SETTLED 2026-06-11.** Your #8 reaction: "✅ Hard agree" with no fake urgency primitives. Adopted: **(b) externalized commitments + (c) lightweight agent/body-double accountability; no synthetic deadlines, no countdowns, and option (d) nag-until-done is dropped.**
5. **Backlog visibility (new, from your #2 ❓):** not invisible — *deemphasized*. The backlog stays one click away and never renders as a wall by default; one-next-action remains the default view, especially under deadline pressure ("the principle matters most when I have tasks that need to get done").
6. **Done-log (your #7 ✅):** first-class, retroactive entries welcome — "even retroactively adding tasks and marking it as done kept me going." Build it into slice planning.

🔓 Unblocks: `pkms tasks` redesign, daily-note template.

**Your call (only sub-decision 2's N remains — rec is 14 days):**

---

## G5 — Retrieval & resurfacing UX

❓ What's the front door, and how does old material come back?

📚 Recognition over recall — show candidates, search is fallback ([[16-academic]] RT3/RT4); event-anchored cues, not clocks (RT2, SC9); curious-question resurfacing, no badges ([[14-github]] F9/F10); one rationed ambient surface (SC8); related-notes embeddings are the cheapest serendipity ([[18-landscape]] LS6).

- **A. "Today view" as front door:** daily note auto-opens with — yesterday's breadcrumb, one next action per active project, a small resurfacing card (1–3 candidates: stale-but-interesting, related-to-current-work, surprise-me), inbox count *as progress not debt* ("3 new to fold in").
- **B. Search-first CLI** (status quo) — ruled out by RT4 unless reactions disagree.
- Sub-decision: **embedding layer** — local model via sqlite-vec/embeddings table now, or defer to a later slice and start with FTS + links only. *(rec: defer to slice 2–3; FTS + backlinks + recency heuristics first, embeddings when resurfacing quality demands it)*

💡 **Provisional rec: A**, rendered in terminal at session start and as the PWA home screen.

*Reactions 2026-06-11 ([[32-theme-retrieval]] — all 8 ✅):* recognition-over-recall, event-based cues, re-entry breadcrumbs, visible-aging-then-amnesty, OCR-at-ingest all confirmed (OCR was "Hard Agree" — promote it to an early slice). Three design constraints from your comments: (a) curious-question resurfacing must stay **subtle** — you predict auto-dismiss habituation if it nags (#3); (b) "surprise me"/related cards should be **relevance-weighted, not random** — "if it hits uninteresting things, i might stop using it" (#4); (c) **scroll-lacing idea (yours, from [[31-theme-tasks]] #1):** lace resurfaced old ideas into your existing content-hoarder scrolling habit — resurfacing inside a feed you already open voluntarily. Strong candidate for the G6 integration; piggybacks on a proven behavior instead of building a new surface.

🔓 Unblocks: daily-note template, indexer queries, PWA home.

**Your call:**

---

## G6 — content-hoarder integration

❓ How do the hoard and the vault relate, mechanically?

📚 [[33-theme-inbox-pipeline]] wholesale: promote-on-demand over the unprocessable 84k inbox (CH1), source prefilter (CH11), thread-JSON → markdown promote pipeline for the win scenario (CH6), archive as system of record (LS8).

Sub-decisions:
1. **Direction:** PKMS pulls from hoarder DB read-only on demand (promote command / agent search) vs hoarder pushes promoted items. *(rec: pull, read-only — no coupling)*
2. **Capture endpoint location:** inside hoarder's Flask app vs sibling service on the same tailnet host. *(rec: sibling service — the spike tests this shape; revisit after the hoarder chat weighs in on [[40-handoff-content-hoarder]])*
3. **Win-scenario slice:** `pkms promote <reddit-url-or-search>` renders post+comment-tree to a vault note + queues it on the deep-reading surface. *(rec: this is the flagship early slice — it's your B11 moment)*

*Reactions 2026-06-12 ([[33-theme-inbox-pipeline]]):* promote pipeline ✅, source prefilter ✅, local archive as system of record ✅, deep-reading surface and megapost extraction soft-✅. Two adjustments: (a) #2 ❌ — you believe per-item review *will* happen (the 97.55% figure notwithstanding) but want promote-on-demand built anyway → build promote-on-demand as the primary path and keep an *optional, debt-free* review affordance (e.g. triage laced into hoarder scrolling, per your G5 idea) — but never a counted review queue, so both stories survive contact with reality. (b) #1 ❓ on the explicit promote-or-purge gate — softened to: promotion is explicit, purging is not a user-facing verb (consistent with your G2/G4 loss-aversion caveats; nothing is ever visibly thrown away).

🔓 Unblocks: the win-scenario build slice; coordination with the content-hoarder session.

**Your call:**

---

## G7 — job-search-2026 relationship

❓ Does the vault absorb, mirror, or merely link to career ops?

📚 The hoard can't feed it (CH12); it already works standalone ([[21-job-search-distill]]); umbrella architecture is iceboxed until the PKMS survives Phase 5 (program plan).

💡 **Provisional rec:** stays fully separate this phase. The PKMS adopts its conventions (⏱▶✓, HANDOFF, ledger, icebox) rather than its content; a vault project note links out to it. Revisit at the umbrella gate post-Phase 5.

*Reactions 2026-06-12:* ✅ "Generally agree" ([[33-theme-inbox-pipeline]] #8) with one future hook — learning material produced by career ops may eventually migrate into the vault. Noted as a post-Phase-5 umbrella item, not a current coupling. Standing caveat from [[37-theme-self-knowledge]] #5/#6: don't over-read job-search-2026 signals — the repo just hasn't had attention lately; its *conventions* remain validated, its *activity patterns* are not evidence.

**Your call:**

---

## G8 — Review cadence & note-rot policy

❓ What replaces the weekly review, and what happens to untouched notes?

📚 Scheduled self-initiated reviews lapse (RT2, RT7); review must happen ambiently at moments that already occur (SC9); visible aging then silent amnesty ([[11-hn]] F8/F14); notes are permanently-in-progress, never "unfinished" ([[10-synthesis]] RQ5 #8); review debt structurally impossible (RT6).

💡 **Provisional rec:** no mandatory ritual, ever. Micro-review is woven into existing moments: today-view shows 1–3 resurfaced items; opening a project note shows its stale loops; the agent's session-start briefing includes one "still interested?" question max. Notes never expire (only tasks do); untouched notes just sink from default views and remain searchable.

**Your call:**

---

## G9 — Tech stack & the LLM layer

❓ Keep the scaffold? And what shape is the agent?

📚 The scaffold's architecture (markdown source of truth + regenerable SQLite) is exactly the surviving pattern ([[18-landscape]] LS4, LS12; [[14-github]] F4); the agent layer should follow your briefing-package idiom (JS11) and present-then-ask grammar (SD6, F23); rules encoded as environment not docs (BK10).

| Sub-decision | Options | 💡 rec |
|---|---|---|
| Core | Keep Python/Typer/SQLite scaffold vs rebuild | **Keep** — it's already dogfooding well (23 notes indexed, FTS fixed); "disposable" turned out not to need disposing. Harden with tests per slice. |
| Agent layer | Claude Code over the vault (skills/commands like `/triage`, `/resume`, `/promote`) vs custom LLM app vs API pipeline scripts | **Claude Code skills first** — zero new infra, matches how you already work; graduate hot paths to scripted API calls only if cost/latency demands. |
| Agent grammar | — | Present-then-ask, one question max, options-not-blank-prompts, one-next-action outputs, shame-free copy rules encoded in skill prompts ([[35-theme-llm-organizer]]). |

*Reactions 2026-06-12 ([[35-theme-llm-organizer]] — all 8 ✅, the cleanest sweep of Phase 2):* LLM-as-organizer architecture, human-dumps/LLM-structures division of labor, AI-as-regenerable-layer, present-then-ask grammar, loop-closing accountability, briefing-package idiom — all confirmed. Only caveat: #7 bounded-output got "✅ with some potential caveats" — keep the bounds adjustable salience-side (ties to the KD2 refinement in G1).

🔓 Unblocks: Phase 4 plan entirely.

**Your call:**

---

## G10 — Mobile sync *(ANSWERED 2026-06-12 — direction set, details to design)*

❓ PWA-only phone access, or also sync vault files to the phone?

📚 [[34-theme-mobile]] #7 — your reaction feeds this directly. PWA-only: zero sync risk, needs tailnet up for reading. +Syncthing fork: offline whole-vault read/edit via Markor, but real 2026 maintainer-risk and conflict-litter to manage ([[20-mobile-sync]] MS-02–MS-04).

**Your answer (34#7 ✅):** *"Synced folder for a portion of the vault would be nice. Predicting which parts of the vault im likely to need would be incredible. Im a bit limited by space on my phone… being able to access and triage stuff on planes would be really nice."*

💡 **Adopted direction: PWA + predictive partial sync.** A bounded, machine-chosen slice of the vault (active projects, today-view material, queued deep-reading, recent captures) syncs to the phone read-mostly; the agent predicts the slice — which is exactly the recognition-over-recall machinery (G5) applied to offline packing. Capture stays append-only POST (offline-queued), so sync is never load-bearing for correctness (clarification under [[34-theme-mobile]] #4 — your ❓ there is compatible with this design; your PC-off concern in #5 is real and the partial replica is the answer to it). Sequencing rec: PWA + capture first (slice 1), predictive sync slice once there's real usage to predict from. Also recorded from #1: the **Discord-bot mirror** idea (PKMS → private notes Discord) as a candidate ambient surface — fits your surviving Discord-dump habit; park it as a possible G5 resurfacing channel, not slice-1 scope.

**Your call (sequencing only — direction is set):**

---

## Closing checklist

- [ ] G1 interface · [ ] G2 capture · [ ] G3 organization · [ ] G4 tasks (+N, +urgency) · [ ] G5 retrieval · [ ] G6 hoarder · [ ] G7 job-search · [ ] G8 review/rot · [ ] G9 stack/LLM · [ ] G10 sync

✓ Phase 3 done-when: every box checked → I turn this into a vertical-slice build plan, each slice ending in something you can actually use.
