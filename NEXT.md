# NEXT.md — PKMS current focus

*Updated 2026-07-05. Bakeoff series ICEBOXED 2026-07-05 (Phases 1-3 complete);
back to product work on Slice 7. Read this first; orient from it alone.*

## Current focus — Slice 7 (Phone PWA)

Code done (Lamplight frontend, `/api/inbox-items`, PWA service worker,
capture surface). Remaining gate is the **device-level proof on the Pixel 6
over tailnet** — Kenja demonstrates: today-view, read a promoted thread,
capture a thought from inside it. Steps: `docs/pixel-pwa-setup.md`.
**First action:** `tailscale serve --bg 8765`, then Add-to-Home-Screen on Pixel.

## Next 1-3 actions

1. **Slice 7 device proof** — Kenja, ~10 min on the Pixel over tailnet.
2. **Slice 8 unblocks** — K4: email-in address shape (plus-alias+label vs
   dedicated). K5: Discord bot token + invite. Both gate Slice 8.
3. **Slice 8 build** once K4+K5 land — email-in + Discord bot, per
   `vault/projects/pkms-design/build-plan.md` slice 8.

## Blocked on Kenja

- **K4** — email-in address shape. **K5** — Discord bot token + invite.

## Open decisions

- **kimi generalization:** does the anti-deliberation spec rewrite transfer to
  kimi-k2.7-code? Paused, not closed — reactivate on user follow-up.

## Icebox (reactivation conditions marked)

- **PKMS bakeoff series** (iceboxed 2026-07-05) — reactivate if routing table
  needs to change. Conclusions: MiniMax M3 default; GLM-5.2 conditional with
  anti-deliberation spec (~50%); kimi not re-tested. Evidence on
  `delegated/run-2026-07-05-glm52-headless-investigation` (local-only); full
  write-up `LLM-dev/bakeoffs/GLM-5.2-Phase3-SpecRewrite-Report-2026-07-05.md`.
- **Phase 1.5 free-models bakeoff — PKMS arm withdrawn** — CH-only now.
  Reactivate if a PKMS-side free-model question resurfaces.
- **kimi Phase 4 run** — reactivate if kimi re-enters the routing decision.
- **Phase 3b (isolate anti-deliberation directive from SQL confounder)** —
  reactivate if the conditional-viability claim needs hardening.

## Branch state

- `main` — Slice 1-6 + Lamplight + bakeoff conclusions merged; **226 green**;
  pushed to `origin/main`.
- `delegated/run-2026-07-05-glm52-headless-investigation` (local-only) —
  Phase 2+3 artifacts; push when ready.
- Derivable: `git status -sb`, `git branch -vv`, `git log --oneline origin/main..main`.
