# NEXT.md — PKMS current focus

*Updated 2026-07-04 (bakeoff Phases 1–3 COMPLETE). Read this first; orient from it alone.*

## What just happened

**PKMS Price-Performance Bakeoff COMPLETE.** 59 runs across Phases 1–3 on `bakeoff/phase1`
(off `feat/uiux-redesign`, 3 F-batch fixes reverted to reuse the oracles):
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

- **K1** — Lamplight device: APPROVED. `feat/uiux-redesign` → `main` merge is Kenja's action.
  `DESIGN.md` rewrite happens after. The bakeoff ran on `bakeoff/phase1` off `feat/uiux-redesign`;
  that branch is mine to delete or keep once you've reviewed the results.
- **K4** — Pick email-in address shape (plus-alias+label vs dedicated). Gates P3.
- **K5** — Discord bot token + invite. Gates P3.
- (K2, K3, K6 — not blocking.)

## Next 1–3 actions (literal first step)

1. **Kenja reviews the bakeoff verdict** (`docs/delegations/bakeoff-phase1-results.md`). If the
   routing table is accepted, wire `minimax/minimax-m3` as the default executor in the
   orchestrator-mode routing table (`~/.agents/skills/orchestrator-mode/`) and the
   aider-delegate defaults. **Literal first step:** open the results MD §"Phase 3 — routing table".
2. **K1 merge (Kenja's action):** merge `feat/uiux-redesign` → `main`; rewrite `DESIGN.md` for
   the Lamplight system. Then `bakeoff/phase1` can be deleted (its 3 revert commits are
   bakeoff-only; the F-batch fixes already shipped on `feat/uiux-redesign` via `c541b73`).
3. **P3 once K4+K5 land:** present K4's two options to Kenja (one question), then build the
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

- `feat/uiux-redesign` — agent commits + Kenja's publication-safety scrub + bakeoff Phase 0 smoke
  (F-batch oracles + 3 fixes + ZenMux cross-check), all merged via `c541b73`. Suite **402**. Not
  pushed, not merged to `main` (rides your K1 review).
- `bakeoff/phase1` — the bakeoff branch (off `feat/uiux-redesign`, 3 revert commits `4f8867e`
  `b59e801` `5a916f0`). Suite at reverted baseline **393 pass / 9 RED** (F-batch RED oracles).
  Untracked: `docs/delegations/bakeoff-phase1-results.{csv,md}`. Delete after K1 merge + your
  review of the verdict; the F-batch fixes already ship via `feat/uiux-redesign`.
- Derivable: `git status -sb`, `git log --oneline cb1db2e..feat/uiux-redesign`,
  `git log --oneline feat/uiux-redesign..bakeoff/phase1`.
