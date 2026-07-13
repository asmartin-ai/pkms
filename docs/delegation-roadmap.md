# PKMS continuation roadmap — delegation charter for Opus-tier executors

> Written 2026-07-02 by Fable 5 after a whole-project review. This file is the
> standing playbook for continuing PKMS with little or no live guidance.
>
> **Invocation pattern (how to use this file):** open a fresh Opus-tier session
> in this repo and say — *"Read `docs/delegation-roadmap.md`. Execute packet
> <ID>."* The file carries everything else: the law (§2), the state ritual
> (§3), and the packet specs (§5–§7). One packet per sitting. When a packet
> ships, append one status line under it (date · commit · outcome) and commit
> this file with the work.

---

## 1. What this project is (read this, then the canon)

PKMS is a **permanent ADHD prosthesis** for one user, Kenja — not a general
notes app. Markdown files in `vault/` are the only source of truth; SQLite in
`.index/` is a derived, regenerable index (`pkms index` rebuilds it, deleting
it must never lose anything). The system exists to make capture instant
(<2s, zero decisions), re-entry easy after gaps (breadcrumbs, one next
action), and old material come back as curiosity rather than debt. Shame is a
design input: no backlog counts, no red, no streaks, no "you haven't…" — ever.
Surfaces: Typer CLI (`pkms …`), Claude-skill agent layer (`/fold`, `/resume`),
and a token-gated web service (`pkms serve`, port 8765) rendering the
new-tab/PWA front end in `src/pkms/web/` (packaged Firefox copy in
`src/pkms/web_ext/`).

**Canon, in precedence order** (read by path, never copy content forward):

