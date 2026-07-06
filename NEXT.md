# NEXT.md — PKMS current focus

*Updated 2026-07-07 (overnight autonomous run). Slices 7+8 CODE DONE; P4
agent-half shipped (area tiles); 431 green. Remaining gates are Kenja-hands.
Read this first; orient from it alone.*

## Current focus — activate Slices 7+8, then Phase 5 dogfood gate

Slice 8 merged (`pkms ingest email`, `pkms discord-bot`). P4 area tiles:
backend + web row shipped; tiles stay hidden until `vault/areas/` notes exist
(authored WITH Kenja — decision gate below). Phase-5 criteria doc drafted at
`vault/projects/pkms-design/phase5-dogfood.md`; its 2-week clock starts at
activation.

## Next 1-3 actions

1. **Slice 8 activation** — Kenja, ~12 min: `docs/email-discord-setup.md`
   (Gmail filter + app password; Discord bot token = K5). Done-when: a work
   email + a Discord DM both land in `vault/inbox/` and the next /fold.
2. **Slice 7 device proof** — Kenja, ~10 min on the Pixel over tailnet:
   `docs/pixel-pwa-setup.md`. First step: `tailscale serve --bg 8765`.
3. **Push main** — deferred from the 2026-07-06 autonomous run (pushes not
   pre-authorized). Verify gh account first (asmartin-ai), then `git push`.

## Blocked on Kenja (decision gates, options prepared)

- Slice 8 activation (incl. K5 Discord token) and Slice 7 device proof, above.
- **P4 content half**: which life areas get `vault/areas/` notes (one
  options-question; agent never invents the structure).
- **S1 notifications design**: `docs/s1-notifications-decision-gates.md` —
  Q1 channel, Q2 what earns a ping, Q3 reshape-clock interaction.

## Open decisions

- **kimi generalization** (anti-deliberation spec → kimi-k2.7-code): paused,
  reactivate on user follow-up.

## Icebox (reactivation conditions marked)

- **PKMS bakeoff series** (2026-07-05) — reactivate if routing table changes.
  MiniMax M3 default; evidence `LLM-dev/bakeoffs/GLM-5.2-Phase3-SpecRewrite-Report-2026-07-05.md`.
- **Phase 1.5 free-models bakeoff** — CH-only; PKMS arm withdrawn.
- **kimi Phase 4 run** — reactivate if kimi re-enters routing.
- **Phase 3b anti-deliberation isolate** — reactivate if GLM viability claim needs hardening.
- **Backlog: inbox surface in PWA** — check `tests/test_web_inbox_surface.py` first;
  may be partially shipped by Slice 7.

## Branch state

- `main` — slices 1-8 + P4 agent-half complete; **431 green** (run the suite
  with FORCE_COLOR/COLORTERM unset — harness shells that export them make
  Rich leak ANSI into pytest captures, 10 spurious fails); local commits
  pending push.
- `delegated/run-2026-07-05-glm52-headless-investigation` (local-only) — bakeoff artifacts.
- Derivable: `git status -sb`, `git branch -vv`, `git log --oneline origin/main..main`.
