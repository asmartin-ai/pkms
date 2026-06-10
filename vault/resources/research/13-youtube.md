---
tags: [pkms-design, research, adhd, sweep-a, youtube]
created: 2026-06-09
modified: 2026-06-09
status: raw-findings
---

# 13 — YouTube: ADHD Engineer Tool Stacks (Sweep A)

Raw findings from the Sweep A community-anecdotes workflow. 21 findings; 6 sample-verified by an adversarial fact-checker, 0 failed.
Program: [[00-ground-truths]] - Synthesis target: [[10-synthesis]]

## Top takeaways

1. **Capture is an interrupt, never a scheduled activity** — "an ADHD brain has almost no RAM" (F1). And the capture surface must not open a feed: paper's killer feature is no notifications (F18).
2. **Self-generated urgency gets rejected by the brain that made it** — Pomodoro and self-imposed deadlines fail across multiple diagnosed creators (F3, F17). Don't build fake-deadline motivation primitives.
3. **Gamification that survives: completions, instant feedback, finishable progress bars. Gamification that decays in a week: points, streaks, leaderboards** (F4).
4. **GTD dies on trust** — "I couldn't trust my own brain" to maintain it (F5, 1.87M-view talk). The machine must hold the invariants. Corollary: plan for the pivot; systems fail when novelty fades, and that's success, not failure (F6) — markdown + regenerable index makes pivots free.
5. **Never enumerate all the steps** — full decomposition makes projects feel infinite and triggers shutdown; surface first-few steps and offer pick-by-interest (F7).
6. **The working blueprint for the win scenario exists:** "Coding With ADHD" runs Claude Code inside an Obsidian vault — web clips land in /inbox, a file-watcher has the LLM summarize and link each into the daily note, hands-free (F8, F9). 134k views on a 3.4k-sub channel = the framing resonates hard.
7. **Ubiquitous capture outranks data elegance** (F10 — Notion chosen over Obsidian purely for phone capture), and outsourced structure + automated inflow keeps systems alive (F11).
8. **Paused/icebox status is shame management** (F12); retrieval is associative (links/backlinks), never location-recall (F15); a visibly growing link graph is a sustainable intrinsic reward (F16).

---

## Findings

### F1. Chris Ferdinandi frames ADHD working memory as 'almost no RAM': capture must happen in the exact moment of the thought, as an interrupt, never as a scheduled or batched activity, or the thought is permanently lost.

> an ADHD brain has almost no RAM... you need to write it down right away or you will lose it forever because it never gets written into long-term storage

- **Source:** https://www.youtube.com/watch?v=tPNMJxrw4yY
- **Who:** Chris Ferdinandi, veteran frontend developer/educator (gomakethings.com), adult-diagnosed ADHD, runs an ADHD-for-developers newsletter; guest on Real Python Podcast #221 (Real Python channel, 207k subs), Sep 2024
- **Tool/system:** paper notebook / any capture device
- **Design implication:** Capture path must be interrupt-grade: single hotkey/command from anywhere into one default inbox, zero filing decisions at capture time. Anything that asks 'where does this go?' first will lose the thought.
- **Research questions:** 3

### F2. Ferdinandi 'defrags' his notebook/to-do list only occasionally and deliberately avoids doing it often, because frequent system-cleanup becomes a substitute activity for real work and reviewing undone items spikes anxiety and burns working memory.

> you get into this habit with systems like that where you obsess over the system to the detriment of the work

- **Source:** https://www.youtube.com/watch?v=tPNMJxrw4yY
- **Who:** Chris Ferdinandi, frontend developer with ADHD, Real Python Podcast #221, Sep 2024
- **Tool/system:** GTD-style notebook/to-do system
- **Design implication:** Make tidying a rare, low-stakes, ideally automated event (machine does the defrag), not a daily user habit. Never surface the full backlog by default — it triggers anxiety-shutdown, not action.
- **Research questions:** 1, 5

