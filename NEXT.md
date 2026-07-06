# NEXT.md — PKMS current focus

*Updated 2026-07-06. Slice 8 CODE DONE (delegated build, merged to main, 416 green);
remaining gates are Kenja activation steps. Read this first; orient from it alone.*

## Current focus — activate Slices 7+8, then Phase 5 dogfood gate

Slice 8 code merged: `pkms ingest email` (IMAP + app password, label "pkms",
plus-alias per K4) and `pkms discord-bot` (DMs → POST /capture). All that's left
on slices 7 AND 8 is Kenja-hands work; after that the build-plan says Phase 5.

## Next 1-3 actions

1. **Slice 8 activation** — Kenja, ~12 min: `docs/email-discord-setup.md`
   (Gmail filter + app password; Discord bot token = K5). Done-when: a work
   email + a Discord DM both land in `vault/inbox/` and the next /fold.
2. **Slice 7 device proof** — Kenja, ~10 min on the Pixel over tailnet:
   `docs/pixel-pwa-setup.md`. First step: `tailscale serve --bg 8765`.
3. **Push main** — deferred from the 2026-07-06 autonomous run (pushes not
   pre-authorized). Verify gh account first (asmartin-ai), then `git push`.

## Blocked on Kenja

- Slice 8 activation (incl. K5 Discord token) and Slice 7 device proof, above.

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

- `main` — slices 1-8 code complete; **416 green**; local commits pending push.
- `delegated/run-2026-07-05-glm52-headless-investigation` (local-only) — bakeoff artifacts.
- Derivable: `git status -sb`, `git branch -vv`, `git log --oneline origin/main..main`.
