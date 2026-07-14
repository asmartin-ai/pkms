# NEXT.md — PKMS current focus

*Updated 2026-07-12 (agent overnight: M3 docs freshness + residual ruff).
Slices 1–8 + P4 agent-half complete; Lamplight merged; M1–M3/M5 done; 431
green. All remaining near-term gates are Kenja-hands — `docs/kenja-gates.md`.*

## Current focus — activate Slices 7+8, then Phase 5 dogfood

Slice 8 code merged (`pkms ingest email`, `pkms discord-bot`); activation
is manual (email app password + Discord bot token). Slice 7 PWA ready; proof
is on the Pixel over tailnet. Phase 5 criteria at
`vault/projects/pkms-design/phase5-dogfood.md` — 2-week clock starts at
activation.

**Life-OS posture (do not reorder around this):** PKMS is the durable
knowledge vault + capture surface, not the first standard-interface
testbed. That role belongs to content-hoarder (life-os ADR 0013). PKMS
should keep capture ramps live and dogfoodable; cross-project contracts
(`resurface_card`, `source_span`, `action_receipt`, `attention_budget`)
land as consumers after the content-hoarder promotion-card fixture
proves the shape. Do not start a PKMS dashboard or Life-OS write-back
from here.

## Next actions (all Kenja — see `docs/kenja-gates.md`)

1. **Push main** — ~~local commits pending (asmartin-ai account). 1 min.~~ ✅ done 2026-07-13.
2. **Slice 8 activation** — `docs/email-discord-setup.md`. ~12 min.
3. **Slice 7 device proof** — `docs/pixel-pwa-setup.md`. ~10 min.
4. **Start Phase 5 dogfood clock** once 1–3 land — criteria in
   `vault/projects/pkms-design/phase5-dogfood.md`.

## After dogfood (not now)

- **Promotion ingest path.** When content-hoarder's promotion-card
  fixture exists, define the PKMS-side destination for a promoted item
  (append-only note + `source_span` pointing at the content-hoarder
  item, not a re-scrape of the URL). Decision A/B/C on auto-promote vs
  triage gate still open in life-os `docs/onramps.md` — do not implement
  Option B until that ADR lands.
- **Today-card / resurface consumption.** PKMS can later render one
  Life-OS `resurface_card` (ADR 0017/0025) on the new-tab/PWA surface.
  Fixture-first; no live ranking until content-hoarder proves the card.
- **Keep link overflow.** Route standalone YouTube/link saves toward
  content-hoarder; Keep stays a notes ramp (`docs/keep-setup.md` +
  life-os `docs/onramps.md`).
- **Hearth type/token convergence.** Atkinson→Lexend, Plex Mono→JetBrains
  Mono, token renames. Rides the next scheduled front-end packet
  (DESIGN.md §Hearth Convergence). Not blocking activation.

## Blocked on Kenja (decision gates)

- **P4 content half**: which life areas get `vault/areas/` notes.
- **S1 notifications**: Q1 channel, Q2 what earns a ping, Q3 reshape-clock
  interaction. Prepped at `docs/s1-notifications-decision-gates.md`.
- **content-hoarder ↔ PKMS handoff** (life-os): Option A / B / C on Save →
  promote. Owned in life-os; PKMS only needs a destination once chosen.

## Open decisions

- **kimi generalization** (anti-deliberation spec → kimi-k2.7-code): paused,
  reactivate on user follow-up.

## Icebox (reactivation conditions marked)

- **PKMS bakeoff series** (2026-07-05) — reactivate if routing table changes.
- **Phase 1.5 free-models bakeoff** — CH-only; PKMS arm withdrawn.
- **kimi Phase 4 run** — reactivate if kimi re-enters routing.
- **Phase 3b anti-deliberation isolate** — reactivate if GLM viability claim needs
  hardening.
- **Life-OS dashboard built from PKMS** — paused; research wants a re-entry
  lede/action-card surface, not a dashboard.
- **Legacy Obsidian migration** from `C:\Users\Kenja\Documents\obsidian_notes`.

## Re-entry

1. `docs/kenja-gates.md` (hands-on only).
2. This file's "After dogfood" only after Phase 5 is running.
3. life-os: `domains/pkms.md` + `docs/onramps.md` §content-hoarder ↔ PKMS
   for integration questions — not for today's activation work.

## Branch state

- `main` — slices 1–8 + Lamplight merge + P4 agent-half + M1–M3/M5 complete;
  **431 green**; pushed to both remotes.
- `canonical` remote = `asmartin-ai/pkms-canonical` (private, full history).
- `origin` remote = `asmartin-ai/pkms` (public mirror). Public pushes use
  `scripts/build_public_mirror.py`; never push canonical main raw.
- `delegated/run-2026-07-05-glm52-headless-investigation` (canonical-only) — bakeoff artifacts.
- Derivable: `git remote -v`, `git status -sb`, `git log --oneline origin/main..main`.
