---
title: PKMS repo sweep — bugs, improvements, scoped features (work order)
tags: [pkms-design, sweep, work-order, bugs, adhd]
created: 2026-06-17
modified: 2026-06-17
status: open
---

# PKMS sweep work order (2026-06-17)

A self-contained backlog from a systematic repo sweep. Written so a fresh session
(no prior context) can execute any item cold. Three parts: **bugs**, **improvements**,
**features**. Each item is scoped (location, fix, acceptance).

---

## 0. Context for a fresh reader

- **What this is:** a personal knowledge-management system (PKMS). Markdown files in
  `vault/` are the source of truth; SQLite `.index/pkms.db` is a **derived, regenerable**
  index (rebuild with `pkms index`). Python, Windows. Library in `src/pkms/`, tests in
  `tests/`, CLI is Typer (`src/pkms/cli.py`). The `pkms` shim works in any shell.
- **Design language (binding):** before designing any surface, flow, or copy, read
  `K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md`. Load-bearing rules referenced
  below: recognition over recall (§5); **no raw backlog counts / no walls** (§3, §6);
  resurfacing is rationed, machine-initiated, **side-effect-free to read** (§5); one next
  action (§6); novelty is scratched at the **view layer** while the file/SQLite substrate
  stays boring (§8); capture is sacred/zero-decision (§1).
- **Current build state:** slices 1–6 shipped; slice 7 (Phone PWA) in progress (increment 1,
  the desktop today-view web app, landed). Repo is **private** on GitHub
  (`asmartin-ai/pkms`); CI runs ruff + pytest. Live branches: `main`,
  `feat/visual-home` (UI work), `chore/docs-sweep` (doc fixes + this file).
- **Run the tests:** `.venv\Scripts\python.exe -m pytest tests -q` (130 passing baseline).
  Lint: `.venv\Scripts\python.exe -m ruff check .`

---

## 1. Bugs

Severity: **high** = wrong results / data loss · **medium** · **low**.
Confidence: **confirmed** = code path traced this sweep · **suspected** = needs a repro.

### B1 — Resurface card mutates on every read of `/api/today` *(high, confirmed)*
- **Where:** `src/pkms/today.py:124` `today_view()` → `:109` `_resurface_card()` → calls
  `mark_offered()` in `src/pkms/resurface.py:156` (`offer_count = offer_count + 1`,
  `rest_until = …`, `conn.commit()`). The web app re-reads `/api/today` after every
  capture: `src/pkms/capture_service.py:280` `save()` → on success calls `load()` (`:287`)
  → `GET /api/today` (`:347`) → `today_view()`.
- **Symptom:** every captured thought silently advances the resurface card's `offer_count`
  and pushes its rest window forward, so the rationed card rests far more aggressively than
  designed and rotates its question template **without ever being seen**. Any plain browser
  refresh or external `GET /api/today` also burns it. Directly violates the design-language
  rule that resurfacing is side-effect-free to read ("call once per open, never on a poll").
- **Fix:** make `/api/today` (and `today_view`) **read-only**. Move the `mark_offered`
  side-effect out of `today_view`; record an offer only on a genuine interactive open —
  e.g. add `today_view(..., record_offer: bool = False)` and pass `True` only from the CLI
  `pkms today` path, or expose a separate `POST /api/today/seen` the page calls once on
  first open (not on capture-reload).
- **Acceptance:** a test that calls `today_view()` twice and asserts `offer_count` is
  unchanged by the read; the CLI/interactive path still advances it exactly once per open.

### B2 — Keep-ingest ledger appended only after the whole loop *(medium, confirmed)*
- **Where:** `src/pkms/keep_ingest.py` — `done_ids` accumulates inside
  `for note in new_notes:` and `append_ledger(index_dir, done_ids)` runs **once after** the
  loop (the line right after `report["new"] += 1`).
- **Symptom:** if anything raises mid-loop (`extract_text`, `keep.getMediaLink`, a
  non-`OSError` from `_download`, `write_capture`), captures already written to
  `vault/inbox/` are on disk but their ids never reach the ledger → re-ingested as
  **duplicate** timestamped files on the next run (dedupe is id-via-ledger only).
- **Fix:** append each `note.id` to the ledger immediately after its capture is written
  (per-note), or wrap the loop so written ids are flushed in a `finally`.
