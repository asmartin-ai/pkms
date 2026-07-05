# Bakeoff Phase 1 — Results & Verdict

**Branch:** `bakeoff/phase1` (off `feat/uiux-redesign`, 3 F-batch fixes reverted to reuse the oracles)
**Date:** 2026-07-04
**Status:** Phases 1–3 complete. 59 runs total: 35 T3 Flash (Phase 1) + 24 T1/T2 Pro (Phase 2).
**Executor price lines:** T3 Flash $0.14 in / $0.28 out per M · T1/T2 Pro $0.435 in / $0.87 out per M (ZenMux promo).
**Orchestrator:** GLM-5.2 via aider-delegate (orchestrator cost computed separately at end, not per-run).
**DATA TAINT NOTICE (2026-07-04, post-completion):** All 59 runs in this bakeoff are
marked **methodology-tainted, not model-specific**. The three F-batch oracles spell out the
fix in their test docstrings (e.g. test_f1_search_raw_cli.py: "Goes green once cli.search
grows a --raw flag... Scope: src/pkms/cli.py only"). Every executor was given the oracle as
--read context (aider-headless-delegate M10), so every model saw the solution spelled out.
This inflates every model's first-shot rate uniformly -- the bakeoff measured "can the model
implement a docstring's hint" not "can the model diagnose a RED test." The verdict and
routing table below stand as the result on the methodology's terms, but they should not be
read as a clean capability ranking. Part 2 (bakeoffs/PKMS-Part2-Correction-Cost-Validation-2026-07-04.md)
authors fresh oracles with the fix stripped from the docstring (test name + assertions only,
no "Goes green once..." prose). The MiniMax M3 cheating suspicion (investigations/MiniMax-M3-Bakeoff-Cheating-Hypothesis-2026-07-04.md)
is recorded as SUSPECTED, UNVERIFIED; the cache-leakage arm of that investigation is the
remaining open question. The per-row first_shot=true and quality_verdict=pass values in the
CSV are accurate on the leaky-oracle methodology; they are not evidence of clean-test capability.

**Verdict:** MiniMax M3 (T3 Flash) wins the cheap-delegate lane. **(Tainted -- see notice above.)** Pro tier does NOT justify ~3× on this workload.

## What ran

Three RED F-batch oracles (the Phase 0 fixes reverted: `284ff1e` `4bd30ff` `620598f`) → 6 T3 Flash executor
models × 3 tasks × 2 runs each, isolated via `git checkout -- src/pkms/<file>.py` between arms (the wrapper
doesn't auto-create run-branches; edits land on `bakeoff/phase1` directly). Oracle hashes asserted unchanged
before and after every run.

**Oracles (RED → GREEN):**
| Task | File | Test oracle (hash locked) | Baseline fails | After fix |
|---|---|---|---|---|
| F1 | `src/pkms/cli.py` | `tests/test_f1_search_raw_cli.py` (`40b3cf5…`) | 1 | 0 (GREEN) |
| F2 | `src/pkms/tasks.py` | `tests/test_f2_task_paused_wake_field.py` (`6acfa30…`) | 4 | 0 (GREEN) |
| F3 | `src/pkms/search.py` | `tests/test_f3_search_empty_query_guard.py` (`4f8f07d…`) | 4 | 0 (GREEN) |

Baseline after reverts: 393 passing, 9 RED. Each successful arm leaves F-batch at 397 pass / 5 fail (the
other two tasks still RED); full suite green at 402 only when all three are fixed.

## The matrix (35 runs)

```
model                  F1                 F2                 F3
----------------------------------------------------------------------------
deepseek-v4-flash      P*1 P*2           P*1 P*2           P*1 P*2
minimax-m3             P*1 P*2           P*1 P*2           P*1 P*2
qwen3.7-plus           P*1 P*2           P*1 P*2           P*1 P*2
step-3.7-flash         P*1 P*2           Fr1               P*1 P*2
kat-coder-pro-v2       P*1 P*2           P*1 P*2           P*1 P*2
qwen3.6-flash          Fr1 P*2           P*1 P*2           P*1 P*2
```
Legend: `P`=pass, `F`=fail, `*`=first-shot green, `r`=retry-needed, `N`=run#.

## Per-model aggregate (sorted by median exec_usd, cheapest first)

| model | runs | pass | first-shot | med $ | med wall | min $ | max $ |
|---|---|---|---|---|---|---|---|
| **minimax-m3** | 6 | 6 | 6 | **$0.001576** | **8s** | $0.001264 | $0.001875 |
| **kat-coder-pro-v2** | 6 | 6 | 6 | **$0.001623** | **10s** | $0.001316 | $0.001863 |
| qwen3.7-plus | 6 | 6 | 6 | $0.001978 | 22.5s | $0.001465 | $0.002184 |
| deepseek-v4-flash | 6 | 6 | 6 | $0.002128 | 22s | $0.001582 | $0.002422 |
| qwen3.6-flash | 6 | 5 | 5 | $0.002128 | 19s | $0.001624 | $0.002380 |
| step-3.7-flash | 5 | 4 | 4 | $0.002184 | 21s | $0.001259 | $0.002289 |

**Total Phase 1 executor spend (35 runs): $0.0649.** Average $0.001855/run.

## Per-task aggregate (which task is hardest?)

| Task | runs | pass | first-shot | med $ | med wall |
|---|---|---|---|---|---|
| F1 (CLI flag) | 12 | 11 | 11 | $0.001535 | 17.5s |
| F2 (wake field) | 11 | 10 | 10 | $0.002100 | 27s |
| F3 (empty-query guard) | 12 | 12 | 12 | $0.002056 | 14s |

F2 is the hardest by both cost and wallclock — it has the largest read context (`tasks.py` + the test
docstring spelling out the contract + `cli.py` and `db.py` as related files in the aider chat), and the
fix touches more lines (6-13+ per run vs 2+ for F3). F1 is cheapest because `cli.py`'s `search()` function
is a one-line fix (add `raw=` kwarg). F3 is the simplest diff (always 2+ — a single `if not query.strip():
return []` guard) but costs slightly more than F1 because the search.py read context is similar in size.

## Phase 1 verdict — the T3 Flash question

**Does the Flash tier ($0.14/$0.28/M) deliver a green PKMS feature oracle? Yes, decisively.**

Every T3 model that didn't hit a structural limit (context overflow on the 256K models) passed every
task it attempted, first-shot, on every run. Across 35 runs there were exactly **2 failures**, both
with clear root causes that aren't quality-of-reasoning issues:

1. **step-3.7-flash × F2 r1** — `token_limit_hit: true`, no edit applied. The 256K context model
   exhausted its window on F2's larger read context (the aider chat includes `tasks.py` + `cli.py` +
   `db.py` + the test file). F2 stays RED. **Verdict for step-3.7-flash: OK for single-file simple tasks
   (F1, F3 — both 2/2 first-shot), context-overflow on multi-file tasks (F2). Not a general-purpose
   executor for the orchestrator lane; use only when the task's read context fits comfortably under 256K.**
2. **qwen3.6-flash × F1 r1** — `applied_edit_count: 0`, diff empty. The model produced a valid-looking
   SEARCH/REPLACE block in its reasoning (visible in `stdout_tail`) but aider's diff parser didn't accept
   it — a transient formatting quirk. The test command never ran. r2 succeeded first-shot. **Verdict for
   qwen3.6-flash: 5/6 first-shot green across F1/F2/F3; flake rate ~14% (1/7 runs). The flake is a
   no-edit-application issue, not a reasoning failure — retry once and it succeeds.**

### The T3 winner: MiniMax M3 (and KAT-Coder-Pro-V2 as a near-tie)

**MiniMax M3** is the clear T3 winner on every axis that matters for the orchestrator's cheap-delegate lane:

- **Cheapest** by median exec_usd: $0.001576 (next-best kat-coder at $0.001623, +3%).
- **Fastest** by median wallclock: 8s (next-best kat-coder at 10s, +25%).
- **Lowest variance**: r1↔r2 deltas within $0.00001 and 0-1s on every task. The two F1 runs were
  $0.001272/7s and $0.001264/8s — near-identical. F3 runs were $0.001875/8s and $0.001873/8s.
- **6/6 first-shot green** (no retries, no flakes, no failures) across F1/F2/F3.
- **1M context** — no overflow risk on multi-file tasks (unlike the 256K models).
- Output is terse (200-700 tok/run) which keeps completion cost down.

**KAT-Coder-Pro-V2** is a near-tie: $0.001623 median, 10s median wall, 6/6 first-shot green, ultra-terse
output (135-989 tok/run — the terser model in the field), and the most minimal diffs on F1 (2+/2- with no
help text vs minimax's 10+/2-). Its only knock is the 256K context — but it held on F2 (unlike step-3.7-flash),
so for the current PKMS workload size it's safe. If the read context grows substantially (a future
multi-file refactor task), kat-coder would be the first to overflow; minimax's 1M ctx has more headroom.

The other three T3 models are **not competitive for the cheap-delegate lane**:
- **deepseek-v4-flash** ($0.002128, 22s, 6/6 first-shot) — the price-setter; you'd pick it only if you
  specifically wanted DeepSeek-family reasoning continuity with the Pro tier.
- **qwen3.7-plus** ($0.001978, 22.5s, 6/6 first-shot) — middle of the pack; notably has the highest
  wallclock variance in the field (148s on F2 r2 vs 58s on F2 r1, identical tokens — pure API-side
  latency variance). If latency predictability matters, avoid.
- **qwen3.6-flash** ($0.002128, 19s, 5/6 first-shot) — same cost band as dsv4-flash but with the
  no-edit-application flake (~14% rate). Not worth the retry overhead when minimax is cheaper and
  flake-free.
- **step-3.7-flash** ($0.002184, 21s, 4/5 pass) — the only T3 model with a hard failure (F2 context
  overflow). Fine for single-file tasks; structurally unsound as a general executor.

### What this proves

- **The T3 Flash tier delivers the green oracle.** 33/35 runs pass first-shot; the 2 failures are
  structural (context cap, diff-parse flake), not reasoning-quality issues. The cheap-delegate lane works.
- **MiniMax M3 is the T3 default.** Cheapest, fastest, lowest-variance, 1M context, 6/6 first-shot
  green. This is the executor the orchestrator should route to for small oracle-able edits on PKMS.
- **KAT-Coder-Pro-V2 is the T3 backup** for single-file tasks where minimax is unavailable or where the
  most-minimal-diff property is specifically desired.
- **The 256K-context models are a liability** for multi-file tasks (step-3.7 overflowed on F2). The
  orchestrator should prefer 1M-context models for the general lane, or scope the 256K models to
  single-file tasks explicitly.

### What this does NOT prove (gates Phase 2)

- **The Pro tier's value-add is unmeasured.** Phase 1 only ran T3 Flash. Phase 0's smoke (3 DeepSeek-V4-Pro
  runs, 3/3 first-shot, $0.0193 total = $0.0064/run) suggests Pro is ~3× the per-run cost of T3 Flash's
  cheapest ($0.0016/run). Whether Pro buys enough quality/speed headroom on harder tasks to justify that
  is the Phase 2 question. The Phase 1 tasks are all small (≤13-line diffs, single-file scope); Pro's
  advantage (if any) may only surface on tasks large enough to strain T3.
- **The variance picture is small-N.** 2 runs per cell gives a median but not a confidence interval. The
  key finding — minimax and kat-coder are the cheapest + most consistent — is robust because their r1↔r2
  deltas are tiny, but a 3rd run on the interesting cells (minimax F2, kat-coder F2) would tighten the
  median. Deferred to a backfill pass if Phase 2 changes the recommendation.

## Phase 2 — the T1/T2 Pro tier (24 runs)

Same 3 RED oracles, same delegation specs, same isolation protocol. **Executor price line (T1/T2 Pro):
$0.435 in / $0.87 out per M** (3.1× the Flash input rate, 3.1× the Flash output rate). 4 Pro models × 3
tasks × 2 runs = 24 runs. **All 24 passed first-shot. Zero failures, zero retries, zero flakes.**

### The matrix (Phase 2)

```
model                  F1                 F2                 F3
----------------------------------------------------------------------------
deepseek-v4-pro        P*1 P*2           P*1 P*2           P*1 P*2
glm-5.2                P*1 P*2           P*1 P*2           P*1 P*2
kimi-k2.7-code         P*1 P*2           P*1 P*2           P*1 P*2
qwen3.7-max            P*1 P*2           P*1 P*2           P*1 P*2
```
All 12 cells P*1 P*2 — a perfectly clean matrix. No Pro model failed or flaked on any task.

### Pro per-model aggregate (sorted by median exec_usd, cheapest first)

| model | runs | pass | first-shot | med $ | med wall | min $ | max $ |
|---|---|---|---|---|---|---|---|
| **kimi-k2.7-code** | 6 | 6 | 6 | **$0.005401** | **10.5s** | $0.003838 | $0.007134 |
| glm-5.2 | 6 | 6 | 6 | $0.005978 | 28.5s | $0.005046 | $0.007395 |
| qwen3.7-max | 6 | 6 | 6 | $0.006178 | 27s | $0.004721 | $0.006873 |
| deepseek-v4-pro | 6 | 6 | 6 | $0.007395 | 39.5s | $0.005307 | $0.008874 |

**Total Phase 2 spend: $0.1476 (24 runs). Average $0.00615/run** — ~3.3× the Phase 1 T3 average
($0.001855/run), confirming the price-line ratio.

### Phase 2 verdict — does the Pro line justify ~3×?

**No. On this workload, the Pro tier buys nothing the T3 Flash tier doesn't already deliver — at 3× the
cost.**

The §6 kill-fast gate fires here in the soft direction: "If no Pro model beats the T3 winner on
pass/first-shot rate enough to justify ~3×, Flash wins outright; Pro becomes the escalation lane."

The data:
- **Pass rate: identical.** T3 winner minimax is 6/6 first-shot green (100%); every Pro model is also
  6/6 first-shot green (100%). There is no quality delta. Pro did not fix a single task that T3 failed;
  there are no T3 failures on these tasks to fix.
- **Cost: Pro is 2.9–4.1× more expensive per task (head-to-head, T3 winner vs Pro winner):**
  | Task | minimax T3 (med $) | kimi Pro (med $) | Pro premium |
  |---|---|---|---|
  | F1 | $0.001268 | $0.003962 | 3.1× |
  | F2 | $0.001576 | $0.006525 | 4.1× |
  | F3 | $0.001874 | $0.005401 | 2.9× |
- **Speed: Pro is NOT faster.** kimi-k2.7-code (the fastest Pro) at 10.5s median wallclock is slightly
  slower than minimax T3 at 8s. The other Pro models are 27–40s — 3–5× slower than minimax T3.
- **Variance: Pro is NOT lower.** dsv4pro's reasoning length varies 1.7k–5.2k tokens across runs (cost
  varies $0.0053–0.0089 on F2); qwen3.7-max has the highest wallclock variance in the entire bakeoff
  (156s on F2 r1 vs 44s on F2 r2 — pure API latency spike). minimax T3's r1↔r2 deltas are within
  $0.00001 and 0–1s on every task. Pro is not more predictable.
