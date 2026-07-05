# NEXT.md — PKMS current focus

*Updated 2026-07-05 (bakeoff Part 2 productionized: cherry-picks + i3 fix + pushed to origin). Read this first; orient from it alone.*

## What just happened

**Bakeoff Part 2 productionized (2026-07-05, follow-up session).** The 3 winning
MiniMax M3 run1 diffs (G1/G2/G3) were cherry-picked to `main` and **pushed to
`origin/main`**. The 4 G-batch oracles are GREEN on main. **i3 regression fixed:**
the G3 cherry-pick added `_snoozed_notes` with
inline `GROUP BY t.note_path` SQL, violating the i3 anti-drift oracle
(`test_bakeoff_i3.py` enforces no inline ranking SQL in `today.py`). Refactored:
extracted `snoozed_notes(conn)` to `tasks.py` (sibling to `next_action_per_note`),
`_snoozed_notes` in `today.py` now delegates to it. **Full suite: 226 passed, 0
failed.** 22 `delegated/run-*` branches preserved for audit. Orchestrator-mode +
orchestrator-law routing table wired in agent-hub (MiniMax M3 default). PAYG→subscription
rewiring clarified in `aider-headless-delegate` SKILL.md M19 (PAYG is bakeoff-only;
ongoing delegation uses `ZENMUX_API_KEY` subscription key — edit uncommitted in
agent-hub alongside Kenja's pre-existing WIP).

**PKMS Bakeoff Part 2 (Correction-Cost Validation) Phase 1 COMPLETE.** 22 Phase 1 runs
on `main` (3 fresh G-batch oracles: G1 multi-file, G2 larger-read-context, G3 single-file
control), activated by the content-hoarder completion signal on ntfy `kenja-bench-r7k2q9`.
- **Verdict: Part 1 routing table holds.** MiniMax M3 stays first-shot clean across all 3
  task shapes (G3, G1, G2) × 2 runs = **6/6 (100%) first-shot green, $0.0013/run median**.
  Zero correction cost (`orch_corr_usd=0` across all 22 runs) — the correction-cost metric
  is confirmed as a logging discipline with near-zero observed cost on the winning executor.
- **Pro lane does NOT earn its keep via aider-delegate.** Both Pro models are unusable
  headless via aider (M5 thinking-tokens bug — model burns output on reasoning prose,
  emits 0 edits): GLM-5.2 0/2, kimi-k2.7-code 1/4 (only G3 run2 passed; G3 run1 + G1×2
  failed M5). Killed via kill-fast on G1/G2 for both.
- **Local control (Qwen3-Coder-30B-A3B):** clears G3 (easy single-file) 2/2 first-shot,
  flails on G1 (multi-file) 0/2 with edit-parse failures (model describes edits in prose
  instead of SEARCH/REPLACE blocks). Local lane stays as 'free but slower' fallback for
  easy single-file scoped tasks only.
- **Cross-substrate check vs content-hoarder's sibling bakeoff (same day):** agrees on both
  counts — MiniMax M3 is the T3 winner, GLM-5.2 is unusable headless. High-confidence
  routing table.
- KAT-Coder-Pro-V2: 5/6 (83%) — near-tie backup; 1 G1 run2 edit-parse fail (variance).
Full results + verdict: `docs/delegations/bakeoff-part2-phase1-results.md`. Raw data:
`bakeoff/part2/results.csv`. Total Phase 1 executor spend ~$0.025. Oracle hashes locked
throughout; no regressions from any arm.

**PKMS Price-Performance Bakeoff Part 1 COMPLETE (2026-07-04).** 59 runs across Phases 1–3
on `bakeoff/phase1` (off `feat/uiux-redesign`, 3 F-batch fixes reverted to reuse the oracles):
- **Phase 1 (T3 Flash):** 6 models × 3 tasks × 2 runs = 35 runs. **MiniMax M3 wins** —
  $0.001576/run median, 8s wallclock, 1M ctx, 6/6 first-shot green, lowest cost+variance.
  KAT-Coder-Pro-V2 is the near-tie backup (256K ctx, most minimal diffs). step-3.7-flash
  overflowed 256K ctx on F2 (kill-fast: OK for single-file only). qwen3.6-flash had 1 no-edit
  flake (F1 r1, r2 clean; 14% flake rate).
- **Phase 2 (T1/T2 Pro):** 4 models × 3 tasks × 2 runs = 24 runs. **All 24 first-shot green.**
  kimi-k2.7-code is the Pro winner ($0.005401/run, 10.5s, lowest variance). dsv4pro is most
  expensive+verbose ($0.007395, adds unsolicited UX scope). qwen3.7-max has severe wallclock
  variance (156s spike on F2).
- **Phase 3 verdict:** **Pro does NOT justify ~3× on this workload.** Identical pass/first-shot
  rates (100%/100%), 2.9–4.1× cost, no speed/quality advantage. The §6 kill-fast gate fires soft:
  Flash wins the cheap-delegate lane; Pro becomes the escalation lane for tasks that strain T3
  (multi-file refactor, ambiguous spec, larger read context).
- **Routing table:** default `minimax/minimax-m3` (T3); backup `kuaishou/kat-coder-pro-v2` (T3);
  Pro escalation `moonshotai/kimi-k2.7-code`; alt Pro `z-ai/glm-5.2`; avoid `stepfun/step-3.7-flash`
  (256K overflow) and `deepseek/deepseek-v4-pro` in the cheap lane.

Full results: `docs/delegations/bakeoff-phase1-results.{md,csv}`. Total executor spend $0.2125
($0.0649 T3 + $0.1476 Pro). Oracle hashes locked throughout; suite stays at 393 pass / 9 RED
(the reverted F-batch) on `bakeoff/phase1`; no regressions from any of the 59 arms.

## Blocked on Kenja (surface, don't wait)

- **K1** — Lamplight device: DONE. `feat/uiux-redesign` → `main` merged; bakeoff
  Part 1 + Part 2 cherry-picks + i3 fix all on `main` and pushed to `origin/main`.
  `DESIGN.md` rewrite still pending (separate action, not blocking).
- **K4** — Pick email-in address shape (plus-alias+label vs dedicated). Gates P3.
- **K5** — Discord bot token + invite. Gates P3.
- (K2, K3, K6 — not blocking.)

## Next 1–3 actions (literal first step)

1. **Commit the agent-hub skill edit.** The `aider-headless-delegate` SKILL.md M19
   PAYG-Is-bakeoff-only clarification is uncommitted in `C:/Users/Kenja/agent-hub`
   alongside Kenja's pre-existing WIP (NEXT.md, README.md, render.py, servers.toml).
   **Literal first step:** `cd C:/Users/Kenja/agent-hub && git diff skills/aider-headless-delegate/SKILL.md`
   — review, then commit just that path with `git commit skills/aider-headless-delegate/SKILL.md`.
2. **Decide on the 22 `delegated/run-*` branches.** Preserved for audit; delete with
   `git branch -D delegated/run-*` once you're satisfied main is the source of truth
   (suite is 226 green, 3 winners cherry-picked). Optional cleanup.
3. **Draft Phase 4 bakeoff plan** for Pro models on harder tasks (multi-file refactor,
   ambiguous spec, larger read context). Kenja: "simple coding tasks are overkill for those
   models — we need to feed them more complex planning or orchestration tasks." Note:
   Part 2 confirmed GLM-5.2 and kimi are unusable headless via aider (M5) — a Phase 4
   plan should use a different harness (interactive aider, or direct API) for the Pro
   escalation lane, not aider-delegate.
4. **P3 once K4+K5 land:** present K4's two options to Kenja (one question), then build the
   email-in + Discord bot per `build-plan.md` slice 8.

## Open decisions

- **Bakeoff follow-up (deferred, not blocking):** the 3rd-run variance backfill on minimax F2 +
  kimi F2 — only worth running if the routing-table decision changes, which it doesn't. Skip.
- **Lever-T thinking-compression plan** — its §1 forbids running before the model question is
  settled. It's now settled (minimax is the default). Lever-T can run if Phase 0's trace study
  shows ≥40% compressible thinking content; otherwise skip.
- **Inbox surface "open" action:** routes to `/api/open-note` (default markdown editor). The
  "/fold externally" alternative is not wired; defer until Kenja lives with the surface.

## Icebox (do not start; reactivation conditions in `docs/delegation-roadmap.md` §8 + `build-plan.md`)

Voice ramp · Discord resurfacing mirror · career-ops dashboard (post-P5) · predictive partial sync (post-P5) · Keep-via-official-API · Textual TUI · Rust/Go hot paths · self-hosted fonts · card thumbnails · blind second visual take · cleaner token path for the PWA (reactivate when the token leaves the tailnet or the URL gets shared).

## Branch state

- `main` — the Lamplight redesign + bakeoff Phase 0/1/2 + Part 2 cherry-picks + i3
  regression fix are all merged here and **pushed to `origin/main`**. Suite
  **226 green**, 0 type-checker errors. The `feat/uiux-redesign` and
  `bakeoff/phase1` branches were deleted after the earlier merge (their commits
  are preserved in main's history). 22 `delegated/run-*` branches preserved as
  the Part 2 audit trail (deletable on review).
- Derivable: `git status -sb`, `git branch -vv`, `git log --oneline origin/main..main`.
  Historical merges (F-batch `c541b73`, Lamplight `5bf7f15`, type fixes `137215c`)
  are preserved in main's history.