### F3. Self-generated urgency mechanisms fail for Ferdinandi because his brain detects they are fake: Pomodoro timers ('not a real timer', 20 min too short to enter meaningful work, the bell just annoys) and self-imposed deadlines are both dismissed by the brain as made-up.

> when that deadline shows up on my calendar my brain goes hey you made that up you don't need this thing for another week

- **Source:** https://www.youtube.com/watch?v=tPNMJxrw4yY
- **Who:** Chris Ferdinandi, frontend developer with ADHD, Real Python Podcast #221, Sep 2024 (Luce Carter and Dr Faye Bate independently report the same Pomodoro failure)
- **Tool/system:** Pomodoro, self-imposed deadlines
- **Design implication:** Don't build fake-deadline or rigid-timer features as motivation primitives. Urgency must be real (external commitment) or replaced by interest-routing; artificial scarcity gets rejected by the same brain that built it.
- **Research questions:** 1

### F4. On what gamification survives ADHD use: completions, immediate feedback loops, and finishable progress bars are durably motivating; points, stickers and leaderboards work for about a week, then the app gets abandoned. Universal joke: adding an already-done task to the list just to check it off.

> that's fun for a week and then it's not anymore and then I'm going to ditch your app and go do something else

- **Source:** https://www.youtube.com/watch?v=9ynX4znKFDA
- **Who:** Chris Ferdinandi, frontend developer with ADHD, interviewed on Backend Banter podcast (28k subs), Feb 2025
- **Tool/system:** ADHD-marketed to-do apps, learning platforms
- **Design implication:** Triage inbox should show a finishable count/progress bar ('3 of 7 triaged') and give instant visible completion feedback. Avoid streaks, points, and competition mechanics — they cause novelty-decay abandonment.
- **Research questions:** 1, 2

### F5. Jesse Anderson spent years building GTD systems (hipster PDA, Kinkless GTD, inbox zero), repeatedly losing whole weekends to building 'the perfect solution' that crashed within days-to-weeks. His diagnosis of why: GTD's core requirement is trust in the system, and his ADHD brain couldn't trust itself to maintain it.

> I would spend weekends building up what I thought was going to be the perfect solution... it would work for maybe a few days or a few weeks or so but eventually it would always come crashing down

- **Source:** https://www.youtube.com/watch?v=JsT3KPYJFl4
- **Who:** Jesse J. Anderson, software developer turned ADHD author/speaker (book 'Extra Focus', adult-diagnosed); conference talk uploaded Jan 2022, 1.87M views, channel 86k subs
- **Tool/system:** GTD, hipster PDA, Kinkless GTD/OmniFocus, inbox zero
- **Design implication:** Mirrors the user's Notion death exactly. The system must not depend on user-maintained invariants (weekly reviews, consistent filing). Trust must come from the machine (index rebuilds, auto-filing), not from user discipline.
- **Research questions:** 1

### F6. Anderson's 'embrace the pivot': assume in advance that any productivity system WILL eventually fail when novelty wears off, treat that as normal and shame-free ('it didn't fail, it worked for that amount of time'), and design life around cheap migrations to the next system.

> it's not about shame for that system failing it didn't fail it worked for that amount of time and now we're moving on to something new

- **Source:** https://www.youtube.com/watch?v=JsT3KPYJFl4
- **Who:** Jesse J. Anderson, software developer turned ADHD author, talk Jan 2022, 1.87M views
- **Tool/system:** system-agnostic strategy
- **Design implication:** Strong argument for the markdown-source-of-truth + regenerable SQLite design: data outlives any workflow fad, so pivots cost nothing. Bake 'pivoting is success, not failure' into the system's tone and docs.
- **Research questions:** 1, 2, 5

### F7. Anderson: the standard advice 'break the project into all its steps' backfires for ADHD — enumerating every step turns it into a visibly infinite project and triggers shutdown. Working alternative: break out only the first few steps, then start with whichever matches an interest hook (his '4 Cs': captivate, create, compete, complete — Dodson's interest-based nervous system), eating the ice cream first to build momentum before the frog.

