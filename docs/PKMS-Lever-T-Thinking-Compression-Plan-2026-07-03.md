# Lever-T — Thinking compression for GLM-5.2 (experimental)

*Created 2026-07-03. Orthogonal companion to `PKMS-Price-Performance-Bakeoff-Plan-2026-07-03.md`.*
*That bakeoff answers "which executor model wins." This lever answers "does compressing
GLM-5.2's thinking traces preserve quality while saving tokens." The two questions must
not be confounded — see §1.*

Status: **PLANNING 2026-07-03** — not yet running. Depends on the caveman skill's
experimental `think` / `think-preserve` modes (added 2026-07-03).

---

## 0. The question (stated so it can be answered with numbers)

> Does compressing GLM-5.2's `thinking` content blocks via caveman-style rules preserve
> `pytest` pass-rate and review- quality while materially reducing output tokens — and if
> so, does the higher-risk `think` mode (full compression) beat the lower-risk
> `think-preserve` mode (connective tissue kept) on the savings/quality tradeoff?

Two sub-questions:
1. **Savings:** what's the actual thinking-token compression ratio `C_think` for each mode
   × intensity, on real PKMS-bakeoff tasks?
2. **Quality hold:** does `pytest` pass-rate and orchestrator review quality hold under
   each mode × intensity, vs. uncompressed-thinking baseline?

**Why it matters financially:** thinking tokens are billed as **output tokens**. On the
ZenMux promo Pro line ($0.87/M output), if thinking is ~50% of output tokens and a mode
compresses it by 50%, that's a ~25% output-cost cut on GLM-5.2 — real money at bakeoff
scale, and it compounds with the model-selection verdict from the main bakeoff.

---

## 1. Why this is a separate lever, not folded into the model bakeoff

Carry-over from `TierB-Offload-Bakeoff-Plan.md` §11/§12: **one compression variable at a
time, never folded into the model comparison.** Thinking compression changes the
dependent variable (tokens/task); folding it into the model bakeoff would confound "which
model wins" with "does thinking compression hurt."

This lever is **orthogonal**: fix the model (GLM-5.2), vary thinking compression on/off,
measure on the same PKMS oracles. It stacks on top of the model verdict only if it clears
its own bar — same sequencing rule as the TierB Headroom (input-compression) lever.

**Sequencing:** run lever-T **after** the PKMS model bakeoff (Phase 1/2) lands, so the
model question is settled and the compression question is tested on the winning model.
Running them in parallel risks confounding if GLM-5.2 turns out not to be the winning
executor.

---

## 2. The two modes (the variable)

Both modes are implemented in the caveman skill (`C:/Users/Kenja/agent-hub/skills/caveman/SKILL.md`,
"Thinking modes (experimental)" section). Both reuse the existing intensity levels
(lite/full/ultra/wenyan-*).

| Mode | What it compresses | What it preserves | Risk hypothesis |
|---|---|---|---|
| `think` | Restatement, hedging, meta-commentary, plan-narration, filler connectives | Technical terms, code, exact error strings | High savings, **risk of breaking reasoning scaffold** |
| `think-preserve` | Same compression targets | Above + verbal connective tissue (plan markers, reconsideration, inference bridges, alternatives, hypothesis framing, verification) | Lower savings, **bet that savings live in restatement not connectives** |

**The connective tissue preserved by `think-preserve`** (verbatim, regardless of
intensity): `First/Then/Next/Finally`, `Wait/Let me reconsider/Hmm/Actually`,
`So/Therefore/That means/This implies`, `Alternatively/Option B/On the other hand`,
`Suppose/If X then/Assume`, `Check:/Verify:/Does this hold?`.

The hypothesis under test: GLM-5.2's connective tissue is load-bearing for reasoning
quality (more so than for output prose), so preserving it trades some token savings for a
safer quality profile. **Unverified.** That's what this experiment is for.

---

## 3. Phase 0 — session-history study of GLM-5.2 thinking traces (prerequisite)

**Must complete before any lever-T run.** The modes were designed from a single sample;
the design must be grounded in real trace statistics before we trust the compression
targets or the connective-tissue list.

### Why a fresh capture is required

The ZCode rollout logs at `C:/Users/Kenja/.zcode/cli/rollout/*.jsonl` were checked
2026-07-03: they record `usage.outputTokens` (which includes thinking tokens billed as
output) but **do not capture `thinking` block text content** — ZCode strips it before
logging. So the trace corpus cannot be mined from existing logs; it must be captured
fresh via direct API calls.

### Capture protocol

Run GLM-5.2 directly (via ZenMux Anthropic endpoint, `z-ai/glm-5.2`) on a representative
task set with `thinking` enabled, logging the full response including `thinking` content
blocks. Target: **20–30 traces** across task classes:

