---
title: PKMS build plan — Phase 4 vertical slices
tags: [pkms-design, build-plan, adhd]
created: 2026-06-12
modified: 2026-06-12
status: ready
---

# PKMS Build Plan (Phase 4)

> **Status: READY — no slice started.** Derived from [[decisions]] (all 10 gates closed
> 2026-06-12) and bound by the shared design language at
> `K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md` (v post-CH-pass, commit `ce809e2`).
> Each slice ends in something Kenja can actually use. Build sittings are Claude-executed
> at HIGH effort; Kenja's actions are the few ⏱-marked items inside slices.

**Binding rules for every build sitting** (the per-slice definition of done):
1. Read `DESIGN-LANGUAGE.md` before designing any surface, flow, or copy (CLAUDE.md rule).
2. Tests added with the slice; full suite green (`.venv\Scripts\python.exe -m pytest tests -q`).
3. `pkms index` clean after any vault-shape change; verify contents, not exit codes.
4. Commit per slice with a message naming the slice.
5. Pacing: one slice per heavy sitting (~5h window). Slices marked *(medium)* can share
   a window with small follow-ups.

---

## Feasibility checks & decision gates

Unmade decisions block downstream work — surfaced here, none block slice 1.

- **F1 — gkeepapi viability** *(Claude, opens slice 4)*: the official Keep API is
  Workspace-only; verify the unofficial `gkeepapi` route works against a personal
  account in 2026 (auth = master-token dance via gpsoauth; known to break). **Fallback
  if dead:** Keep stays a manual side door (share-to-capture / periodic Takeout), slice 4
  shrinks to OCR-at-ingest only.
- **F2 — fresh-Reddit-URL path for promote** *(Claude, inside slice 2)*: hoarded threads
  render straight from the hoarder DB (`reddit_threads` JSON). For URLs *not* already
  hoarded: Reddit blocks unauthenticated JSON from this machine (verified live);
  options are pullpush.io, redlib, or Kenja's pending free script app at
  reddit.com/prefs/apps. Slice 2 ships DB-only if F2 drags — that already covers B11.
- **D1 — email-in address shape** *(Kenja, ~1 min, needed at slice 8 not before)*:
  `you+pkms@example.com` with a Gmail label + API poll, or a dedicated address.
  Options will be presented at slice 8; nothing earlier depends on it.

---

## Slice map

| # | Slice | You get | Sitting |
|---|---|---|---|
| 1 | Capture everywhere + minimal today-view | Dump a thought from couch or desktop in <2s | heavy |
| 2 | `pkms promote` — the win scenario | A hoarded Reddit thread becomes a readable vault note, comments included | heavy |
| 3 | Agent layer — fold, resume, briefing | Inbox folds itself; mornings start with a breadcrumb | heavy |
| 4 | Keep ingest + OCR at ingest | Keep dumps (incl. images) land searchable | medium |
| 5 | Task model — ⏱▶✓, states, reshape | One next action per project; stale tasks reshaped not rotted | heavy |
| 6 | Resurfacing card | 1–3 curious questions a day, relevance-weighted, dismissable forever | medium-heavy |
| 7 | Phone PWA | Today-view + reading queue + capture on the Pixel over tailnet | heavy |
| 8 | Side-door batch — email-in + Discord bot | Capture from work and from Discord | medium |

After slice 8 → **Phase 5 dogfood gate**. Predictive partial sync (G10) stays gated on
real usage to predict from; embeddings decision lives inside slice 6.

---

## Slice 1 — Capture everywhere + minimal today-view

⏱ one heavy sitting · ▶ graduate `spike/capture_server.py` into `src/pkms/capture_service.py` with token auth **mandatory** (the spike stays untouched and dies later)

Ships:
- `vault/inbox/` landing zone; capture format = one timestamped file
  (`YYYY-MM-DD_HHMMSS_slug.md`, frontmatter `captured:`/`source:`) — the spike's format, kept.
