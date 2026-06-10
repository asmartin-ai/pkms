---
title: "Kenja's resource dump — six sources, mined"
tags: [pkms-design, research, adhd, seed-sources]
created: 2026-06-10
modified: 2026-06-10
status: draft
---

# 22 — Kenja's resource dump (six sources, mined)

Six user-supplied sources mined against the six RQs, deduped against [[10-synthesis]]. 11 findings; every quote re-verified against raw fetched source text (see Verification). Program: [[00-ground-truths]] · Synthesis target: [[10-synthesis]].

## Top takeaways

1. **goblin.tools independently ships the exact task grammar this program converged on** — auto-subdivide with a user-set "how hard does this feel" dial, braindump→actions compiler, one-task-at-a-time focus mode — as tiny single-purpose AI tools, free, popular enough to spawn press coverage and mobile apps (KD8, KD9). Strongest external validation yet of [[31-theme-tasks]] #4 and the G4 stuck-state.
2. **The al3rez arc is a clean longitudinal specimen for "AI as layer, never tied to an app backend":** three weeks after publishing his Claude-Code-manages-my-Todoist system, he published the todo.txt essay with Todoist on the abandoned list — the LLM survived his churn; the proprietary backend didn't. "The AI makes it faster, not required" (KD4, KD5). Hard confirmation of [[35-theme-llm-organizer]] #3.
3. **New shame facet: when a tool's state is unclear or it misbehaves, ADHD users blame themselves, not the tool** (KD1). System-state transparency is shame mitigation — silent failures convert directly into user self-criticism. Extends [[10-synthesis]] RQ5 #7 into error/status design.
4. **The customization verdict needs a split:** cap structural/system knobs (synthesis holds), but ADHD users actively want a small set of density/quiet controls to manage perceptual overwhelm (KD2). Refinement for G1, not a contradiction.
5. **Conventions outlive tools.** Across 25 years of one maximal organizer's PKM, what survived were naming conventions and the data substrate; every notes app churned — and even he lands on "organize what matters most, and don't feel bad about the rest" (KD6, KD7).

---

## Findings

### KD1. ADHD students blame themselves when the tool is at fault: in a think-aloud study of nine ADHD computing students using VS Code, participants directed frustration inward even when the IDE "had been unclear or had not functioned as expected" — ambiguous tool state converts to self-criticism, not tool-criticism.

> This sub-theme also lead to participants focusing the blame on themselves for their mistakes rather than the IDE, even in situations where the IDE had been unclear or had not functioned as expected.

