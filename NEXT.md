# NEXT.md — PKMS current focus

*Updated 2026-07-26 (session wrap-up). Keep onramp shipped (ADR 0028).
CI green. 273 tests passed after UV migration; uv.lock committed.
Free-pool swarm confirmed gkeepapi v0.17.1 is actively maintained.*

## Session wrapup — 2026-07-26 (Google Keep onramp + UV migration)

**Shipped:** Three-path Keep onramp per life-os ADR 0028:
- `pkms ingest keep-takeout <zip>` — bulk Takeout import (no auth, idempotent)
- `pkms ingest keep` — live incremental sync via gkeepapi
- `pkms ingest keep-sweep [--apply]` — destructive sweep; DRY RUN DEFAULT

**Load-bearing safety:** a Keep note never imported is NEVER deleted
(`test_apply_never_deletes_uncaptured_note`). 32 keep tests, 273 full suite.
Attachments mirrored to K:\MediaMirror\keep\ (sha256, file:// links).

**UV migration:** `uv.lock` committed (38 packages). `uv sync --all-extras`
reuses `.venv`. `typer>=0.16` floor bumped.

**Next for the user:**
1. Generate Takeout ZIP at takeout.google.com (Keep only)
2. `pkms ingest keep-takeout <zip>` → ~200 notes into vault/inbox/
3. `pkms ingest keep-sweep --age-days 30` (dry-run); review; `--apply` if good

**Discord bot + Pixel PWA still pending** (Slice 7+8 activation, unblocked).
**Promotion ingest path** still per ADR 0027 (unblocked, deferred behind dogfood).

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

- **Promotion ingest path — UNBLOCKED 2026-07-20.** content-hoarder's
  promotion-card fixture is click-test proven (CH#72 closed) and life-os
  ADR 0027 (Proposed) records the direction: Option C hybrid — promote via
  triage sprint into PKMS `vault/inbox/`, capture envelope per life-os
  `docs/contracts.md`, two-hop `source_span` (PKMS → CH item → original URL),
  unsave-on-source deferred behind `action_receipt`. Next: PKMS-side
  promotion-ingest spec (destination, envelope mapping) — see
  `docs/delegation-roadmap.md`.
- **Today-card / resurface consumption.** Fixture-first; no live ranking
  content-hoarder proves card.
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
