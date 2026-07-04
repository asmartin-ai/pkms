# NEXT.md — PKMS current focus

*Updated 2026-07-04 (agent unattended run + bakeoff Phase 0 smoke). Read this first; orient from it alone.*

## What just happened

Bakeoff Phase 0 smoke **merged into `feat/uiux-redesign`** (Option A — you approved).
Suite 391 → 402. Three F-batch RED oracles authored (F1 search --raw CLI flag, F2
paused-task wake field, F3 empty-query guard), each verified red-for-right-reason,
then fixed via 3 DeepSeek-direct Pro `aider-delegate` runs (3/3 first-shot,
$0.0193 total). One ZenMux raw-endpoint cross-check run (F3 reproduced
byte-identical, ts 2026-07-04T17:47:21Z). The `bakeoff/phase0` branch is deleted
(commits preserved in the `--no-ff` merge `c541b73`). Real bakeoff (Phases 1-3)
runs in a fresh session; the F-batch is consumed, so the fresh session authors a
new F-batch per the plan's Phase 0 protocol.

Earlier on this branch: agent executed the unattended-executable packets from
`docs/delegation-roadmap.md`, then committed Kenja's publication-safety scrub +
two planning docs. Commit history: `git log --oneline cb1db2e..feat/uiux-redesign`.

## Blocked on Kenja (surface, don't wait)

- **K1** — Lamplight device verdict: **APPROVED 2026-07-04**. The merge `feat/uiux-redesign` →
  `main` is Kenja's action (agents never merge to main). The `DESIGN.md` rewrite happens after
  the merge. The bakeoff does NOT wait for the merge — it runs on the branch (or off `main`
  once merged; the fresh session verifies which).
- **K4** — Pick email-in address shape (plus-alias+label vs dedicated). Gates P3.
- **K5** — Discord bot token + invite. Gates P3.
- **bakeoff token cross-check** — DONE 2026-07-04. ZenMux dashboard for the 17:47:21Z
  call (generationId `3ad28c9f…`): prompt 5151 / completion 2569 / realAmount $0.004475715.
  Matches aider-delegate's 5.2k sent / 2.6k received and the predicted $0.004476 (Pro line
  $0.435/$0.87/M). **aider-delegate's token counter is trustworthy** — the real bakeoff
  can compute $ from reported tokens × the known rate, no per-run dashboard lookup needed.
  (Side-data: throughput 75.96 tok/s, generationTime 33.82s — useful for the `wallclock_s`
  column in the real bakeoff's results CSV.) Phase 0's one cross-check per provider is
  sufficient — no Phase 1 cross-check needed (Kenja confirmed 2026-07-04).
- **skill fixes M17/M18/G1** — DONE 2026-07-04 + committed in `agent-hub` (Kenja approved).
  Wrote M17 (`zai` preset ≠ ZenMux — use raw `--api-base https://zenmux.ai/api/anthropic`),
  M18 (`cost_reported: null` on raw-`--api-base` → compute $ from stdout tokens × known
  rate; counter cross-checked to the 7th decimal, one cross-check per provider is sufficient),
  and G1 (ZenMux raw-`--api-base` recipe block) into `agent-hub/skills/aider-headless-delegate/SKILL.md`
  (+37 lines). The G1 recipe is the load-bearing ZenMux invocation for the bakeoff.
- **bakeoff Phase 1 primer** — DONE 2026-07-04. `docs/delegations/bakeoff-phase1-primer.md`
  (180 lines): self-contained handoff for the fresh session. Covers state-at-start, oracle
  reuse decision (recommends Option A — revert 3 F-batch fixes on `bakeoff/phase1`), the
  6 T3 + 4 T1/T2 models to wire, the G1 invocation recipe, results CSV schema, phasing +
  kill-fast gates, and what-NOT-to-do.
- (K2, K3, K6 — not blocking the next packet.)

## Next 1–3 actions (literal first step)

1. **Run the bakeoff (fresh session).** Phase 0 is smoke-complete and fully unblocked:
   K1 approved, token cross-check passed, skill fixes committed, primer written. The fresh
   session reads `docs/delegations/bakeoff-phase1-primer.md` + the plan + the skill, verifies
   state per primer §1, picks the oracle-reuse option (primer §2 recommends Option A — revert
   the 3 F-batch fixes on `bakeoff/phase1`), wires the 6 T3 models, and runs Phase 1.
   **Literal first step:** open `docs/delegations/bakeoff-phase1-primer.md` and follow §1.
2. **K1 merge (Kenja's action):** merge `feat/uiux-redesign` → `main` and rewrite `DESIGN.md`
   to document the Lamplight system. Does NOT gate the bakeoff — it runs on the branch (or off
   `main` once merged; the fresh session verifies which).
3. **P3 once K4+K5 land:** present K4's two options to Kenja (one question), then build the
   email-in + Discord bot per `build-plan.md` slice 8.

## Open decisions

- **Bakeoffs deferred to fresh sessions** (their own protocols require it):
  - `PKMS-Price-Performance-Bakeoff-Plan-2026-07-03.md` — Phase 0 smoke DONE (this session);
    Phases 1-3 need a fresh session. Phase 0's stale baseline concern is now corrected in the
    plan (391 on `feat/uiux-redesign`, not 145 on main). Remaining Phase 0 item: token
    cross-check vs ZenMux dashboard.
  - `PKMS-Lever-T-Thinking-Compression-Plan-2026-07-03.md` — thinking-compression lever. Must
    run AFTER the bakeoff's Phase 1/2 lands (its §1 forbids running before the model question
    is settled). Even then only if Phase 0's trace study shows ≥40% compressible thinking content.
- **Inbox surface "open" action:** currently routes to `/api/open-note` (opens the capture file
  in the default markdown editor). The roadmap mentions "start /fold externally" as an
  alternative action — not wired; defer until Kenja lives with the surface and decides if
  /fold-from-the-browser is worth building.
- **bakeoff/phase0 merge disposition:** RESOLVED — Option A (merge the fixes as
  real features). Merged via `c541b73` on `feat/uiux-redesign`. The real bakeoff
  session authors a fresh F-batch per the plan's Phase 0 protocol.

## Icebox (do not start; reactivation conditions in `docs/delegation-roadmap.md` §8 + `build-plan.md`)

Voice ramp · Discord resurfacing mirror · career-ops dashboard (post-P5) · predictive partial sync (post-P5) · Keep-via-official-API · Textual TUI · Rust/Go hot paths · self-hosted fonts · card thumbnails · blind second visual take · cleaner token path for the PWA (reactivate when the token leaves the tailnet or the URL gets shared).

## Branch state

`feat/uiux-redesign` — agent commits + Kenja's publication-safety scrub + the
bakeoff Phase 0 smoke (F-batch oracles + 3 fixes + ZenMux cross-check), all
merged via `c541b73`. Suite **402**. Not pushed, not merged to `main` (agents
never merge to main themselves — rides your K1 review). Derivable:
`git status -sb`, `git log --oneline cb1db2e..feat/uiux-redesign`. The
`bakeoff/phase0` branch is deleted (commits preserved in the `--no-ff` merge).
The 3 F-batch fixes are user-visible (`--raw` flag, `wake` field, library
guard) — they ship with the rest of the branch on K1 merge.