- **Acceptance:** a test where the 2nd note raises mid-loop asserts the 1st note's id is
  ledgered (and not re-ingested on a second `ingest_keep` call).

### B3 — OCR `subprocess.run` can raise `FileNotFoundError`, aborting the pull *(medium, confirmed)*
- **Where:** `src/pkms/ocr.py:31` `extract_text()` calls `subprocess.run([str(exe), …])`
  with no try/except. In `keep_ingest.py` only `_download` is wrapped in `try/except OSError`;
  the following `extract_text(...)` call is unguarded.
- **Symptom:** if the tesseract path is stale/unlaunchable, `subprocess.run` raises
  `FileNotFoundError` (an `OSError`), which propagates out and aborts the whole scheduled
  Keep pull — and compounds B2 (the in-progress batch isn't ledgered).
- **Fix:** wrap the `subprocess.run` in `try/except OSError: return None` (None = "no engine",
  which the caller already discloses gracefully).
- **Acceptance:** `test_ocr.py` (see I2) asserts a launch failure returns `None` rather than
  raising; a keep-ingest test with OCR raising still completes and ledgers prior notes.

### B4 — Search runs raw user text through FTS5; sanitize is only an error-fallback *(medium, confirmed)*
- **Where:** `src/pkms/search.py` — `_SQL` does `WHERE notes_fts MATCH ?` with the **raw**
  query first; `_sanitize` is applied only in the `except sqlite3.OperationalError` retry.
- **Symptom:** queries that are *valid* FTS5 but not what the user meant don't raise, so they
  silently execute as operators: `foo OR bar`, `foo NEAR bar`, `title:foo`, leading `*`.
  Only syntactically *invalid* cases (e.g. a lone hyphen) raise and get sanitized. Plain-text
  search therefore returns wrong/empty results without erroring.
- **Fix:** if plain-text is the contract, sanitize **unconditionally** (`_sanitize(query)`);
  put raw-FTS behind an explicit `--raw` flag if power-search is ever wanted.
- **Acceptance:** a test that `search("foo OR bar")` matches a note literally containing
  "foo OR bar" and does **not** treat `OR` as an operator.

### B5 — `promote._day` uses local-time conversion on UTC epoch values *(low, confirmed)*
- **Where:** `src/pkms/promote.py:99` `_day()` uses `datetime.fromtimestamp(utc)` on values
  named `*_utc` (epoch seconds). Conversion uses the local timezone.
- **Symptom:** rendered `posted:` / `saved:` provenance dates can be a day off near midnight.
  Cosmetic (frontmatter provenance only), not load-bearing.
- **Fix:** `datetime.fromtimestamp(utc, tz=timezone.utc).date().isoformat()`.

### B6 — CRLF could leak into task text / hash *(low, suspected)*
- **Where:** `src/pkms/tasks.py:34` `TASK_RE` ending `.+$`. All current readers use
  `Path.read_text()`/`frontmatter.load` (universal newlines), so today it's clean.
- **Risk:** if any future reader opens with `newline=""` or via bytes, a trailing `\r` would
  leak into `text` and the line hash → silently resets every task's reshape clock.
- **Fix (cheap insurance):** `rstrip("\r")` in `extract_tasks`, or anchor `\r?$`.

### B7 — `linker.resolve_link` case-insensitive match is filesystem-order dependent *(low, suspected)*
- **Where:** `src/pkms/linker.py:14` returns the first `rglob` hit on a case-insensitive
  match. Currently **unused** by the indexer (see I5), so low impact.
- **Fix:** prefer an exact-case match across the full scan before any case-insensitive
  fallback (or drop the function per I5).

---

## 2. Improvements

Effort: **S** (<1h) · **M** (half-day) · **L** (multi-session). "Behavior:" flags anything
that changes runtime behavior vs pure cleanup/tests.

### I1 — CI tests only py3.12 but the floor is py3.11 *(S, tooling)*
`pyproject.toml` declares `requires-python = ">=3.11"` / `target-version = "py311"`, but
`.github/workflows/ci.yml` runs only 3.12. Add a matrix `python-version: ["3.11", "3.12"]`.
Also bump `actions/checkout@v4`→`@v5` and `actions/setup-python@v5`→`@v6` to clear the
Node-20 deprecation warning. Benefit: the declared support floor is actually verified.

### I2 — `test_ocr.py` is missing *(M, tests)*
`src/pkms/ocr.py` has **zero direct tests** (keep-ingest tests monkeypatch `extract_text`
away). It guards the load-bearing `None` (no engine) vs `""` (engine ran, no text)
distinction the OCR-disclosure UX hinges on. Add a `test_ocr.py` faking
`subprocess.run`/`shutil.which` to assert: no engine → `None`; returncode≠0 → `""`;
returncode 0 → stripped stdout; and the `_CANDIDATES` fallback. Pairs with B3.

### I3 — Duplicated "one next action per note" SQL *(M, cleanup)*
The identical GROUP-BY / projects-first query appears in `src/pkms/cli.py:149` (`tasks`
default) and `src/pkms/today.py:62` (`_next_actions`). They will drift. Extract one helper
(e.g. `tasks.next_action_per_note(conn)`) and call from both — single source of truth for
the core ranking rule. Behavior: none (pure refactor; keep tests green).

### I4 — Ruff selects no rule set; existing `# noqa` annotations are inert *(S, tooling)*
`[tool.ruff]` sets only `line-length`/`target-version`, so only the default `E`/`F` run.
Tests already carry `# noqa: S310` (`tests/test_capture_service.py`), implying intent to run
`S` rules that isn't enabled. Add `[tool.ruff.lint] select = ["E","F","I","S","UP","B"]`
(at minimum `I` for import sorting). Benefit: import hygiene is enforced and existing noqa's
become meaningful; auto-catches I7's repeated local imports. Behavior: none (lint only).

### I5 — `linker.resolve_link` is tested but called by nothing *(S, cleanup)*
`src/pkms/linker.py:14` is an orphaned parallel resolution path (the indexer stores raw
wikilink text and resolves by stem at query time in `search.backlinks`). Either wire it in
or delete it with its test — today it's coverage protecting dead code. Resolves B7 if deleted.

### I6 — Packaging hygiene *(S, tooling)*
`pyproject.toml` dev extras (`pytest-cov`, `ruff`, `Pillow`) have no lower bounds; `ruff`
unbounded means a future breaking release can fail CI unexpectedly (pin `ruff>=0.6`).
`pytest-cov` is declared but **no `--cov` is configured** anywhere — either wire coverage in
(`[tool.pytest.ini_options]` + CI flag) or drop the dep.

### I7 — Small cleanups *(S each, cleanup)*
- `src/pkms/cli.py` — `from rich.markup import escape` is re-imported locally 7+ times (twice
  aliased `_esc`); hoist to one module-level import.
- `src/pkms/keep_ingest.py` — `import json` appears twice inside one function; hoist to top.
- `src/pkms/indexer.py:53` — `datetime.now().date().isoformat()` is recomputed per note inside
  the loop; hoist above it.
- `src/pkms/cli.py:393` (`new`) — slugging lacks the `-2` collision suffix that
  `write_capture`/`write_note` have; two titles slugging identically silently collide.
  (Low priority for a solo tool; flagged as an inconsistent pattern.)

---

## 3. Features (scoped & defined)

The headline direction (agreed 2026-06-17): the PKMS should be **more than a thought dump —
you can "see" your notes and items.** Per the design language this means **recognition-first
visual surfaces over curated slices**, NOT an Obsidian-style graph of the whole pile (the
research flags the graph view as the canonical abandonment artifact). All visual work is a
**view-layer evolution of the slice-7 web today-view**, not a new app; the file + SQLite
substrate does not change.

> **UI design is intentionally open.** There is an icebox request to get a *blind* second
> design take from another model. So these features scope **capability, data, and acceptance
> + the binding design-language constraints** — not the exact visual look. An implementer
> should propose the look within those constraints.

### F1 — Recognition card row in the web today-view *(first increment; branch `feat/visual-home`)*
- **What:** add a horizontal row of visual cards to the desktop today-view: promoted reading
  notes, resurfacing candidates, and OCR'd image captures rendered as cards **with
  thumbnails** (YouTube/thread/image), each with a one-line "why this" and a ⏱ consume-cost
  pill where relevant.
- **Data (already exists):** promoted notes (`reading: queued` frontmatter,
  `vault/resources/reading/`), the resurface candidate set (`src/pkms/resurface.py`), OCR'd
  image notes (`vault/media/keep/`). Served via `/api/today` (`capture_service.py`).
- **Constraints:** curated slice only (~3 cards, **never the raw pile**, §3/§6); thumbnails
  obey content-class fates (§5 — identity/entertainment never resurfaces as work); resurface
  cards carry the question + "not now" (silent no-renag) + "let it go" (forever-exit) per §5;
  **must not** reintroduce B1 (reads stay side-effect-free).
- **Acceptance:** on the desktop today-view, ~3 visual cards render from real index data with
  thumbnails + "why this"; no raw counts anywhere; opening the view does not mutate resurface
  state.
- **Depends on:** B1 fixed first (otherwise the card row worsens the resurface corruption).

### F2 — Area tiles + populate `areas/` *(second increment)*
- **What:** a row of life-domain tiles (Projects, Career, Health, Money/Finance), each
  showing **one** next action and a quiet "last touched" line — a glanceable life-OS.
- **Data:** `vault/areas/` is currently empty; this feature populates it as first-class notes
  (start with Career — research exists in `vault/resources/research/21-job-search-distill.md`).
  Next-action per area reuses the existing per-note ranking (see I3).
- **Constraints:** each tile is exactly one next action so N domains ≠ a wall (§6); no counts.
- **Acceptance:** the today-view shows one tile per populated area, each with a single next
  action sourced from that area's notes.

### F3 — Gated "everything" / board view *(later; highest wall-risk)*
- **What:** an optional fuller board/canvas showing more items spatially.
- **Constraints:** **gated behind the density control** ("calm / more / everything") — the
  single sanctioned personalization knob (§8, personalization-as-decluttering). **Never the
  default**, because an always-on wall of items is the documented abandonment pattern.
- **Acceptance:** default view stays curated; "everything" is reachable only via an explicit
  density choice.

### F4 — Notifications & reminders *(backlog; design-gated)*
- **What:** time-/event-aware nudges (due reshapes, surfaced reminders, capture follow-ups).
- **Hard constraints (from research):** **ration aggressively** — alert acceptance drops ~30%
  per repeat; one ambient surface, varied form, silently-decaying queue, no accumulating debt,
  no guilt/overdue framing. Anchor to **events** (opening a project, creating the daily note),
  not clocks (§5: time-based prospective memory is impaired). See `16-academic` SC8/RT6.
- **Open design questions:** delivery channel (today-view card vs phone push vs Discord);
  what earns a reminder; relation to the reshape clock and `[p]` paused reactivation conditions.
- **Status:** scoped, not yet specced into a slice.

### F5 — Smart routing at capture *(backlog; design-gated)*
- **What:** capture classifies by content type and routes to the right destination instead of
  everything landing in `vault/inbox/`. E.g. YouTube videos → content-hoarder; Obsidian-style
  notes → the Obsidian vault (already ingested by content-hoarder); knowledge captures stay
  in the PKMS vault.
- **Hard constraint:** preserve the sacred zero-decision capture path — classification happens
  **after** the dump, never as a prompt at capture time (§1). Coordination point with
  content-hoarder (the triage inbox / system of record for raw saves; see
  `vault/resources/research/40-handoff-content-hoarder.md`).
- **Status:** scoped, not yet specced into a slice.

### F6 — Normalize index path separators to forward slash *(enabler for the visual/web surface)*
- **What:** the index currently stores **OS-native** path separators (`projects\alpha.md` on
  Windows). Fine for a gitignored/regenerable index, but as note paths flow into the growing
  web/PWA surface (hrefs, URLs), a backslash is technically invalid in a URL.
- **Fix:** normalize stored/returned paths to `/` in the indexer/linker layer; update the
  (already cross-platform) tests accordingly.
- **Behavior:** changes stored path format — re-`pkms index` after; verify the web today-view
  and any path-keyed lookups. Lands naturally with F1.

---

## Appendix — also recorded

- **Icebox (in `build-plan.md`):** when Fable 5 is restored, get its **blind** take on the
  visual-home UI (F1–F3) without the context of the existing mockup/branch — an independent
  design to compare, not refine.
- **Judgment calls left to the user (private repo, low urgency):** four "Aaron" self-references
  in `vault/resources/research/21-job-search-distill.md` and `00-ground-truths.md`, and a
  hardcoded tailnet IP in `docs/pixel-capture-setup.md` — scrub to "Kenja"/placeholder only
  if consistency is wanted.
