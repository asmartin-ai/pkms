---
tags: [pkms-design, research, adhd, sweep-a, github]
created: 2026-06-09
modified: 2026-06-10
status: raw-findings
---

# 14 — GitHub: ADHD Tool Design Patterns (Sweep A)

Raw findings from the Sweep A community-anecdotes workflow. 17 findings; 6 sample-verified by an adversarial fact-checker, 0 failed.
Program: [[00-ground-truths]] - Synthesis target: [[10-synthesis]]

## Top takeaways

1. **ADHD-specific PKM essentially didn't exist before LLMs** — pre-2023 ADHD repos are all timers/pickers/reminders; the 2026 "markdown vault + agent" wave is the first architecture that structurally fits (F17). The user's Notion lesson is the norm, and his planned build rides the first viable wave (F4).
2. **The shame-freeze loop is an explicit design target** in the best repos: no guilt language, briefings that end "with an invitation, not an assignment," and when work stalls the system *shrinks the task* (F2, F3 — ai-chief-of-staff, 100+ real sessions).
3. **Queue, not list:** show one next action, keep the backlog invisible; "in a deep low, the system has to get dumber, not smarter" (F6). "Starting is success, completion is optional" — store a concrete first action *at capture time* (F7).
4. **Concrete capture budget: under two seconds** thought-to-saved, with a transient triage inbox feeding a persistent vault as separate stages (F8) — the cleanest RQ6 answer found.
5. **Staleness is detected by the machine and resurfaced as a curious question** ("Still interested in GPU benchmarks?"), never a count badge (F9, F10).
6. **Re-entry hooks beat reorganization:** per-project `_why.md` re-read every session, logs ending "conclusion + next step" — "treat yourself as a team across time" (F11, F3).
7. **Hyperfocus containment lives inside existing tools** (git pre-commit bedtime hook, clock injected into agent prompts) with an escape hatch, not in a new app demanding a new habit (F5, F13).
8. **ADHD retrieval is state-restore, timeline, and breadcrumbs-with-dead-ends** — not keyword recall (F16).

---

## Findings

### F1. Leantime, a 10k-star open-source project management tool sustained for 11 years, is explicitly 'Built with ADHD, dyslexia and autism in mind.' Founder Gloria Folaron (ex-ER nurse, diagnosed ADHD as an adult) built it because mainstream PM tools are visually overwhelming — too much choice, not enough structure — and tasks lose their purpose; her design centers goals-first views so 'tasks have purpose again.'

> Built with ADHD, dyslexia and autism in mind.

- **Source:** https://github.com/Leantime/leantime
- **Who:** Gloria Folaron, founder, publicly diagnosed ADHD as adult (per SiliconANGLE 2024 / benefitnews coverage); repo 10,005 stars, created Jan 2015, actively pushed June 2026 — strongest human-built sustained signal found
- **Tool/system:** Leantime/leantime
- **Design implication:** Attach the WHY to every task (goal/purpose link) and aggressively reduce visible choice. A PKMS view should surface fewer items with their motivating context, not exhaustive lists.
- **Research questions:** 1, 2

### F2. The ai-chief-of-staff repo (Claude Code + Obsidian 'ADHD prosthetic') was built by a self-described non-coder with ADHD and battle-tested over 100+ real sessions; its ARCHITECTURE.md states every operating rule was derived from lived failure, not theory, and names the core mechanism it must break: the shame-freeze loop.

> Financial pressure triggers shame. Shame triggers freeze. Freeze prevents action. Inaction deepens the shame. A system that leads with guilt feeds the loop that broke you in the first place.

- **Source:** https://github.com/jdpolasky/ai-chief-of-staff
- **Who:** jdpolasky, states 'non-coder with ADHD' building for 'non-coders with ADHD'; 70 stars, created 2026, used against real paying client work for 100+ sessions
- **Tool/system:** jdpolasky/ai-chief-of-staff
- **Design implication:** Shame-aware framing as an explicit design rule: no 'should have' language, no streaks, and when work stalls the system SHRINKS the task instead of nagging. Encode this in any LLM layer's system prompt.
- **Research questions:** 1, 5

### F3. Same repo's session loop (/start, /sync, /wrap) exists because re-priming a fresh AI session at the start of each day 'drains executive function you can't afford' — the vault holds state on disk between sessions and /start hands back a Must/Should/Could briefing plus stale-item flags, ending 'with an invitation, not an assignment.'