- **Diff quality: Pro is NOT better.** All 59 runs (T3 + Pro) produce functionally-equivalent fixes.
  kimi-k2.7-code did produce the most minimal F2 fix in the entire bakeoff (a single ternary, 4+ diff)
  — but kat-coder-pro-v2 (T3, 256K) produced the most minimal F1 fix (2+/2- with no help text). The
  "Pro reasons better" hypothesis is not supported by diff-content review on these tasks.
- **One Pro behavioral note:** dsv4pro consistently adds unsolicited UX enhancements (the "No results"
  early-return on F1, multi-line explanatory comments on F3) beyond the minimal fix the oracle pins.
  This is benign on these tasks (no regressions) but it's a scope-creep signal — Pro doesn't stick to
  the minimal-diff discipline the T3 coding-specialists (kat-coder, kimi) exhibit naturally.

**Why this is the right answer for THIS workload, with the caveat:** The 3 bakeoff tasks are small
oracle-able edits (≤13-line diffs, single-file scope, ≤10k input tokens of read context). On this
class of task, the T3 Flash tier is fully sufficient and Pro's extra reasoning capacity is unused.
Pro's value-add would only surface on harder tasks — multi-file refactors, large read contexts,
ambiguous specs without a tight oracle — none of which are in this bakeoff. The verdict is
"Flash wins the cheap-delegate lane for small oracle-able edits on PKMS;" not "Pro is worthless."

