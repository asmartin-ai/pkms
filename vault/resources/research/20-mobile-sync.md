---
title: Mobile capture + sync architecture — Pixel 6 constraint
created: 2026-06-10
modified: 2026-06-10
tags: [research, adhd, pkms-design, mobile, sync, capture]
status: draft
---

# 20 — Mobile Capture + Sync Architecture (Pixel 6 Constraint)

Findings from the mobile-capture/sync research track. 14 findings; 3 sample-verified by an adversarial fact-checker, 0 failed.
Program: [[00-ground-truths]] - Related: [[11-hn]] (the <2s capture bar and "phone is the capture surface" insights this track operationalizes)

## Top takeaways

1. **The <2s zero-decision capture ramp exists and is boring to build:** HTTP Shortcuts (FOSS, actively maintained) home-screen widget or quick-settings tile firing a 1-tap POST to a self-hosted `/capture` route over tailnet HTTPS, which appends a timestamped one-file-per-capture note to `vault/inbox/` — no app launch, no destination decision, and conflicts are structurally impossible because no two devices ever edit the same file (MS-08, MS-12, MS-13).
2. **Never put "open the vault app" on the capture path.** Obsidian on Android has a multi-year pattern of slow startups (reports from a few seconds up to a minute) and its share target dumps into the last-used vault without asking — capture and triage/reading must be separate ramps with separate latency budgets (MS-06).
3. **The phone story is already solved in this user's own ecosystem:** content-hoarder serves a tailnet-private HTTPS PWA via `tailscale serve` with zero file sync, and the PKMS should reuse that exact pattern (same host, same tailnet) rather than inventing a new mobile architecture (MS-01, MS-12).
4. **If file sync is wanted at all, Syncthing is the only fit for the privacy constraint** (peer-to-peer, no cloud) and its conflicts are non-destructive — but the Android client situation is genuinely risky in 2026 (official app retired Dec 2024; the main fork went through an opaque maintainer handover with unresolved signing-key questions). Pin the install source, make sync swappable, and let the PWA/endpoint path carry capture so sync is never load-bearing (MS-02, MS-03, MS-04).
5. **Kill the git-on-phone idea early — it is exactly this user's overengineering trap:** Android shared storage supports no permissions/symlinks so a healthy repo can't live where editor apps can reach it, and GitJournal — the only real git-native mobile app — hasn't shipped a release since September 2021 (MS-10, MS-11).

---

## Findings

### MS-01. The sibling content-hoarder project already solved Pixel 6 access for this exact user without any file sync: the Windows machine serves a Flask PWA over a tailnet-private HTTPS tunnel (tailscale serve), and the phone is a thin client that installs it from Firefox.

> We use Tailscale (a zero-config WireGuard mesh VPN) so the app is reachable **only by your own devices** — never the public internet.

- **Source:** `K:\Projects\content-hoarder\docs\MOBILE_TAILSCALE.md` (first-party, read this session)
- **Credibility:** First-party project doc on this machine; describes a working deployed pattern for the same user/devices. Strongest possible precedent for this build.
- **Design implication:** PKMS can reuse the proven pattern wholesale: keep the vault+index on Windows, expose a capture/triage PWA via tailscale serve (HTTPS enables Add-to-Home-Screen + offline shell), and treat file sync as optional rather than foundational.

### MS-02. Syncthing's conflict behavior is non-destructive but litter-producing: when the same file is modified on two devices, the older copy is renamed to a sync-conflict file, both versions survive, and the conflict files themselves propagate to every device.

> When a file has been modified on two devices simultaneously and the content actually differs, one of the files will be renamed to `<filename>.sync-conflict-<date>-<time>-<modifiedBy>.<ext>`. The file with the older modification time will be marked as the conflicting file and thus be renamed.

