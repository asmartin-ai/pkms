---
title: PKMS build plan — Phase 4 vertical slices
tags: [pkms-design, build-plan, adhd]
created: 2026-06-12
modified: 2026-08-07
status: in-progress
---

# PKMS Build Plan (Phase 4)

> **Status (2026-07-12):** slices 1–8 agent-complete on `main` (431 green). Slice 7
> remaining is Kenja device proof on the Pixel (`docs/pixel-pwa-setup.md`). Slice 8
> remaining is Kenja activation (`docs/email-discord-setup.md`). Phase 5 dogfood
> criteria live at [[phase5-dogfood]]; clock starts after activation. Repo published
> to GitHub with CI.
> Derived from [[decisions]] (all 10 gates closed
> 2026-06-12) and bound by the shared design language at
> `/path/to/adhd-design-language/DESIGN-LANGUAGE.md` (v post-CH-pass, commit `ce809e2`).
> Each slice ends in something Kenja can actually use. Build sittings are agent-executed
> at HIGH effort; Kenja's actions are the few ⏱-marked items inside slices.

**Binding rules for every build sitting** (the per-slice definition of done):
1. Read `DESIGN-LANGUAGE.md` before designing any surface, flow, or copy (AGENTS.md rule).
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

Status: ✓ shipped · ▸ in progress · ◦ not started.

| # | Status | Slice | You get | Sitting |
|---|---|---|---|---|
| 1 | ✓ | Capture everywhere + minimal today-view | Dump a thought from couch or desktop in <2s | heavy |
| 2 | ✓ | `pkms promote` — the win scenario | A hoarded Reddit thread becomes a readable vault note, comments included | heavy |
| 3 | ✓ | Agent layer — fold, resume, briefing | Inbox folds itself; mornings start with a breadcrumb | heavy |
| 4 | ✓ | Keep ingest + OCR at ingest | Keep dumps (incl. images) land searchable | medium |
| 5 | ✓ | Task model — ⏱▶✓, states, reshape | One next action per project; stale tasks reshaped not rotted | heavy |
| 6 | ✓ | Resurfacing card | 1–3 curious questions a day, relevance-weighted, dismissable forever | medium-heavy |
| 7 | ▸ | Phone PWA | Today-view + reading queue + capture on the Pixel over tailnet | heavy |
| 8 | ▸ | Side-door batch — email-in + Discord bot | Capture from work and from Discord | medium |
| 9 | ✓ | Promotion ingest from content-hoarder (S3 spec) | A promoted CH item lands in the inbox as a capture | medium |

After slice 8 → **Phase 5 dogfood gate**. Predictive partial sync (G10) stays gated on
real usage to predict from; embeddings decision lives inside slice 6.

---

## Slice 1 — Capture everywhere + minimal today-view

⏱ one heavy sitting · ▶ build `src/pkms/capture_service.py` with token auth **mandatory**

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
`/path/to/content-hoarder/data/app.db` and dump the schema of `reddit_threads`

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

⏱ one heavy sitting · ▶ create `.agents/skills/fold/SKILL.md` and run it on the real
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
SWAP 155.=175:
## Slice 4 — Keep ingest + OCR at ingest *(medium, extended 2026-07-26)*

⏱ medium sitting · ▶ run F1: a live `gkeepapi` auth + list against the personal account

Ships (F1-pass path):
- `pkms ingest keep`: new Keep notes → inbox files (`source: keep`), media downloaded;
  ingested-ID ledger in `.index` so dedupe is invisible (§1).
- `pkms ingest keep-takeout <zip>` *(2026-07-26, ADR 0028)*: one-shot bulk import
  of a Google Takeout ZIP — **recommended starting point** for any user with
  pre-existing Keep history. No auth, idempotent on re-run. Brings all
  history into the vault without the master-token blast radius.
- `pkms ingest keep-sweep [--apply]` *(2026-07-26, ADR 0028)*: destructive
  cleanup that trashes from Keep the captured notes that are old + unpinned.
  **DRY RUN by default**; the load-bearing safety property is that a note
  is never deleted unless `keep_completed` (the durable SQLite index)
  records it as imported. Configurable `--age-days` (default 30).
- **Attachments are mirrored to `<repo-root>/keep-media/`** (Spec 10, sha256
  filenames) and referenced from the capture via `file://` markdown image
  links. Override with `PKMS_KEEP_MEDIA_DIR` env var.
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
on words that only exist inside the image. (Extended 2026-07-26: a Takeout
import brings ALL existing Keep notes into the vault, with attachments
mirrored, before any live sync is enabled.)

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
  posting to the same `/capture`; resurface actions persist through `/api/resurface`;
  fold-lite triage (pick-list actions only).