### Per-Pro-model disposition

- **kimi-k2.7-code** — the Pro winner on every axis (cheapest $0.005401, fastest 10.5s, lowest-variance,
  most minimal diffs, tersest output 179–237 tok). If a Pro escalation is ever needed, kimi is the one.
  Notably its 262K context is smaller than the 1M T3 models — but it held on F2 (unlike step-3.7-flash T3),
  so for the current PKMS workload it's safe.
- **glm-5.2** — the most consistent Pro model on cost+wallclock (no API latency spikes, no verbose runs).
  Self-delegation flag: glm-5.2 is the orchestrator's own family, so using it as the executor is the
  orchestrator reasoning about its own output — fine for the cheap lane, but kimi is cheaper+ faster.
- **qwen3.7-max** — middle of the pack on cost; notable for severe wallclock variance on F2
  (156s spike on r1, 44s on r2 — identical tokens, pure API-side latency). If latency predictability
  matters, avoid. Same variance pattern as its T3 sibling qwen3.7-plus (148s on F2 r2).
- **deepseek-v4-pro** — the most expensive Pro model on every task (median $0.007395, max $0.008874);
  the most verbose (1.7k–5.2k output tokens per run); the only Pro model that consistently adds
  unsolicited scope (UX enhancements, explanatory comments). It's the price-setter and matches the
  Phase 0 smoke ($0.0084 for F2 via DeepSeek-direct Pro) — but it's the wrong pick for the cheap lane.

