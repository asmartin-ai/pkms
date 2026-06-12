---
title: "Theme: Mobile & sync (Pixel 6)"
tags: [pkms-design, research, adhd, theme, mobile, sync]
created: 2026-06-10
modified: 2026-06-12
status: reacted-with-questions
---

# 34 — Theme: Mobile & sync (Pixel 6)

**Why this matters for the build:** mobile capture latency is a documented abandonment *cause*, and a desktop-only vault loses the capture war you've already settled with Keep/Discord. Mark each: ✅ / ❌ / ❓.

*Reactions transferred verbatim from `exports/phase2-reading-bundle.md`, 2026-06-12. Items #4/#5 got ❓ — clarification added under #4; both concerns feed gate G10.*

1. **Reuse content-hoarder's proven pattern wholesale:** vault + index stay on Windows; the phone gets a tailnet-private HTTPS PWA via `tailscale serve`. Same host, same tailnet, zero new infrastructure ([[20-mobile-sync]] MS-01, MS-12).
   **React:** ✅ - Soft Agree. I think we can consider other patterns. Mobile latency is critical and if we think the PWA isnt meeting my needs then we might need to try other soltuions or upgrade what we have. I think it could be cool to have a discord bot that works with this tool to "mirror" the pkms into my private notes discord. Ive also thought about more complex solutions like having an outright native Android app from scratch for mobile but that is way out of scope for now.
2. **The <2s capture ramp: HTTP Shortcuts widget/tile → one-tap POST to a `/capture` route → append-only timestamped file in `vault/inbox/`.** No app launch, no decisions, conflicts structurally impossible ([[20-mobile-sync]] MS-08, MS-13).
   **React:** ✅
3. **"Open the vault app" is never on the capture path.** Capture and triage/reading are separate ramps with separate latency budgets ([[20-mobile-sync]] MS-06).
   **React:** ✅ - I think I agree.
4. **File sync is optional and never load-bearing.** If wanted: Syncthing fork via F-Droid, with eyes open about the 2025–26 maintainer-handover risk; indexer must hide `*.sync-conflict-*` files ([[20-mobile-sync]] MS-02–MS-04).
   **React:** ❓ — I dont understand and i dont think i agree.
   > **Clarification (Claude, 2026-06-12):** "Never load-bearing" doesn't mean "sync is discouraged" — it means *the system's correctness must never depend on sync having worked*. The vault's one source of truth stays on the PC; the phone's synced copy is a convenience replica. If sync breaks, lags, or produces a conflict file, you lose freshness, never data. Your actual concern ("if I turn off my PC I'd still like to sync/read") is fully compatible with this: a synced folder gives you offline reading exactly because it's a replica that doesn't need the PC live. What the principle rules out is the *fragile* version — phone and PC both editing the same authoritative files, where a sync failure can corrupt or silently fork the vault. Your G10 answer (partial synced folder for offline access) fits inside this principle, not against it.
5. **Git-on-phone is ruled out** — Android storage can't host a healthy repo where editors can reach it, and GitJournal is 4.5 years stale. It's exactly your overengineering trap ([[20-mobile-sync]] MS-10, MS-11).
   **React:** ❓ — Only being able to use tailscale is questionable i think. If i ever want to turn off my PC, it would be nice to still be able to sync.
6. **Voice capture = Pixel Recorder's on-device transcription, ingested later** — don't build custom voice infrastructure ([[20-mobile-sync]] MS-14).
   **React:** ✅
7. **Open question for you (Phase 3 gate):** PWA-only, or PWA + synced folder so the phone has offline read access to the whole vault? Capture-offline works either way ([[20-mobile-sync]] open questions).
   **React:** ✅ - Synced folder for a portion of the vault would be nice. Predicting which parts of the vault im likely to need would be incredible. Im a bit limited by space on my phone, but network access is plentitiful. Still, being able to access and triage stuff on planes would be really nice.

Full evidence: [[20-mobile-sync]]; [[10-synthesis]] → cross-cutting verdicts.
