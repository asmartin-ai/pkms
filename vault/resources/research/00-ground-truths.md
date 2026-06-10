---
tags: [pkms-design, research, adhd, ground-truths]
created: 2026-06-09
modified: 2026-06-09
status: answered
---

# 00 — Ground Truths

The starting facts for the ADHD-friendly PKMS redesign. Everything downstream — the research
sweeps, the synthesis, the design decisions — assumes what's written here. Correct anything
wrong; this doc is meant to be edited.

**Your job in this doc:** answer Part B inline (partial is fine — partial beats abandoned),
and fix anything in Parts A/C that's wrong. Everything else is my job.

---

## Part A — Hard Constraints

- **Local-first.** Notes, index, and especially health data live on this machine. Nothing
  personal leaves it without explicit say-so.
- **Windows** (Windows 10 LTSC, PowerShell). No Unix-only assumptions.
- **Mobile access (Pixel 6).** The tool and/or its content must be reachable from the
  user's Android phone in some way — content-hoarder's approach is the reference experience.
- **Single user.** No multi-user, no sync-to-collaborate requirements.
- **Architecture is open.** The current Python/Typer/SQLite scaffold is a learning artifact,
  not a foundation. Language, storage, and interface are all up for grabs in Phase 3.
- **Sibling systems exist and stay.** [[content-hoarder]] (triage inbox, 84k items) and
  [[job-search-2026]] (career ops) are separate working systems. The PKMS must eventually
  relate to them under a life-management umbrella, but it gets built standalone first.
- **Token budget is real.** Research and build are paced for Max x20 usage windows
  (~5-hour spacing between heavy sittings).

---

## Part B — Systems Questionnaire (answer inline, your words, any length)

This replaces any kind of usage monitoring — you're the only credible source for this data.
Answer under each question. Skip any that don't land; mark skips with `—` so I know it was
seen, not missed.

### History

**B1. What systems/tools have you tried for notes, tasks, or organization?**
(Paper, Notion, Obsidian, Todoist, plain folders, spreadsheets, whiteboards, content-hoarder,
the job-search TODO.md, anything — even half-tries count.)

> TODO text file, Paper, Bulletjournal system from bulletjournal.com, Obsidian, Spreadsheets, Rocketbook as a whiteboard, content-hoarder, pertsonal discord server, Google Keep, Pocket, Anytype, Google Calendar

**B2. Which ones stuck for more than ~6 months? What specifically kept them alive?**
(Be concrete: "it was already open," "zero setup per entry," "I saw it every morning"…)

> I had a very successful system roughly following the system from https://bulletjournal.com/. This lasted about 2 years when I was in college, a time when executive dysfunction and managaing it was highly critical. I was using it multiple times a day.
> I ended up dropping the bujo system because even though the act of writing was very helpful for reminding me, i kept wanting to fan out my thoughts more and more, and i couldnt transfer my thoughts onto paper fast enough.
> In college I also had an interesting hybrid system where I would use bujo for thought dump, simple tracking, and periodic logs and as a TODO list. I would use a rocketbook for lecture notes and schedule diagrams (I got tired of having to erase it so frequently) and Google Keep for rapid thought dump.
> After I graduated and got employed, I was thinking of getting an epaper tablet and using that to build a pkms/"life OS" which would give me the advantage of going digital with the feel of writing and the retention advantages that come with the act of writing.
> Google Keep was a very awesome place to dump thoughts and have it be searchable, but theres a lot of shortcomings to the platform.
> I tried Notion for a semester and I really liked it, but without something like an LLM to help me digest and organize my thoughts, I ended up getting lost in perfectionism trying to build the perfect system.
> Obsidian was an amazing thought dump and I still use it today, but I need to build the habit of regularly putting in new entries. I thinkp part of the struggle is not having something to help me organize the notes and also me not setting up the sync with the repo to access the notes on my phone too.
> Sometimes I use my personal Discord server as a semi-organized channel with thought dumps as well. I also take advantage of the fact that I can send things too and from devices easily. I find the UI to be pretty ADHD friendly, but things get cluttered fast when im forced to maintain it on my own.
> When I have events like conventions or travel plans, I get very organized with Google Calendar. I also used to be a lot better with using it for appointments. I still use it today I think it could be a lot better. I really miss the old Google Inbox product which would read from your email and dynamically create calendar entries.

**B3. Which ones died, and at what stage?**
(Setup never finished / abandoned in week 2 / faded around month 3 / killed by one bad
re-organization…) What was the proximate cause of death for each?

> Bujo lasted 2.5 years or so. I stopped when i started to get super busy with travel plans and distracted with so many hobbies.
> Google Keep i still use as a random thought dump today.
> Obsidian I still use today.
> Discord server i still use today
> Google calendar i still use today

### Capture