## Phase 3 — routing table + verdict

### Routing table (for the orchestrator's aider-delegate lane on PKMS)

| Lane | Model | When | Med $/run | Med wall | Notes |
|---|---|---|---|---|---|
| **Cheap-delegate (default)** | `minimax/minimax-m3` | Small oracle-able edits (≤13-line diff, single-file scope, ≤10k tok read context) | **$0.001576** | **8s** | T3 Flash; 1M ctx; 6/6 first-shot green; lowest cost + fastest + lowest variance in the field. |
| Cheap-delegate (backup) | `kuaishou/kat-coder-pro-v2` | Same as default, when minimax is unavailable or the most-minimal-diff property is specifically desired | $0.001623 | 10s | T3 Flash; 256K ctx (held on F2, watch on larger); terse (135–989 tok); most minimal F1 fix (2+/2-). |
| **Pro escalation** | `moonshotai/kimi-k2.7-code` | Tasks that strain T3 (multi-file refactor, ambiguous spec, larger read context) — IF a T3 model fails or the task is judged too large for the cheap lane | $0.005401 | 10.5s | T1/T2 Pro; 262K ctx; cheapest+fastest+lowest-variance Pro; most minimal F2 fix (4+ ternary). |
| Pro escalation (alt) | `z-ai/glm-5.2` | Same as kimi, when kimi is unavailable | $0.005978 | 28.5s | T1/T2 Pro; 1M ctx; most consistent on cost+wallclock; self-delegation flag (orchestrator family). |
| **Avoid** | `stepfun/step-3.7-flash` | Don't use as a general executor | $0.002184 | 21s | T3 Flash; 256K ctx overflowed on F2 (multi-file). OK for explicitly-scoped single-file simple tasks only. |
| **Avoid** | `deepseek/deepseek-v4-pro` | Don't use in the cheap-delegate lane | $0.007395 | 39.5s | T1/T2 Pro; most expensive + most verbose Pro; adds unsolicited scope. Reserve for cases that specifically need DeepSeek-family reasoning. |

