# NEXT.md — PKMS current focus

*Updated 2026-07-14 (session wrap-up). CI green. Email capture live.
Private/public repo split complete. Slices 1–8 agent-complete; P4
agent-half complete; Lamplight merged; 431 green.*

## Current focus — finish Slice 7+8 activation, then Phase 5 dogfood

Slice 8 code merged; email-in is activated (Gmail app password + filter
working — `pkms ingest email` captured 1 live). Discord bot NOT yet wired.
Slice 7 PWA ready; proof is on the Pixel over tailnet.

**Life-OS posture (do not reorder around this):** PKMS is the durable
knowledge vault + capture surface, not the first standard-interface
testbed. That role belongs to content-hoarder (life-os ADR 0013).

## Next actions

1. ~~Push main~~ ✅ done 2026-07-14.
2. ~~Email capture activation~~ ✅ live 2026-07-14.
3. **Discord bot activation** — `docs/email-discord-setup.md` Discord section. ~10 min.
4. **Slice 7 device proof** — `docs/pixel-pwa-setup.md`. ~10 min.
5. **Start Phase 5 dogfood clock** once 1–4 land — criteria in
   `vault/projects/pkms-design/phase5-dogfood.md`.

## After dogfood (not now)

- **Promotion ingest path.** When content-hoarder's promotion-card fixture
  exists, define the PKMS-side destination.
- **Today-card / resurface consumption.** Fixture-first; no live ranking
  until content-hoarder proves the card.
- **Hearth type/token convergence.** Atkinson→Lexend, Plex Mono→JetBrains
  Mono, token renames. Rides the next scheduled front-end packet.
- **Keep link overflow.** Route standalone YouTube/link saves toward
  content-hoarder.

## Blocked on Kenja (decision gates)

- **P4 content half**: which life areas get `vault/areas/` notes.
- **S1 notifications**: Q1 channel, Q2 what earns a ping, Q3 reshape-clock
  interaction. Prepped at `docs/s1-notifications-decision-gates.md`.
- **content-hoarder ↔ PKMS handoff** (life-os): Option A / B / C on Save →
  promote. Owned in life-os.

## Open decisions

- **kimi generalization** (anti-deliberation spec → kimi-k2.7-code): paused,
  reactivate on user follow-up.

## Icebox

- **PKMS bakeoff series** — reactivate if routing table changes.
- **Phase 1.5 free-models bakeoff** — CH-only; PKMS arm withdrawn.
- **kimi Phase 4 run** — reactivate if kimi re-enters routing.
- **Life-OS dashboard built from PKMS** — paused.
- **Legacy Obsidian migration** from `C:\Users\Kenja\Documents\obsidian_notes`.

## Re-entry

1. Pick a remaining activation item above (Discord or Pixel).
2. Decision gates when you have bandwidth — one question per sitting is fine.
3. `docs/kenja-gates.md` for the full list.

## Branch + remote state

- `canonical` = `asmartin-ai/pkms-canonical` (private) — push work here.
- `origin` = `asmartin-ai/pkms` (public) — push via mirror pipeline.
- `main` — in sync with both remotes; **CI green** (3.11 + 3.12, ruff + pytest).
- `delegated/run-*` branches on canonical only.
- Derivable: `git remote -v`, `git status -sb`.
