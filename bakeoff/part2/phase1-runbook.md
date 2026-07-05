# PKMS Part 2 Bakeoff — Phase 1 Runbook

*Created 2026-07-05. The execution plan for Phase 1 of the PKMS Part 2
Correction-Cost Validation bakeoff. Activated when content-hoarder signals
done via ntfy topic `kenja-bench-r7k2q9`.*

**Plan source:** `K:/Users/Kenja/Documents/LLM-dev/bakeoffs/PKMS-Part2-Correction-Cost-Validation-2026-07-04.md`
**Skill source:** `~/.agents/skills/aider-headless-delegate/SKILL.md`
**Canonical Part 1 results:** `docs/delegations/bakeoff-phase1-results.{md,csv}`

---

## State at activation (verified 2026-07-05 before arming listener)

*Snapshot as of 2026-07-05 06:06 CDT (pre-signal). The `main` branch has since
been pushed to `origin/main` and is no longer ahead; the listener is no longer
running. This table records the state at the moment the listener was armed —
verify with `git status -sb`, `git log --oneline -5`, `lms ps` if reusing.*

| Item | State at activation | Verify (current) |
|---|---|---|
| PKMS branch | `main`, 3 ahead of origin (G-batch oracles + Part 2 results committed) | `git status -sb`, `git log --oneline -5` |
| Test baseline | **222 passed, 4 RED** (G1, G2, G3×2 oracles) | `.venv/Scripts/python.exe -m pytest tests/ -q` |
| G1 oracle | `tests/test_keep_ingest_db_durability.py` (multi-file: `keep_ingest.py` + `db.py`) | committed `61a495a` |
| G2 oracle | `tests/test_linker_orphans.py` (larger read context: `linker.py` + `db.py` + `tasks.py`) | committed `61a495a` |
| G3 oracle | `tests/test_today_snoozed.py` (single-file control: `today.py`) | committed `61a495a`, tightened `be4da63` |
| Phase 0 smoke | 3 rows in `bakeoff/part2/results.csv` (G3 cloud + G3 local weak + G3 local tightened) | `cat bakeoff/part2/results.csv` |
| ZenMux subscription | `healthy`, plan `starter`, expires 2026-08-04, 5h quota 95% used (auto-PAYG overflow keeps promo price) | `GET /api/v1/management/subscription/detail` |
| PAYG balance | $26.28 (plenty for 30 runs at ~$0.002–0.007/run) | `GET /api/v1/management/payg/balance` |
| Local model | `qwen3-coder-30b-a3b-instruct` on disk (14.71 GB), nothing loaded | `lms ls`, `lms ps` |
| `aider-delegate` | on PATH with `zenmux` provider preset | `aider-delegate --help` |
| Env keys | `ZENMUX_API_KEY`, `ZENMUX_PAYG_API_KEY`, `ZENMUX_MANAGEMENT_API_KEY` all set | `env \| grep -i zenmux` |
| ntfy listener | armed, PID 20320, polling every 30s with `since=1783231798` | `bakeoff/part2/logs/ntfy-listener.log` |

---

## Phase 1 shape (per plan §7)

**3 tasks × 5 models × 2 runs = 30 runs.** Serial (never parallel same-repo — M16).

### Tasks

| ID | Oracle file | In-scope files | Difficulty | Shape |
|---|---|---|---|---|
| G1 | `tests/test_keep_ingest_db_durability.py` | `src/pkms/keep_ingest.py`, `src/pkms/db.py` | Medium-hard | Multi-file: add `completed_keep_ids(index_dir)` durability surface |
| G2 | `tests/test_linker_orphans.py` | `src/pkms/linker.py` (+ may read `db.py`, `tasks.py`) | Medium-hard | Larger-read-context: add `find_orphans(index_dir)` walking the links table |
| G3 | `tests/test_today_snoozed.py` | `src/pkms/today.py` | Easy | Single-file control: add `snoozed` section + `hide_snoozed` flag to `today_view` |

### Models (5)

