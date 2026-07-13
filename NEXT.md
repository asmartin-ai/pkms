# NEXT.md — PKMS current focus

*Updated 2026-07-12 (M2 ruff pass + doc prep session). Slices 1–8 + P4
agent-half complete; Lamplight merged; M2 done; 431 green. All remaining
gates are Kenja-hands — consolidated in docs/kenja-gates.md.*

## Current focus — activate Slices 7+8, then Phase 5 dogfood gate

Slice 8 code merged (`pkms ingest email`, `pkms discord-bot`); activation
is manual (email app password + Discord bot token). Slice 7 PWA ready; proof
is on the Pixel over tailnet. Phase 5 criteria doc at
`vault/projects/pkms-design/phase5-dogfood.md` — 2-week clock starts at
activation.

## Next actions (all Kenja — see `docs/kenja-gates.md`)

1. **Push main** — 13 commits pending (asmartin-ai account). 1 min.
2. **Slice 8 activation** — `docs/email-discord-setup.md`. ~12 min.
3. **Slice 7 device proof** — `docs/pixel-pwa-setup.md`. ~10 min.

## Blocked on Kenja (decision gates)

- **P4 content half**: which life areas get `vault/areas/` notes.
- **S1 notifications**: Q1 channel, Q2 what earns a ping, Q3 reshape-clock
  interaction. Prepped at `docs/s1-notifications-decision-gates.md`.

## Open decisions

- **kimi generalization** (anti-deliberation spec → kimi-k2.7-code): paused,
  reactivate on user follow-up.

## Icebox (reactivation conditions marked)

- **PKMS bakeoff series** (2026-07-05) — reactivate if routing table changes.
- **Phase 1.5 free-models bakeoff** — CH-only; PKMS arm withdrawn.
- **kimi Phase 4 run** — reactivate if kimi re-enters routing.
- **Phase 3b anti-deliberation isolate** — reactivate if GLM viability claim needs
  hardening.

## Branch state

- `main` — slices 1–8 + Lamplight merge + P4 agent-half + M2 ruff pass complete;
  **431 green**; local commits pending push.
- `delegated/run-2026-07-05-glm52-headless-investigation` (local-only) — bakeoff
  artifacts.
- Derivable: `git status -sb`, `git branch -vv`, `git log --oneline origin/main..main`.