| Doc | What it binds |
|---|---|
| `K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md` | Every surface, flow, copy line, and mechanic. Non-negotiable. |
| `K:\Projects\adhd-design-language\VISUAL-LANGUAGE.md` | Shared visual layer ("Hearth", **Accepted 2026-07-03**): token schema, lamp/bench modes, component grammar. Lamplight is its lamp-mode reference — lands unchanged. Ratified G-B: PKMS swaps Atkinson→Lexend and Plex Mono→JetBrains Mono, plus Hearth token renames, riding the next scheduled front-end packet (token-level; no dedicated repaint). |
| `AGENTS.md` (repo root) | Repo rules, vault layout, commands, conventions. |
| `vault/projects/pkms-design/decisions.md` | The 10 closed design gates (G1–G10). Do not relitigate; a packet that seems to need a gate reopened goes back to Kenja. |
| `vault/projects/pkms-design/build-plan.md` | Slice history, backlog, icebox with reactivation conditions. |
| `PRODUCT.md`, `DESIGN.md` | Product framing; current visual system. |
| `vault/projects/pkms-design/sweep-findings-2026-06-17.md` | Bug/improvement ledger (mostly resolved; §1 headers say what's open). |
| `docs/redesign/fable-{directions,report}.md` | The Lamplight visual system: rationale + verified state. |

The research corpus behind all of this lives in `vault/resources/research/`
(00 = ground truths, 10 = synthesis, 11–21 = tracks). Cite it when making a
design argument; don't re-derive it.

---

## 2. Standing law (applies to every packet; violations void the run)

**Substrate invariants**
- Plain files stay the source of truth. User-visible state lives in note
  frontmatter/markdown, never only in the index. The index stays regenerable.
- No new runtime deps, no Node/build step, no framework. Vanilla JS front end.
  `pip install` needs explicit approval (venv-only if granted).
- API contract stability: existing `/api/*` routes, request/response field
  names, and the capture `POST /capture` contract don't change without a
  packet that says so. `/api/*` reads must stay side-effect-free (the B1 rule:
  resurface offers are recorded only on genuine interactive opens).

**Design-language floor** (full text in DESIGN-LANGUAGE.md — these recur):
- Capture is sacred: zero decisions on the dump path, instant honest
  confirmation, never opens a feed, text preserved on failure.
- One next action; backlog deemphasized (one click away), never a wall.
- No raw counts, no red for self-imposed states, no urgency theater, no
  streaks. Empty states are rewards. Completion (PAGE CLEARED) is the one
  loud moment.
- One ambient resurface prompt at a time; dismiss = silent no-renag rest;
  "let it go" = cheap, reversible forever-exit.
- Copy: plain, humane, sentence case, welcomes lapses. Agent grammar:
  present-then-ask, ONE question max, options not blank prompts.
- Accessibility: WCAG AA contrast, visible keyboard focus, reduced-motion
  honored, no color-only state. No AI-generated art or icons (Tabler MIT ok).

**No-touch / never-run**
- Never read-dump, edit, move, or delete: `vault/daily/**`, `vault/inbox/**`
  (personal content), `.index/**`, `.secrets/**`, `.venv/`, `.env`. Never
  print secret values. (Tracked design notes under `vault/projects/` and
  `vault/resources/research/` are fair to read.)
- Never run destructive/network CLI against the real vault: `delete`,
  `purge-done`, `decay --apply`, `bankruptcy --apply`, `reddit-sync`,
  `hn-sync`, `reddit-unsave`, `archive-media --apply`, `scan-media --apply`,
  `enrich --archives`, `reddit-hydrate*`. Packets never need them.
- Anything needing the user's real data for verification uses a **synthetic
  vault** instead (pattern: `tests/` fixtures, or the demo-server approach in
  `docs/redesign/fable-report.md` — temp vault + `make_server` on a spare
  port + throwaway token).

**Front-end packaging rule** (test-enforced by `tests/test_web_ext.py`):
`src/pkms/web/` is the source; after any front-end edit, re-copy `app.js`,
`styles.css`, `icon.svg` byte-identical into `src/pkms/web_ext/` and
regenerate `newtab.html` = `index.html` minus the manifest `<link>` and the
inline SW-registration `<script>`. Bump the `sw.js` cache version whenever
shell assets change.

**Verification discipline**
- Capture the pytest baseline number BEFORE changing anything; "no
  regressions" only means something against that number. Full suite:
  `.venv\Scripts\python.exe -m pytest -q`.
- Tests are contracts: update string-coupled assertions to new reality,
  never delete or weaken a test to go green. New behavior gets new tests.
- Verify artifacts by content, not exit codes. Label claims **confirmed**
  (names the check you ran) vs **inferred**. Front-end changes get a real
  browser pass (preview MCP; Pixel-6 412×915 viewport for mobile claims).
- Reviewable commits, one per coherent chunk, imperative subject ≤50 chars.
  Never force-push, rebase, or rewrite history. Never merge to `main`
  yourself — branches land via Kenja's review.

**Decision authority**
- Decide freely inside a packet's scope when consistent with the law and the
  closed gates — make the call, record it in the commit/report.
- Needs Kenja (present options, ONE question): reopening any G1–G10 gate; new
  ambient surfaces or notification mechanics; anything touching his accounts,
  credentials, or external services; visual-language pivots; deleting
  anything user-visible.
- The user dislikes unpolished agent output: agent-built systems should be
  finished-feeling ("ship ugly" applies only to work Kenja executes himself).

**Sub-delegation (optional, machine-local)**
This machine has an `aider-delegate` MCP + skill (`aider-headless-delegate`)
for offloading bounded, pytest-oracle-backed Python edits to DeepSeek. Use it
only for mechanical, oracle-able chunks (its own M11 rule: frontend/JS with no
Playwright oracle → edit directly). Verify with `git diff --stat`, never the
tool's applied-edit count; oracle test hash must be unchanged.

---

## 3. State ritual (run this first — docs lie, git doesn't)

This snapshot is from 2026-07-02 and WILL go stale. Before executing any
packet:

```sh
git branch -vv                     # what exists, what's merged
git status --short                 # in-flight work — do NOT sweep others' changes into your commits
git log --oneline -10 main
.venv\Scripts\python.exe -m pytest -q   # record the real baseline number
```

Snapshot (verify, don't trust — re-run the ritual): as of 2026-07-12, slices
1–8 agent-complete on `main`, Lamplight merged, suite **431 green**. Slice 7
device proof + Slice 8 credential wiring remain Kenja-hands
(`docs/kenja-gates.md`). P4 agent-half shipped (area tiles); content half
blocked on which areas Kenja wants. M1/M2/M3/M5 maintenance done. S1 is
decision-gated (`docs/s1-notifications-decision-gates.md`). Do not invent
life-area notes or start a Life-OS dashboard from here.

---

## 4. Blocked-on-Kenja ledger (surface these, don't wait on them)

Standing human actions that gate packets. When a packet hits one, do the
agent-side prep, then end with the single ▶ Kenja action.

| # | Action | ⏱ | Gates |
|---|---|---|---|
| K1 | Review Lamplight on real devices (Firefox ext new tab + Pixel PWA), verdict merge/fix | ~10 min | P0 — **done 2026-07-04; Lamplight merged** |
| K2 | Pixel HTTP-Shortcuts capture tile setup (`docs/pixel-capture-setup.md`) | ~10 min | P1 |
| K3 | Google Keep master-token dance (`docs/keep-setup.md`) | ~5 min | scheduled Keep pull |
| K4 | D1: pick email-in address shape (plus-alias+label vs dedicated) | ~1 min | P3 — plus-alias path documented in `docs/email-discord-setup.md`; still needs live wiring |
| K5 | Discord bot token + invite | ~10 min | P3 — code ready; token still Kenja |
| K6 | Reddit script app at reddit.com/prefs/apps (F2 fresh-URL promote) | ~10 min | icebox |

---

## 5. Packet queue (execute in order unless dependencies say otherwise)

Every packet: read §1 canon first, run §3 ritual, obey §2 law. Work on a
fresh branch named in the packet. Status lines get appended under each packet
as they ship.

### P0 — Land Lamplight
⏱ medium sitting · branch: continue `feat/uiux-redesign`
▶ Ask Kenja for the K1 device verdict; while waiting, fix the known nit:
`lede__sub` breadcrumb lines render a doubled marker when the daily-note
breadcrumb section uses `- ` bullets ("— - text") — strip a leading `- ` at
render time in `app.js` (frontend only; keep the CSS `—` marker).
Scope: `src/pkms/web/**` + `web_ext` sync + `tests/test_web_*.py`; after
merge approval, also rewrite `DESIGN.md` to document the Lamplight system
(tokens, type, the one-lit-object rule, motion) so the canon stops describing
the dead cream/serif look.
Decisions pre-made: keep Google-Fonts loading (offline degrades to system
stacks) — self-hosting woff2 is icebox material, not a blocker. Device
feedback beyond copy/CSS tweaks (e.g. "too dark", layout pivots) = new
direction conversation with Kenja, not silent rework.
✓ Done-when: branch merged by Kenja (or his fix list executed and re-reviewed),
`DESIGN.md` matches shipped reality, suite green at or above baseline.

**Status (2026-07-04, agent):** lede__sub doubled-marker nit fixed and committed
(`8b00796` — strip leading `- ` at render time in app.js, sw cache v2→v3, web_ext
re-synced). Suite green at 372. **K1 (device verdict) still blocks the rest of P0**
(merge + DESIGN.md rewrite happen after Kenja's review). Branch `feat/uiux-redesign`
carries the fix; not merged.

**Status (2026-07-04, later):** K1 approved; `feat/uiux-redesign` merged to `main`
(`5bf7f15`). DESIGN.md rewritten for Lamplight (`46551d5`). P0 closed.

### P1 — Slice-7 close-out: prove it on the Pixel
⏱ medium sitting · depends: P0 merged · branch `feat/pixel-proof`
▶ Write `docs/pixel-pwa-setup.md`: exact steps for Kenja — tailscale serve
mapping, install-to-homescreen from Chrome/Android, token handling
(`?token=` URL vs a future cleaner path), what to tap to verify.
Then support the live run: Kenja opens the PWA over tailnet, reads a promoted
thread, captures a thought from inside it (the slice-7 done-when, verbatim
from `build-plan.md`). Fix fallout small enough to be CSS/JS/doc-level;
anything bigger becomes a new packet.
Watch for: Android gesture-nav deadzones (no critical targets at screen
edges), standalone-display safe-areas (already padded via `env()` — verify),
keyboard-overlap on the capture field, PWA offline shell behavior (SW v2+).
✓ Done-when: all three device actions demonstrated by Kenja and any fixes
landed; `build-plan.md` slice-7 row flipped to ✓ with a dated note.

**Status (2026-07-04, agent):** `docs/pixel-pwa-setup.md` written and committed
(`3589839`) — tailscale serve mapping, Chrome-on-Android install, token handling
(URL form, cached at install; cleaner localStorage path is icebox), the three
slice-7 device actions, failure-mode table (gesture-nav deadzones, keyboard-
overlap, SW cache, theme-color), build-plan row flip procedure. **K1 + the live
run still block close-out.** Agent side is done; everything remaining needs Kenja.

**Status (2026-07-12):** Lamplight merge removed the K1 block. Remaining P1
close-out is still the live Pixel proof only (`docs/kenja-gates.md`).

### P2 — Web surface completion (recognition-first search + inbox surface)
⏱ one heavy sitting · depends: P0 · branch `feat/web-surfaces`
Two halves, one branch:
(a) **Real search candidates.** The search surface's recognition-first picker
renders `RECENT_NOTES = []` — a dead mock. Add token-gated
`GET /api/recent-notes` (recently touched notes: title, vault-relative `/`
path, last-touched; reuse index data; read-only, side-effect-free; cap ~8)
and wire `renderSearch()` to it. Free-text stays the labeled fallback.
Also wire the free-text input to actual results via a small token-gated
`GET /api/search?q=` → existing `search.search()` (literal-by-default
contract from B4 stays). Candidates first, results below, no result counts.
(b) **Inbox surface** (backlog item, Kenja-requested 2026-06-29): a calm
card/row surface showing recent `vault/inbox/` captures — recognition of
what's waiting, framed as progress ("safe here until folded"), NEVER a pile:
no count badges beyond the existing fold-progress copy, each item offers one
gentle action (open · start /fold externally · leave it). Density-gated
(`.block--optional` — visible in more/everything, hidden in calm).
Backend edits allowed here: `capture_service.py` + `today.py` route handlers
only (read-only endpoints, token-gated, tests first — follow the T2 oracle
pattern in `docs/superpowers/plans/2026-06-29-frontend-parallel-pipeline.md`).
Good aider-delegation candidates: the two backend endpoints (pytest-oracle
clean); keep all JS/design work first-party.
✓ Done-when: search shows real recent-note candidates + literal results from
live data; inbox items visible at density=more with design-language-clean
copy; new endpoint tests + updated web tests green; web_ext re-synced.

**Status (2026-07-04, agent):** BOTH halves shipped and committed.
- (a) search candidates: `GET /api/recent-notes` (`ee658c2`) — recently-touched
  notes (title, vault-relative `/` path, last-touched ISO), capped 8, mtime-sorted
  desc (index for candidate set, mtime is ground truth — `indexed_at` resets on
  every reindex, `modified` frontmatter is often empty). `GET /api/search?q=` —
  literal-by-default via search.search() (B4 contract preserved); empty/whitespace
  q → 200 [] (guards the FTS5 empty-query syntax error). Frontend wired (`1b10530`):
  RECENT_NOTES mock → real data, debounced free-text input → #search-results,
  quiet "last touched" relative label (_fmtTouched), no result counts.
- (b) inbox surface: `GET /api/inbox-items` (`0c1c5ba`) — recent captures (preview
  = FIRST LINE of body, truncated to 120 chars — recognition cues only, never a
  full content dump; source, captured ISO, path), capped 10, newest-first. Empty/
  missing inbox → []. Frontend: density-gated `#inbox-surface` block between the
  recognition rail and the actions block; renderInbox() hides on empty (empty state
  is a reward); each item one gentle action (open via the existing data-path
  handler). No count badges, no urgency cues (design §3/§6).
- Aider delegation of the (a) backend to DeepSeek-direct Pro hit the M6 8K output
  cap (analysis paralysis on the literal-search edge case); implemented directly
  with the spec as the guide. Delegation spec kept at `docs/delegations/p2-search-endpoints.md`.
- Suite: 372 → 391 (+3 B6 guards, +9 P2-search oracle, +7 P2-inbox oracle).
  web_ext re-synced byte-identical (test_web_ext.py asserts). SW cache v2 → v5.

### P3 — Slice 8: side-door batch (email-in + Discord bot)
⏱ medium-heavy sitting · depends: K4 + K5 · branch `feat/side-doors`
▶ Present K4's two options to Kenja (one question), then build whichever.
Ships per `build-plan.md` slice 8: Gmail-API poll of the chosen
address/label → inbox file (`source: email`, subject = first line);
minimal Discord bot (DM or dedicated channel) → POST `/capture`
(`source: discord`). Both idempotent, append-only, per-item ingestion
ledgers in `.index` (copy the per-note-ledger pattern from
`keep_ingest.py` post-B2 — never batch-ledger after the loop).
Credentials live in `.secrets/` (gitignored), never in code or logs; agent
never prints them. Scheduled pieces must not depend on interactive services
(AGENTS.md rule). This packet is backend+infra: strong aider candidates for
the parsing/ledger units; the Gmail/Discord auth wiring stays first-party.
✓ Done-when: an email and a Discord DM each land in `vault/inbox/` (proven
on a synthetic run + one real message Kenja sends), appear in the next
/fold, suite green, `build-plan.md` row flipped.

**Status (2026-07-06, agent):** code + oracles shipped on `main` —
`pkms ingest email`, `pkms discord-bot` (`979d848`), activation doc
(`e360540`). Synthetic path green; real email + Discord DM still need Kenja
credentials (K4/K5).

### P4 — F2: area tiles + populate `vault/areas/`
⏱ one heavy sitting · depends: P0 (visual system), best after P2 · branch `feat/area-tiles`
Half design, half content. Build the life-domain tile row for the today-view
(Projects / Career / Health / Money — start with Career, seeded from
`vault/resources/research/21-job-search-distill.md` conventions): each tile =
exactly ONE next action + a quiet "last touched" line; no counts; tiles obey
the Lamplight rule (they are dim desk objects — the lamp stays on the lead
action). `vault/areas/` is empty: author the initial area notes WITH Kenja
(one options-question for which areas to start; don't invent his life
structure). Next-action-per-area reuses `tasks.next_action_per_note`.
✓ Done-when: today-view (density=more+) shows one tile per populated area
rendering live data; area notes exist as first-class vault notes; tests for
the tile data source; Kenja recognizes it as "mine" (his reaction is the
acceptance bar, per the G5 precedent).

**Status (2026-07-06, agent, autonomous run):** the AGENT half is shipped —
`today.area_tiles()` + token-gated `GET /api/area-tiles` (oracle
`tests/test_area_tiles.py`, 14 tests, backend delegated to MiniMax M3 via the
CLI lane, one-shot) and the density-gated `#area-tiles` row in web + web_ext
(first-party, SW cache v5→v6). Tiles render title + ONE next action (reuses
`tasks.next_action_per_note`) + quiet last-touched; no counts; empty
`vault/areas/` → row hidden. The CONTENT half (authoring area notes WITH
Kenja — one options-question for which areas) remains open; nothing was
invented. Suite 430 green. Discovery: the indexer crashes on non-UTF8 vault
files (`frontmatter.load` → UnicodeDecodeError) — parked in §7 as M5.

### P5 — Phase 5 dogfood gate (after slices ship)
⏱ light setup + a 2-week clock + one review sitting · depends: P1, ideally P3
▶ Setup sitting: confirm all capture ramps + surfaces work end-to-end; write
`vault/projects/pkms-design/phase5-dogfood.md` with the evaluation criteria
from `10-synthesis` RQ6 + the win scenario: is capture habitual, does folding
stay debt-free, do resurfacing picks land, does re-entry work after gaps.
NO instrumentation/telemetry — evidence comes from Kenja's daily notes,
/resume breadcrumbs, and his direct answers at review time (behavioral
monitoring was explicitly rejected in Phase 0).
Then: 2 weeks of real use, agent hands off.
Review sitting: walk the criteria with Kenja (options, not essays), record
verdicts, and produce the post-Phase-5 plan (umbrella items — career-ops
dashboard, content-hoarder triage coordination, predictive partial sync —
unlock only if the gate passes).
✓ Done-when: phase5-dogfood.md holds dated verdicts per criterion and a
decided next-phase direction.

---

## 6. Spec-first packets (design before build — do NOT jump to code)

### S1 — Notifications & reminders (F4)
Blocked on design. Constraints already binding: ration aggressively (alert
acceptance drops ~30% per repeat), one ambient surface, varied form,
event-anchored (never clocks), silently-decaying queue, zero guilt framing.
Open questions to resolve WITH Kenja (options-grammar, one at a time across
sittings if needed): delivery channel (today-view card vs phone push vs
Discord), what earns a reminder, interaction with the 14d reshape clock and
`[p]` reactivation conditions. Deliverable: a decisions-doc section +
slice-shaped spec appended to `build-plan.md`. Build is a separate packet.

### S2 — Smart routing at capture (F5)
Blocked on design + content-hoarder coordination
(`vault/resources/research/40-handoff-content-hoarder.md`). Hard rule:
classification happens AFTER the dump — the capture path gains zero
decisions. Deliverable: routing-table spec (what goes where, what stays),
coordination notes with the content-hoarder session, slice-shaped spec.

---

## 7. Maintenance lane (fill spare capacity; never displaces a P-packet)

- **M1 — B6 CRLF strip**: `rstrip("\r")` in `tasks.extract_tasks` (or `\r?$`
  anchor) + the oracle sketched in sweep-findings §3. XS; fine inline.
  **Status (2026-07-04, agent):** investigated — B6 is NOT a live bug. The regex
  anchor does leak `\r` at the capture level, but `extract_tasks` `.strip()` and
  `task_hash` `.strip()` both mitigate it. Added `tests/test_line_endings.py` as a
  regression guard pinning the mitigation (`755179b`). NOT a usable bakeoff oracle
  (already green); the bakeoff plan's Phase 0 needs fresh RED oracles (its F-batch).
- **M2 — I4 ruff rule policy**: deliberate pass enabling
  `["E","F","I","S","UP","B"]` with per-file S101 ignores for tests and
  judged noqas (~345 findings — judgment work, not mechanical; do not
  delegate).
  **Status (2026-07-12, agent):** enabled on `main` (`bc33d7e`) with
  per-file ignores for tests. Residual lint is scripts/bakeoff-only.
- **M3 — docs freshness**: after any packet ships, reconcile README /
  AGENTS.md / DESIGN.md statements it invalidated. Docs that describe dead
  reality are how future sessions get poisoned.
  **Status (2026-07-12, agent):** README command list (`d020ed7`);
  DESIGN.md Lamplight + Hearth gate status; build-plan + this roadmap
  snapshot/status lines brought current.
- **M5 — indexer non-UTF8 hardening**: `index_vault` dies with a raw
  UnicodeDecodeError if any vault `*.md` file isn't valid UTF-8
  (`frontmatter.load(md_path)` at indexer.py:27). Found 2026-07-06 while
  writing the P4 oracle. Fix shape: try/except per file — skip + warn, never
  crash the whole index run. Small; pairs well with an oracle test. NOT
  urgent (real vault is UTF-8 today).
  **Status (2026-07-06, agent):** fixed same day, inline (decision-rule
  small). Skip + "skipped (unreadable)" note + stale index copy pruned like
  a deleted file. Regression test in `test_indexer.py` (`34fe308`).
- **M4 — publication-safety respect**: Kenja has an in-flight scrub
  (options.html help text, test path hygiene, `spike/` removal,
  `docs/publication-safety.md`). Never commit those files in a packet; if
  they block you, ask.

---

## 8. Icebox (do not start; reactivation conditions in build-plan.md)

Voice ramp · Discord resurfacing mirror · career-ops dashboard (post-P5) ·
predictive partial sync (post-P5, needs real usage) · Keep-via-official-API ·
Textual TUI · Rust/Go hot paths (needs a *measured* felt-slow path) ·
self-hosted fonts · card thumbnails beyond OCR'd images (little real imagery
exists in-vault; text cards are the design until that changes) · the blind
second visual take (partially superseded by Lamplight — revisit only if
Kenja still wants a comparison after living with Lamplight).

---

## 9. Maintaining this file

- Append status lines under packets; don't rewrite history.
- New work enters as a packet with the same anatomy (⏱ ▶ ✓ · scope ·
  decisions pre-made · done-when), or into §6/§7/§8.
- If reality and this file disagree, git and the test suite win — fix the
  file in the same commit as the discovery.
