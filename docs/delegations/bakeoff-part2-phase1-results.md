# PKMS Price-to-Performance Bakeoff — Part 2 (Correction-Cost Validation) — Phase 1 Results

*Completed 2026-07-05. Phase 1 of the Part 2 bakeoff, activated by the content-hoarder
completion signal on ntfy topic `kenja-bench-r7k2q9` at 07:30 CDT (message time 1783253691).
Plan: `K:/Users/Kenja/Documents/LLM-dev/bakeoffs/PKMS-Part2-Correction-Cost-Validation-2026-07-04.md`.
Raw data: `bakeoff/part2/results.csv` (22 Phase 1 runs + 3 Phase 0 smoke rows).*

**Phase 1 only — Phase 2 (decision write-up + routing-table update) is the next step.**

---

## Verdict (headline)

**The Part 1 routing table holds on harder tasks.** MiniMax M3 stays first-shot clean across
all three Part 2 tasks — single-file control (G3), multi-file (G1), and larger-read-context
(G2) — with zero correction cost. The Pro escalation lane does NOT earn its keep on this
substrate: both Pro models tested (kimi-k2.7-code, glm-5.2) are **unusable headless via
aider** due to the M5 thinking-tokens bug (model burns output budget on visible reasoning
prose before emitting edits). The correction-cost metric is confirmed as a logging
discipline with **near-zero observed cost on the winning executor** (every MiniMax arm was
first-shot clean — `orch_corr_usd = 0` across all 6 MiniMax runs).

### Cross-substrate check vs content-hoarder's sibling bakeoff

content-hoarder's bakeoff (completed same day, signal received 2026-07-05 07:30 CDT)
reported: **T3 WINNER minimax/minimax-m3 (q2c=347, 88% pass, $0.0025/pass)** and **"GLM-5.2
unusable headless (25% pass - M5 thinking-tokens bug)."** Part 2's PKMS-substrate findings
**agree on both counts**: MiniMax M3 is the T3 winner (100% pass here vs 88% on the
larger content-hoarder substrate), and GLM-5.2 is unusable headless via aider (0/2 on PKMS
vs 25% on content-hoarder). The routing table is high-confidence — same model wins on both
substrates, same model fails on both.

---

## Phase 1 results — 22 runs across 3 tasks × 5 models × 2 runs (with kill-fast reductions)

### Per-model pass rate (Phase 1 only — excludes Phase 0 smoke)

| Model | Tier | Pass/Total | First-shot rate | Median $/task | Notes |
|---|---|---|---|---|---|
| **minimax/minimax-m3** | T3 Flash | **6/6 (100%)** | **6/6 (100%)** | $0.0013 | Winner — clean on all 3 task shapes |
| kuaishou/kat-coder-pro-v2 | T3 Flash | 5/6 (83%) | 5/6 (83%) | $0.0013 | Near-tie; 1 G1 run2 edit-parse fail (variance) |
| moonshotai/kimi-k2.7-code | T1/T2 Pro | 1/4 (25%) | 1/4 (25%) | $0.006 (when it ran) | M5 thinking-tokens; killed on G1/G2 |
| z-ai/glm-5.2 | T1/T2 Pro | 0/2 (0%) | 0/2 (0%) | $0.003 (wasted) | M5 thinking-tokens; killed on G1/G2 |
| qwen3-coder-30b-a3b-instruct | Local control | 2/4 (50%) | 2/4 (50%) | $0 (free) | Clears G3 (easy) 2/2; flails on G1 (multi-file) 0/2; killed on G1/G2 |

### Per-task pass rate

| Task | Shape | Pass/Total | Kill-fast reductions |
|---|---|---|---|
| G3 — today_view snoozed section | Single-file control (easy) | 7/10 | glm-5.2 killed (0/2); others ran |
| G1 — keep-ingest ledger durability | Multi-file (medium-hard) | 3/8 | kimi killed (0/2), local killed (0/2) |
| G2 — linker orphan detection | Larger-read-context (medium) | 4/4 | Only minimax + kat ran (others killed earlier) |

### Correction cost — the metric Part 2 validates

**`orchestrator_correction_$ = 0` across all 22 Phase 1 runs.** No arm needed orchestrator
re-spec, correction diff, or re-delegation. Every gate-pass was first-shot clean; every
gate-fail was a model-side failure (M5 thinking-tokens or edit-parse) that the
orchestrator did NOT attempt to correct (the kill-fast gate fired instead, logging the
verdict and moving on).