| Class | Count | Source tasks |
|---|---|---|
| Mechanical bugfix (clean oracle) | 8–10 | PKMS B6 + the F-batch oracles from the model bakeoff |
| Multi-step reasoning | 5–7 | Tasks that require chaining 3+ inference steps (e.g. FTS sanitize + raw flag interaction) |
| Judgment / weak oracle | 3–5 | PKMS F1-style design tasks (no clean pytest gate) |
| Tool-use planning | 3–5 | Tasks where GLM-5.2 plans a file-edit sequence before acting |

For each trace, log: task id, input tokens, output tokens, thinking tokens (if exposed
separately), full thinking text, full output text, gate result.

### Analysis (per trace, then aggregated)

Classify each thinking block's content into:

| Category | Example (from real GLM-5.2 trace, 2026-07-03) | Compressible? |
|---|---|---|
| **Restatement** of the problem before solving | "We need to fix a Python function that should return unique items..." | Yes — both modes |
| **Hedging** / preference commentary | "But the seen-set approach is more explicit and works in all Python versions" | Yes — both modes |
| **Meta-commentary** about answer shape | "Let's structure the answer: first explain the issue, then provide the fix" | Yes — `think`; preserved by `think-preserve`? (borderline — classify as plan-narration) |
| **Plan-narration** | "We'll write: [code]. That's it." | Yes — `think` ultra; borderline for `think-preserve` |
| **Connective tissue** (load-bearing?) | "Alternatively, in Python 3.7+..." / "Reasoning:" / "Let me reconsider" | `think` strips; `think-preserve` keeps |
| **Technical substance** | The actual fix, the actual reasoning chain | Never compressed |

Compute, per class:
- **% compressible** = (restatement + hedging + meta + plan-narration chars) ÷ total thinking chars
- **% connective tissue** = (connective chars) ÷ total thinking chars
- **Theoretical max `C_think`** = total ÷ (total − compressible − connective) for each mode

### Phase 0 decision gate

- If **% compressible < 20%** across classes → the modes have little to compress; lever-T
  is low-value, **stop** and report.
- If **% compressible ≥ 40%** in mechanical/multi-step classes → proceed to Phase 1; the
  savings are real enough to measure against quality.