> You used to lose minutes at the top of every session re-priming a fresh model. Those minutes drain executive function you can't afford.

- **Source:** https://github.com/jdpolasky/ai-chief-of-staff/blob/main/ARCHITECTURE.md
- **Who:** jdpolasky (non-coder, ADHD, 100+ sessions of real use); 70 stars, 2026
- **Tool/system:** jdpolasky/ai-chief-of-staff
- **Design implication:** Make session-resume a first-class command: the PKMS should open by reading yesterday's state and offering 3 prioritized options. Re-orientation cost is the hidden activation-energy tax.
- **Research questions:** 3, 4, 2

### F4. The repo's notion-vs-obsidian editorial argues Notion fails the AI-memory architecture test — quoting the most common Reddit complaint that Notion AI 'doesn't know your workspace, it just searches it' — while plain-text markdown read directly by a frontier LLM 'compounds over time'; this independently mirrors the user's own Notion death.

> The biggest problem is that it doesn't know your workspace, it just searches it.

- **Source:** https://github.com/jdpolasky/ai-chief-of-staff/blob/main/notion-vs-obsidian
- **Who:** jdpolasky (ADHD, non-coder); he also describes his own pre-LLM failure: flailing with n8n-to-Obsidian pipelines, 'webhooks failed, file paths broke,' before Claude Code made it workable
- **Tool/system:** jdpolasky/ai-chief-of-staff
- **Design implication:** Validates the user's chosen architecture: local plain-text vault + LLM with direct file access beats database-app + bolted-on AI for cross-note synthesis. The user's hybrid markdown+SQLite design is on the surviving side of this divide.
- **Research questions:** 1, 4

### F5. claude-adhd-skills (engineer, diagnosed ADHD 'mainly distraction component') treats Obsidian as shared memory between agent sessions and treats TIME AWARENESS as the central ADHD accommodation: hooks inject the current time into every prompt so the agent can enforce 'stop me at 11' promises, and his CLAUDE.md instructs Claude to suggest breaks after an hour stuck.

> Ideas get dumped into notes, marinate, and only the ones that survive get built.