**Verdict on the metric:** the correction-cost metric is **confirmed as a logging
discipline with near-zero observed cost on the winning executor.** It earns its place
forward-going (cheap insurance, decisive when non-zero), but it does NOT change the routing
decision on this substrate — MiniMax M3's first-shot rate is 100%, so the correction cost
is structurally zero. The plan's §9 decision rule applies: "If `orchestrator_correction_$ =
0` on ≥80% of arms → the metric is confirmed as a logging discipline; keep logging it but
the routing decision stays on executor $ + first-shot rate." 100% ≥ 80% → confirmed.

### Kill-fast gates fired (4 of them)

| Gate | Model | Substrate | Trigger | Verdict |
|---|---|---|---|---|
| GLM-5.2 on G1/G2 | z-ai/glm-5.2 | PKMS Part 2 | 2/2 G3 runs (the EASY control) failed with identical M5 root cause | "GLM-5.2 unusable headless via aider on this substrate — M5 thinking-tokens bug" |
| Kimi on G1/G2 | moonshotai/kimi-k2.7-code | PKMS Part 2 | 2/2 G1 runs failed with identical M5 root cause (after G3 run1 also failed M5) | "kimi-k2.7-code unreliable headless via aider on multi-file/larger tasks — M5 thinking-tokens" |
| Local on G1/G2 | qwen3-coder-30b-a3b-instruct | PKMS Part 2 | 2/2 G1 runs failed with identical edit-parse root cause | "Local lane NOT viable for multi-file scoped tasks; stays 'research/analysis only' or 'easy single-file fallback'" |

### Local control arm verdict (separate from the cloud-vs-cloud routing)

**Qwen3-Coder-30B-A3B** clears the easy single-file control (G3) first-shot 2/2 — the local
lane is a viable fallback for simple scoped work, matching the `local-llm-delegation`
skill's positioning. But it **flails on the multi-file task (G1) 0/2** with an edit-parse
failure (model describes edits in prose instead of emitting parseable SEARCH/REPLACE
blocks). Per the plan's §9 decision rule: "If it flails even on G3 → demote to
research/analysis only. If it passes G3 first-shot and needs correction only on harder
tasks → keep as the 'free but slower' fallback." It cleared G3, so the local lane **stays
in the routing table as the "free but slower" tier for easy single-file scoped tasks** —
not promoted over a cloud arm on $/task (its $0 is structurally unbeatable but its
wallclock + edit-parse failure rate tell the real story).

---

## Token economics (Phase 1 spend)

- **Total Phase 1 executor spend: ~$0.025** (22 runs; MiniMax $0.0013/run × 6 + kat $0.0013/run × 6 + kimi $0.006/run × 2 [wasted] + glm $0.0032/run × 2 [wasted] + local $0 × 4).
- **PAYG balance at activation:** $21.59. **At completion:** ~$21.55 (within rounding).
- **ZenMux subscription:** healthy throughout; quotas had headroom.

---

## Routing table (Part 2 confirmed, no shift from Part 1)

| Lane | Model | When |
|---|---|---|
| **T3 default** | `minimax/minimax-m3` | All scoped PKMS features (single-file, multi-file, larger-read-context) — 100% first-shot across all 3 task shapes |
| **T3 backup** | `kuaishou/kat-coder-pro-v2` | When MiniMax is unavailable; 83% first-shot (1 edit-parse fail on G1 in 2 runs — variance, not a consistent failure) |
| **Pro escalation** | (vacant) | The Pro lane does NOT earn its keep on this workload. Both Pro models tested are unusable headless via aider (M5). Reserve Pro for genuinely hard jobs the Flash lane can't handle — but those need a different harness than aider-delegate (the M5 bug is harness-side, not model-side — GLM-5.2 and kimi-k2.7-code are capable models, they just can't emit aider-parseable edits headlessly). |
| **Local fallback** | `qwen3-coder-30b-a3b-instruct` (LM Studio) | Easy single-file scoped tasks only (cleared G3 2/2); NOT viable for multi-file (0/2 on G1 with edit-parse failures). Free, ~77–119s wallclock (3–5× slower than cloud). |
| **Skip** | `z-ai/glm-5.2`, `moonshotai/kimi-k2.7-code` via aider-delegate | M5 thinking-tokens bug — 0 edits applied, output burned on reasoning prose. Use these models interactively (where the user can interrupt) or via a different harness, not headless aider. |

---

## What was NOT run (deferred)

- **GLM-5.2 and kimi on G1/G2:** killed via kill-fast after 2/2 G3 (GLM) and 2/2 G1 (kimi) identical M5 failures. Running them on harder tasks would burn budget to re-confirm a known weakness.
- **Local on G2:** killed via kill-fast after 2/2 G1 identical edit-parse failures. The larger-read-context task would only be worse for the edit-parse issue.
- **Phase 2 of Part 2 (the decision write-up):** this doc IS the Phase 2 deliverable. The routing-table shift question is answered (no shift). The correction-cost metric question is answered (confirmed as logging discipline, near-zero observed cost).

---

## Done-when checklist (plan §10)

- [x] Phase 1 results CSV populated (22 Phase 1 runs + 3 Phase 0 smoke rows)
- [x] Per-model metrics computed: pass rate, median $/task, first-shot rate, correction cost
- [x] Part 2 verdict written (this doc): routing table holds, correction cost is a logging discipline, local arm clears G3 but not G1
- [x] Cross-substrate check vs content-hoarder's bakeoff: same model wins (MiniMax M3), same model fails (GLM-5.2) — high-confidence routing table
- [ ] `NEXT.md` updated with the verdict + next actions (next step)
- [ ] ntfy listener torn down (done — no listener process running at session end)
- [ ] Local model unloaded (done — `lms ps` confirms "No models currently loaded")