- Reuses CH's hard-won mobile rules by *reference*: Firefox-on-Pixel-6 PWA gotchas and
  gesture pricing live in `content-hoarder/.claude/skills/frontend-design/SKILL.md`;
  behavior comes from `DESIGN-LANGUAGE.md`; PKMS visual tokens are its own, local.
- Friction asymmetry on any triage gestures (§2): reduce cheapest, preserve priced,
  deferral between.

Increment landed 2026-06-29: desktop/new-tab frontend posts real captures, fetches live
reading/recognition data, and persists resurface not-now/let-go actions. Agent close-out
2026-07-04: `docs/pixel-pwa-setup.md` written; Lamplight merged. Remaining slice-7 proof
is Kenja device-level only (Pixel over tailnet).

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

**Status (2026-07-06, agent):** code + tests shipped on `main` — `pkms ingest email`,
`pkms discord-bot`, oracles in `tests/test_email_ingest.py` + `tests/test_discord_capture.py`,
activation doc at `docs/email-discord-setup.md`. Remaining is Kenja wiring only
(Gmail app password + Discord bot token).

✓ Done-when: an email sent from a work-ish context and a Discord DM both appear in
`vault/inbox/` and in the next /fold run.

---

## Slice 9 — Promotion ingest from content-hoarder (S3 spec)

⏱ medium sitting · spec shipped 2026-07-31; **build shipped** (ported to
main 2026-08-07) · ▶ remaining: wire the CH-side `promote` action to POST it
(content-hoarder's own packet)

Governing decision: life-os ADR 0027 (Accepted 2026-07-28, Option C hybrid) +
`docs/delegation-roadmap.md` §S3. Promotion happens in a CH triage sprint — the
resurface card proposes `promote`; an explicit accept (Kenja, on the card) pushes
the item into `vault/inbox/` and stamps an `action_receipt` on the CH side. This
spec is the PKMS-side destination; the build shipped (ported to main 2026-08-07).

### Destination

`vault/inbox/` — promotion is a capture; it enters the one inbox like every other
ramp (Decision 0003; G2 "multiple ramps, one inbox"). Classification happens
after, in /fold: a promoted item is **not** pre-filed as a reading note. Contrast
slice 2's `pkms promote` (pull-side renderer straight to `vault/resources/reading/`
for hoarder-DB threads): this slice is the push-side capture ramp for CH's
triage-sprint promote action. Both coexist; /fold decides the destination.

### Envelope mapping (CH `external_item` → `capture` contract)

Transport: **extended `POST /capture`** (decision below). CH sends one JSON
envelope per accepted promote; the handler flattens it into the standard inbox
file via `write_capture` (frontmatter + body).

| `capture` field | Source | Notes |
|---|---|---|
| `id` | inbox filename (PKMS-native) | `YYYY-MM-DD_HHMMSS_<slug>.md`, same as every ramp; no separate id artifact |
| `captured_at` | ingest time (`write_capture` stamp) | `captured:` frontmatter keeps the inbox convention (= when it landed); CH's `captured_at` rides in provenance as `ch_captured_at` |
| `source` | `content-hoarder` (fixed) | existing `?source=` query param |
| `source_account_id` | `external_item.source_account.id` | frontmatter `source_account_id:` |
| `raw_text` | **title + summary + url** (composition) | body: title line, blank, summary, blank, url line — raw markdown, no headings, zero pre-shaping; /fold proposes structure |
| `raw_ref` | `external_item.url` | frontmatter `raw_ref:` (also hop 3 of the span) |
| `context.{device,app}` | `{device: desktop, app: content-hoarder}` | flat frontmatter `context_device:` / `context_app:` (capture.py frontmatter is flat; the JSON envelope stays nested) |

### Provenance — two-hop `source_span`

Never flatten to the original URL: the CH hop is a live pointer into CH's DB that
carries tags / decay / receipt state. Frontmatter keeps all three hops:

| Hop | Field | Value |
|---|---|---|
| 1 — PKMS note | (the capture file itself) | `vault/inbox/<file>.md` |
| 2 — CH item | `ch_item_id` + `ch_origin_ref` | `external_item.id` + `external_item.origin_ref` (namespaced stable pointer, e.g. `content-hoarder:fullname:reddit:t3_…`) |
| 3 — original URL | `raw_ref` | `external_item.url` |

