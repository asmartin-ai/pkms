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

- **K1** — Lamplight device verdict (Firefox ext new tab + Pixel PWA). Gates: P0 merge + `DESIGN.md` rewrite + the P1 live run. The branch is ready; the nit is fixed.
- **K4** — Pick email-in address shape (plus-alias+label vs dedicated). Gates P3.
- **K5** — Discord bot token + invite. Gates P3.
- **bakeoff token cross-check** — verify the ZenMux dashboard $ for the call at
  **2026-07-04T17:47:21Z** (F3 oracle re-fixed via ZenMux raw endpoint; 5.2k sent,
  2.6k received; Pro line $0.435/$0.87/M → ~$0.0045 expected). If it matches,
  aider-delegate's in-harness token counter is trustworthy for the real bakeoff; if it
  diverges, the $/task column has to come from the dashboard, not aider-delegate
  (plan §6 token-counting-bug pitfall). ~2 min on your dashboard. **Gates the real bakeoff's
  $ reporting.**
- (K2, K3, K6 — not blocking the next packet.)

## Next 1–3 actions (literal first step)

1. **Get K1 from Kenja** (the device verdict). The agent side of P0 is done; the merge and
   `DESIGN.md` rewrite happen after his review. If he says "merge as-is," merge
   `feat/uiux-redesign` → `main` (his action — agents never merge to main themselves) and
   rewrite `DESIGN.md` to document the Lamplight system.
2. **If K1 has fixes:** apply them as a follow-up on `feat/uiux-redesign`, re-review, then merge.
3. **Real bakeoff (fresh session):** the Phase 0 smoke is done; the real T3×N sweep needs a
   fresh session per plan §5 symmetry rules. First step in that session: revert the 3 F-batch
   fixes on a new `bakeoff/phase1` branch (to reuse the oracles — 3 small commits) OR author a
   new F-batch; then wire the 6 T3 + 4 T1/T2 models into `aider-delegate` provider config; then
   run Phase 1 (T3 × 3-4 tasks × 6 models × 2-3 runs). Gated by the bakeoff token cross-check
   above (else $/task is untrustworthy).
4. **P3 once K4+K5 land:** present K4's two options to Kenja (one question), then build the
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
