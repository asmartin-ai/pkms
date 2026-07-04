# Bakeoff Phase 1+ Primer — for the fresh session

*Created 2026-07-04 (the Phase 0 session, at Kenja's request) as the handoff document for
the fresh session that runs the real Phase 1/2/3 sweep. A fresh session orients from
`NEXT.md` + this file + the plan (`PKMS-Price-Performance-Bakeoff-Plan-2026-07-03.md`) —
read those three first; don't re-derive the context.*

---

## 0. The one-question framing

> Across the ZenMux promo's two DeepSeek price lines, **which executor model delivers a green
> PKMS feature oracle at the lowest $/task and best quality-to-cost ratio** — and does the Pro
> line ($0.435/$0.87 per M) buy enough quality/speed headroom over the Flash line ($0.14/$0.28)
> to justify its ~3× per-token cost?

The orchestration layer is settled (aider-delegate, run-branch protocol). The orchestrator is
fixed (GLM-5.2 on ZenMux). **The variable is the executor model.** Phase 0 smoked the
pipeline; Phase 1+ is the real measurement.

## 1. State at session start (verify, don't trust)

| Item | Expected state | How to verify |
|---|---|---|
| PKMS branch | `feat/uiux-redesign` checked out, clean except the two doc edits from the Phase 0 follow-up session (`NEXT.md`, `docs/delegations/bakeoff-phase0-results.md`) — OR `main` if Kenja has merged (K1 approved 2026-07-04; the merge is his action). Verify which before branching | `git status -sb`, `git branch --show-current` |
| PKMS test baseline | **402 passing** (391 redesign + 9 F-batch + 2 parametrization) | `K:/Projects/PKMS/.venv/Scripts/python.exe -m pytest -q` |
| F-batch oracles | **GREEN** (the 3 fixes are merged via `c541b73`) — consumed as oracles; see §2 for the reuse decision | `git log --oneline 3cbc55b..HEAD \| grep -E "F[123]\|raw\|wake\|empty"` |
| Skill fixes M17/M18/G1 | Baked into `agent-hub/skills/aider-headless-delegate/SKILL.md` (committed in the `agent-hub` repo) | `git -C C:/Users/Kenja/agent-hub log --oneline -1 -- skills/aider-headless-delegate/SKILL.md` |
| ZenMux token cross-check | **PASSED 2026-07-04** — counter is trustworthy to the 7th decimal; no per-run dashboard lookup needed | `docs/delegations/bakeoff-phase0-results.md` §"What this does NOT prove" |
| `feat/uiux-redesign` → `main` | **K1 APPROVED 2026-07-04** — Kenja's merge (agents never merge to main). The bakeoff runs on the branch (or off `main` once merged; verify which at session start) | `git log --oneline main..feat/uiux-redesign \| wc -l` > 0
| ZenMux promo | Active, expires **~2026-08-03** — re-verify before relying on the price lines | (Kenja's dashboard) |

**If any of those don't hold, stop and reconcile before running arms.** The symmetry rule
(§5 of the plan) requires identical baseline + oracle for every arm.

## 2. First decision: oracle reuse vs. fresh F-batch

The 3 F-batch fixes are merged on `feat/uiux-redesign` → the oracles are **green**. The fresh
session has three options (plan §7, results doc §"Hand-off"):

| Option | Cost | Provenance | When to pick |
|---|---|---|---|
| **A. Revert the 3 fixes on a fresh `bakeoff/phase1` branch** | 3 small revert commits | Cleanest — smoke oracles reused as RED, smoke provenance preserved | **Default.** Cheapest, keeps the F1/F2/F3 oracles proven. |
| **B. Author a new F-batch** | 1 GLM-5.2 authoring session | Fresh, but doubles the oracle-authoring work | Only if A is blocked (e.g. the fixes have moved on) |
| **C. Re-introduce the B6 regression** | N/A | B6 is green per M1 — would need a regression seeded | Skip — plan already deprecated this |

**Recommendation: Option A.** If Kenja has merged `feat/uiux-redesign` → `main`, branch off
`main`; otherwise branch off `feat/uiux-redesign`:

```
git checkout -b bakeoff/phase1 <base-branch>
git revert 284ff1e 4bd30ff 620598f   # the 3 F-batch fix commits, in order
# verify: pytest -q should show F1/F2/F3 oracles RED, rest green at 393
```

This gives 3 RED oracles (F1, F2, F3) ready to delegate against, baseline 393 (402 − 9 F-batch
tests; the parametrization +2 stays because it's in the test files, not the fixes). **Re-verify
the count after revert** — if the revert changes the count unexpectedly, stop and investigate.

**Target: 3–4 hard-oracle tasks per model.** Three (the reverted F-batch) is the minimum; if
you want a fourth, author one fresh (Option B for one task) before wiring models. Don't run
fewer than 3 — the median needs the spread.

## 3. Models to wire (the variable)

From plan §3. **All via ZenMux raw `--api-base`** (M17 — no preset; recipe G1 in the skill):

### T3 — Flash price line ($0.14 in / $0.28 out per M) — Phase 1

| Model | ZenMux ID | Context | Notes |
|---|---|---|---|
| DeepSeek V4 Flash | `deepseek/deepseek-v4-flash` | 1M | Price-setter; native thinking. Watch M12 (16K output cap). |
| MiniMax M3 | `minimax/minimax-m3` | 1M | Prior PKMS bakeoff winner-tied (2026-06-18). |
| Qwen 3.7-Plus | `qwen/qwen3.7-plus` | 1M | 66% off. |
| Step 3.7 Flash | `stepfun/step-3.7-flash` | 256K | Multimodal MoE. Smaller ctx — watch for context overflow on big reads. |
| KAT-Coder-Pro-V2 | `kuaishou/kat-coder-pro-v2` | 256K | Coding-specialist. Smaller ctx. |
| Qwen3.6 Flash | `qwen/qwen3.6-flash` | 1M | 54% off. |

### T1/T2 — Pro price line ($0.435 in / $0.87 out per M) — Phase 2 (after Phase 1 lands)

| Model | ZenMux ID | Context | Notes |
|---|---|---|---|
| DeepSeek V4 Pro | `deepseek/deepseek-v4-pro` | 1M | Price-setter; 384K max output. **Already smoke-tested** (Phase 0, 3/3 first-shot, $0.0193). |
| GLM 5.2 | `z-ai/glm-5.2` | 1M | Same family as orchestrator — self-delegation, flag in notes (plan §3 note). |
| Kimi K2.7 Code | `moonshotai/kimi-k2.7-code` | 262K | Coding-specialist. |
| Qwen 3.7-Max | `qwen/qwen3.7-max` | 1M | 83% off. |

## 4. Invocation recipe (per arm)

Use the `aider-delegate` CLI via the `terminal` tool (M — Zed doesn't bridge MCP
`agent_servers` tools to the agent session; see skill "Zed agent caveat 2026-06-27"). Recipe
from G1 in the skill:

```sh
aider-delegate \
  --repo-path K:/Projects/PKMS \
  --message "<delegation spec — goal, in-scope files, invariants, 'do not edit tests'>" \
  --editable-files src/pkms/<file>.py \
  --api-base https://zenmux.ai/api/anthropic \
  --api-key-env ZENMUX_API_KEY \
  --api-format anthropic \
  --model <ZenMux-id> \
  --test-cmd "K:\Projects\PKMS\.venv\Scripts\python.exe -m pytest tests\test_f<N>_<name>.py -q" \
  --pretty
```

**Per-run mandatory:**
- **Record the oracle hash before** (`git hash-object tests/test_f<N>_*.py`) and assert unchanged after (M — integrity gate).
- **`cost_reported` will be `null`** (M18) — capture `tokens_in` / `tokens_out` from the wrapper's stdout/result, compute `exec_usd = (tok_in × $0.14 + tok_out × $0.28) / 1M` (T3) or `(tok_in × $0.435 + tok_out × $0.87) / 1M` (T1/T2).
- **Verify with `git diff --stat`**, not the `applied_edit_count` field (M13). Verify `git status -s` scope = only the spec's file.
- **Run-branch isolation:** the wrapper auto-creates `delegated/run-<id>` off HEAD unless `--skip-branch`; let it. Don't run on `feat/uiux-redesign` directly.
- **2–3× per task per model.** Variance is real; one run is an anecdote.

## 5. Results CSV — where to put it + schema

Plan §6 spec:

```
run_id, task_id, tier, executor_model, executor_id, run_n,
orch_tok_in, orch_tok_out, orch_usd,
exec_tok_in, exec_tok_out, exec_usd,
wallclock_s, gate_pass, quality_verdict, first_shot, retries, notes
```

- `tier ∈ {T3_flash, T12_pro}`
- `quality_verdict` ∈ {pass, flag} — your test-gaming review, separate from `gate_pass`
- `first_shot` — bool, green on first attempt with no re-spec
- `wallclock_s` — capture from the wrapper; cross-check against ZenMux `generationTime` if you want (Phase 0: 33.82s for F3)

**Location:** `docs/delegations/bakeoff-phase1-results.{md,csv}` (mirror Phase 0's naming). Don't
overwrite Phase 0's CSV — it's the smoke record; the real bakeoff gets its own files.

## 6. Phasing + kill-fast gates (plan §7)

| Phase | Runs | Shape | Gate |
|---|---|---|---|
| **Phase 1** (the main event) | 3 tasks × 6 T3 models × 2–3 runs = 36–54 runs | Bulk of the data, cheapest signal | If every T3 model passes every task first-shot (no variance), the T3 question is answered — pick cheapest or 1M-ctx; Phase 2 shrinks to a spot-check. |
| **Phase 2** (the experiment) | 3 tasks × 4 T1/T2 models × 2–3 runs = 12–36 runs | Pro tier; only after Phase 1 lands | If no Pro model beats the T3 winner on pass/first-shot rate enough to justify ~3×, Flash wins outright; Pro becomes the escalation lane. |
| **Phase 3** (decision) | — | Build the routing table; write the verdict | — |

**Kill-fast gates — stop and surface if:**
- Baseline can't be cleaned or oracles can't be authored red-for-the-right-reason (Phase 0 gate, already cleared — don't re-trip).
- A model's first 3 runs all fail with the same root cause (e.g. context overflow on a 256K-ctx model) — don't burn more budget; log it as the verdict for that model and move on.
- The ZenMux promo expires mid-bakeoff (re-verify before continuing; pricing comparison stays valid, but re-verify absolute-$ projections).

## 7. Open questions for Kenja (surface, don't wait)

These **don't block starting Phase 1**:

1. **K1 — Lamplight device verdict: APPROVED 2026-07-04.** The merge `feat/uiux-redesign` →
   `main` is Kenja's action (agents never merge to main). The bakeoff does NOT wait for the
   merge — branch off whichever of `feat/uiux-redesign` or `main` is current at session start
   (verify per §1). The `DESIGN.md` rewrite happens after the merge; it does not gate the
   bakeoff.
2. **Orchestrator cost cross-check policy — RESOLVED 2026-07-04.** Phase 0's one cross-check
   per provider is sufficient (Kenja confirmed). Compute orchestrator $ from tokens × rate
   the same way as executor $ (M18); no per-run dashboard lookup needed.

## 8. Done-when

- [ ] Phase 1 results CSV populated (3 tasks × 6 T3 models × 2–3 runs)
- [ ] Phase 1 verdict: T3 winner identified, or "all flat — pick cheapest" verdict with the data
- [ ] Phase 2 results CSV populated (3 tasks × 4 T1/T2 models × 2–3 runs) — OR shrunk to a spot-check per the §7 kill-fast gate
- [ ] Phase 3 routing table: per-tier winner + escalation policy
- [ ] `docs/delegations/bakeoff-phase1-results.md` written (mirror Phase 0's verdict format)
- [ ] `NEXT.md` updated with the bakeoff verdict + next actions

## 9. What NOT to do

- **Don't run on `feat/uiux-redesign` directly.** Use run-branches (`delegated/run-<id>` auto-created by the wrapper).
- **Don't trust `applied_edit_count` or `cost_reported`** (M13/M18) — verify with `git diff --stat` and compute $ from tokens.
- **Don't parallelize delegations to the same repo** (M16) — run arms serially. The wrapper's run-branch isolation handles sequential runs cleanly.
- **Don't skip the oracle-hash gate** (skill checklist item 3) — a model that can't find the test will rewrite it to pass.
- **Don't fold orchestrator tokens into `exec_usd`** — keep them in `orch_usd`; the comparison is on executor cost.
- **Don't re-derive the ZenMux invocation** — G1 in the skill is the recipe; M17 explains why `--provider zai` is wrong.
- **Don't merge `feat/uiux-redesign` to `main`** — agents never merge to main; that's Kenja's K1-gated action.