`ch_origin_ref` is the load-bearing hop: CH's tags, decay state, and the promote
`action_receipt` resolve through it — nothing is copied into PKMS except the item
id. `ch_tags_hint` MAY ride along as a non-binding hint for /fold, never as a
decision.

### Transport decision: extended `POST /capture` (not file drop)

**Decision: reuse `POST /capture`, extended additively.** Rationale:
- Promotion is defined (ADR 0027) as a capture into the one inbox; the endpoint
  is the existing single-writer path for exactly this (G2; slice-8 Discord bot
  precedent). File drop would make content-hoarder a second writer into
  `vault/inbox/` with its own naming/frontmatter implementation — a second
  convention beside the existing one (prohibited), plus no ledger channel.
- `write_capture` grants the shared invariants for free: timestamped filename,
  same-second `-N` collision suffix, flat frontmatter, append-only.
- The ledger stays inside one process: the handler checks/appends at the write
  boundary (per-note pattern from `keep_ingest.py`, below). File drop would need
  a poller + spool dir for the same dedupe — strictly more mechanism.
- Token gate preserved: only capture-token holders write to the inbox. CH runs
  on this machine and reads `/path/to/PKMS\.secrets\capture-token` (or the
  build packet injects it via env) — a local secret handoff, no new account.

Additive-only contract change (standing law: `/capture` changes only via a packet
that says so — this spec is that packet):

```json
{
  "text": "<title>\n\n<summary>\n\n<url>",
  "source_account_id": "acct_…",
  "raw_ref": "https://…",
  "context": {"device": "desktop", "app": "content-hoarder"},
  "ch_item_id": "ext_ch_item_001",
  "ch_origin_ref": "content-hoarder:fullname:…",
  "ch_captured_at": "2026-07-12T05:51:25Z"
}
```

`text` stays the only required field; `source` stays a query param; every new
field is optional — a plain human capture (no `ch_item_id`) is byte-for-byte the
old behavior. The capture path gains zero decisions: the card's explicit promote
accept (already made) is the only gate.

**Idempotency / replay / duplicates.** `ch_item_id` is the dedupe key. Handler:
`ch_item_id` present and in the ledger → 200 `already saved ✓ <existing name>`, no
second file (replay-safe); else `write_capture` → ledger append → 200 `saved ✓
<name>`. Acknowledge the one race — crash between write and ledger-append leaves a
file without a ledger entry; a replayed POST then writes a same-content duplicate
(`-2` suffix handles the name) which /fold dedupes (machine dedupe is the job,
G2/G3). Window is one file write.

**Ledger.** `.index/ch-promote-ledger.txt`, one `ch_item_id` per line, append-only
— the `keep_ingest.py` per-note ledger pattern (`load_ledger`/`append_ledger`). A
durable SQLite mirror (like `keep_completed`) is deferred unless the build packet
finds a consumer needing queryable state — nothing does today: PKMS reads the
ledger only for dedupe; CH reads receipt state from its own DB via `ch_origin_ref`.

**CH-side handshake (coordination note, out of PKMS scope):** the promote
`action_receipt` (ADR 0027 done-when) stamps on CH's side after the POST succeeds;
PKMS's deterministic response body (`saved ✓ <name>` / `already saved ✓ <name>`) is
the receipt's external evidence. Build packet MUST keep the success body
content-verifiable.

### S2 boundary (smart routing at capture)

S2 decides which content classes route where at capture time; S3 is the
destination spec for items CH has already decided to promote. Boundary: S2's
routing table treats "CH-promoted item" as a post-dump input class — both specs
share the hard rule that classification happens after the dump, never as a
capture-time prompt — and if S2 later adds routing, promoted captures flow through
the same post-dump classification unchanged. Nothing in S3 adds a decision to the
write path; nothing in S2 moves the promote gate onto the dump path.

### Scope

`capture_service.py` `do_POST` (additive fields + ledger check/append), the
`.index` ledger file, oracle tests. Not: `/fold` changes, S2 routing
implementation, reading-note rendering (slice-2 `pkms promote` covers the pull
side), CH-side work (its own packet).

### Out of scope (explicit)

- **Unsave-on-source** — deferred behind CH `action_receipt` infra (ADR 0027
  §Decision.3); PKMS never touches Reddit/HN/YouTube saved lists.