- If the **connective-tissue list is wrong** (Phase 0 shows load-bearing tissue we didn't
  preserve, or preserved tissue that's actually filler) → revise the `think-preserve` list
  in the caveman skill before Phase 1.

---

## 4. Phase 1 — the measurement (kill-fast)

Fix the model = **GLM-5.2 on ZenMux** (`z-ai/glm-5.2`, thinking enabled, budget 8192).
Use the **same PKMS oracles** as the model bakeoff (B6 + F-batch), so results are
directly comparable and no new oracle authoring is needed.

### Arms

| Arm | Thinking mode | Intensity | Expected |
|---|---|---|---|
| **Baseline** | uncompressed thinking | n/a | Control; the model bakeoff's GLM-5.2 numbers |
| **T-compress-lite** | `think` | lite | Smallest savings, smallest risk |
| **T-compress-full** | `think` | full | The headline test |
| **T-compress-ultra** | `think` | ultra | Max savings, max risk |
| **T-preserve-lite** | `think-preserve` | lite | Connective tissue kept |
| **T-preserve-full** | `think-preserve` | full | The lower-risk headline test |

Run **3–4 tasks × 6 arms × 2–3 runs** = ~36–72 runs. Same run-branch protocol as the
model bakeoff; same aider-delegate harness; same oracle-hash integrity gate.

### Metrics (extends the model bakeoff's results CSV)

```
run_id, task_id, lever, think_mode, think_intensity, run_n,
tok_in, tok_out, tok_thinking, think_usd, total_usd,
wallclock_s, gate_pass, quality_verdict, first_shot, notes
```

- `lever ∈ {baseline, T-compress, T-preserve}` — distinguishes the arms.
- `tok_thinking` — thinking tokens specifically (if the API exposes them; else infer from
  output-token delta vs. a no-thinking control run).
- `think_usd` — thinking-token cost, separated so savings are visible.

### Per-arm computation

- **`C_think`** = baseline `tok_thinking` ÷ arm `tok_thinking` (compression ratio)
- **Quality hold** = gate pass-rate + orchestrator review verdict (same review strictness
  as the model bakeoff — no asymmetric effort)
- **Net savings** = (baseline `total_usd` − arm `total_usd`) ÷ baseline `total_usd`

### Kill-fast gates

- After the first task across all arms: if **any** arm's `pytest` pass-rate drops below
  baseline by >1 task, or the orchestrator flags test-gaming/quality regression, **stop**
  that arm — it's dead for this model. Record `C_think` and move on.
- After Phase 1: if **no** arm achieves `C_think ≥ 1.3` **and** quality hold, lever-T is
  dead for GLM-5.2; the thinking traces aren't compressible without quality loss. Record
  and move on.

---

## 5. Decision rule

After Phase 1, for each arm compute `C_think`, quality hold, net savings. Then:

- **Adopt a mode** iff `C_think ≥ 1.3` **and** quality holds (gate green + clean review +
  no first-shot regression) **and** net savings ≥ ~15% of total $.
- **Prefer `think-preserve` over `think`** at equal `C_think` — lower risk for the same
  savings wins. Adopt `think` only if it beats `think-preserve` on `C_think` by a clear
  margin (≥0.2) with quality held.
- **Intensity routing:** if lite and full both clear the bar, default to lite (safer);
  reserve full/ultra for tasks where the savings matter and quality has been shown to hold.
- **If no arm clears the bar** → thinking compression is dead for GLM-5.2 on this
  workload. The honest answer. Do not adopt on hope.

### Stacking with the model bakeoff

If lever-T clears the bar, the winning mode **stacks on top of** the model bakeoff's
winning executor — but only when that executor is GLM-5.2 (the model lever-T was measured
on). Do not assume the verdict transfers to other models; each model needs its own
lever-T spot-check before the mode is applied to it. Log model+mode+intensity as a tuple.

---

## 6. Pitfalls (specific to thinking compression)

- **Silent quality regression** — the dangerous failure mode. `pytest` passes on easy
  tasks, fails opaquely on hard ones. The 2–3× run variance check + the multi-step
  reasoning task class (Phase 0) are the guards.
- **Reasoning scaffold loss** — `think` ultra strips plan-narration; if GLM-5.2 relies on
  "Let's structure the answer" to actually structure its answer, quality drops. The
  `think-preserve` mode exists to test this hypothesis specifically.
- **Connective-tissue list drift** — the preserved-tissue list was designed from one
  sample. Phase 0's job is to validate it; if it's wrong, revise before Phase 1.
- **Token-counting** — thinking tokens may not be exposed separately in `usage`. If not,
  infer from output-token delta vs. a no-thinking control; cross-check against ZenMux
  dashboard $. Same token-of-record discipline as the model bakeoff.
- **Confounding with the model bakeoff** — do not run lever-T arms in the same session as
  model-bakeoff arms. Fresh sessions, no context bleed.
- **Generalizing beyond GLM-5.2** — the verdict is for GLM-5.2 only. DeepSeek V4, MiniMax
  M3, etc. have different thinking styles; each needs its own spot-check.

---

## 7. Setup checklist

- [ ] **Phase 0:** capture 20–30 GLM-5.2 thinking traces via direct ZenMux API calls
      (script: log full `thinking` blocks + task class + gate result).
- [ ] Classify trace content into the 6 categories; compute % compressible, % connective,
      theoretical max `C_think` per class.
- [ ] Phase 0 decision gate: if % compressible < 20%, stop. If connective-tissue list is
      wrong, revise the caveman skill's `think-preserve` list.
- [ ] Confirm the model bakeoff (Phase 1/2) has landed and GLM-5.2 is the winning
      executor (or accept lever-T tests GLM-5.2 regardless, with the caveat above).
- [ ] Seed the lever-T results CSV with the header from §4.
- [ ] Run Phase 1 (3–4 tasks × 6 arms × 2–3 runs) with the kill-fast gates active.
- [ ] Compute `C_think`, quality hold, net savings per arm; apply the decision rule.

---

## 8. Icebox — deferred extensions

- **Other models.** Repeat lever-T for DeepSeek V4 Pro, MiniMax M3, Kimi K2.7 Code — each
  has a different thinking style; the GLM-5.2 verdict does not transfer. Run only if
  GLM-5.2's lever-T clears the bar and the mode is worth porting.
- **Budget-cap lever (option A).** The boring alternative: lower `thinking.budget_tokens`
  (8192 → 4096) without style steering. Known tradeoffs, no skill needed. If lever-T
  fails, this is the fallback worth testing — it's the lower-risk way to cut thinking cost.
- **Caveman on output, not thinking.** Already supported (the existing skill). Not part
  of lever-T; the 65% measured savings claim is for output prose only.
- **Headroom (input compression) interaction.** TierB §11's Headroom lever compresses
  *inputs*; lever-T compresses *thinking*. They're orthogonal and could stack — but test
  one at a time. Headroom first (it has a prior verdict attempt), then lever-T, never
  simultaneously until both own separate verdicts.