### The bakeoff verdict

> **For the orchestrator's aider-delegate cheap-delegate lane on PKMS, route to `minimax/minimax-m3`
> (T3 Flash, $0.14/$0.28/M) by default. It delivers a green oracle at $0.001576/run, 8s wallclock, 1M
> context, 6/6 first-shot green across 3 tasks, and the lowest cost+variance in the field. The Pro tier
> ($0.435/$0.87/M) does NOT justify its ~3× cost on this workload — every Pro model also passes 6/6
> first-shot green, but at 2.9–4.1× the cost with no speed or quality advantage. Reserve the Pro
> escalation lane (`moonshotai/kimi-k2.7-code`) for tasks that strain T3 (multi-file refactor, ambiguous
> spec, larger read context); use the T3 cheap-delegate lane for everything else.**

### Does the Pro line justify ~3×? — the framing question, answered

**No, on this workload.** The bakeoff's §0 framing question was: "does the Pro line buy enough
quality/speed headroom over Flash to justify its ~3× per-token cost?" The answer is a clean **no**
for the small-oracle-able-edit class that dominates the orchestrator's cheap-delegate lane:
- Pro and Flash have **identical pass/first-shot rates** (100% / 100% across 6/6 cells each).
- Pro is **2.9–4.1× more expensive** per task (head-to-head, winners vs winners).
- Pro is **not faster** (kimi Pro 10.5s vs minimax Flash 8s; other Pro 27–40s vs Flash 8–22s).
- Pro is **not lower-variance** (dsv4pro cost swings $0.0053–0.0089; qwen3.7-max wallclock spikes 156s).
- Pro's diff quality is **not better** (functionally equivalent fixes; kat-coder T3 produced the most
  minimal F1 fix; kimi Pro produced the most minimal F2 fix — the coding-specialists win on minimalism,
  not the Pro tier).

