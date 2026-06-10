---
title: PKMS landscape — system critiques + LLM-PKM implementations
created: 2026-06-10
modified: 2026-06-10
tags: [research, adhd, pkms-design, landscape, llm-pkm, tool-critique]
status: draft
---

# 18 — PKMS Landscape: System Critiques + LLM-PKM Implementations

Raw findings from the landscape-survey track: what happened to existing PKM tools and LLM-PKM projects, plus the canonical critique essays. 14 findings; 3 sample-verified by an adversarial fact-checker, 0 failed.
Program: [[00-ground-truths]] - Synthesis target: [[10-synthesis]]

## Top takeaways

1. **Capture-without-filing is the single most repeated survival factor** across every source: the zero-energy path must be "dump into today's note, decide nothing" — on desktop AND Pixel 6 — with structure emerging later from observed patterns, never predesigned (LS13, LS9, LS6).
2. **Every note, link, and feature is a liability, not an asset** (Borretti). For this user's overengineering/hyperfocus profile, the PKMS needs a deliberately frozen, small feature surface tied to named contexts of use (job-search-2026, hoarder triage) — anything serving "PKM in general" is the procrastination surface (LS9, LS10, LS11).
3. **Read-later services die and piles get ignored in their entirety:** capture must store full content (article + Reddit/HN comment thread) as local markdown at save time, and the inbox must be capped and triaged in short time-boxed cycles so it can never become an intimidating graveyard (LS7, LS8).
4. **LLM-era verdict: AI-as-layer-over-plain-files survives** (Smart Connections, Copilot, basic-memory — all active); **AI-as-app dies** (Reor archived, Khoj pivoting). Build any AI feature as a regenerable sidecar over the vault, with a local embedding index for ambient "related notes" resurfacing as the cheapest high-value serendipity mechanism (LS2, LS3, LS4, LS6).
5. **Mobile capture latency is an abandonment cause, not a polish item:** a loading pause at capture time was documented as the moment a whole system died — the Pixel 6 path must be instant and spinner-free (LS14, LS12).

---

## Findings

### LS1. Khoj positions itself as a self-hostable "AI second brain" (chat with your docs across markdown/org/PDF from browser, Obsidian, Emacs, phone, WhatsApp), but the server-style architecture is heavyweight for one user and the team's attention has visibly moved to a new product (Pipali); the khoj repo's last push was 2026-03-26 despite 35k stars.

> Khoj is open-source, self-hostable. Always.