- **Source:** [Accessible Design in IDEs: A Think Aloud Study Exploring the Experiences of Students with ADHD](https://arxiv.org/html/2506.10598v1) — Halpin, Benachour, Hall, Houghton, Winter (Lancaster University)
- **Credibility:** Qualitative, n=9 university students, thematic analysis with two coders; arXiv preprint. Small sample, but a rare direct-observation ADHD-and-developer-tooling study — closer to this user's population than most of the academic corpus.
- **Design implication:** RQ5 (extends [[10-synthesis]] RQ5 #7): shame-free design isn't only copy tone — it's status transparency. When the indexer/agent fails or does nothing, say so explicitly ("nothing new because X", "promote failed: Y"); a silent or ambiguous failure gets billed to the user's self-worth. Encode "the system owns its errors out loud" in the G9 agent grammar.

### KD2. The same study found IDE default layouts trigger overwhelm ("a bunch of stuff just pops up on the screen") while participants simultaneously wanted to personalize the interface to reduce load — and the desired direction varied (some wanted less on screen, some wanted more information).

> It's like you open it up and a bunch of stuff just pops up on the screen and it's really a little bit overwhelming.

> Adaptability and being able to personalise the interaction were major factors.

- **Source:** [arXiv 2506.10598v1](https://arxiv.org/html/2506.10598v1) (P05 think-aloud quote; discussion section)
- **Credibility:** Same study as KD1 (n=9, qualitative). The heterogeneity point (less vs more on screen) is the authors' own observation.
- **Design implication:** RQ1 / G1 refinement: the "cap the customization surface" verdict ([[10-synthesis]] cross-cutting; [[36-theme-anti-perfectionism]] #1) should split into: zero knobs on structure/schema/workflow (the tinkering trap), but a small bounded set of *salience* controls (density, quiet mode, how much the today-view shows). Personalization-as-decluttering is an accessibility need, distinct from personalization-as-tinkering.

### KD3. In a 22-participant ADHD study comparing three learning-platform UIs, the AI-generated interface won on usability but the human-designed one won on effectiveness — the authors recommend hybrids: AI generation inside human-led instructional design.

> The research discovered that users prefer the AI-generated LMS for usability and the manual system for effectiveness. The findings indicate that although AI-generated user interfaces (UIs) enhance usability, human-designed UIs are essential for educational effectiveness.

- **Source:** [Enhancing Adaptive Personalized Learning Interfaces with Generative AI for Individuals with ADHD](https://dl.acm.org/doi/10.1145/3768633.3770138) — Gunawardana, Perera, Lakshika, Ranasinghe, Karunanayaka; ACM proceedings of the 16th International Conference of HCI Design & Research, Dec 2025. Abstract retrieved verbatim via Semantic Scholar API (full text inaccessible — see coverage notes).
- **Credibility:** Abstract-only access; n=22 ADHD adults (18–30), SUS/UEQ measures, learning-platform domain (not PKM). Venue is a regional HCI conference. Treat as directional, not load-bearing.
- **Design implication:** RQ6 / G9: supports the decisions.md G9 shape — the agent generates and maintains content within human-curated conventions (⏱▶✓, templates, shame-free copy rules), rather than the LLM inventing the structure of meaning per-interaction. AI for fluency, human-designed scaffolding for substance.

### KD4. Longitudinal churn specimen: al3rez published "How I manage my life with Claude Code + Todoist" on 2025-07-20; on 2025-08-11 — three weeks later — he published the todo.txt essay with Todoist on the failed-apps list ("gaming the points system instead of doing actual work"). What survived the churn was the LLM layer over a plain text file, explicitly framed as optional acceleration.

> With Cursor/Claude Code or Neovim + Supermaven, I can write my entire day's schedule in 5 minutes. The AI completes my sentences, predicts meeting times, memorizes how I write tasks. But if all these AI companies disappear tomorrow, my system still works. It's just a text file. The AI makes it faster, not required.

- **Source:** [How I manage my life with Claude](https://al3rez.substack.com/p/how-i-manage-my-life-with-claude) (2025-07-20) + [The todo.txt journey](https://www.al3rez.com/todo-txt-journey) (2025-08-11) — same author; the latter is the article behind the HN thread already mined in [[11-hn]] F5/F6 and saved by the user ([[17-hoarder-mining]] CH9).
- **Credibility:** Single self-reporting author, publication dates ≠ exact usage dates (the txt essay narrates a multi-year arc and may have been drafted in parallel). But the ordering is verifiable from the posts themselves, and the within-weeks contradiction is real: the system he showcased did not include Todoist a month later.
- **Design implication:** RQ1 #5 / RQ2 / [[35-theme-llm-organizer]] #3: hard first-person confirmation that the durable asset is plain files + an optional LLM accelerant, and the disposable part is any proprietary task backend. For G9: never wire the agent to an external app's API as the system of record; the vault is the record, the agent is regenerable.

### KD5. The al3rez Claude system itself is one sentence of delegation: a standing instruction telling Claude Code to perform all Todoist CRUD via a CLI, after which he states intent at week/day/month granularity and the LLM does the bookkeeping. The post contains no friction report, no longevity evidence, and no mention of past systems.

> I tell Claude Code what I want to do for the week/day/month and it will update my todos/projects with reminders/due dates and deadline

- **Source:** [How I manage my life with Claude](https://al3rez.substack.com/p/how-i-manage-my-life-with-claude) (~300 words; the workflow is `claude` + the `doist` CLI + one system instruction)
- **Credibility:** Thin enthusiasm-phase post (the kind [[11-hn]] L2-07 warns about) — and KD4 shows the backend half didn't survive the month. The delegation *grammar* is the durable signal, not the stack.
- **Design implication:** RQ6 / [[35-theme-llm-organizer]] #2: confirms the division of labor at its most minimal — human states intent at natural granularity ("this week I want…"), agent owns dates/reminders/ordering. The PKMS triage agent should accept week-level intent dumps, not only per-item commands.

### KD6. Across 25 years of one PKM lifer's systems, every notes/app layer churned (notes.txt → wikis → Evernote → Notion → Obsidian; Delicious, XMarks, Google Reader all died under him) while what survived were conventions and infrastructure: YYYY-MM-DD naming, hierarchical folders, an RSS source list, a NAS, KeePass. He frames permanent flux as the correct end state.

> My system is always in flux and that's the way it should remain. There's no perfect system. It's all very personal.

- **Source:** [25 years of personal knowledge management](https://www.dsebastien.net/2022-04-03-25-years-of-personal-knowledge-management/) — Sébastien Dubois, 2022. (The HN thread on this article was mined in Sweep A and contains zero ADHD mentions; this is the first read of the article itself.)
- **Credibility:** PKM content creator selling Obsidian courses, coaching, and community — the [[18-landscape]] LS11 caveat applies in full. Self-described as "very organized (probably too much so)"; no ADHD or executive-function angle anywhere. Useful as a survival dataset, not as a behavioral model for this user.
- **Design implication:** RQ2 #5 / cross-cutting: independent 25-year confirmation that the permanent layer is conventions + data substrate and the app/view layer is fungible. Supports the existing verdict: let novelty churn happen at the view layer ([[11-hn]] F15) while names, formats, and files stay boring and portable.

### KD7. Even the maximal organizer's closing lessons are Pareto and guilt-absolution — and his concrete losses came from migrations and naming mistakes, not from under-organizing ("lost my journal more than once along the way").

> Most importantly, don't ruin your life trying to organize everything. Life is way too short for that. Design your own system and try to apply the Pareto principle. Organize what matters most, and don't feel bad about the rest.

- **Source:** [25 years of personal knowledge management](https://www.dsebastien.net/2022-04-03-25-years-of-personal-knowledge-management/)
- **Credibility:** Same LS11 caveat as KD6. The "don't feel bad" framing arriving from the opposite personality pole (an over-organizer, not an ADHD struggler) is what makes it notable.
- **Design implication:** RQ5: convergent support for shame-free partial organization from outside the ADHD corpus. Small new operational point: migration/rename events are where data dies — the indexer should treat renames/moves as first-class (link integrity checks, no retrieval path that depends on location), reinforcing [[12-reddit]] F12 / G3's "nothing ever depends on location."

### KD8. goblin.tools ships this program's task grammar as a free, popular, neurodivergent-targeted product suite: Magic ToDo (auto-breakdown with per-item re-breakdown), Compiler ("Turn a braindump into actions"), Taskmaster ("Focus on one task at a time"), Estimator (duration guess), Consultant ("Help me decide") — small single-purpose tools rather than a system you live inside.

> goblin.tools is a collection of small, simple, single-task tools, mostly designed to help neurodivergent people with tasks they find overwhelming or difficult.

- **Source:** [goblin.tools](https://goblin.tools/) and [goblin.tools/About](https://goblin.tools/About) — built and maintained by Bram De Buyser; free, no ads/paywalls, AI back-end, paid mobile apps + Patreon.
- **Credibility:** First-party product pages, fetched directly. Popularity is evidenced by mainstream press coverage and inclusion in ADHD community lists (it's the only AI tool in awesome-adhd, KD10), not by published usage numbers.
- **Design implication:** RQ5 / supports [[31-theme-tasks]] #4 and G4: Stuck=auto-subdivide, dump→actions, one-next-action, and ⏱ estimation all exist as a single product family with real adoption — the grammar is market-validated. Equally important is the form factor: point-of-performance micro-tools, not a destination app — matching G1's "not a UI you open" and G9's skills-over-app rec.

### KD9. Magic ToDo's "spiciness" dial (1–5 peppers) is a user-declared *current difficulty/stress* input that directly controls decomposition depth — spicier = more, smaller steps. It operationalizes "the system gets dumber when you're lower" as a one-tap, per-task control with zero shame framing (peppers, not "I'm struggling").

- **Source:** [goblin.tools Magic ToDo](https://goblin.tools/ToDo); mechanic corroborated by independent reviews ([FocusHack review](https://www.focushack.io/reviews/goblin-tools-adhd-review/), [local3news coverage](https://www.local3news.com/local-news/what-the-tech-app-of-the-day-goblin-tools-releases-app-to-help-people-with/article_08825264-24c3-11ee-8b4f-17504cf42106.html)). No verbatim quote: the tool is a client-rendered SPA and its FAQ page 404'd, so the spiciness description here is paraphrase from secondhand coverage — flagged per quote discipline.
- **Credibility:** Mechanic is well-documented across multiple independent reviews and the tool itself is publicly usable; only the exact first-party wording is unavailable.
- **Design implication:** RQ1 #7 / G4: adopt a capacity dial on decomposition — when the user marks a task Stuck (or signals a low day), the agent re-breaks it into smaller rungs rather than re-presenting the same step. The euphemistic, playful encoding (peppers) is itself a shame-design lesson for [[36-theme-anti-perfectionism]]: ask "how spicy is this?" never "how impaired are you?".

### KD10. Full scan of awesome-adhd confirms the ecosystem skew at higher resolution: ~40 apps across timers, blockers, soundscapes, visual planners and chore apps, vs exactly four notetaking entries (Glean, Evernote, Notability, Obsidian — none ADHD-specific), zero capture tools, zero resurfacing tools, and exactly one AI tool (goblin.tools). A small "persistent nagging" category exists (Due, "nag reminder") built on auto-repeating notifications until done.

> Similar to Due, persistent notifications for tasks!

- **Source:** [XargsUK/awesome-adhd README](https://github.com/XargsUK/awesome-adhd) (raw README fetched and read directly; quote is the verbatim nag-reminder description)
- **Credibility:** Community-curated list — measures what the community recommends, not what works. Already cited at category level in [[14-github]] F17; this is the full-list pass.
- **Design implication:** RQ2/RQ4: confirms the gap the PKMS targets (capture/retrieval/resurfacing unserved). New tension for G5/G8: the existence and popularity of nag-until-done reminder apps sits against the notification-depletion evidence ([[16-academic]] SC8; [[19-seed-links]] SD5). Plausible reconciliation: persistent re-notification works for *single hard commitments* (one item, self-chosen), while ambient surfaces must stay rationed — worth carrying into the G4 urgency sub-decision rather than changing the G5/G8 recs.

### KD11. The only ADHD-branded PKM-adjacent app found (Lunatask, via awesome-adhd) is an encrypted all-in-one (tasks+habits+mood+notes+relationship CRM) whose headline ADHD mechanic is machine-owned prioritization — the app orders the list, not the user.

> We designed Lunatask specifically with ADHD brains in mind and with many tools that really help.

- **Source:** [lunatask.app](https://lunatask.app/) (homepage fetched raw; quote verified verbatim in page text)
- **Credibility:** Vendor marketing plus app-store testimonials; no independent evidence. Closed-source, subscription, proprietary store — the AI-as-app/everything-app shape that [[18-landscape]] LS2–LS6 says dies.
- **Design implication:** RQ2/RQ4: weak-but-consistent market signal that "the machine owns ordering/prioritization" is the ADHD-facing pitch that sells ([[12-reddit]] F23's pick-from-a-list strength, productized). The PKMS gets the same benefit via the agent proposing today's one-next-action — without inheriting the everything-app failure shape.

---

## Coverage notes

- **Source 1 — arXiv 2506.10598v1:** Fetched full HTML directly (WebFetch + raw curl for quote verification). Identified as the Lancaster University ADHD/IDE think-aloud study (n=9). Relevant: yes — two findings (KD1, KD2). Its third theme (learning approaches) is education-specific and was not mined.
- **Source 2 — ACM 10.1145/3768633.3770138:** dl.acm.org blocked (403 via WebFetch; Cloudflare JS challenge via curl). Identified via web search; verbatim abstract + author list retrieved through the Semantic Scholar API (DOI lookup). Full text never accessed — KD3 is abstract-only and flagged as such. No arXiv mirror found.
- **Source 3 — al3rez Substack:** Fetched via WebFetch + raw HTML download. The post is ~300 words and thinner than expected — no friction points, no system history, no ADHD content. The real signal came from cross-dating it against his todo-txt essay (also fetched raw): the Substack post (2025-07-20) *predates* the todo.txt essay (2025-08-11), reversing the assumed order — the Claude+Todoist showcase came first and Todoist was on the dead list three weeks later (KD4, KD5).
- **Source 4 — dsebastien 25-years article:** Fetched via WebFetch + raw HTML for quote verification. Two findings (KD6, KD7). Much of the article (data-hoarding nostalgia, storage history, PARA promotion) is already-established territory or course marketing; LS11 caveat applied throughout. Verdict on the rest: already established, nothing new.
- **Source 5 — goblin.tools:** Landing + About pages fetched (About text verified verbatim in raw HTML). The app itself is a client-rendered SPA; /FAQ returned 404, so the spiciness wording is paraphrased from independent reviews (flagged in KD9). Two findings (KD8, KD9). The existing [[11-hn]] F19 finding (theshackleford, from the goblin.tools HN thread) stands unchanged.
- **Source 6 — awesome-adhd:** Raw README fetched and read directly (~70KB). Confirms [[14-github]] F17 at full resolution (KD10). Spot-checked the three most PKM-adjacent entries: Super Productivity (open-source timeboxing/task app — solid but generic; notes are secondary; nothing new for the RQs), Lunatask (KD11), and Due/nag-reminder (folded into KD10's tension). Everything else on the list (timers, blockers, sounds, books, podcasts, charities) is out of scope or already covered. No medication-related content from the list was mined or carried into this note.

## Verification

Self-check before writing: the three most load-bearing quotes were re-confirmed character-for-character against raw fetched source text (curl → grep), not against WebFetch summaries:

1. **al3rez (KD4):** "But if all these AI companies disappear tomorrow, my system still works. It's just a text file. The AI makes it faster, not required." — found verbatim in O:\Temp\al3rez_txt.html (source uses curly apostrophes; normalized here).
2. **arXiv (KD1):** "participants focusing the blame on themselves for their mistakes rather than the IDE, even in situations where the IDE had been unclear or had not functioned as expected" — found verbatim in the fetched arXiv HTML (note: "lead to" is the paper's own typo, preserved).
3. **dsebastien (KD6/KD7):** "My system is always in flux and that's the way it should remain. There's no perfect system. It's all very personal." and "don't ruin your life trying to organize everything. Life is way too short for that" — both found verbatim in the raw article HTML.

Additional verbatim confirmations: goblin.tools About text (KD8) and the awesome-adhd nag-reminder line (KD10) grep-confirmed in raw downloads; Lunatask ADHD line (KD11) grep-confirmed on the live homepage; ACM abstract (KD3) is the Semantic Scholar-stored abstract, quoted unmodified. The KD2 P05 quote and "Adaptability…" sentence were extracted directly from the arXiv HTML text dump. The only paraphrase-without-quote is the spiciness mechanic (KD9), deliberately left unquoted per quote discipline.