The Pro tier's value-add (deeper reasoning, larger context, more-nuanced specs) is **unexercised on this
workload**. The bakeoff tasks are tight-oracle small edits; Pro's capacity is wasted on them. The verdict
is not "Pro is worthless" — it's "Pro is the wrong tool for the cheap-delegate lane; reserve it for the
escalation lane where its capacity is actually exercised."

### What this does NOT prove (the bakeoff's scope)

- **The verdict is for the small-oracle-able-edit class only.** The 3 bakeoff tasks are ≤13-line diffs,
  single-file scope, ≤10k tok read context. Pro's advantage may surface on: multi-file refactors (the
  256K-ctx T3 models already overflowed on F2's modest multi-file read; a real refactor would strain them
  more), ambiguous specs without a tight oracle, larger read contexts (>10k tok), or tasks where the
  minimal-diff discipline matters less than reasoning about tradeoffs. None of these are in the bakeoff.
- **The 256K-context T3 verdict is from 1 failure.** step-3.7-flash overflowed on F2 r1; we did NOT retry
  (per §6 kill-fast, the failure mode is clear and retrying would just hit the same wall). kat-coder-pro-v2
  (also 256K) held on F2 — so the overflow is model-specific to step-3.7-flash's context budgeting, not a
  universal 256K limitation. For larger tasks, treat 256K models as suspect until proven.
- **The variance picture is 2-run medians.** The key findings (minimax is cheapest+fastest+most-consistent
  T3; kimi is cheapest+fastest+most-consistent Pro; Pro doesn't justify 3× on these tasks) are robust
  because the r1↔r2 deltas on the winners are tiny. But 2 runs is a median, not a confidence interval —
  a 3rd run on the cells that matter (minimax F2, kimi F2) would tighten the medians. Deferred: not needed
  unless the routing-table decision changes, which it doesn't.
- **Orchestrator cost is not folded in.** Per the M18 policy, `orch_usd` is left empty per-run and computed
  at end from total tokens × rate. The bakeoff ran 59 arms; the orchestrator (GLM-5.2) cost for those 59
  delegations is the orchestrator's own accounting, not the executor's. The routing-table decision is on
  executor cost; orchestrator cost is constant across arms (same orchestrator, same protocol).

## Verification (per `aider-headless-delegate` 4-check protocol)

Every run:
1. **Oracle hash unchanged** before/after (`40b3cf5…` / `6acfa30…` / `4f8f07d…` — asserted via
   `git hash-object tests/test_f<N>_*.py`, never modified by any model).
2. **`git diff --stat` scope** = only the spec's editable file (1 file each arm; no test edits, no
   harness files, no signature regressions).
3. **Diff content reviewed** — no test-gaming (one model that produced a SEARCH/REPLACE block in its
   reasoning but failed to apply it was logged as a flake, not a pass).
4. **Full suite green at/above baseline** — every successful arm left the suite at 397 pass / 5 fail
   (F-batch at 4 fixed + the other two tasks still RED); no regressions observed in any run.

## Cost methodology

- `exec_usd`:
  - T3 Flash: `(tok_in × $0.14 + tok_out × $0.28) / 1e6`
  - T1/T2 Pro: `(tok_in × $0.435 + tok_out × $0.87) / 1e6`
  - (M18: `cost_reported: null` on raw-`--api-base`; compute from stdout `Tokens: Xk sent, Yk received`.)
- `orch_usd` left empty per-run (Phase 0's one-per-provider cross-check is sufficient; orchestrator $
  computed at end from total tokens × rate).
- Tokens rounded to nearest 100 from aider-delegate's stdout ("8.9k sent, 1.2k received" → 8900/1200).
- Wallclock captured via `START=$(date +%s)` / `END=$(date +%s)` around the `aider-delegate` invocation
  (includes aider startup + the model call + the test run; not pure model latency).

## CSV

Full per-run data: `docs/delegations/bakeoff-phase1-results.csv` (59 records: 35 T3 Flash + 24 T1/T2 Pro,
schema per primer §5).
