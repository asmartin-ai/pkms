# NEXT.md — PKMS current focus

*Updated 2026-07-04 (agent unattended run + bakeoff Phase 0 smoke). Read this first; orient from it alone.*

## What just happened

Two threads on this branch (`feat/uiux-redesign`) + a side branch:

1. **Bakeoff Phase 0 smoke** on `bakeoff/phase0` (off the clean 391 baseline). Authored 3
   fresh F-batch RED oracles (the plan §4/§7 Phase 0 deliverable; B6 unusable — already
   green per M1), then delegated each fix to DeepSeek-direct Pro via `aider-delegate` as a
   pipeline smoke. 3/3 first-shot, 0 retries, total **$0.0193** (F1 $0.0078, F2 $0.0084,
   F3 $0.0031). Suite 391 → 402 (+9 F-batch tests green, +2 from parametrization). Oracle
   hashes unchanged, diff scope clean, no token-cap truncations. Results + verdict in
   `docs/delegations/bakeoff-phase0-results.md`; CSV in `bakeoff-phase0-results.csv`.
2. **Earlier on `feat/uiux-redesign`** (the prior NEXT.md content, unchanged): agent
   executed the unattended-executable packets from `docs/delegation-roadmap.md`, then
   staged and committed Kenja's in-flight publication-safety scrub plus two planning docs.
   Suite was 372 → 391, no regressions. Commit history: `git log --oneline cb1db2e..feat/uiux-redesign`.

| Branch | Commit | What |
|---|---|---|
| bakeoff/phase0 | `620598f` | F3 fix: empty/whitespace query guard in search.search() |
| bakeoff/phase0 | `4bd30ff` | F2 fix: paused-task wake field in extract_tasks() |
| bakeoff/phase0 | `284ff1e` | F1 fix: --raw flag on pkms search CLI |
| bakeoff/phase0 | `3cbc55b` | F-batch RED oracles (3) for bakeoff Phase 0 |
| feat/uiux-redesign | `8b00796` | P0 nit: strip doubled `— - ` breadcrumb bullet in `.lede__sub`; sw v2→v3 |
| feat/uiux-redesign | `755179b` | M1: B6 CRLF regression guard (investigation: not a live bug; mitigation pinned) |
| feat/uiux-redesign | `ce02f52` | P2 RED: oracle for `/api/recent-notes` + `/api/search?q=` |
| feat/uiux-redesign | `ee658c2` | P2(a) backend: two endpoints; `recent_notes()` + search route (literal-by-default) |
| feat/uiux-redesign | `1b10530` | P2(a) frontend: wire search surface; sw v3→v4 |
| feat/uiux-redesign | `3589839` | P1 doc: `docs/pixel-pwa-setup.md` + delegation spec |
| feat/uiux-redesign | `0c1c5ba` | P2(b): `/api/inbox-items` + density-gated inbox surface; sw v4→v5 |
| feat/uiux-redesign | `279c85c` | bookkeeping: packet status lines in delegation-roadmap + this NEXT.md |
| feat/uiux-redesign | `3b243fb` | publication safety: allowlist mirror scripts/doc/tests, path scrub, `spike/` removal |
| feat/uiux-redesign | `2e39fd8` | design input: Fable UI/UX redesign brief |
| feat/uiux-redesign | `3fb04b1` | planning: two bakeoff plans |

Status lines appended under P0, P1, P2, M1 in `docs/delegation-roadmap.md` and under
Phase 0 in `docs/PKMS-Price-Performance-Bakeoff-Plan-2026-07-03.md`.

## Blocked on Kenja (surface, don't wait)

- **K1** — Lamplight device verdict (Firefox ext new tab + Pixel PWA). Gates: P0 merge + `DESIGN.md` rewrite + the P1 live run. The branch is ready; the nit is fixed.
- **K4** — Pick email-in address shape (plus-alias+label vs dedicated). Gates P3.
- **K5** — Discord bot token + invite. Gates P3.
- **Bakeoff token cross-check** — confirm `aider-delegate`'s in-harness token counter matches
  the ZenMux dashboard $ on one smoke run. Gates the real bakeoff's $/task reporting (the only
  Phase 0 item still open from the smoke). ~2 min on Kenja's dashboard.
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
- **bakeoff/phase0 branch disposition:** the F-batch fixes are real improvements (a CLI escape
  hatch, a structured `wake` field, an empty-query guard). They could merge to
  `feat/uiux-redesign` independently of the bakeoff, OR stay on `bakeoff/phase0` to be
  reverted there for the real run's oracle reuse. Decision: defer to Kenja — these are
  user-visible changes (`--raw` flag, `wake` field in the parsed task dict) that ride the
  same merge-review gate as K1.

## Icebox (do not start; reactivation conditions in `docs/delegation-roadmap.md` §8 + `build-plan.md`)

Voice ramp · Discord resurfacing mirror · career-ops dashboard (post-P5) · predictive partial sync (post-P5) · Keep-via-official-API · Textual TUI · Rust/Go hot paths · self-hosted fonts · card thumbnails · blind second visual take · cleaner token path for the PWA (reactivate when the token leaves the tailnet or the URL gets shared).

## Branch state

- `feat/uiux-redesign` — agent commits + Kenja's publication-safety scrub (committed together
  in `3b243fb`). Not pushed, not merged (agents never merge to main themselves). Suite 391.
  Derivable: `git status -sb`, `git log --oneline cb1db2e..feat/uiux-redesign`.
- `bakeoff/phase0` — off `feat/uiux-redesign` (clean 391 baseline). 4 commits: 3 F-batch fixes
  + the oracle commit. Suite 402. Derivable: `git log --oneline feat/uiux-redesign..bakeoff/phase0`.
  F-batch fixes are user-visible (CLI flag + structured field + library guard); merge
  disposition deferred to Kenja alongside K1. The 3 RED oracles on this branch are CONSUMED
  (green) — the real bakeoff reverts them on a fresh `bakeoff/phase1` to reuse, OR authors a
  new F-batch.