- **Source:** [Khoj README + GitHub API repo metadata](https://github.com/khoj-ai/khoj)
- **Credibility:** Primary source (project README, marketing-toned) plus GitHub API metadata fetched this session (pushed_at 2026-03-26T03:35:43Z, 35,044 stars, not archived). "Attention moved" is an inference from the README's top billing of Pipali plus the 2.5-month push gap — moderately supported, not proven dead.
- **Design implication:** Don't make the vault depend on a hosted/server AI app for core function; if a chat-with-vault layer is wanted, it must be a disposable add-on over plain files, because even 35k-star AI-PKM projects pivot.

### LS2. Reor — the flagship "private & local AI note-taking app" that auto-linked related notes via local embeddings and did RAG Q&A over your corpus — is now an archived (abandoned) GitHub repository, so users who adopted it as their primary notes app lost their AI features while keeping only the markdown files.

> The hypothesis of the project is that AI tools for thought should run models locally _by default_.

- **Source:** [Reor README + GitHub API](https://github.com/reorproject/reor)
- **Credibility:** Strong: README is primary, archived status verified via GitHub API this session (archived: true, pushed_at 2025-05-13, 8,566 stars).
- **Design implication:** Integrated AI-note apps die; the only part of Reor that survived its abandonment is the plain-markdown directory. Architect the PKMS so every AI feature (embeddings, auto-linking, chat) is a regenerable layer beside the vault, never the container of the notes.

### LS3. Obsidian Copilot (actively maintained, pushed the day of this research, 7.1k stars) represents the surviving LLM-PKM pattern: an AI layer inside an existing vault with bring-your-own-model, optional embeddings, chat-based vault search, and explicit anti-lock-in positioning.

> Today's AI giants want **you trapped**: your data on their servers, prompts locked to their models, and switching costs that keep you paying. When they change pricing, shut down features, or terminate your account, you lose everything you built.

- **Source:** [Copilot for Obsidian README + GitHub API](https://github.com/logancyang/obsidian-copilot)
- **Credibility:** Primary source; marketing-toned README but feature claims (vault QA, agent mode, BYO model, local storage) are core documented functionality. Maintenance status verified via GitHub API (pushed 2026-06-10).
- **Design implication:** Chat-with-vault retrieval is mature commodity tech; the PKMS can defer it. The durable design choice it validates: AI sits in the user's existing files and the model is swappable — mirror that with an optional agent/CLI layer over vault/ rather than a new app.

### LS4. Basic Memory (MCP server, active, 3.1k stars) demonstrates the human-and-agent-share-the-same-markdown architecture: knowledge lives as local markdown with wikilinks that both the user (e.g. in Obsidian) and any MCP client read and write, with the database as derived infrastructure.

> **Local-first.** Plain text on your disk. Forever.
> - **Two-way.** AI and humans write to the same files; sync keeps them in step.

- **Source:** [Basic Memory README + GitHub API](https://github.com/basicmachines-co/basic-memory)
- **Credibility:** Primary source (README), actively maintained per GitHub API (pushed 2026-06-10). Claims are architectural statements, easy to verify from the repo itself.
- **Design implication:** This is the closest existing architecture to the PKMS scaffold (markdown source of truth + derived index + agent access). Adopt its key move: expose the vault to Claude/agents via MCP or CLI tools over the same files, so AI assistance never forks the data.

### LS5. Mem0 (58k stars, very active) defines the opposite design pole: an extraction-based "memory layer" where an LLM distills facts about the user into a vector/graph store for agent recall — optimized for benchmark recall (claims 94.8 on LongMemEval), not for human-readable, user-owned notes.

> enhances AI assistants and agents with an intelligent memory layer, enabling personalized AI interactions. It remembers user preferences, adapts to individual needs, and continuously learns over time—ideal for customer support chatbots, AI assistants, and autonomous systems.

- **Source:** [Mem0 README + GitHub API](https://github.com/mem0ai/mem0)
- **Credibility:** Primary source; benchmark numbers are self-reported in the README and not independently verified here.
- **Design implication:** Memory-layer products store knowledge as opaque extracted records — exactly what a privacy-sensitive, file-over-app PKMS should avoid for the vault itself. If agent memory is added later, keep it as a derived, regenerable cache (like .index/pkms.db), never the canonical store.

### LS6. Smart Connections (5.1k stars, active) shows that passive, zero-setup resurfacing works on consumer hardware: it ships a local embedding model and continuously shows a "related notes" pane so connections appear without the user doing any linking, tagging, or filing.

> With Smart Connections running, ideas resurface when you need them, writing flows faster, and your note taking system finally feels like the trusted second brain you imagined.

- **Source:** [Smart Connections README + GitHub API](https://github.com/brianpetro/obsidian-smart-connections)
- **Credibility:** Primary source, promotional tone; but the zero-setup local-embedding claim ("✔️ Zero-setup: ships with a local embedding model that just works") is a verifiable shipped feature, and its problem statement explicitly targets users who "capture ideas quickly, but later struggle to find and connect them". Maintenance verified via GitHub API (pushed 2026-06-04).
- **Design implication:** For RQ4, the winning serendipity mechanism is ambient and effort-free: a local embedding index over the vault that surfaces related notes at read/write time. Resurfacing must cost the user zero actions — never a review chore.

### LS7. The Collector's Fallacy (zettelkasten.de, 2014, foundational essay for RQ5/RQ6) argues that saving/bookmarking is an addictive self-rewarding loop that produces fake knowledge, that an intimidatingly large pile gets ignored in its entirety, and that the cure is short, time-boxed research→read→assimilate cycles rather than big piles.

> The worst we could do is to pile up copies until the stack grows intimidatingly high, until it becomes unmanageable. After that it will be ignored in its entirety.

- **Source:** [The Collector's Fallacy — Christian Tietze, Zettelkasten Method blog](https://zettelkasten.de/posts/collectors-fallacy/)
- **Credibility:** Widely-cited practitioner essay (primary text fetched and read in full this session); argument is theoretical/anecdotal, but it is the canonical articulation the "second brain" backlash builds on.
- **Design implication:** The triage inbox (RQ6) must be designed so the pile cannot become "intimidatingly high": cap visible inbox size, make triage a short time-boxed cycle, and treat capture-count growth as a system warning rather than a reward.

### LS8. Pocket — the dominant read-it-later service — was shut down by Mozilla on July 8, 2025 with only a 3-month export window, demonstrating that read-later queues stored in a service (rather than as local content) are mortal and their saved-article graveyards vanish with the host.

> Users will be able to continue using the app and browser extensions for Pocket until July 8. After that date, Pocket will move into export-only mode. Users have until October 8 to export saved articles, including items in their list, archive, favorites, notes, and highlights.

- **Source:** [Mozilla is shutting down read-it-later app Pocket — TechCrunch (Aisha Malik, May 22 2025)](https://techcrunch.com/2025/05/22/mozilla-is-shutting-down-read-it-later-app-pocket/)
- **Credibility:** Strong: reputable tech press reporting a verifiable corporate announcement; article fetched and read in full. (Mozilla's own support KB and getpocket.com farewell page are behind JS challenges from this machine.)
- **Design implication:** For the win scenario (capture a Reddit/HN post WITH its comments), capture must store the full content as markdown in the vault at save time — never a URL pointing into a service or even the live web, since both the service and the thread can disappear.

### LS9. Borretti's "Unbundling Tools for Thought" — written by someone who built six or seven personal wikis and used none — argues that building the system is itself procrastination, that plugin-extensible everything-graphs fail ("the work becomes infinite, the gains are imaginary"), that ~86% of his nodes were journal entries, and that most use cases unbundle into boring specialized apps.

> Every node in your knowledge graph is a debt. Every link doubly so. The more you have, the more in the red you are.

- **Source:** [Unbundling Tools for Thought — Fernando Borretti (Dec 2022)](https://borretti.me/article/unbundling-tools-for-thought)
- **Credibility:** Practitioner essay, n=1 but unusually self-aware and widely discussed; full text fetched and read this session. Directly relevant to the user's overengineering/hyperfocus failure mode.
- **Design implication:** Treat every schema element, plugin, and link type in the PKMS as a liability requiring justification from actual usage. The journal/daily-note dominance (86% of his nodes) supports daily-notes-first capture; the engine-building-as-procrastination warning argues for freezing the PKMS feature surface early.

### LS10. Sasha Chapin's "Notes Against Note-Taking Systems" frames elaborate PKM as avoidance behavior and sets a usefulness test: a note system is legitimate only when adapted to a specific context of use (e.g. tracking a million references for real work) — otherwise it is performance.

> Getting lost in your knowledge management system is a fantastic way to avoid creating things. Or calling that friend you're estranged from. Or doing anything else even mildly threatening.

- **Source:** [Notes Against Note-Taking Systems — Sasha Chapin (Jan 2022)](https://sashachapin.substack.com/p/notes-against-note-taking-systems)
- **Credibility:** Influential opinion essay (the canonical anti-PKM piece of the 2022 backlash); full text fetched this session. His companion line — "If your note-taking system is adapted to a specific context of use such as this, then you're working. If it's not, then you're LARPing." — is verbatim from the same page.
- **Design implication:** Anchor every PKMS capability to one of the user's named contexts of use (job-search-2026 ops, content-hoarder triage, project notes); any feature that serves "knowledge management in general" rather than a named context gets cut — it's the avoidance surface.

### LS11. Andy Matuschak's note warns that PKM best practices mostly come from people whose primary output is writing about productivity, developed disconnected from real work — while Luhmann himself barely wrote about his Zettelkasten — i.e. the Zettelkasten/evergreen canon is partly cargo cult and should not be copied wholesale.

> But most people who write about note-taking don't seem particularly accomplished in their own fields, whatever those may be. In fact, most such writers aren't applying their notes to some exogenous creative problem: their primary creative work *is* writing about productivity.

- **Source:** [People who write extensively about note-writing rarely have a serious context of use — Andy Matuschak, working notes](https://notes.andymatuschak.org/People_who_write_extensively_about_note-writing_rarely_have_a_serious_context_of_use)
- **Credibility:** Primary source; note text extracted verbatim from the page's embedded JSON this session (the site is a JS SPA). Matuschak is a leading tools-for-thought researcher — high credibility within the field, still opinion not data.
- **Design implication:** Design decisions should be derived from this user's observed behavior (zero-friction dumps to Keep/Discord/Obsidian, buried Reddit saves) rather than from imported PKM methodology (atomic notes, evergreen rewriting, forced linking) — adopt a practice only after the user's own usage demands it.

### LS12. Kepano's "File over app" manifesto (written by Obsidian's CEO) states the longevity argument for plain local files: durable digital artifacts must be user-controlled files in easily readable formats, because every app — including Obsidian itself — will become obsolete.

> File over app is a philosophy: if you want to create digital artifacts that last, they must be files you can control, in formats that are easy to retrieve and read.

- **Source:** [File over app — Steph Ango (July 2023)](https://stephango.com/file-over-app)
- **Credibility:** Primary source, fetched and read in full; author has obvious commercial alignment with the thesis, but he applies it against his own product ("it's a delusion to think it will last forever" — verbatim from the same page, about Obsidian).
- **Design implication:** Validates the existing scaffold (markdown vault as source of truth, SQLite as regenerable index). The corollary for the Pixel 6 constraint: mobile access must read/write the same plain files (sync of the vault), not a parallel app database.

### LS13. A firsthand ADHD account of why Obsidian stuck after Roam/Logseq/Mem/Amplenote all failed credits three things: capture without deciding where notes belong, a daily note that absorbs zero-structure dumps on bad days while permitting elaborate structure during hyperfocus, and adding structure only after patterns emerge from real use — while naming premature system-building and comparing yourself to YouTube setups as the two abandonment triggers.

> The biggest mistake ADHD folks make with any system is trying to build Rome in a day, getting overwhelmed, and then abandoning it entirely. The second biggest mistake is looking at Reddit or YouTube content creators, seeing their beautiful systems, getting overwhelmed, and then abandoning it entirely.

- **Source:** [Note-Taking for the Chronically Distracted: An ADHD Guide to Obsidian — Ernie Hsiung (Mar 2025)](https://www.littleyellowdifferent.com/p/note-taking-for-the-chronically-distracted)
- **Credibility:** n=1 personal newsletter by an adult-diagnosed writer/engineer; anecdotal but unusually specific and it independently converges with Sweep A community findings ([[11-hn]]). His stated win condition — "My personal win wasn't creating some elaborate system—it was finally having a place where ideas don't disappear." — is verbatim from the same page.
- **Design implication:** RQ2/RQ3 mechanism in one source: the PKMS must make "dump into today's daily note with no decisions" the zero-energy default path on both desktop and Pixel 6, tolerate wildly inconsistent structure across days, and defer all taxonomy until the vault's own contents justify it (his rule: organize AI prompts only after the 30th one).

### LS14. A representative Notion-abandonment account identifies the two failure modes the track predicted: flexibility becomes a perfectionism trap (endless dashboard tweaking as hidden procrastination) and mobile slowness kills capture — a pause at capture time was enough to derail momentum and ultimately the whole system.

> I'd sit down to capture an idea or plan a task, and wait. That tiny pause was enough to derail my momentum. Productivity tools should disappear into the background.

- **Source:** [Why I Quit Notion (And You Might Want To) — Dedi R, Vocal Media](https://vocal.media/motivation/why-i-quit-notion-and-you-might-want-to)
- **Credibility:** Weak-to-moderate: low-prestige personal blog, n=1; used because it states both mechanisms concretely and verbatim ("I spent more time tweaking my system than actually doing the work" and "I was hiding behind complexity" are also verbatim from the page). Converges with the broader Notion-abandonment literature surfaced in search.
- **Design implication:** Two hard requirements: (1) the Pixel 6 capture path must be measured in seconds with no loading spinner — latency is an abandonment cause, not an annoyance; (2) minimize the PKMS's tweakable surface (themes, dashboards, config) because customization affordances are where perfectionism metastasizes.

---

## Coverage notes

FETCHED AND READ THIS SESSION (all quotes copied from these): raw GitHub READMEs for khoj, reor, obsidian-copilot, basic-memory, mem0, smart-connections, logseq, plus GitHub API metadata (pushed_at/stars/archived) for all seven repos; full text of stephango.com/file-over-app, zettelkasten.de/posts/collectors-fallacy, borretti.me/article/unbundling-tools-for-thought, sashachapin.substack.com notes-against-note-taking-systems, TechCrunch Pocket shutdown article, littleyellowdifferent.com ADHD-Obsidian guide, vocal.media quit-Notion essay, gwern.net/about, and Andy Matuschak's note (extracted verbatim from the SPA's embedded JSON). BLOCKED: support.mozilla.org Pocket KB and getpocket.com/farewell (JS challenges) — substituted TechCrunch. CUT FOR THE 14-FINDING CAP: gwern.net/about Long Content section (verified verbatim: "most blog posts are the triumph of the hare over the tortoise... the best blogs always seem to be building something: they are rough drafts—works in progress" — directly useful for RQ5: treat notes as permanently-in-progress pages rather than finishable artifacts, removing the 90%-done shame frame; recommend the designer use this). THIN/SKIPPED: org-mode power-vs-ramp (no strong essay fetched; low relevance for a Windows+Pixel-6 user); Logseq daily-notes-first (README fetched but never mentions journals — its docs site is JS-rendered; repo is active, 43k stars, pushed 2026-06-10; the daily-notes-first lesson is instead carried by Borretti's 86%-journal stat and LS13); a dedicated "Zettelkasten is overrated" essay (the critique is covered from three angles by LS9/LS10/LS11); Instapaper-specific guilt essays; a dedicated BASB/Tiago Forte backlash piece (LS7 collector's fallacy + LS10 carry the substance). OPEN QUESTIONS: no quantitative abandonment data exists for any of these tools (only anecdote + repo liveness); whether Smart-Connections-style passive resurfacing actually changes reading-queue completion for ADHD users is untested anywhere found; khoj's long-term maintenance is ambiguous (slowed, pivoted, not dead).

## Verification

Sampled ids: LS1, LS8, LS14 — all three verified, 0 failed.

- [verified] LS1 (Khoj) — All checkable facts confirmed. The exact quote "Khoj is open-source, self-hostable. Always." is present verbatim in the README. The platform list (markdown, org, PDF, Obsidian, Emacs, WhatsApp, browser, phone) is confirmed by the README. Pipali is prominently featured at the top of the README as a new product. GitHub API metadata confirms pushed_at 2026-03-26T03:35:43Z, 35,044 stars, and not archived — matching the claim exactly. The "attention moved" inference is editorial judgment, not a sourced fact, but the underlying evidence (Pipali top billing + 2.5-month push gap) is accurately reported.
- [verified] LS8 (Pocket) — All facts confirmed via the TechCrunch article (Aisha Malik, May 22 2025). The July 8 service-end date, the transition to export-only mode, and the October 8 final export deadline are all confirmed. The first two sentences of the quote are confirmed verbatim; the trailing sentence about exporting "items in their list, archive, favorites, notes, and highlights" matches the article's enumeration of exportable content. No material discrepancy found.
- [verified] LS14 (Vocal Media) — The page exists and the key quotes are confirmed on it. "That tiny pause was enough to derail my momentum. Productivity tools should disappear into the background." is confirmed; "I spent more time tweaking my system than actually doing the work." and "I was hiding behind complexity." are both confirmed verbatim. The opening sentence of the block quote was not returned word-for-word by the checker's fetch but is consistent with the confirmed continuation and the article's framing. Author (Dedi R) and platform (Vocal Media) confirmed; the stated credibility caveat (low-prestige personal blog, n=1) is accurate.

**Checker summary:** All three sampled findings check out. LS1: every verifiable claim confirmed (quote, platform list, Pipali placement, GitHub API figures); the "attention moved" characterization is an editorial inference resting on accurately reported facts. LS8: article exists, bylined and dated as claimed; quoted shutdown timeline matches exactly. LS14: page live, all three quoted phrases confirmed; leading sentence of the block quote not returned verbatim by the fetch but no contradicting text found; credibility caveat correctly stated by the original analyst.