- **Source:** [Syncthing docs — Understanding Synchronization (Conflicting Changes)](https://docs.syncthing.net/users/syncing.html)
- **Credibility:** Official documentation; quote extracted verbatim from fetched page (whitespace normalized from HTML).
- **Design implication:** If Syncthing is used, no data is ever lost in a conflict — but the PKMS indexer must recognize `*.sync-conflict-*` files, exclude them from search results, and surface them as a one-tap triage item instead of indexing them as duplicate notes.

### MS-03. The official Syncthing Android app was retired with the December 2024 release because Google Play publishing became near-impossible and the app was unmaintained, so any Android Syncthing today means a community fork.

> I am retiring it. The last release on Github and F-Droid will happen with the December 2024 Syncthing version. Reason is a combination of Google making Play publishing something between hard and impossible and no active maintenance.

- **Source:** [Discontinuing syncthing-android — Syncthing Community Forum (official announcement)](https://forum.syncthing.net/t/discontinuing-syncthing-android/23002)
- **Credibility:** Primary source (maintainer announcement); quote copied from the forum's raw post endpoint.
- **Design implication:** Document the Android sync leg as "community fork via F-Droid" from day one and architect so the sync transport is swappable — never hard-code assumptions that the Syncthing Android client will exist in its current form.

### MS-04. Syncthing-Fork (the main community Android client) went through an opaque 2025–2026 maintainer handover — repo deletions, an unreachable original maintainer, and unresolved questions about who holds the app signing keys — making it a real supply-chain/maintenance risk.

> Without an official statement from Catfriend1, it cannot be ruled out that the developer account has been compromised.

- **Source:** [heise online — Key handover in the dark: Syncthing fork community raises alarm](https://www.heise.de/en/news/Key-handover-in-the-dark-Syncthing-fork-community-raises-alarm-11107337.html)
- **Credibility:** Reputable tech news outlet reporting on public forum evidence; quote verified verbatim from raw HTML. Situation is fluid — current state (new maintainer researchxxl, repo at researchxxl/syncthing-android, Play listing) corroborated by Syncthing forum threads found in search.
- **Design implication:** If Syncthing is chosen: install from F-Droid (reproducible community build), disable blind auto-update on the phone, and re-verify the fork's trust status at build time — plus keep the PWA/endpoint path (MS-01) as the fallback so sync is never load-bearing for capture.

### MS-05. Markor (FOSS Android markdown editor) provides a near-zero-friction capture ramp that bypasses heavyweight vault apps: a dedicated home-screen QuickNote launcher (1 tap to an editable markdown file) and a share-sheet target that appends shared text into a fixed file (~2-3 taps, no decisions), explicitly designed to pair with Syncthing.

> The fastest and easiest way to take notes! QuickNote is a file in Markdown format with a freely choosable file location. You can access it by swiping twice at the main screen, by selecting QuickNote at Notebook, or by using the dedicated launcher.

- **Source:** [Markor README (gsantner/markor)](https://github.com/gsantner/markor)
- **Credibility:** Official README, quote copied verbatim from raw.githubusercontent.com. README also states "The project recommendation is Syncthing." Tap counts are estimates from the documented flows, not device-measured.
- **Design implication:** Markor is the strongest native-editor candidate for the phone leg: point its QuickNote/ToDo files at the vault's inbox folder so 1-tap launcher capture and share-into-append work today with zero custom code.

### MS-06. Capture paths that require opening Obsidian on Android fail the <2s budget: users report startup taking from several seconds up to a minute (multiple forum threads), and the Android share target silently lands in the last-used vault with no way to pick a destination.

> Each time Obsidian App is loading it takes up to a minute to load.

- **Source:** [Obsidian Forum — "Obsidian is loading very slow on Android"](https://forum.obsidian.md/t/obsidian-is-loading-very-slow-on-android/85228) (plus threads 95793, 91272, 57450 corroborating; vault-picking complaint verified verbatim in thread 92591: "It seems like everytime the last used vault is selected and I hate this behaviour.")
- **Credibility:** User anecdotes, but a persistent multi-year pattern across at least five separate forum threads; worst-case quote is an outlier (typical reports are 1-25s). Quotes copied from forum raw post endpoints.
- **Design implication:** Never make "open the vault app" part of the mobile capture ramp — capture must go through a widget/tile/share target that writes to the inbox without launching the full PKMS UI; reading/triage can tolerate app startup, capture cannot.

### MS-07. Obsidian Sync is the low-maintenance commercial fallback: $4/month (billed annually), end-to-end encrypted with AES-256, official and mobile-supported — but it only solves sync, not capture friction (MS-06 still applies).

> End-to-end encryption. Your data is automatically secured using AES‑256, the strongest encryption standard. With Obsidian Sync you're always in total control of your notes.

- **Source:** [Obsidian Sync (official product page)](https://obsidian.md/sync)
- **Credibility:** Vendor marketing claims (E2E design is publicly documented but not independently audited here); pricing and quote verified verbatim from fetched page HTML ("Start syncing $4 per month").
- **Design implication:** Acceptable privacy-wise as a paid escape hatch if self-hosted sync becomes a maintenance burden; budget $48/yr and note it does nothing for the capture-ramp problem, so it never replaces the capture endpoint/widget.

### MS-08. HTTP Shortcuts (FOSS, actively maintained, v4.5.0 May 2026) is the best verified <2s zero-decision capture ramp: a home-screen widget or quick-settings tile fires a pre-configured HTTP POST (e.g. clipboard or prompted text) to a self-hosted capture endpoint — 1 tap, no app launch, no decisions.

> Invoke from home screen widgets, quick settings tiles, or quick access device controls

- **Source:** [HTTP Shortcuts for Android README (Waboodoo/HTTP-Shortcuts)](https://github.com/Waboodoo/HTTP-Shortcuts)
- **Credibility:** Official README, quote copied verbatim from raw README; release recency (v4.5.0, 2026-05-24) from GitHub via WebFetch summary (secondary). Share-sheet-target support NOT verified this session — only widgets/tiles/device-controls are documented in the quoted line.
- **Design implication:** Pair HTTP Shortcuts with a tiny capture route on the PKMS's own served app (POST `/capture` appends a timestamped file to `vault/inbox/` over the tailnet): this is the concrete <2s ramp for the "save this HN/Reddit link with zero ceremony" win scenario.

### MS-09. The Telegram-bot-to-vault pattern (share to a Telegram chat from the phone, a desktop Obsidian plugin ingests messages into notes) is a proven fast offline-queued ramp, but the main plugin is desktop-only by design and routes captures through Telegram's cloud — a privacy tradeoff.

> Transfer messages and files from Telegram to your Obsidian vault. You can easily save text, voice transcripts, images, and other files from your Telegram chats to Obsidian for further processing and organization. This plugin is only available for desktops and would never be available on mobile platforms.

- **Source:** [Telegram Sync for Obsidian README (soberhacker/obsidian-telegram-sync)](https://github.com/soberhacker/obsidian-telegram-sync)
- **Credibility:** Official README, quote copied verbatim from raw README; last release v4.0.0 Oct 2024 per WebFetch (maintenance cooling). Regular Telegram chats are cloud-stored, not E2E — disqualifying for a privacy-sensitive vault without accepting that exposure.
- **Design implication:** Treat this as design inspiration, not a component: replicate its winning property (instant share target + offline queue + desktop-side ingestion) with the self-hosted capture endpoint instead, keeping content off third-party clouds. The user's existing Discord-dump habit is the same pattern with the same privacy caveat.

### MS-10. Git-based phone sync is structurally awkward on Android: Termux's docs show shared storage (where GUI editors like Markor/Obsidian must read the vault) supports no chmod/chown, no symlinks/special files, and no executables — so a healthy git repo must live in Termux's private directory, which those editor apps cannot access.

> Storage type | chmod/chown support | Special files support | Executables support | Access mode — Internal ($HOME/$PREFIX): yes, yes, yes, RW (app dir); Shared storage: no, no, no, RW; External storage: no, no, no, RO / RW (app dir)

- **Source:** [Termux Wiki — Internal and external storage (feature comparison table)](https://wiki.termux.com/wiki/Internal_and_external_storage)
- **Credibility:** Official Termux wiki; quote is the comparison table flattened to text verbatim from the fetched page. The architectural consequence (repo location vs editor access conflict) is the researcher's inference from the documented constraints.
- **Design implication:** Rule out Termux+git cron as the phone sync leg: the repo-location dilemma plus scripting maintenance burden is exactly the kind of overengineering trap flagged in the user profile. Git stays a desktop-side versioning/backup tool only.

### MS-11. GitJournal, the main git-native mobile notes app, has had no release since v1.80.0 in September 2021 (4.5+ years) despite some recent repo pushes and 132 open issues — too stale to bet the mobile leg on.

- **Source:** GitHub API — `https://api.github.com/repos/GitJournal/GitJournal/releases/latest` (releases/latest: v1.80.0, 2021-09-15; repo pushed_at 2026-05-26, archived: false, open_issues: 132)
- **Credibility:** Primary data from the GitHub API queried this session; interpretation (release channel effectively dead while repo technically alive) is the researcher's.
- **Design implication:** Eliminates the last credible git-on-phone option (reinforces MS-10): the mobile leg should be either a synced plain folder (Markor) or the served PWA, not a git client.

### MS-12. tailscale serve provides tailnet-only HTTPS with a real TLS certificate in front of a localhost service — the missing piece that makes a self-hosted vault UI installable as a PWA on Android Firefox without exposing anything to the public internet.

> tailscale serve lets you share a local service securely within your Tailscale network (known as a tailnet).

- **Source:** [Tailscale KB — Tailscale Serve command](https://tailscale.com/kb/1242/tailscale-serve)
- **Credibility:** Official vendor docs; quote verified verbatim from raw page HTML. The page explicitly contrasts with "tailscale funnel ... to expose your service publicly, open to the entire internet." PWA-install-requires-HTTPS detail corroborated first-party by content-hoarder's MOBILE_TAILSCALE.md (MS-01).
- **Design implication:** The PKMS server gets two mobile-facing routes over the same tailnet HTTPS endpoint: POST `/capture` (for the HTTP Shortcuts ramp, MS-08) and the triage/read PWA — zero new infrastructure beyond what content-hoarder already requires.

### MS-13. Sync conflicts concentrate precisely in the note types a capture-heavy ADHD workflow touches from both devices — daily notes and inbox notes — which is why append-only, one-file-per-capture inbox design sidesteps the entire conflict class: phone and desktop never write the same file.

> This matters most for daily notes, inbox notes, and active project notes that you edit from multiple devices.

- **Source:** [Synch blog — Why Obsidian Notes Get Duplicated or Disappear During Sync](https://synch.run/blog/obsidian-sync-conflicts/)
- **Credibility:** Vendor blog of a sync product (secondary, has an interest in the problem existing), but the mechanism is fully consistent with Syncthing's official conflict model (MS-02): conflicts require two devices modifying the same file. The one-file-per-capture corollary is engineering inference from MS-02's documented trigger condition, not an independently sourced anecdote.
- **Design implication:** Make mobile capture append-only and atomic: every capture creates a new timestamped file in `vault/inbox/` (or POSTs to the endpoint which does the same); the shared "today" daily note is only ever edited on desktop, making sync-conflict files structurally near-impossible.

### MS-14. Voice capture on the Pixel 6 is solvable fully on-device and privately via the Recorder app's local transcription, but exporting the transcript as text is a deferred multi-step flow (~3-5 taps after recording), so voice is a "capture now, ingest later" ramp rather than a <2s one.

> Share or save a transcript as a text file: On your device, open the Recorder app. Touch and hold a recording. Tap Share > Transcript (.txt).

- **Source:** [Pixel Phone Help — Save & share recordings & transcripts](https://support.google.com/pixelphone/answer/16267696?hl=en)
- **Credibility:** Official Google support doc; quote verified verbatim from fetched page (step-list flattened to text — the checker notes the original renders "Tap Share" and "Transcript (.txt)" as two sub-steps). On-device/offline transcription on Pixel corroborated by multiple secondary articles in search; tap counts are estimates from the documented steps.
- **Design implication:** Don't build custom voice infrastructure: accept .txt share-sheet output into the capture inbox (via Markor share-into or the capture endpoint) and treat voice transcript export as a batch step during desktop triage, not part of the instant-capture ramp.

---

## Coverage notes

SEARCHED/READ THIS SESSION: Syncthing official docs (conflict mechanics, verbatim) and the official syncthing-android retirement announcement (forum raw post); heise.de coverage of the 2025-26 Syncthing-Fork maintainer handover (raw HTML verified); Markor README (raw); HTTP Shortcuts README (raw) + release recency; obsidian.md/sync page (raw, pricing + E2E text); Obsidian forum threads on Android startup latency (raw posts, 85228 and 92591; three more threads identified but not read in full); obsidian-telegram-sync README (raw); Termux wiki storage-feature table (verbatim); GitJournal via GitHub API (repo + releases/latest); Tailscale serve KB (raw); synch.run conflict blog; Pixel Recorder support doc (raw); and first-party content-hoarder docs (README.md, docs/MOBILE_TAILSCALE.md). Quote-verification discipline: every quote was copied from raw HTML/markdown/API output fetched this session, not from WebFetch model summaries (whitespace normalized where HTML was stripped).

GAPS/SKIPS: Tap counts and seconds-to-capture are estimates derived from documented flows, not measured on the actual Pixel 6. HTTP Shortcuts' ability to act as a share-sheet target was not verified (only widgets/QS tiles/device controls are documented in the quoted line) — worth a 5-minute on-device test in Phase 2. The current Play Store listing state of Syncthing-Fork under the new maintainer was corroborated only by search-result snippets (situation explicitly fluid — re-verify at build time). Obsidian Advanced URI / QuickAdd home-screen-shortcut ramps not evaluated in depth (the forum post confirmed vault-scoped URI shortcuts exist). Dropbox/Drive+third-party-client options not benchmarked (eliminated early: no E2E without extra layers, weaker offline story, and the Syncthing/PWA paths dominate them on this user's privacy constraint). LAN-only-without-Tailscale (plain mDNS/static-IP) covered only implicitly via content-hoarder's "2a plain HTTP" section.

OPEN QUESTIONS FOR THE DESIGNER: (1) PWA-only vs PWA+Syncthing hybrid — does the user need offline read access to the whole vault on the phone, or only capture (offline) + read (online-over-tailnet)? Capture-offline is satisfiable by HTTP Shortcuts' queuing or a Markor inbox folder without full vault sync. (2) Whether the PKMS capture endpoint should live inside the existing content-hoarder Flask app or as a separate tiny service on another port of the same tailnet host.

## Verification

Sampled ids: MS-01, MS-08, MS-14 — all 3 verified, 0 failed.

- [verified] MS-01 — Quote is verbatim from `K:\Projects\content-hoarder\docs\MOBILE_TAILSCALE.md` (lines 4-5). The doc confirms the full pattern: Flask app (web.py line 1: "Flask app factory + routes"), tailscale serve for HTTPS, Pixel 6 + Firefox PWA install, tailnet-private, no file sync. All material claims supported.
- [verified] MS-08 — Quoted line present verbatim in the raw README (raw.githubusercontent.com/Waboodoo/HTTP-Shortcuts/master/README.md). Version claim (v4.5.0, 2026-05-24) confirmed on the GitHub releases page. The finding's own caveat — share-sheet-target support unverified — is accurate and honestly disclosed; no overclaiming.
- [verified] MS-14 — Google support page confirms the process and substance, with one minor transcription note: the original is a two-sub-step action ("Tap Share" then select "Transcript (.txt)"), which the finding rendered as a single merged line — light flattening, not fabrication. The 3-5 tap estimate is consistent with the documented steps, and the "capture now, ingest later" characterization is well-supported.

Checker summary: All three findings check out. MS-01 fully verified against the local first-party doc and project source. MS-08 verified word-for-word against the raw README with release date confirmed directly from GitHub. MS-14 verified with a minor note about a compressed two-part step in the quoted text; the substance, tap estimate, and characterization are well-supported.
