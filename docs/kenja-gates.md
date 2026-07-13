# What's waiting on you

*Last updated 2026-07-12. All code is done. 431 tests green. These are the
only things between now and a fully live system.*

---

## Do (hands-on, ~23 min)

### Push main
⏱ ~1 min

13 commits sitting local. No code to write — just the push.

▶ **First keystroke:** open a terminal anywhere, type `git -C K:\Projects\PKMS push`

✓ **Done when:** `git status` says "up to date with origin/main"

---

### Wire up email capture
⏱ ~2 min + one test send

Gmail filter + app password. After this, forwarding a work email to
`aaronmartin638+pkms@gmail.com` lands it in your inbox.

Setup doc: `docs/email-discord-setup.md` — steps 1–5.

▶ **First keystroke:** open Gmail → Settings → Filters

✓ **Done when:** you forward one email and `pkms ingest email` picks it up

---

### Wire up Discord bot
⏱ ~10 min

Discord bot that DMs you become captures. Token = K5 (you have it).

Setup doc: `docs/email-discord-setup.md` — Discord section.

▶ **First keystroke:** open Discord Developer Portal → New Application

✓ **Done when:** you DM the bot and the message lands in `vault/inbox/`

---

### Prove it on the Pixel
⏱ ~10 min

Open the PWA on your phone over tailnet. Capture a thought, read a promoted
thread, verify it feels right.

Setup doc: `docs/pixel-pwa-setup.md`.

▶ **First keystroke:** on the Pixel, run `tailscale serve --bg 8765`

✓ **Done when:** you capture one thought from the phone and it shows up in
the desktop inbox

---

## Decide (sit-down, ~5 min — one question at a time is fine)

### Which life areas?

The today-view can show area tiles (Career, Health, Money, etc.) — but
`vault/areas/` is empty. The code is ready; it needs content only you can
author.

▶ **The one question:** which 1–3 areas do you want tiles for? Career is the
seeded default. Pick the ones that feel real, not aspirational.

✓ **Done when:** you say the names. Agent writes the notes.

---

### S1: how should PKMS nudge you?

Three quick picks. The questions are prepped in detail at
`docs/s1-notifications-decision-gates.md`.

**Q1 — where?** Today-view card (zero new infra) / Discord DM / phone push /
or defer all until after Phase 5.

**Q2 — what earns it?** Resurface picks / reading-queue nudges / reshape-clock
events / defer all.

**Q3 — reshape overlap?** Keep reshape on the today-view (separate lanes) or
let notifications be the reshape surface.

▶ **First keystroke:** open `docs/s1-notifications-decision-gates.md`

✓ **Done when:** three answers. Agent writes the spec; build is a separate
packet.

---

## The order that wastes the least brain

1. **Push main** — clears the mental "unpushed work" weight in 1 minute
2. **Email** — fastest ramp to wire (2 min)
3. **Discord** — one sitting with the portal (10 min)
4. **Pixel** — finish the evening with the phone in hand (10 min)
5. **Decisions** — whenever; one question per session is totally fine

No urgency on any of these. The system works locally right now. These just
open the doors.