- `pkms capture "text"` CLI (secondary ramp, also what the hotkey calls).
- Production capture service: stdlib HTTP, `X-Capture-Token` required, served over the
  tailnet via `tailscale serve`; writes are append-only one-file-per-capture so sync is
  never load-bearing (§9). Autostart task so it survives reboots.
- Desktop global hotkey (AutoHotkey, Win+N style): tiny always-ready input → writes the
  file directly (no server dependency on desktop — works offline, point of performance).
- Pixel 6: HTTP Shortcuts tile → POST `/capture` (validated by the spike). Includes
  retry-on-failure so a tailnet blip queues instead of losing the thought (§1 latency).
- Minimal `pkms today`: yesterday's breadcrumb (tail of last daily note), open tasks per
  project (raw for now), and inbox shown as **progress, not debt** — "3 new to fold in",
  never a backlog count (§3).
- Tests: capture file format, token rejection, hotkey-path append, today-view render.

Kenja actions: ⏱ ~10 min — install/configure the HTTP Shortcuts tile from the doc I'll
write (`docs/pixel-capture-setup.md`); confirm `tailscale serve` maps the port.

Design-language checkpoints: §1 (<2s, zero decisions, never opens a feed, instant
"saved" confirmation), §3 (no counts-as-debt copy anywhere in today-view), §9
(append-only, conflict-free by construction).

✓ Done-when: a thought tapped on the phone tile and one typed at the desktop hotkey both
exist as files in `vault/inbox/` and show up in `pkms today` as "N new to fold in" —
demonstrated live, not assumed.

---

## Slice 2 — `pkms promote` (flagship: the B11 win scenario)

⏱ one heavy sitting · ▶ read-only `sqlite3` attach to
`K:\Projects\content-hoarder\data\app.db` and dump the schema of `reddit_threads`

Ships:
- `pkms promote <reddit-url | search terms>` — URL hits the hoarder DB directly; search
  terms show a **pick list of candidates** (recognition over recall, §5; present-then-ask,
  §9 — never a blank "which one?").
- Renderer: post + comment tree → markdown note in `vault/resources/reading/`, score-ordered,
  deep threads collapsed, provenance frontmatter (source URL, saved date, promoted date).
- Consume-cost pill (§6): word count → "~18 min read" stamped on the note and shown
  wherever it's offered.
- Deep-reading queue: promoted-but-unread notes surface as one line in today-view
  ("1 queued read · ~18 min"), never a counted pile (§3).
- F2 resolved or explicitly deferred (DB-only ship is acceptable).
- Hoarder DB access is **read-only enforced** (open with `mode=ro` URI) — G6's no-coupling rule.

Design-language checkpoints: §5 (recognition, candidates), §6 (consume cost), §9
(transparent "why this" if anything is ranked), §3 (queue framing). Identity-content
exclusion (§5) noted now, enforced when hoarder material enters *resurfacing* in slice 6.

✓ Done-when: one real saved thread Kenja actually wanted to read becomes a vault note he
opens and reads — the B11 moment, executed on his pick.

---

## Slice 3 — Agent layer: fold, resume, briefing

⏱ one heavy sitting · ▶ create `.claude/skills/fold/SKILL.md` and run it on the real
inbox accumulated since slice 1

Ships:
- **/fold**: reads `vault/inbox/`, proposes filing + wikilinks + task extraction as a
  pick list (present-then-ask, one question max, options not blank prompts — §9), applies
  on approval; filing is cosmetic, nothing depends on location (G3). Dedupe is the
  machine's job (§1).
- **/resume**: breadcrumb at the breakpoint — writes a HANDOFF-style note at session end,
  reads it back at session start (§7; job-search-2026 convention, JS4).
- Session-start briefing: terminal autostart runs `pkms today`; the briefing ends with an
  invitation, not an assignment (§3), and contains **at most one** "still interested?"
  question (G8).
- Daily-note template upgrade: breadcrumb slot + folded-captures log (done-things visible).
- Shame-free copy rules encoded **in the skill prompts** (rules as environment, BK10).

