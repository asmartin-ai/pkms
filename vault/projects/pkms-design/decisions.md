---
title: PKMS design decisions — Phase 3 gates
tags: [pkms-design, decisions, adhd]
created: 2026-06-10
modified: 2026-06-10
status: draft-provisional
---

# PKMS Design Decisions (Phase 3)

> **Status: PROVISIONAL SKELETON.** Drafted 2026-06-10 from the full Phase 1 research, *before* your Phase 2 reactions. Every recommendation below may move once you've marked ✅/❌/❓ in the theme notes ([[05-reading-queue]]). Gates are ordered by what they block — close them top to bottom. Answer inline under "**Your call:**" (a sentence is enough; "go with rec" counts).

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

🔓 Unblocks: G2, G5, G9, build-slice ordering.

**Your call:**

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

Sub-decisions:
1. **Fields:** ⏱ size, ▶ first action, ✓ done-when on every task — adopt as schema, with "needs a first step" as a surfaced state. *(rec: yes, it's your own surviving convention)*
2. **Decay policy:** tasks untouched N days fade from active view into amnesty (visible-aging marks first). **Pick N** (bujo monthly suggests ~30; HN evidence suggests 7–14 for daily-level items). *(rec: 14 days to fade, 30 to amnesty-archive, never delete)*
3. **States:** open / done / stuck (auto-subdivide) / not-now (back of queue) / paused (with written reactivation condition) / iceboxed. *(rec: adopt all six; paused & icebox are your existing patterns)*
4. **Urgency mechanics — the [[31-theme-tasks]] #8 tension:** self-imposed deadlines get rejected ([[13-youtube]] F3) but your own saves say low-consequence environments produce nothing ([[17-hoarder-mining]] CH7). Options: (a) no deadline features at all, interest-routing only; (b) externalized commitments only (a task can reference a real-world consequence/person/date); (c) lightweight body-double/agent-session accountability ([[17-hoarder-mining]] CH13). *(rec: b + c, never synthetic countdowns — but this one genuinely needs your reaction)*

🔓 Unblocks: `pkms tasks` redesign, daily-note template.

**Your call (incl. N and sub-decision 4):**

---

## G5 — Retrieval & resurfacing UX

❓ What's the front door, and how does old material come back?

📚 Recognition over recall — show candidates, search is fallback ([[16-academic]] RT3/RT4); event-anchored cues, not clocks (RT2, SC9); curious-question resurfacing, no badges ([[14-github]] F9/F10); one rationed ambient surface (SC8); related-notes embeddings are the cheapest serendipity ([[18-landscape]] LS6).

- **A. "Today view" as front door:** daily note auto-opens with — yesterday's breadcrumb, one next action per active project, a small resurfacing card (1–3 candidates: stale-but-interesting, related-to-current-work, surprise-me), inbox count *as progress not debt* ("3 new to fold in").
- **B. Search-first CLI** (status quo) — ruled out by RT4 unless reactions disagree.
- Sub-decision: **embedding layer** — local model via sqlite-vec/embeddings table now, or defer to a later slice and start with FTS + links only. *(rec: defer to slice 2–3; FTS + backlinks + recency heuristics first, embeddings when resurfacing quality demands it)*

💡 **Provisional rec: A**, rendered in terminal at session start and as the PWA home screen.

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

🔓 Unblocks: the win-scenario build slice; coordination with the content-hoarder session.

**Your call:**

---

## G7 — job-search-2026 relationship

❓ Does the vault absorb, mirror, or merely link to career ops?

📚 The hoard can't feed it (CH12); it already works standalone ([[21-job-search-distill]]); umbrella architecture is iceboxed until the PKMS survives Phase 5 (program plan).

💡 **Provisional rec:** stays fully separate this phase. The PKMS adopts its conventions (⏱▶✓, HANDOFF, ledger, icebox) rather than its content; a vault project note links out to it. Revisit at the umbrella gate post-Phase 5.

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

🔓 Unblocks: Phase 4 plan entirely.

**Your call:**

---

## G10 — Mobile sync *(can stay open through early slices)*

❓ PWA-only phone access, or also sync vault files to the phone?

📚 [[34-theme-mobile]] #7 — your reaction feeds this directly. PWA-only: zero sync risk, needs tailnet up for reading. +Syncthing fork: offline whole-vault read/edit via Markor, but real 2026 maintainer-risk and conflict-litter to manage ([[20-mobile-sync]] MS-02–MS-04).

💡 **Provisional rec:** start PWA-only (capture works offline via HTTP Shortcuts queuing); add Syncthing later only if you actually miss offline reading in practice. Evidence over speculation.

**Your call:**

---

## Closing checklist

- [ ] G1 interface · [ ] G2 capture · [ ] G3 organization · [ ] G4 tasks (+N, +urgency) · [ ] G5 retrieval · [ ] G6 hoarder · [ ] G7 job-search · [ ] G8 review/rot · [ ] G9 stack/LLM · [ ] G10 sync

✓ Phase 3 done-when: every box checked → I turn this into a vertical-slice build plan, each slice ending in something you can actually use.
