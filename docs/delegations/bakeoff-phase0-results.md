# Bakeoff Phase 0 — Results & Verdict

**Branch:** `bakeoff/phase0` (off `feat/uiux-redesign` clean 391 baseline)
**Date:** 2026-07-04
**Status:** Smoke-complete. Real T3×N sweep deferred to fresh session per plan §5 symmetry rules.

## What ran

Three F-batch RED oracles (authored by GLM-5.2 orchestrator) → one DeepSeek-direct Pro
delegation each (smoke of the `aider-delegate` → DeepSeek-direct pipeline on PKMS).

| # | Oracle | RED-for-right-reason | Executor | Cost | Edits | Gate | Quality |
|---|---|---|---|---|---|---|---|
| F1 | `pkms search --raw` CLI flag missing (`No such option: --raw`) | ✓ | DeepSeek V4 Pro | $0.0078 | 1 | pass | pass |
| F2 | `extract_tasks()` no `wake` field (`KeyError: 'wake'`) | ✓ | DeepSeek V4 Pro | $0.0084 | 1 | pass | pass |
| F3 | `search.search("")` raises `OperationalError: fts5: syntax error near ""` | ✓ | DeepSeek V4 Pro | $0.0031 | 1 | pass | pass |
| F3 (ZenMux) | same oracle, ZenMux endpoint | ✓ | DeepSeek V4 Pro (via ZenMux) | **see dashboard** | 1 | pass | pass |

**Total executor cost (DeepSeek-direct):** $0.0193. **ZenMux cross-check run:** cost unreported
by aider (no model-metadata entry for the doubled-prefix id); find on ZenMux dashboard by
timestamp **2026-07-04T17:47:21Z** (5.2k sent, 2.6k received; Pro line $0.435/$0.87 per M).
**Total:** 3 edits across 3 disjoint files (`cli.py`, `tasks.py`, `search.py`); the ZenMux
run reproduced the F3 fix byte-identically.
**Baseline:** 391 → 402 passing (+9 F-batch tests green, +2 incidental from F-batch parametrization).

## Verification (per `aider-headless-delegate` 4-check protocol)

Every run:
1. Oracle hash unchanged (F1 `40b3cf5…`, F2 `6acfa30…`, F3 `4f8f07d…` — recorded before, asserted after).
2. `git diff --stat` scope = only the spec's editable file (1 file each).
3. Diff content reviewed — no test-gaming, no harness files, no signature regressions.
4. Full suite green at/above baseline each run (393 → 394 → 398 → 402).

## What this proves

- **Pipeline works end-to-end** on PKMS: `aider-delegate` CLI → DeepSeek-direct Pro →
  `--edit-format diff` → pytest oracle gate → run-branch isolation. 3/3 first-shot, 0 retries,
  0 stream-drops, 0 token-cap truncations (all edits were ≤7 lines, well under the M6 8K ceiling).
- **DeepSeek-direct Pro handles small oracle-able edits cleanly** at ~$0.003–0.008/fix.
  This is the cheap-delegate lane the orchestrator-mode routing table predicts.
- **F-batch oracle authoring works** as the Phase 0 deliverable: 3 fresh RED tests, all
  red-for-the-right-reason, all green after one delegate run each.

## What this does NOT prove

- **Not the bakeoff.** This is the smoke. The real Phase 1 is T3 × 3-4 tasks × 6 models × 2-3 runs
  = 24+ runs, plus Phase 2 (T1/T2 Pro tier) = 12+ more. Plan §5 requires a fresh session for
  symmetry (identical spec/orchestrator/review for every arm; 2-3× variance per model).
- **No T3 (Flash) data yet.** Only Pro-tier executor exercised. The price-to-performance
  question (does Flash beat Pro on this workload at ~3× cheaper?) is the whole point and
  needs Phase 1.