- **Source:** https://github.com/ravila4/claude-adhd-skills
- **Who:** ravila4, software engineer; CLAUDE.md template states 'I have ADHD (mainly distraction component) and can lose track of time when hyperfocused'; 80 stars, created 2026, used daily by author
- **Tool/system:** ravila4/claude-adhd-skills
- **Design implication:** Two reusable patterns: (1) externalize clock-awareness into the tooling itself (hyperfocus containment matching this user's top-3 struggle); (2) treat the vault as an idea incubator where most captures are ALLOWED to die — survival-of-the-interesting replaces mandatory processing.
- **Research questions:** 2, 4, 6

### F6. niyet, built by a developer with self-described severe ADHD on 'a worst day,' identifies the to-do list itself as the failure mode: a homogeneous wall of equal-weight items triggers avoidance, so the app shows only ONE next physical action with the queue hidden, plus pre-saved 'ritual chains' that collapse seven decisions into one tap, and a tulip garden reward that never wilts.

> You never see the whole list. You only see the next thing your body does.

- **Source:** https://github.com/burakgizlice/niyet
- **Who:** burakgizlice; repo description: 'Built for my severe ADHD executive dysfunction'; README recounts paralysis breaking even prayer into terminal-typed micro-steps; 2 stars, created 2026 — low stars but exceptional first-person design rationale
- **Tool/system:** burakgizlice/niyet
- **Design implication:** Queue, not list: render one next action; keep backlog invisible by default. Also 'in a deep low, the system has to get dumber, not smarter' — design the worst-day path first. And beware: 'The tool itself is a procrastination trap... friction has to be near zero' (his exact echo of the user's Notion perfectionism death).
- **Research questions:** 1, 3, 5

### F7. Nudge (desktop ADHD companion on a plain-markdown vault) inverts completion-centric design with the mantra 'Starting is success, completion is optional'; every captured idea file mandates a 'What does starting look like?' section with tiny first steps, and the UI bans badges, streaks, and red notification dots.

> No badges. No streaks. No red notification dots. No guilt. Just a quiet room that helps you start.

- **Source:** https://github.com/thatsjet/nudge-app
- **Who:** thatsjet; ADHD status not explicitly stated but app described as built 'for ADHD brains'; 13 stars, created 2026
- **Tool/system:** thatsjet/nudge-app
- **Design implication:** Directly targets this user's worst struggle (task initiation): store a concrete ~10-minute first action WITH each captured item at capture time, and measure starts rather than completions. Reframes the '90% done' problem by making completion explicitly optional.
- **Research questions:** 3, 5

### F8. Ilseon (Android executive-function assistant) sets a hard quantitative capture budget — under two seconds from thought to saved — and structurally separates its Idea Inbox into a Transient Inbox (triage: convert to task or save) and a Persistent Notes view (long-term knowledge), the cleanest inbox-vs-vault answer found on GitHub.

> The path from “I thought of something” to “It’s safely saved” should take less than two seconds.

- **Source:** https://github.com/cladam/ilseon
- **Who:** cladam; 'Built with love for the neurodivergent community,' own dx not stated; 11 stars, created 2025, pushed 2026, shipped on Google Play
- **Tool/system:** cladam/ilseon
- **Design implication:** Gives a concrete max-activation-energy number (<2s) and a two-stage architecture: transient triage inbox feeding a persistent vault, with conversion (to task / to note / discard) as the only inbox operations. Maps directly onto research question 6.
- **Research questions:** 3, 6

### F9. Autopilot (Claude Code hooks for ADHD devs) names the half-finished-work ratio ('three started-but-never-finished tasks for every one you ship') and counters it mechanically: stale tasks (>14 days, no sessions) get surfaced and bumped to your phone, natural-language capture triggers ('todo', 'later') in prompts auto-create tasks, and an explicit no-guilt 'good enough?' check fires after 3+ sessions on the same task.

> a backlog of “todo” items you said but never wrote down, an inbox of half-thought notes, and three started-but-never-finished tasks for every one you ship.

- **Source:** https://github.com/maximgalson/autopilot-cc
- **Who:** maximgalson; ADHD-targeted ('If you have ADHD: you also have a backlog...'), own dx implied not stated; 6 stars, created 2026
- **Tool/system:** maximgalson/autopilot-cc
- **Design implication:** Three patterns for the 90%-done problem: passive capture from text you were already typing; automatic staleness detection with gentle resurfacing; and a scheduled 'is this good enough to ship?' interrupt to break perfectionism loops.
- **Research questions:** 3, 5

### F10. Companion Cube reframes distractions as deferred assets rather than sins: one click saves a rabbit hole into a Vault 'where distractions go to become future inspiration,' with gentle reminders for stale saved items ('Still interested in GPU benchmarks?'), while activity history is auto-organized with zero manual tracking.

> Instead of blocking distractions, it gently saves them for later—because that rabbit hole about mechanical keyboards might actually be worth exploring, just not right now.

- **Source:** https://github.com/HandsomeHarry/companion-cube-ui
- **Who:** HandsomeHarry; ADHD-assistant project, own dx not stated; 74 stars, created 2025, pushed 2026, local-only (Ollama)
- **Tool/system:** HandsomeHarry/companion-cube-ui
- **Design implication:** Closest match to the user's win scenario (save a Reddit/HN rabbit hole, reliably return later): the inbox must actively re-ask about its own stale contents in a curious, non-judgmental voice — resurfacing as a question, not a notification count.
- **Research questions:** 4, 6

### F11. A zh-TW Obsidian ADHD work system (adapted from blogger chiukaun's ADHD essay) makes interruption-recovery the organizing principle: 'built to work without willpower, and resume without pain.' Each project keeps a _why.md re-read before EVERY session, an _info.md for SOPs, and one log file per sprint, under the philosophy 'treat yourself as a team across time.'

> A low-friction Obsidian work system designed for ADHD — built to work without willpower, and resume without pain.

- **Source:** https://github.com/hankforgamedev/adhd-obsidian-system
- **Who:** hankforgamedev, adapting blog.chiukaun.com/p/adhd (first-person ADHD essay); 1 star, created 2026 — value is the design pattern, not adoption
- **Tool/system:** hankforgamedev/adhd-obsidian-system
- **Design implication:** Treat past-you and future-you as teammates who must hand off: every project note carries its WHY (motivation decays before relevance does) and a per-session log whose last lines are 'conclusion + next step' — the resume hook that beats note rot without reorganizing anything.
- **Research questions:** 2, 5

### F12. CringeClock, a human-built pomodoro app maintained 2023-2026, encodes time-blindness accommodation as deliberate un-ignorability: always-on-top window, color flashing at a BPM that slows as the session progresses, ticking sounds, voice countdowns — the opposite of calm-tech minimalism.

> A pomodoro timer that refuses to be ignored.

- **Source:** https://github.com/timsayshey/cringe-clock
- **Who:** timsayshey; 'Built for people who get distracted easily,' own dx not stated; 66 stars, created 2023, still pushed 2026 — survived >2 years
- **Tool/system:** timsayshey/cringe-clock
- **Design implication:** For time-blindness, ambient/polite cues fail; chosen-intrusive cues that live inside the visual field work. A PKMS reminder layer may need an obnoxious mode the user opts into, not just notifications.
- **Research questions:** 2

### F13. git-leash puts hyperfocus containment INSIDE the existing workflow rather than in a separate app: a pre-commit hook blocks commits during configured time windows (e.g. past bedtime), overridable 'when you genuinely need to ship,' and stealth-installed so it never becomes another system to maintain.

- **Source:** https://github.com/SiteRelEnby/git-leash
- **Who:** SiteRelEnby; repo description: 'Helps you stop hyperfocusing and go to bed'; own ADHD dx not stated (enby/plural-made badges); 34 stars, created 2026
- **Tool/system:** SiteRelEnby/git-leash
- **Design implication:** Guardrails succeed when embedded in a tool the user already touches (git) with zero upkeep, instead of requiring a new habit. For hyperfocus-eats-the-day, intercept at the action point, and always leave an escape hatch to avoid resentment-driven uninstall.
- **Research questions:** 2

### F14. ReceiptPrinterAgent (from the video 'I Fixed my ADHD with a Receipt Printer') automates the Google-Inbox-style extraction this user misses: it pulls tasks out of Gmail automatically, AI-parses and prioritizes them, deduplicates via vector embeddings, and prints each task as a physical thermal receipt — a single tangible artifact per task.

- **Source:** https://github.com/CodingWithLewis/ReceiptPrinterAgent
- **Who:** Lewis Menelaws (CodingWithLewis, programming YouTuber), self-described ADHD in the source video title; 467 stars, created 2025
- **Tool/system:** CodingWithLewis/ReceiptPrinterAgent
- **Design implication:** Automated extraction (email/feed -> structured tasks) plus embedding-based dedup is buildable today and resonates with this user's Google Inbox nostalgia. The physical print also shows externalization can mean making ONE task materially present, not making lists longer.
- **Research questions:** 3

### F15. ctrl (2020, pre-LLM, human-built) digitizes ADHD artist Dani Donovan's dice method: tasks get dice-side ranges weighted by priority and a roll picks what you do first — using randomization to bypass prioritization paralysis, with the whole list framed as 'a temporary to-do list.'

> ctrl is a temporary to-do list... to assist people living with executive dysfunction, in completing necessary tasks in a sustainable & healthy manner.

- **Source:** https://github.com/stordahl/ctrl
- **Who:** stordahl, building for 'people living with executive dysfunction,' method credited to @danidonovan (ADHD creator); 6 stars, created 2020 — small but genuinely pre-AI-wave human-built
- **Tool/system:** stordahl/ctrl
- **Design implication:** When all options feel equal, choosing IS the blocker; a 'pick for me' randomizer (optionally weighted) is a legitimate triage mechanism for both tasks and a reading-queue inbox. Note also 'temporary' framing: lists that expire avoid becoming shame archives.
- **Research questions:** 3, 6

### F16. HyperFocache (MCP memory server 'built by and for developers with ADHD') designs retrieval around interruption and hyperfocus: save/restore work states when task-switching, 'problem-solving breadcrumbs' that record debugging journeys including dead ends, semantic search by meaning, time-based timeline navigation, and automatic consolidation of related memories to reduce clutter.

- **Source:** https://github.com/offendingcommit/hyperfocache
- **Who:** offendingcommit; README: 'ADHD-Optimized: Built by and for developers with ADHD'; 13 stars, created 2025
- **Tool/system:** offendingcommit/hyperfocache
- **Design implication:** ADHD retrieval is rarely keyword recall: support 'what was I doing before the interrupt' (state restore), 'when did I touch this' (timeline), and 'what did I already try' (breadcrumbs with dead ends) as first-class queries alongside FTS.
- **Research questions:** 4, 5

### F17. Ecosystem-level pattern: pre-2023 human-built ADHD software on GitHub is almost entirely timers, task pickers, and reminder bots (time-coach 2011, executive-function-bot 2018, ctrl 2020, adhd-focus 2020); ADHD-specific PKM essentially did not exist until the 2026 'markdown vault + LLM agent' wave (ai-chief-of-staff, claude-adhd-skills, ADAM, claudia, autopilot, Karpathy's viral 'LLM Wiki' gist). Even the 359-star curated awesome-adhd list has only 4 notetaking apps versus dozens of task/timer tools.

- **Source:** https://github.com/XargsUK/awesome-adhd
- **Who:** Synthesis across ~30 repos surveyed this session; awesome-adhd: 359 stars, maintained 2023-2025
- **Tool/system:** GitHub ADHD tooling landscape
- **Design implication:** The community's revealed belief: ADHD-friendly knowledge management was not viable until an LLM could carry the organizing burden — organization-on-write always died. The user's 'Notion died without an LLM to digest my thoughts' is the norm, not an idiosyncrasy; his LLM-indexed vault rides the first wave that structurally fits.
- **Research questions:** 1, 2, 6

---

## Coverage notes (what was NOT covered)

SEARCHED: GitHub repo search API unauthenticated, 8 queries (q=adhd by stars; adhd+task; topic:adhd; adhd+obsidian; adhd+pkm/knowledge; executive dysfunction; time blindness/body doubling — that last one returned pure noise). Fetched ~25 READMEs raw plus deep-dive design docs: ai-chief-of-staff ARCHITECTURE.md + notion-vs-obsidian editorial, ravila4 CLAUDE.md template, Leantime founder story via WebSearch (leantime.io /our-story 404'd; founder ADHD dx confirmed via SiliconANGLE/benefitnews coverage). Verified Leantime dates/stars via core API (created 2015-01, pushed 2026-06, 10,005 stars). NOT COVERED: (1) GitHub Issues/Discussions mining — the unauthenticated issues-search API now returns 422 'cannot be searched' for repo-scoped queries, so I could not harvest real-user ADHD voices from super-productivity (a likely goldmine of ADHD user issues — recommend an authenticated pass or web-scrape of its GitHub discussions). (2) Per-repo commit-history texture sampling — relied on created_at/pushed_at from search payloads instead of /commits, to conserve the ~60/hr core budget. (3) Sourcehut, GitLab, Codeberg — not searched at all. (4) Unread but plausibly relevant repos: Zenitr0/second-brain-adhd-n8n (115 stars), Illyism/sidejot (94), eci-global/80HD interruption shield, mordechaipotash/brain-mcp, mrseth01/awesome-adhd (2020 list), SteinEntropy Obsidian vault template (README was a one-line stub). (5) Referenced-but-secondhand tools from niyet's competitive analysis (Llama Life, Forget, Goblin Tools, One & Three) — closed-source, not independently verified. (6) blackcoat/time-coach (2011) confirmed as earliest ADHD repo found but README too thin to mine. DEAD ENDS: 'body doubling' and 'time blindness' repo searches return unrelated results (the phrases match ML papers); voidcoefficient/giro redirected to marlalain/hivemind whose README has no ADHD-specific rationale. Honesty note: most high-signal design rationale on GitHub is from the 2025-2026 AI-agent wave; genuinely pre-2023 human-built ADHD tools with rich first-person READMEs are scarce — Leantime is the only large sustained one found.

## Verification sample

- [verified] https://github.com/Leantime/leantime — Quote 'Built with ADHD, dyslexia and autism in mind.' is verbatim in README.md. GitHub API confirms 10,005 stars, created 2015-01-23 (11 years), pushed 2026-06-09, and repo description 'goals focused project management system for non-project managers'. Caveat: the Gloria Folaron bio and design rationale are NOT on the GitHub page — but they check out in the coverage the finding cites: benefitnews.com confirms adult ADHD diagnosis ('two years ago') and near-verbatim 'visually overwhelming, with the platform offering too much choice and not enough structure'; riot.org confirms ER nurse; Hypepotamus attributes 'gives tasks purpose again' (slight wording drift from 'tasks have purpose again') to Folaron.
- [verified] https://github.com/jdpolasky/ai-chief-of-staff — Repo exists; description: 'AI Chief of Staff / Personal Operating System built on Claude Code and Obsidian. Designed as an ADHD prosthetic.' 70 stars, created 2026-04-15 — both match. README: 'A non-coder with ADHD built this for non-coders with ADHD, and lived in it for over a hundred sessions against real client work and a public platform build. The rules in here were learned, not theorized.' Shame quote is verbatim in ARCHITECTURE.md (Shame-aware framing section): 'Financial pressure triggers shame. Shame triggers freeze. Freeze prevents action. Inaction deepens the shame. A system that leads with guilt feeds the loop that broke you in the first place.' ARCHITECTURE.md also says 'Every operating rule here responds to that, none are theoretical' — claim's 'derived from lived failure, not theory' is fair paraphrase.
- [verified] https://github.com/jdpolasky/ai-chief-of-staff/blob/main/ARCHITECTURE.md — Fetched raw ARCHITECTURE.md. Quote verbatim: 'You used to lose minutes at the top of every session re-priming a fresh model. Those minutes drain executive function you can't afford.' Also verbatim: /start 'Hands you a Must / Should / Could briefing and flags anything you are waiting on that has gone stale. Ends with an invitation, not an assignment.' and 'Between sessions the vault sits on disk and holds state.' The /start, /sync, /wrap skills exist as files in .claude/skills/. Fully supported.
- [verified] https://github.com/jdpolasky/ai-chief-of-staff/blob/main/notion-vs-obsidian — File exists at that exact extensionless path. Quote verbatim, with the framing the claim describes: 'The most common Reddit complaint, verbatim: "The biggest problem is that it doesn't know your workspace, it just searches it."' Compounding language present: 'It's yours, it's local, it compounds over time' and 'nothing compounds like a local-first, plain-text knowledge base connected to a frontier AI model.' The 'architecture breaks down' argument is the file's central section. Author_context n8n detail confirmed in ARCHITECTURE.md: 'Node names changed under me, webhooks failed, and file paths broke, I was just flailing around.' (The 'mirrors the user's own Notion death' clause is the researcher's interpretation, not a source claim.)
- [verified] https://github.com/ravila4/claude-adhd-skills — Repo exists, 80 stars, created 2026-03-01, README opens 'skills and hooks I use daily'. Quote verbatim in README: 'Ideas get dumped into notes, marinate, and only the ones that survive get built.' Obsidian 'becomes a shared memory between sessions' — verbatim. Date hook 'Injects current date and time into every prompt so Claude knows when it is'; nudge skill literally documents 'Stop me at 11'. CLAUDE.md template verbatim: 'I have ADHD (mainly distraction component) and can lose track of time when hyperfocused' and 'Suggest a break when we've been stuck on something for over an hour.' Minor: 'central ADHD accommodation' is light editorializing (README lists time awareness first among three key pieces), and 'engineer' comes from profile context rather than this page.
- [verified] https://github.com/burakgizlice/niyet — Repo exists; description verbatim 'Built for my severe ADHD executive dysfunction...'; 2 stars, created 2026-05-29 — match. README quote verbatim (bolded blockquote): 'You never see the whole list. You only see the next thing your body does.' All claim details confirmed verbatim: 'It was built from a worst day'; homogeneous wall — 'A single homogeneous to-do list — every item the same weight... triggered avoidance, not action'; chains — 'Seven decisions become one'; garden — 'grows a tulip every time you act — and never wilts'; prayer micro-steps 'typed one at a time into a terminal task manager'; 'In a deep low, the system has to get dumber, not smarter'; 'The tool itself is a procrastination trap... The friction has to be near zero.'

## Round 2 (Sweep C leftovers)

Appended 2026-06-10 from the Sweep C leftovers track: the super-productivity GitHub mining pass that Sweep A's unauthenticated API access blocked (issues fetched by label and via WebFetch after the 422/rate-limit failures). 3 findings; 1 sampled by the adversarial checker (verified with a minor caveat — see Round 2 verification below).

### L2-12. super-productivity has a named built-in 'Procrastination Buster' plugin (confirmed by a June 2026 commit fixing its i18n), and ADHD users file issues specifically about features that fail their needs: auto-dismissing tips that close before a distracted user can read them, and break notifications too subtle to interrupt hyperfocus.

> This affects people with ADHD, that are shortly distracted and therefore have no time to read the Productivity Tip.

- **Source:** [super-productivity GitHub issue #5881 — Settings: Behavior of Productivity Tip (2026-01-04)](https://github.com/johannesjo/super-productivity/issues/5881)
- **Credibility:** Primary source; GitHub issue with direct author statement about ADHD. The Procrastination Buster plugin existence confirmed via commit 8145 (2026-06-08). Issues fetched directly via GitHub REST API and WebFetch.
- **Design implication:** Two specific design rules emerge from ADHD users of mature todo tools: (1) any auto-dismissing UI element will be missed — use persistent banners or require explicit dismissal; (2) time-based notifications are insufficient for hyperfocus interruption — the break signal must be impossible to miss (fullscreen overlay, not a badge).

### L2-13. ADHD users of super-productivity explicitly request 'quick add without loading the full app' as a keyboard-shortcut global hotkey, and location-based reminders for working memory support — real users cite both as the friction points that cause them to abandon capture.

> This would be huge and helpful for my ADHD short term memory.

- **Source:** [super-productivity GitHub issue #5336 — Location-based Reminders (open enhancement)](https://github.com/johannesjo/super-productivity/issues/5336)
- **Credibility:** Primary source; GitHub issues with direct ADHD self-identification by requesters. Issue #5549 (quick add modal) is a separate corroborating signal — though that commenter did not mention ADHD, the request mirrors the win+n friction benchmark from Sweep A F4 (11-hn.md).
- **Design implication:** Validate that the PKMS capture path (global hotkey → text field, sub-2 second) is achievable without loading the main vault view. For mobile (Pixel 6 constraint), consider a persistent notification/widget that opens a single text field — not the full app.

### L2-14. super-productivity's Focus Mode (three timer variants: Pomodoro, Flowtime, Countdown) has no built-in distraction blocking, no ADHD-specific UI adaptations, and no single-task view that hides the broader task list — hyperfocus containment is entirely self-managed by the user.

- **Source:** [super-productivity Wiki: 4.15 Timers and Focus Mode](https://github.com/johannesjo/super-productivity/wiki/4.15-Timers-and-Focus-Mode)
- **Credibility:** Official product documentation; directly fetched. Negative finding but high credibility — this is what the tool actually ships. The gap between what ADHD users request (issues #5836, #5881) and what the tool provides confirms the unmet need. (Checker caveat: #5836 cleanly supports the gap claim; #5881 is about auto-closing tips and only tangentially supports the single-task-view point.)
- **Design implication:** A PKMS focus mode should show exactly one task with its first step, hide all other vault content, and require an active 'exit focus' gesture rather than allowing accidental navigation. The fullscreen-overlay break signal (requested in #5836) should be a default, not an opt-in, for users who self-identify as hyperfocus-prone.

### Round 2 coverage notes

GitHub REST API search returned 422 for repo-scoped queries and the unauthenticated rate limit was exhausted after ~15 requests; issues were fetched by label (enhancement) and filtered locally, with WebFetch recovering body text for individual pages. Full body text of issues #5549, #427, #5712, #5737 was unavailable after the rate limit; WebFetch summaries were used for those. The super-productivity Discussions tab returned no ADHD results (possible rendering failure). Open question: the Procrastination Buster plugin's actual UX is undocumented in public wiki pages — its mechanism is unknown beyond the plugin name.

### Round 2 verification

Sampled: L2-14 — verified. The wiki page exists and describes exactly three timer modes (Pomodoro, Flowtime, Countdown); the fetched content contains no mention of distraction blocking, ADHD-specific adaptations, single-task view, or task-list hiding, confirming the negative finding. Issue #5836 exists and explicitly requests a fullscreen break overlay citing hyperfocus. Minor caveat: #5881 is about auto-closing productivity tips and only tangentially supports the single-task-view gap it is cited for — a slight overclaim that does not undermine the core finding. 0 findings failed.