| Model | ZenMux ID | Tier | Notes |
|---|---|---|---|
| MiniMax M3 | `minimax/minimax-m3` | T3 Flash | Part 1 default — does it hold on harder tasks? |
| KAT-Coder-Pro-V2 | `kuaishou/kat-coder-pro-v2` | T3 Flash | Part 1 backup — 256K ctx, watch overflow on G2 |
| Kimi K2.7 Code | `moonshotai/kimi-k2.7-code` | T1/T2 Pro | Part 1 Pro winner — escalation candidate on G1/G2 |
| GLM-5.2 | `z-ai/glm-5.2` | T1/T2 Pro | Self-delegation (orchestrator == executor) — flag in notes |
| Qwen3-Coder-30B-A3B | `qwen3-coder-30b-a3b-instruct` | **Local control** | Free; load via `lms load` only for this arm, unload after |

### Arm ordering (per task)

For each task, run all 4 cloud arms first (serially), then load the local model, run the local arm, unload. Single load/unload transition per task (per plan §3.5).

**Order within a task:** G3-control first to confirm the harness, then G1, then G2 (harder). Actually — plan doesn't mandate task order; I'll go G3 → G1 → G2 (easy → hard) so a kill-fast on G3 saves budget.

### Run matrix (30 runs)

For each (task, model) pair: 2 runs. Record per run: `run_id, task_id, tier, executor_model, executor_id, run_n, orch_spec_tok_in, orch_spec_tok_out, orch_spec_usd, orch_corr_tok_in, orch_corr_tok_out, orch_corr_usd, exec_tok_in, exec_tok_out, exec_usd, total_usd, wallclock_s, gate_pass, quality_verdict, first_shot, retries, notes`.

---

## Delegation specs (pre-built, one per task)

### G3 — today_view snoozed section (single-file control)

**Goal:** Add a `snoozed` section to `today_view`'s output and a `hide_snoozed: bool = False` keyword arg that suppresses it.

**Delegation message:**
```
Make tests/test_today_snoozed.py pass without editing the test file.

The test asserts two things about today_view in src/pkms/today.py:
1. today_view(vault, index_dir) returns a dict with a "snoozed" key, a list of
   entries each shaped like {"note": <relative-path>, ...}, containing exactly the
   notes whose only open-but-unfinished tasks are not-now ([~]) — an active note
   (with a [ ] open task and no [~]) must NOT appear.
2. today_view(vault, index_dir, hide_snoozed=True) returns the same dict but with
   "snoozed" set to [] (suppressed); other sections (next_actions, breadcrumb)
   unchanged.

In scope: src/pkms/today.py ONLY. Do not edit any test file. Do not edit any
other source file. Use the existing pkms.db index (the indexer writes a tasks
table with a state column — see src/pkms/db.py and src/pkms/tasks.py for the
schema, but do NOT edit them). A task with state='not-now' (marker [~]) is
snoozed; a note is "snoozed" if it has at least one not-now task and NO open
task (state='open', marker [ ]). The existing _next_actions helper shows the
DB-query pattern; follow it.

Acceptance: K:\Projects\PKMS\.venv\Scripts\python.exe -m pytest
tests/test_today_snoozed.py -q exits 0 with 2 passed.
```

**In-scope files:** `src/pkms/today.py`
**Read-only context (optional --read):** `tests/test_today_snoozed.py`, `src/pkms/tasks.py`, `src/pkms/db.py`

### G1 — keep-ingest ledger durability (multi-file)

**Goal:** Add `completed_keep_ids(index_dir)` to `keep_ingest` that returns a set/dict of keep note IDs recorded as completed in a durable SQLite store, so dedupe state is recoverable after a partial-failure crash.

