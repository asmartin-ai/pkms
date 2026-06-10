---
title: "Theme: Mobile & sync (Pixel 6)"
tags: [pkms-design, research, adhd, theme, mobile, sync]
created: 2026-06-10
modified: 2026-06-10
status: awaiting-reactions
---

# 34 — Theme: Mobile & sync (Pixel 6)

**Why this matters for the build:** mobile capture latency is a documented abandonment *cause*, and a desktop-only vault loses the capture war you've already settled with Keep/Discord. Mark each: ✅ / ❌ / ❓.

1. **Reuse content-hoarder's proven pattern wholesale:** vault + index stay on Windows; the phone gets a tailnet-private HTTPS PWA via `tailscale serve`. Same host, same tailnet, zero new infrastructure ([[20-mobile-sync]] MS-01, MS-12).
   **React:** ✅ / ❌ / ❓ —
2. **The <2s capture ramp: HTTP Shortcuts widget/tile → one-tap POST to a `/capture` route → append-only timestamped file in `vault/inbox/`.** No app launch, no decisions, conflicts structurally impossible ([[20-mobile-sync]] MS-08, MS-13).
   **React:** ✅ / ❌ / ❓ —
3. **"Open the vault app" is never on the capture path.** Capture and triage/reading are separate ramps with separate latency budgets ([[20-mobile-sync]] MS-06).
   **React:** ✅ / ❌ / ❓ —
4. **File sync is optional and never load-bearing.** If wanted: Syncthing fork via F-Droid, with eyes open about the 2025–26 maintainer-handover risk; indexer must hide `*.sync-conflict-*` files ([[20-mobile-sync]] MS-02–MS-04).
   **React:** ✅ / ❌ / ❓ —
5. **Git-on-phone is ruled out** — Android storage can't host a healthy repo where editors can reach it, and GitJournal is 4.5 years stale. It's exactly your overengineering trap ([[20-mobile-sync]] MS-10, MS-11).
   **React:** ✅ / ❌ / ❓ —
6. **Voice capture = Pixel Recorder's on-device transcription, ingested later** — don't build custom voice infrastructure ([[20-mobile-sync]] MS-14).
   **React:** ✅ / ❌ / ❓ —
7. **Open question for you (Phase 3 gate):** PWA-only, or PWA + synced folder so the phone has offline read access to the whole vault? Capture-offline works either way ([[20-mobile-sync]] open questions).
   **React:** ✅ / ❌ / ❓ —

Full evidence: [[20-mobile-sync]]; [[10-synthesis]] → cross-cutting verdicts.