✓ Done-when: the real captures from slices 1–2 get folded in one /fold run with Kenja
only picking from options; the next session opens with a breadcrumb and one next action.

---

## Slice 4 — Keep ingest + OCR at ingest *(medium)*

⏱ medium sitting · ▶ run F1: a live `gkeepapi` auth + list against the personal account

Ships (F1-pass path):
- `pkms ingest keep`: new Keep notes → inbox files (`source: keep`), media downloaded;
  ingested-ID ledger in `.index` so dedupe is invisible (§1).
- **OCR at ingest** (research: "Hard Agree", promote early): image captures get extracted
  text appended into the capture file at ingest — never a deferred backlog of
  unsearchable images (§1, §9 bound-what-automation-produces). Engine picked at build
  time (tesseract via winget vs. delegating to a local vision model — decided in-sitting,
  whichever passes a 5-image accuracy spot-check).
- Scheduled pull (Task Scheduler), with the quiet-disclosure rule: if a pull caps or
  skips anything, it says so ambiently (§4 silent-toward-debt/honest-about-actions).

F1-fail path: slice shrinks to OCR on inbox images + a documented manual Keep side door;
Keep ingestion moves to the icebox with reactivation = "gkeepapi or official API becomes viable".

✓ Done-when: a Keep note with an image, created on the phone, is findable by `pkms search`
on words that only exist inside the image.

---

## Slice 5 — Task model: ⏱▶✓, states, reshape-before-fade

⏱ one heavy sitting · ▶ extend `tasks.py` parser to read `⏱/▶/✓` metadata and the state
markers from task lines, with tests first

Ships:
- Fields: every task carries ⏱ size, ▶ concrete first action, ✓ done-when; "needs a first
  step" is a surfaced state the agent offers to fill (§6).
- States: open / done / stuck / not-now / paused(+written reactivation condition) /
  iceboxed (G4). Pause over delete.
- **Done-log, first-class**: `pkms did "thing"` appends (retroactive welcome, §6);
  today-view shows today's dones as quiet win-pebbles — wins reset without debt, no
  streaks (§3).
- **Reshape-before-fade at N=14d** (G4): stale tasks get re-offered in the briefing with
  a smaller ▶ and a smaller / not-now / stash choice; only then sink to the searchable
  stash. The stash is **visibly recoverable** — the presentation must show nothing is
  thrown away (§4). Repeated deferral may expire into the same guilt-free path, no
  "snoozed 3×" copy ever (§2). Any manual touch strips machine staleness marks (§4
  human-touch rule).
- `pkms tasks` redesign: default view = one next action per active project; backlog one
  flag away (`--all`), rendered grouped, never as a wall (§6). No fake urgency anywhere (G4).

✓ Done-when: today-view shows exactly one next action per active project; a deliberately
aged test task gets re-offered reshaped at 14d; stashing it and recovering it both work
and the recovery path is visible in the UI copy.

---

## Slice 6 — Resurfacing card *(medium-heavy)*

⏱ medium-heavy sitting · ▶ write the candidate scorer as a pure function over the index
(recency, backlink degree, FTS overlap with active projects, stale-but-linked) with a
test harness of known-good picks

Ships:
- 1–3 candidates in today-view/briefing, shaped as **curious questions**, varied form,
  never repeated unchanged, one rationed ambient surface total (§5).
- **Dismiss = silent decay + no-renag window** (stored in `.index`); plus the
  **forever-exit**: a guilt-free "let it go" that reversibly decays the content itself,
  as cheap as accepting (§5, CH-ratified).
- **One machine fate per content class** (§5): vault knowledge = resurface-able, never
  silently decayed; anything hoarder-sourced inherits its hoarder fate — and
  **identity/entertainment content never resurfaces as work** (§5 hard rule).
- **Transparent ranking** (§9): every candidate carries a one-line "why this"
  ("links to [[active-project]] · untouched 40d").
- **Embeddings decision point** (G5 sub-decision, decided in-sitting): heuristics ship
  first; sqlite-vec + local embeddings adopted only if the heuristic picks miss — the
  test is Kenja's reaction to a week of real candidates, not a benchmark. Default: defer.