**B4. When a thought/link/idea hits you right now, what do you actually do with it?**
(Honest answer — including "save it to Reddit and never look again" or "tell myself I'll
remember." Where do things go on a normal day?)

> If its on Reddit/HN Ill save it on my phone. If its a meme i want to share ill remember to come back to it when talking to my friends. Sometimes this triggers memories of articles i want to come back to and read. Ocassionally i come back and read my saved reddit posts or stashed yt videos or hn articles when im tired of my current feeds.
> For some links i share it to my personal discord server. I have a habit of clicking my personal discord server when i open it so its a good place to stash a quick link that. Google keep is more of a big heap.

**B5. What does capture look like on your worst day?**
(Low energy, meds worn off, overwhelmed. What's the maximum effort you'd realistically spend
to save a thought before giving up?)

> Ill throw it into Google Keep and forget about it until i do a pass through my old notes down the line and feel the urge to clean it up.

### Retrieval

**B6. When do you actually go looking for something you saved? What does that moment look like?**
(Searching for a specific thing vs. browsing vs. "I know I saved this somewhere" frustration.
How often does retrieval actually happen?)

> Usually my long term memory is surprisngly decent, and i remember a relevant article or resource i saved in the moment that i saved somewhere. This happens daily, but i end up saving more than i triage/process, so the stack grows.
> When im bored of my feeds, sometimes ill check my saved feeds this helps me get through it somewhat. Youtube has the problem of the very large watch later playlists taking a long time to load and slowing the app, discouraging me from using it. Sometimes i feel like im saving high quality content that i want to watch when im less mentally lazy and i can lock into it and really appreciate and enjoy it.

**B7. Has a system ever resurfaced something at the right moment (reminder, review prompt,
serendipity)? Did you like it or did it feel like nagging?**

> Yes. Usually i can scroll and scroll and scroll and find it eventually unless its really old or has no search function like materialistic HN

### Shape of the problem

**B8. Rank your top 3 ADHD struggles as they apply to managing knowledge/tasks.**
(e.g., task initiation, time blindness, working memory, the 90%-done problem, note rot,
over-engineering systems instead of using them, hyperfocus eating the day…)

> Task initition is the worst.
Perfectionism stopping me from making prototypes and being stuck in planning/overengineering phase is also a big problem.
Hyperfocus eating the entire day and making me focus on other things is the 3rd worst.

**B9. What time(s) of day does your brain work best, and when is it gone?**
(Include the meds dimension if relevant — e.g., when coverage starts/fades.)

> Usually in the Afternoon.

**B10. What's your honest relationship with maintenance rituals (weekly review, inbox zero,
tagging)? Have you ever sustained one?**

> See above.

### Wants

**B11. Describe the moment this PKMS would have to win: one concrete scenario where today's
setup fails you and the new system shouldn't.**

> If i see a reddit post with a ton of discussion, i often want to process not only the article, but the intelligent back and forth the commenters are having. I love reading insights from intelligent people, and more often than not thats the real value i get from reddit. I think i often save the post meaning to read the discussion at a later time when im more able to lock in, but sometimes it gets buried.

**B12. Anything the system should NEVER do?**
(Per the openclaw-adhd pattern — e.g., "never guilt me about untouched notes," "never show me
a count of 82,000 unprocessed items," "never require a decision at capture time"…)

> Not sure.

---

## Part C — Context the Research Inherits

### C1. What already demonstrably works for this user (from [[job-search-2026]])

First-party evidence — these conventions survived real daily use through an active job search:

- **⏱ size / ▶ first action / ✓ done-when on every task** — startable and closable.
- **Decision gates surfaced first** — unmade decisions visibly block downstream work instead
  of silently rotting it; whole subsystems get explicitly *paused* (not deleted) at a gate.
- **Icebox** — deferred work out of sight, with reactivation conditions.
- **Achievement ledger** — ongoing structured capture at the moment work finishes (not
  retrospective), with a template that forces a metric and an evidence source.
- **Save-point dopamine** — every session ends at a working commit / closable state.
- **Hyperfocus protection** — when it shows up, ride it; don't fight it.
- **HANDOFF.md continuity pattern** — context survives across sessions/agents via one
  self-contained doc with explicit guardrails ("never fabricate", "don't claim X").
- **Visual board generated by script** (matplotlib kanban PNG) — visible state, zero manual
  drawing, "one thing at a time" baked into the artifact.

### C2. Prior analysis: openclaw-adhd (see memory note `ref-openclaw-adhd-repo.md`)

Patterns worth testing against research: one-next-action (never lists of 10), partial
completion as a first-class state, per-person profile that everything reads, shame-free tone
encoded as explicit rules, externalize executive function permanently rather than nagging the
user to improve.

### C3. The six research questions (every track must answer these)

1. What made ADHD users **abandon** a PKM/productivity system? (failure modes)
2. What survived **>1 year** of real use, and what property made it stick?
3. What does **frictionless capture** look like? What's the max acceptable activation energy?
4. How do ADHD users actually **retrieve** — search, resurfacing, serendipity?
5. How to handle the **"90% done" problem** and note rot without shame?
6. How should a **triage inbox** ([[content-hoarder]]) and **career ops**
   ([[job-search-2026]]) relate to a knowledge vault?

### C4. Open tasks seeded by this doc

- [x] Aaron: answer Part B (any subset counts)
- [ ] Claude: Sweep A — community anecdotes (HN/Reddit/YouTube/GitHub) → [[11-hn]], [[12-reddit]], [[13-youtube]], [[14-github]]
- [ ] Claude: Reddit MCP recommendation note → [[reddit-mcp-options]]
- [ ] Claude: Sweep B — Barkley + academic → [[15-barkley]], [[16-academic]]
- [ ] Claude: Sweep C — hoarder mining, landscape, seed links → [[17-hoarder-mining]], [[18-landscape]], [[19-seed-links]]
- [ ] Claude: synthesis → [[10-synthesis]]
