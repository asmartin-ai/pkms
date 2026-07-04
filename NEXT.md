# NEXT.md — PKMS current focus

*Updated 2026-07-04 (agent unattended run). Read this first; orient from it alone.*

## What just happened

Agent executed the unattended-executable packets from `docs/delegation-roadmap.md`
on `feat/uiux-redesign`. Suite: **372 → 391**, no regressions. Six commits, all
via pathspec (Kenja's 51 staged publication-safety deletions left strictly alone
throughout — M4 respected).

| Commit | Packet | What |
|---|---|---|
| `8b00796` | P0 nit | Strip doubled `— - ` breadcrumb bullet in `.lede__sub`; sw v2→v3 |
| `755179b` | M1 | B6 CRLF regression guard (investigation: not a live bug; mitigation pinned) |
| `ce02f52` | P2 RED | RED oracle for `/api/recent-notes` + `/api/search?q=` |
| `ee658c2` | P2(a) backend | Two endpoints; `recent_notes()` + search route (literal-by-default) |
| `1b10530` | P2(a) frontend | Wire search surface: real candidates + debounced free-text results; sw v3→v4 |
| `3589839` | P1 doc | `docs/pixel-pwa-setup.md` (slice-7 install + verification steps for Kenja) |
| `0c1c5ba` | P2(b) | `/api/inbox-items` + density-gated inbox surface; sw v4→v5 |

Status lines appended under P0, P1, P2, M1 in `docs/delegation-roadmap.md`.

## Blocked on Kenja (surface, don't wait)

- **K1** — Lamplight device verdict (Firefox ext new tab + Pixel PWA). Gates: P0 merge + `DESIGN.md` rewrite + the P1 live run. The branch is ready; the nit is fixed.
- **K4** — Pick email-in address shape (plus-alias+label vs dedicated). Gates P3.
- **K5** — Discord bot token + invite. Gates P3.
- (K2, K3, K6 — not blocking the next packet.)

## Next 1–3 actions (literal first step)

1. **Get K1 from Kenja** (the device verdict). The agent side of P0 is done; the merge and `DESIGN.md` rewrite happen after his review. If he says "merge as-is," merge `feat/uiux-redesign` → `main` (his action — agents never merge to main themselves) and rewrite `DESIGN.md` to document the Lamplight system (tokens, type, the one-lit-object rule, motion).
2. **If K1 has fixes:** apply them as a follow-up on `feat/uiux-redesign`, re-review, then merge.
3. **P3 once K4+K5 land:** present K4's two options to Kenja (one question), then build the email-in + Discord bot per `build-plan.md` slice 8. Strong aider-delegation candidates for the parsing/ledger units; Gmail/Discord auth wiring stays first-party.

## Open decisions

- **Bakeoffs deferred to fresh sessions** (their own protocols require it):
  - `PKMS-Price-Performance-Bakeoff-Plan-2026-07-03.md` — model-selection bakeoff. Phase 0 needs a clean baseline (the branch is clean now — 391 passing) + fresh RED oracles (the F-batch item). B6 turned out NOT to be a usable oracle (already green — see M1 status in the roadmap). Run in a fresh session per its §5 symmetry rules.
  - `PKMS-Lever-T-Thinking-Compression-Plan-2026-07-03.md` — thinking-compression lever. Must run AFTER the bakeoff's Phase 1/2 lands (its §1 forbids running before the model question is settled). Even then only if Phase 0's trace study shows ≥40% compressible thinking content.
- **Inbox surface "open" action:** currently routes to `/api/open-note` (opens the capture file in the default markdown editor). The roadmap mentions "start /fold externally" as an alternative action — not wired; defer until Kenja lives with the surface and decides if /fold-from-the-browser is worth building.

## Icebox (do not start; reactivation conditions in `docs/delegation-roadmap.md` §8 + `build-plan.md`)

Voice ramp · Discord resurfacing mirror · career-ops dashboard (post-P5) · predictive partial sync (post-P5) · Keep-via-official-API · Textual TUI · Rust/Go hot paths · self-hosted fonts · card thumbnails · blind second visual take · cleaner token path for the PWA (reactivate when the token leaves the tailnet or the URL gets shared).

## Branch state

`feat/uiux-redesign` (HEAD `0c1c5ba`) — agent commits + Kenja's in-flight publication-safety scrub (staged, untouched). NOT pushed, NOT merged. The 51 staged `spike/` deletions + `exports/phase2-reading-bundle.md` are Kenja's; the agent never swept them into a commit (the pathspec discipline held across all six commits).