- **Token reporting cross-check:** the 3 DeepSeek-direct runs can't be cross-checked on
  ZenMux (different endpoint). The ZenMux run (F3-via-ZenMux, ts 2026-07-04T17:47:21Z) is the
  cross-check data point — **Kenja verifies the ZenMux dashboard $ for that call**. If it
  matches the Pro-line math (5.2k × $0.435/M in + 2.6k × $0.87/M out ≈ $0.0045), aider-delegate's
  token counter is trustworthy for the real bakeoff. If it diverges, the real bakeoff's $/task
  column has to come from the dashboard, not aider-delegate (plan §6 token-counting-bug pitfall).

## Phase 0 checklist status (plan §10)

- [x] Clean PKMS test baseline (391 on `feat/uiux-redesign` — the plan's "44 collection
      errors / 145 on main" baseline concern is STALE; the redesign branch is clean).
- [x] Author fresh F-batch RED oracles (3) — all verified red-for-the-right-reason.
- [x] B6 RED oracle — NOT usable (already green, per M1 status in delegation-roadmap.md).
      The plan acknowledged this; F-batch replaces it.
- [x] Smoke aider-delegate → DeepSeek-direct pipeline (3 runs, all green).
- [x] Smoke aider-delegate → ZenMux raw endpoint (1 run, F3 fix reproduced byte-identical;
      ts 2026-07-04T17:47:21Z for the dashboard cross-check). **Kenja verifies the dashboard
      $ for that call vs the Pro-line math (~$0.0045 expected).** GATES trustworthy $/task
      reporting in the real bakeoff.
- [ ] Wire T3 + T1/T2 executor models into aider-delegate provider config (setup for real run).
- [ ] Seed results CSV — header + these 4 smoke rows in `bakeoff-phase0-results.csv` (done as
      a template; the real CSV lives wherever the fresh bakeoff session puts it).
- [ ] Run Phase 1 (T3 × 3-4 tasks × 6 models × 2-3 runs) — fresh session.
- [ ] Run Phase 2 (T1/T2 × 3-4 models × 2-3 runs) — fresh session, after Phase 1.
- [ ] Compute metrics, build routing table, write verdict.

## Deliverables on this branch

- `tests/test_f1_search_raw_cli.py` — RED → green oracle (committed `3cbc55b`)
- `tests/test_f2_task_paused_wake_field.py` — RED → green oracle (committed `3cbc55b`)
- `tests/test_f3_search_empty_query_guard.py` — RED → green oracle (committed `3cbc55b`)
- `src/pkms/cli.py` — F1 fix: `--raw` flag (committed `284ff1e`)
- `src/pkms/tasks.py` — F2 fix: `wake` field (committed `4bd30ff`)
- `src/pkms/search.py` — F3 fix: empty-query guard (committed `620598f`)
- `docs/delegations/bakeoff-phase0-results.csv` — results CSV (3 smoke rows)
- `docs/delegations/bakeoff-phase0-results.md` — this file

## Hand-off to the real bakeoff session

The F-batch fix set is now green. The real bakeoff needs RED oracles to delegate against —
**the F-batch fixes consumed the oracles.** A fresh bakeoff session must either:
1. Author a new F-batch (the plan's intended Phase 0 deliverable — these 3 were the smoke's
   oracle set, not the real run's), OR
2. Revert these 3 fixes on a fresh `bakeoff/phase1` branch to reuse the oracles (cheap —
   3 commits to revert, all small), OR
3. Use the B6 oracle once it's re-enabled (it's currently green per M1; would need a
   regression introduced to make it RED).

Option 2 is cheapest and keeps the smoke provenance clean. The fresh session picks 3-4
oracles (these reverted, or a new F-batch), wires 6 T3 models, runs 2-3× each, and proceeds
through Phases 1-3 per the plan.

## Decision

No routing-table verdict yet — Phase 0 smoke only. The single data point (DeepSeek-direct Pro:
3/3 first-shot, $0.0193 total, all clean) is consistent with the orchestrator-mode routing
table's prediction (Pro as the default delegate lane for bounded oracle-able edits). The
price-to-performance question (Flash vs Pro) is unanswered and is the real bakeoff's job.