> we break that overwhelming project into all of its steps oh wow that is a lot of steps... it sort of feels like this is an infinite project now with the never-ending steps

- **Source:** https://www.youtube.com/watch?v=JsT3KPYJFl4
- **Who:** Jesse J. Anderson, software developer turned ADHD author, talk Jan 2022, 1.87M views
- **Tool/system:** task decomposition / 'eat the frog'
- **Design implication:** Task views (pkms tasks) should surface one-next-action or first-few-steps, never full recursive task trees. Offer 'pick by interest' ordering, not priority-only ordering.
- **Research questions:** 1, 5

### F8. The 'Coding With ADHD' channel's thesis: a second brain is insufficient for ADHD — the system must build and maintain itself. He runs Gemini CLI/Claude Code inside Obsidian (Terminal plugin), has the AI generate and maintain the folder structure, versions the vault with git, and centralizes agent 'skills' in dotfiles via symlinks, explicitly treating the PKM as a software project.

> Building a Second Brain isn't enough when you have ADHD; you need a system that builds itself.

- **Source:** https://www.youtube.com/watch?v=JGwFsyyewYc
- **Who:** Anonymous software engineer behind 'Coding With ADHD' channel (3.4k subs; ADHD implied by channel identity rather than stated on camera); video Jan 2026, 134k views — massively outperforming channel size, suggesting the framing resonates
- **Tool/system:** Obsidian + Gemini CLI/Claude Code + git + agent skills
- **Design implication:** Direct validation of the PKMS architecture and of the user's 'Notion died without an LLM to digest my thoughts' lesson: organization upkeep is delegated to an agent; the human only dumps. Closest existing analog to the planned build.
- **Research questions:** 2, 6

### F9. Same creator's capture pipeline is a working blueprint for the user's win scenario: Obsidian Web Clipper saves pages to an /inbox folder; a file-watcher (fswatch + launchd, PowerShell version for Windows) triggers Claude Code to summarize each clip and insert a markdown link + short description into today's daily note — capture and triage are fully automated.

> Clip a website and it shows up in your daily journal completely hands-free.

- **Source:** https://www.youtube.com/watch?v=cFd5BI5cgl0
- **Who:** 'Coding With ADHD' channel, software engineer, video Jan 2026, 15k views
- **Tool/system:** Obsidian Clipper + inbox folder + fswatch/launchd watcher + Claude Code summarizer
- **Design implication:** Implementable pattern for the Reddit/HN-post win scenario: watcher on vault inbox, LLM summarizes each capture and back-links it into the daily note, so saved content surfaces by date instead of getting buried. He even ships a PowerShell variant.
- **Research questions:** 3, 6

### F10. Luce Carter rejected Obsidian specifically because local markdown broke ubiquitous capture — her brain 'never switches off' and she must be able to capture/update from a bus or bed, so she chose Notion despite its complexity. Capture-anywhere outranked data ownership and elegance.

> my brain never switches off... I can't have things in just one place because I need to be able to get to them from anywhere