✓ Done-when: a week of daily candidates judged relevant-enough by Kenja (his bar from
G5: "if it hits uninteresting things, i might stop using it"); a dismissed item provably
doesn't reappear inside its window.

---

## Slice 7 — Phone PWA

⏱ one heavy sitting · ▶ serve a static today-view page from the capture service and load
it on the Pixel over tailnet before building anything else

Ships:
- Tailnet PWA (vanilla JS, no deps — content-hoarder's proven shape): home = today-view;
  reading queue (promoted notes readable on the couch/plane-adjacent); capture textbox
  posting to the same `/capture`; fold-lite triage (pick-list actions only).
- Reuses CH's hard-won mobile rules by *reference*: Firefox-on-Pixel-6 PWA gotchas and
  gesture pricing live in `content-hoarder/.claude/skills/frontend-design/SKILL.md`;
  behavior comes from `DESIGN-LANGUAGE.md`; PKMS visual tokens are its own, local.
- Friction asymmetry on any triage gestures (§2): reduce cheapest, preserve priced,
  deferral between.

✓ Done-when: on the Pixel, over tailnet, Kenja opens the PWA → sees today-view, reads a
promoted thread, captures a thought from inside it — all three demonstrated.

---

## Slice 8 — Side-door batch: email-in + Discord bot *(medium)*

⏱ medium sitting (two independent tiny ramps, one activation cost) · ▶ present D1's two
email-address options and wire whichever is picked

Ships:
- **Email-in**: poll the chosen address/label via Gmail API; matching mail → inbox file
  (`source: email`), subject = first line. The from-work ramp.
- **Discord bot**: minimal bot; DM or dedicated channel → POST `/capture`
  (`source: discord`). Kenja action: ⏱ ~10 min — create the bot token + invite it.
- Both ramps idempotent and append-only; ingestion ledgers in `.index` (§1 dedupe, §9).

✓ Done-when: an email sent from a work-ish context and a Discord DM both appear in
`vault/inbox/` and in the next /fold run.

---

## After slice 8 — Phase 5 gate

Dogfood period: the system runs Kenja's real days. Phase 5 evaluation criteria come from
[[10-synthesis]] RQ6 + the win scenario: is capture habitual, does folding stay debt-free,
do resurfacing picks land. Only after surviving Phase 5: umbrella items (career-ops
dashboard, triage spin-off coordination with content-hoarder Epic 22).

## Icebox (carried from Phase 3, unchanged)

- **Voice capture ramp** — reactivate when core capture is stable and a real need shows
  (interim: Pixel Recorder transcript → share into any ramp).
- **Discord-bot PKMS mirror as resurfacing channel** — reactivate at slice 6 if the
  today-view card alone under-delivers; candidate second surface (still rationed, §5).
- **Career-ops dashboard inside PKMS** — post-Phase-5 umbrella gate.
- **Predictive partial sync (G10)** — reactivate when there is real usage to predict
  from (post-dogfood); design is sketched in [[20-mobile-sync]] + G10.
- **Keep ingestion via API** — only if F1 fails; reactivation = a viable API route appears.
- **Claude-CLI-style interactive terminal UI** (Kenja, 2026-06-12) — a richer
  full-screen TUI for the today-view/triage surfaces (candidate tech: Textual — same
  Python stack; honors G1's zero-settings rule). Reactivation condition: after slices
  5–6 ship, when the task-model and resurfacing surfaces it would render actually
  exist. Until then, incremental readability passes on the plain CLI are the channel.
- **Rust (or Go) rewrite of hot paths** — potential perf improvement; the architecture
  (plain files + regenerable SQLite) makes any component swappable without migration.
  Reactivation condition: a *measured* slow path Kenja actually feels during dogfooding
  (most likely candidate: CLI cold start). Not before — Python currently stands on no
  perceptible hot path (capture is AHK/resident-server, search is FTS5/C).