**Delegation message:**
```
Make tests/test_keep_ingest_db_durability.py pass without editing the test file.

The test simulates a partial failure: append_ledger seeds an existing ID, then
ingest_keep runs with a flaky write_capture that raises on the 2nd note. After
the (caught) failure, the test calls keep_ingest.completed_keep_ids(index_dir)
and asserts:
  - "n1" (the note that wrote successfully before the crash) IS in the returned
    collection
  - "n2" (the note that failed mid-capture) is NOT in the returned collection

The contract: a completed keep note ID must be recoverable from the SQLite
index (a durable, queryable store), not solely from the append-only flat ledger
file at .index/keep-ledger.txt. The recovery surface must be a function on the
keep_ingest module named completed_keep_ids.

In scope: src/pkms/keep_ingest.py and src/pkms/db.py. Do not edit any test file.
Do not edit any other source file. The durable store must be the SQLite
pkms.db (the existing index database, schema in src/pkms/db.py). Add a new
table in the SCHEMA string for completed keep IDs (e.g. keep_completed(id TEXT
PRIMARY KEY, ...) and a migration in connect() if user_version bumps. Record
the ID into this table right after write_capture succeeds for each note (before
or alongside append_ledger — but the test only checks the SQLite store, so the
flat ledger alone is insufficient). completed_keep_ids(index_dir) must return a
set (or set-like) of IDs currently in that table.

Acceptance: K:\Projects\PKMS\.venv\Scripts\python.exe -m pytest
tests/test_keep_ingest_db_durability.py -q exits 0 with 1 passed.
```

**In-scope files:** `src/pkms/keep_ingest.py`, `src/pkms/db.py`
**Read-only context:** `tests/test_keep_ingest_db_durability.py`

### G2 — linker orphan detection (larger-read-context)

**Goal:** Add `find_orphans(index_dir)` to `linker` that walks the `links` table and returns wikilink targets that resolve to no indexed note, each with the list of source notes that reference it.

**Delegation message:**
```
Make tests/test_linker_orphans.py pass without editing the test file.

The test asserts:
  - pkms.linker.find_orphans exists and returns a list
  - the list is non-empty (at least one orphan)
  - each entry has a "target" (the missing wikilink text) and "sources" (a list
    of note paths that reference it)
  - "gamma" is among the targets (the fixture's alpha.md references [[gamma]]
    but gamma.md does not exist in the vault)
  - "projects/alpha.md" is among gamma's sources
  - "beta" is NOT among the targets (beta resolves to resources/beta.md)

In scope: src/pkms/linker.py. Do not edit any test file. Do not edit any other
source file. The links table (schema in src/pkms/db.py — read it for context,
do NOT edit it) stores (source, target) pairs where target is the raw wikilink
text. The notes table stores indexed note paths. A wikilink target "resolves"
if a note with a matching path-or-stem exists in the notes table: target text
like "gamma" matches a note path ending in "gamma.md" (case-insensitive stem
match); target text like "gamma|the gamma note" splits on the pipe — but the
links table stores the raw target so check the WIKILINK_RE convention. Walk all
links, group by target, and for each target with no matching note, emit
{"target": <raw>, "sources": [sorted source paths]}. Use src/pkms/db.connect to
open the index.

Acceptance: K:\Projects\PKMS\.venv\Scripts\python.exe -m pytest
tests/test_linker_orphans.py -q exits 0 with 1 passed.
```

**In-scope files:** `src/pkms/linker.py`
**Read-only context:** `tests/test_linker_orphans.py`, `src/pkms/db.py`, `src/pkms/tasks.py`

---

## Per-run protocol (every arm)

For each (task, model, run_n):

1. **Record oracle hash before:**
   ```sh
   ORACLE=tests/test_<oracle>.py
   HASH_BEFORE=$(git hash-object $ORACLE)
   ```