- **Source:** https://www.youtube.com/watch?v=ac-3eA4CZHc
- **Who:** Luce Carter, Developer Advocate at MongoDB, Microsoft MVP, diagnosed combined-type ADHD (also dyspraxic); DevReach 2022 conference talk, Sep 2022
- **Tool/system:** Notion (chosen) vs Obsidian (rejected)
- **Design implication:** A desktop-only vault will leak captures. The PKMS needs a phone-reachable capture ramp (the user's Discord/Keep behavior is this) that automatically lands in the vault inbox — otherwise the vault becomes the second-class store.
- **Research questions:** 1, 3

### F11. Carter did not build her Notion system: she paid $50 for Thomas Frank's pre-built 'Ultimate Second Brain' PARA template, and automated ingestion with Readwise (Kindle/Instapaper highlights auto-sync into Notion). Outsourced structure plus automated inflow is what kept the system alive alongside a 'brain for having ideas, not storing them' trusted-store philosophy.

> if you're not happy with how you're storing your information... your brain won't let it go

- **Source:** https://www.youtube.com/watch?v=ac-3eA4CZHc
- **Who:** Luce Carter, MongoDB Developer Advocate with combined-type ADHD, DevReach 2022 talk
- **Tool/system:** Notion + purchased PARA template + Readwise + Instapaper
- **Design implication:** Two anti-perfectionism levers: (a) ship the user a finished opinionated structure so there is nothing to architect, and (b) make content flow IN automatically (read-later → highlights → vault) so the system grows without manual upkeep.
- **Research questions:** 2, 6

### F12. Carter keeps an explicit 'on hold / waiting' status for stalled projects precisely so they stop generating guilt while remaining recoverable — borrowed from GTD's 'waiting for' but used as shame management.

> why have it there making me feel guilty and shamed that I'm not working on it when it's not being done right now

- **Source:** https://www.youtube.com/watch?v=ac-3eA4CZHc
- **Who:** Luce Carter, MongoDB Developer Advocate with combined-type ADHD, DevReach 2022 talk
- **Tool/system:** Notion project statuses
- **Design implication:** First-class 'paused/icebox' status in frontmatter and task views (matching the user's existing icebox preference), with paused items excluded from default views so they don't radiate shame.
- **Research questions:** 5

### F13. John Mavrick's abandonment-adjacent story: Obsidian theme/customization became a compulsion — an essay session turned into hours of theme, font, banner and emoji tweaking with 'little progress' on the essay. His countermeasure is preset, purpose-locked workspaces that hide the settings sidebar and any view not needed for the task.

> eventually the time I wanted to spend working on the essay ended yet I made little progress I did end up with a nice looking vault though

- **Source:** https://www.youtube.com/watch?v=P1FkPzksxpU
- **Who:** John Mavrick, programmer/content creator, diagnosed combined-type ADHD in Feb 2024; video Sep 2024, 7.4k views, channel 21k subs
- **Tool/system:** Obsidian themes / preset workspaces
- **Design implication:** Constrain the customization surface: opinionated defaults, few knobs, and task-scoped views that hide config affordances. Every visible setting is a perfectionism trap for this user profile.
- **Research questions:** 1

### F14. Mavrick uses the daily note as 'extended working memory': a global hotkey appends a log entry from anywhere, mid-task thoughts are offloaded instantly and revisited later the same day; project notes record 'where I left off' so resuming doesn't require a full mental reload (his RAM/cold-boot analogy).

> a few seconds could be all it takes before you forget an idea

- **Source:** https://www.youtube.com/watch?v=P1FkPzksxpU
- **Who:** John Mavrick, programmer/content creator with combined-type ADHD, Sep 2024
- **Tool/system:** Obsidian daily notes + global capture hotkey + project 'left off' notes
- **Design implication:** Make the daily note the default capture sink (pkms daily already planned). Add a 'left off here' convention/command for projects to cut resume-cost — directly targets task initiation, the user's worst struggle.
- **Research questions:** 3, 5

### F15. Mavrick's retrieval model: never rely on remembering WHERE a note lives; navigate associatively through links, backlinks and maps-of-content until the note is found, mimicking how the ADHD brain already chains associations.

> we don't need to remember exactly where a note is stored instead we can just navigate through the related concepts... following the links until we find what we need

- **Source:** https://www.youtube.com/watch?v=P1FkPzksxpU
- **Who:** John Mavrick, programmer/content creator with combined-type ADHD, Sep 2024
- **Tool/system:** Obsidian backlinks, local graph, maps of content
- **Design implication:** Retrieval should be association-first: backlink panes, 'related notes' surfacing, and full-text search must work even when filing was sloppy — folder location can never be load-bearing.
- **Research questions:** 4

### F16. Sarah Best (PhD student) migrated Notion → Obsidian and stayed: the growing link graph itself is the reward loop ('dopamine hit... an incentive for taking more notes'), and she explicitly ties wikilink/graph navigation to ADHD pattern-matching strength. She also names the over-capture failure — taking notes on everything out of fear of forgetting — and counters it with purpose-scoped notes plus cheap pointer notes ('see page 60 for X') instead of full extraction.

> there's a bit of a dopamine hit for me there honestly as I continue to make them grow which is an incentive for taking more notes

- **Source:** https://www.youtube.com/watch?v=46YRoSwGaho
- **Who:** Sarah E. Best, 3rd-year PhD student (religious studies) with ADHD; video Mar 2023, 25k views, channel 3.6k subs
- **Tool/system:** Obsidian (graph view, tags, one-note-per-reading); previously Notion
- **Design implication:** Visible vault growth (graph, counts, backlink density) is a sustainable intrinsic reward. For the triage inbox: allow 'pointer' captures (link + one line on why it mattered) as a legitimate terminal state — full digestion need not be the only success.
- **Research questions:** 2, 4, 6

### F17. Lindie Botes details why calendar blocking fails ADHD: blocks are too vague (decision fatigue at execution time), trivially reschedulable (drag-to-tomorrow becomes a procrastination habit), and one slipped block collapses the whole plan via perfectionism. Her replacements: paper running list with priority/duration symbols, batching 5-minute tasks, and timing herself AFTER starting instead of estimating before.

> I can create the most perfect-looking schedule, but if something goes wrong... my whole schedule goes with it, and I'm like, eh, might as well just not do anything

- **Source:** https://www.youtube.com/watch?v=a-omjbMH7Yw
- **Who:** Lindie Botes, UX/UI designer in tech (Singapore) and polyglot YouTuber, diagnosed ADHD ~2023; video Aug 2025, 198k views, 360k subs; contains a paid dictation-app sponsorship (weigh that segment accordingly)
- **Tool/system:** Google Calendar blocking (failed); paper jotter list, visual timers
- **Design implication:** Tag tasks with rough duration so 'I have 10 minutes and low energy' queries work; support batch-the-tiny-ones views; never make the plan brittle — a missed item should degrade to 'still on the list', not 'plan ruined'.
- **Research questions:** 1

### F18. Botes' single favorite tactic is a paper 'parking lot' next to the keyboard: intrusive thoughts get written down and put away without task-switching, because the capture medium has no notifications — knowing the thought is 'safe there' lets her stay on task.

> If something pops in your mind, write it down and instead of switching tasks, put it away. You know that it's safe there in the book and then continue working.

- **Source:** https://www.youtube.com/watch?v=a-omjbMH7Yw
- **Who:** Lindie Botes, UX designer with ADHD, Aug 2025
- **Tool/system:** paper distraction list / idea parking lot
- **Design implication:** Capture must not open a feed. A CLI `pkms capture "..."` or hotkey that swallows the thought without rendering the vault (no browsing temptation) replicates paper's notification-free property digitally.
- **Research questions:** 3

### F19. Dr Faye Bate's surviving mechanisms are automation-over-willpower: Do-Not-Disturb modes that trigger automatically by time and by arriving at work ('my phone does it for me'), and passive time tracking (Toggl auto-sync) chosen specifically because manual tracking and alarms interrupt hyperfocus. She also insists every routine must be designed expecting occasional failure to pre-empt the guilt spiral.

> I don't even have to motivate myself or remind myself to remove distractions my phone does it for me

- **Source:** https://www.youtube.com/watch?v=pRRRyv-xaiA
- **Who:** Dr Faye Bate, UK medical doctor with diagnosed ADHD (graduated med school while running a business), 629k subs, Nov 2024; video includes an Xtiles sponsorship segment — tool recommendation there is paid, the strategies are her own
- **Tool/system:** automatic DND profiles, Toggl Track, Forest
- **Design implication:** Matches the user's Google Inbox nostalgia: anything that can fire on schedule/location/event should, so zero willpower is spent invoking the system. Background jobs (auto-index, auto-resurface) beat user-initiated rituals.
- **Research questions:** 2

### F20. Evan Burger's elimination test of 4 apps by abandonment reason: Obsidian dies on maintenance ('20 minutes figuring out why my daily note template broke... system maintenance disguised as work'), Notion dies on mobile capture (10–30s load — 'by the time it was there, my idea was already half gone'), Apple Notes dies on the energy test (stores but doesn't structure), and an LLM chat survives because it clarifies raw dumps into next actions even at zero motivation.

> That's not productivity to me. That's system maintenance disguised as work.

- **Source:** https://www.youtube.com/watch?v=gEULEI4nvag
- **Who:** Evan Burger, small productivity channel (3.2k subs), Jan 2026, 4.5k views; ADHD not stated and profession unclear — secondary corroboration only, but his 4 'kills' (complexity/mobile/capture/energy) map cleanly onto ADHD failure modes reported by the diagnosed creators above
- **Tool/system:** Obsidian, Notion, Apple Notes, ChatGPT
- **Design implication:** Evaluate every PKMS feature against 'does it work at 6am with zero motivation?' An LLM layer that structures raw dumps (capture → machine clarifies) is the differentiator that kept the surviving tool alive — same conclusion the user reached about Notion needing an LLM.
- **Research questions:** 1, 3, 6

### F21. Brown University CS student with ADHD+dyslexia: large assignments only start when decomposed until each piece feels like a 30-minute chunk; she also keeps a written running list of her personal recurring error patterns (externalized self-knowledge) and tells a hyperfocus-cost story (coded Tetris 10pm–4am, vision problems for a week).

> you break down the assignment into smaller parts until it feels like you're doing one 30-minute chunk at a time

- **Source:** https://www.youtube.com/watch?v=9wf7scUSxAU
- **Who:** 'BeepBopViola' (Shinrou), music + computer science undergraduate at Brown University, diagnosed ADHD and dyslexia; video Jan 2021, 14k views, 1k subs — the high-achieving-student profile requested
- **Tool/system:** manual chunking, written personal-error checklist
- **Design implication:** 30 minutes is a credible felt-size ceiling for a startable unit. A standing 'my known failure patterns' note is a cheap, high-leverage vault page worth seeding for the user (mirrors his ground-truths doc).
- **Research questions:** 3, 5

---

## Coverage notes (what was NOT covered)

Method: WebSearch (6 query families) + direct YouTube search via yt-dlp (ytsearch), then yt-dlp auto-subtitle extraction (12 full transcripts, deduped VTT→txt in O:\Temp\sweepA) — every finding above is grounded in the actual transcript, not video summaries. Weighting honored: 8 of 11 creators are engineers/tech workers or demanding-degree students with stated ADHD diagnoses; the two big-sub productivity brands found (Andrew Kirby 630k, Tiago Forte's ADHD video, ADHDVision, Thomas Frank content) were deliberately NOT mined per the deprioritization instruction (Thomas Frank appears only as the template Luce Carter bought). NOT covered: (1) no true MIT-specific 'how I survived MIT with ADHD' system video surfaced despite targeted searches — Brown CS undergrad and a PhD student are the closest student profiles; (2) comment sections and pinned comments were not mined (yt-dlp comment extraction skipped for time) — top comments on the Jesse Anderson and Coding With ADHD videos would likely yield additional first-person abandonment stories; (3) CodeHead's 'The ADHD Developer Experience' (25k views, Oct 2025) skipped as a 3-minute comedy short; John Sonmez 'ADHD & Programming' (2020) skipped as guru-adjacent; (4) no org-mode/emacs ADHD engineer video found — searches returned only generic productivity content, so the plain-text/terminal ADHD niche on YouTube may simply be thin (it lives more on HN/Reddit); (5) Luce Carter's 2022 talk could not confirm whether her Notion system survived to present day (>1yr claims rest on her talk-time statements). Question 4 (retrieval) has the thinnest YouTube coverage overall — only Mavrick and Sarah Best address it concretely; resurfacing/serendipity mechanisms (spaced repetition, random-note) did not appear in any transcript mined.

## Verification sample

- [verified] https://www.youtube.com/watch?v=tPNMJxrw4yY — Claim 1 (no-RAM capture). Video exists: 'Thriving as a Developer With ADHD | Real Python Podcast #221', Real Python channel (207k subs), uploaded 2024-09-20; guest confirmed as Chris Ferdinandi (runs gomakethings.com and ADHD FTW / adhdftw.com, both named in episode). Auto-caption transcript matches near-verbatim: 'an ADHD brain has almost no RAM... you need to write it down right away... or you will lose it forever because it never gets written into longterm storage... the writing things down piece that needs to happen in the moment that's not like a scheduled task.' The interrupt-not-scheduled framing is explicit in the source, not an embellishment.
- [verified] https://www.youtube.com/watch?v=tPNMJxrw4yY — Claim 2 (occasional defrag). Transcript supports every component: he describes 'defragging' the notebook 'every now and then', says 'I don't do it all that often I actually think doing it too often can create...' then verbatim 'you get into this habit with systems like that where you obsess over the system to the detriment of the work' (explicitly referencing GTD/David Allen), cleanup 'becomes the thing you do instead of the stuff that's actually on the to-do list', and reviewing the notebook 'spikes your anxiety level... then starts to occupy your limited working memory.'
- [verified] https://www.youtube.com/watch?v=tPNMJxrw4yY — Claim 3 (fake urgency rejected). Deadline quote verbatim in transcript: 'when that deadline shows up on my calendar my brain goes hey you made that up you don't need this thing for another week.' Pomodoro reasons also match: 'one because I know it's not a real time[r]... the other problem is 20 minutes is not enough time for me to really get into any sort of meaningful work and so when the timer goes off I'm just annoyed.' (The Luce Carter / Faye Bate corroboration in author_context is not from this source and was not checked here.)
- [verified] https://www.youtube.com/watch?v=9ynX4znKFDA — Claim 4 (gamification survivors). Video exists: 'Does ADHD really make programming harder? ft. Chris Ferdinandi | S2 E04', Backend Banter (28.2k subs), uploaded 2025-02-03. Quote verbatim: 'that's that's fun for a week and then it's not anymore and then I'm going to ditch your app and go do something else.' Also present: 'most satisfying is completions and immediate feedback', progress bars 'you've completed 10 of n tasks... really motivating... I want to close that', and the universal joke 'if I do something that wasn't on my to-do list I'll add it to the to-do list just to be able to check it off... it's like a universal [truth amongst my people].' One minor nuance: the week-then-abandon decay is said about sticker/social-comparison gimmicks; leaderboards he says never appeal to him at all (non-competitive), not 'for about a week'.
- [verified] https://www.youtube.com/watch?v=JsT3KPYJFl4 — Claim 5 (GTD trust failure). Video exists: 'Avoiding Toxic Productivity Advice for ADHD', ADHD Jesse channel, uploaded 2022-01-18, 1,874,388 views, 86.4k subs — all matching the stated context. Quote verbatim in transcript: 'i would spend weekends building up what i thought was going to be the perfect solution... it would work for maybe a few days or a few weeks or so but eventually it would always come crashing down.' Hipster PDA, Kinkless GTD ('kickless' in auto-captions, described as 'predecessor to omnifocus'), and inbox zero all named; trust diagnosis explicit: 'the crucial requirement that you need for those systems to work is trust and i did not have trust... i couldn't trust my own brain.'
- [verified] https://www.youtube.com/watch?v=JsT3KPYJFl4 — Claim 6 (embrace the pivot). Transcript verbatim: 'my first strategy i like to call embracing the pivot and this is all about knowing ahead of time that our productivity system is going to fail... it's not about shame for that system failing it didn't fail it worked for that amount of time and now we're moving on to something new.' Novelty framing also present ('our brain wants those new things every once in a while', 'we'll get bored of a routine that works'). 'Design life around cheap migrations' is a light paraphrase of 'we don't pour everything into it as if it's gonna be the end-all be-all solution... then we just pivot to a new system' — faithful to the source.