- **Auto-promote on save** — Option B rejected (ADR 0027); CH never pushes
  without the explicit accept on the resurface card.

### Decisions pre-made

Transport = extended `POST /capture` (additive) · `source` = `content-hoarder` ·
`raw_text` = title + summary + url · dedupe key = `ch_item_id` vs
`.index/ch-promote-ledger.txt` · ledger = per-note file pattern, SQLite mirror
deferred · context flattened to `context_device`/`context_app` · CH
tags/decay/receipt resolve via `ch_origin_ref`, never flattened.

✓ Done-when (build packet): a CH-promoted item (fixture `item-001`) lands in
`vault/inbox/` as one capture file with the envelope frontmatter + two-hop span;
a replayed POST adds no second file; a plain capture (no `ch_item_id`) behaves
exactly as before; suite green at ≥ baseline.

**Status (2026-08-07, agent):** build shipped — cherry-picked `ccecaf5` onto
main (commit 99b674f). `do_POST` accepts the additive envelope (flattened to
`source_account_id:` / `raw_ref:` / `context_device:` / `context_app:` /
`ch_item_id:` / `ch_origin_ref:` / `ch_captured_at:` frontmatter; `text` still
the only required field), dedupes via `.index/ch-promote-ledger.txt` — replay
returns 200 `already saved ✓ <name>`, no second file; plain captures (no
`ch_item_id`) byte-for-byte unchanged. 7 oracles in `tests/test_ch_promote_ingest.py`, green on main. Live smoke
(promote one real CH item) deferred until the CH-side promote action is wired
(its own packet).

---


## After slice 8 — Phase 5 gate

Dogfood period: the system runs Kenja's real days. Phase 5 evaluation criteria come from
[[10-synthesis]] RQ6 + the win scenario: is capture habitual, does folding stay debt-free,
do resurfacing picks land. Only after surviving Phase 5: umbrella items (career-ops
dashboard, triage spin-off coordination with content-hoarder Epic 22).

## Backlog (unscheduled ideas)

Captured but not yet slotted into a slice or paused with a reactivation condition —
candidates for the post-slice-8 roadmap, to be designed against the design language
when picked up.

- **Notifications & reminders** *(Kenja, 2026-06-16)* — time-/event-aware nudges from the
  PKMS (due reshapes, surfaced reminders, capture follow-ups). Hard constraint from the
  research: **ration aggressively** — alert acceptance drops ~30% per repeat, so one
  ambient surface, varied form, silently-decaying queue, no accumulating debt and no
  guilt/overdue framing ([[16-academic]] SC8/RT6, [[40-handoff-content-hoarder]] #9).
  Open design questions: delivery channel (today-view card vs phone push vs Discord),
  what earns a reminder, and how reminders relate to the reshape clock and `[p]` paused
  reactivation conditions.
- **Smart routing at capture** *(Kenja, 2026-06-16)* — capture classifies by content type
  and routes to the right destination system instead of everything landing in
  `vault/inbox/`. E.g. YouTube videos → content-hoarder; Obsidian-style notes → the
  Obsidian vault (which content-hoarder already ingests); knowledge captures stay in the
  PKMS vault. Coordination point with content-hoarder (the triage inbox / system of record
  for raw saves — [[40-handoff-content-hoarder]]); must preserve the sacred zero-decision
  capture path (classification happens after the dump, never as a prompt at capture time).
- **Inbox surface in the new-tab/PWA** *(Kenja, 2026-06-29)* — ✅ shipped 2026-07-04
  as packet P2(b): density-gated `#inbox-surface` + `GET /api/inbox-items`. Left here
  only as history; do not re-open.

## Icebox (Phase 3 carries + later additions)

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
- **Fable's blind take on the visual-home UI** (Kenja, 2026-06-17) — when the Fable 5
  model is available again, have it produce its *own* design for the "see my notes"
  visual surfaces (area tiles + recognition cards with thumbnails — compare against the
  archived visual-home/new-tab work after Fable's draft exists) **blind**: without seeing
  this session's mockup, prior branch/tagged archive, or the discussion that produced it —
  an independent design to compare against, not a refinement of it. Why: parallel
  independent takes let Kenja pick the best from a list (the agent-grammar strength, §9 /
  judge-panel pattern) and surface framings the Opus 4.8 pass missed. Reactivation
  condition: Fable 5 restored. Keep it blind — don't point Fable at the archive or mockup
  until after it ships its own take, then diff the two.