2. **Confirm clean tree + on `main`:** `git status -sb` (the wrapper auto-creates `delegated/run-<id>` off HEAD).
3. **Invoke aider-delegate:**
   ```sh
   aider-delegate \
     --repo-path K:/Projects/PKMS \
     --message "<the delegation spec from above>" \
     --editable-files src/pkms/<file>.py [src/pkms/<file2>.py ...] \
     --read-files tests/test_<oracle>.py [src/pkms/<read-only-context>.py ...] \
     --provider zenmux \
     --model <ZenMux-id> \
     --test-cmd "K:\Projects\PKMS\.venv\Scripts\python.exe -m pytest tests\test_<oracle>.py -q" \
     --pretty > bakeoff/part2/logs/<run_id>.log 2>&1
   ```
   For the local arm (Qwen3-Coder), replace `--provider zenmux --model <id>` with:
   ```sh
   --api-base http://127.0.0.1:1234/v1 --api-key-env LMSTUDIO_API_KEY --api-format openai \
   --model qwen3-coder-30b-a3b-instruct
   ```
   And before the local arm: `lms load qwen3-coder-30b-a3b-instruct -y --ttl 300` + `lms ps` confirm.
   After: `lms unload` + `lms ps` confirm "No models currently loaded".
4. **Verify per the aider-headless-delegate 4-check:**
   - `git diff --stat` shows edits in ONLY the spec's in-scope files (M13: ignore `applied_edit_count`)
   - `git status -s` scope = only the spec's files (no stray test/harness files — M15)
   - `HASH_AFTER=$(git hash-object $ORACLE)` == `HASH_BEFORE` (oracle integrity — VOID if changed)
   - Full suite green: `.venv/Scripts/python.exe -m pytest tests/ -q` → 226 passed (222 + 4 G-batch now green), 0 failed
5. **Review the diff** for test-gaming/hacks (M5/M6: check for token-limit truncation on G1/G2 which have larger edits). Quality verdict: `pass` or `flag`.
6. **Log the run** to `bakeoff/part2/results.csv` (append).
7. **Commit the run-branch** so it's reviewable. The wrapper left the result on `delegated/run-<id>`; commit with `git add <in-scope files> && git commit -m "bakeoff part2 <run_id>"`. Then `git checkout main` to restore the clean baseline for the next arm.

### Cost computation (M18 — `cost_reported` will be null on ZenMux)

From the wrapper's stdout/result, capture `exec_tok_in` / `exec_tok_out`. Compute:
- T3 Flash rate: `exec_usd = (tok_in × 0.14 + tok_out × 0.28) / 1e6`
- T1/T2 Pro rate: `exec_usd = (tok_in × 0.435 + tok_out × 0.87) / 1e6`
- Local arm: `exec_usd = 0` by construction

Orchestrator correction tokens (the variable of interest in Part 2): if the first shot passes review clean, `orch_corr_usd = 0` and `first_shot = true`. If I had to re-spec or fix the diff, log those tokens and `first_shot = false`.

### Run-branch cleanup

After each arm, the `delegated/run-<id>` branch holds the result. Keep it for review (the plan says "never auto-merge; human reviews after"). After committing, `git checkout main` to restore baseline. Don't delete the run-branches.

---

## Kill-fast gates (plan §7)

- If any model's first 3 runs all fail with the same root cause (e.g. context overflow on a 256K model for G2), stop and log it as the verdict for that model.
- If the ZenMux subscription drops to `monitored`/`abusive` or PAYG balance < $2, pause and surface.
- If baseline can't be cleaned (oracles not red for the right reason), stop.

## Done-when (plan §10)

- [ ] 30 runs logged in `bakeoff/part2/results.csv`
- [ ] Per-model metrics computed: pass rate, median $/task total, first-shot rate, median correction cost
- [ ] Part 2 verdict written: does the routing table hold? Is correction cost a real driver?
- [ ] Local control verdict: does Qwen3-Coder-30B-A3B clear the cloud floor on G3 (single-file control)?
- [ ] Update `NEXT.md` with the verdict + next actions
- [ ] Tear down the ntfy listener (PID 20320)

---

## Tear-down (session end)

```sh
pkill -f ntfy_listener 2>/dev/null
lms unload 2>/dev/null  # if a local arm left a model loaded
ps -ef | grep -E 'ntfy_listener|lms|aider' | grep -v grep  # confirm clean
```
