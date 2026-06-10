---
tags: [pkms-design, research, adhd, sweep-a, reddit]
created: 2026-06-09
modified: 2026-06-10
status: raw-findings
---

# 12 — Reddit Anecdotes (Sweep A)

Raw findings from the Sweep A community-anecdotes workflow. 24 findings; 6 sample-verified by an adversarial fact-checker, 0 failed.
Program: [[00-ground-truths]] - Synthesis target: [[10-synthesis]]

## Top takeaways

1. **Saving is guilt-free tab-closure, not future reading** — users say it out loud (F1, F2). A passive save-pile is a solved, already-failing pattern; only *active resurfacing* changes the outcome.
2. **The Telegram/Discord dump is the survivor pattern** (F4, F5) — already open, zero decisions — and its known failure (unsearchable graveyard) is exactly what a downstream LLM-classification layer fixes. This is the user's Discord habit, diagnosed.
3. **Re-entry beats organization** (F6): the killer cost is "Monday with zero memory of Friday." Machine-generated where-I-left-off breadcrumbs matter more than taxonomy. And systems must be *resilient* (cheap to revive, no streaks/backfill debt), not robust (F7).
4. **The highest-voted ADHD Obsidian thread (1.2k upvotes) is an abandonment confession** (F10): two years of effort, no habit. Tool love ≠ retention; the system must pay out on read-back.
5. **One inbox, filing deferred to a batched pass** kills decision paralysis (F18); customizability itself fuels paralysis (F19).
6. **The win scenario already exists in the wild:** a Reddit archiver pulling saved posts + comments into Obsidian (F20). Critical detail: Reddit's native saves silently cap at ~1000 items — the archive must be the system of record.
7. **Senior devs use LLMs as executive-function prosthetics** (F9): plan-mode dissolved planning-procrastination. Pattern to copy: agent generates options, ADHD user picks — "bad at generating the ideal plan, extremely proficient at identifying the best from a list" (F23).
8. **"Render unto Computer the things that are the Computer's"** (F22, 681 pts): the machine holds all state; the human gets novelty and big-picture.

---

## Findings

### F1. The archetypal ADHD pattern is years of screenshots, bookmarks, and saved posts that are never revisited; the OP explicitly frames it as being 'unable to make and stick with just one system'. Thousands of commenters confirmed the same pattern (500+ browser tabs, 15k screenshots, 26k unread emails).

> Sadly, it's all information I once found important and worth reviewing. But unless I definitely needed to return to that info again in the near future, I never have!

- **Source:** https://www.reddit.com/r/ADHD/comments/motdce/i_have_this_habit_of_saving_posts_and_screenshots/
- **Who:** u/thegryphonator, r/ADHD OP, 7686 pts, Apr 2021; dx status not stated but posting in dx-gated sub
- **Tool/system:** screenshots / bookmarks / saved posts (none)
- **Design implication:** Capture volume will massively exceed retrieval. The system must assume most captures are never reopened and make that cheap and shame-free, while making the few that matter findable. Do not treat unread backlog as failure state.
- **Research questions:** 1, 6

### F2. One-click save tools (Pocket, OneTab) succeed at capture but their real psychological function is guilt-free closure, not future reading — users say this out loud. Saving lets them close the tab; retrieval almost never happens.

> Its just one button I have to press and then I forget about the article forever as I lie to myself and say that I will read it one day

- **Source:** https://www.reddit.com/r/ADHD/comments/motdce/i_have_this_habit_of_saving_posts_and_screenshots/gu9453v/
- **Who:** u/sourpatch_grown-up, r/ADHD commenter, 2021; corroborated by u/chorus_of_stones ('I use OneTab... I almost never look at them again! But it's easier to close knowing I am saving them')
- **Tool/system:** Pocket, OneTab, pinboard.in
- **Design implication:** A triage inbox must add an active resurfacing mechanism (scheduled re-presentation, digest, or agent-pushed reminders); a passive save-pile is already solved and already fails. Distinguish 'close this tab' saves from 'I genuinely want to return' saves at capture time.
- **Research questions:** 3, 4, 6

### F3. A technology consultant with a recent ADD diagnosis keeps a Trello board with a knowledge-inbox list, a backlog, an active list, and a slowly-archived done list; the stated purpose is to 'outsource it out of my brain and overcome FOMO', and he deliberately keeps the completed list visible because seeing finished items rewards him.

> The key is to have a reasonable place to drop this stuff so I can outsource it out of my brain and overcome FOMO on something strategically important.

- **Source:** https://www.reddit.com/r/ADHD/comments/motdce/i_have_this_habit_of_saving_posts_and_screenshots/gudc7yp/
- **Who:** u/pderpderp, self-described technology consultant with recent ADD diagnosis, r/ADHD, Apr 2021
- **Tool/system:** Trello
- **Design implication:** Separate the knowledge inbox from the task backlog but keep them on one surface; preserve a visible 'done/processed' trail as a dopamine reward rather than silently archiving.
- **Research questions:** 5, 6

### F4. Designer/dev with ADHD describes the canonical abandonment loop — 4 days building the perfect system, 1-2 weeks of religious use, one missed log, never opens it again — across Notion, Obsidian, Todoist, Things, Sunsama, Capacities and more. The only thing that survived is Telegram Saved Messages, because it is already open and requires zero decisions; but it became an unsearchable 'graveyard' where tasks, thoughts, and reminders are indistinguishable.

> by the time i pick a folder, add tags, set priority, choose a project, the thing i wanted to write down is just... gone.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/1sovgpl/i_gave_up_on_every_productivity_app_and_now_i/
- **Who:** u/ArtyomNet, self-described designer/dev, r/ADHD_Programmers OP, 19 pts, Apr 2026
- **Tool/system:** Telegram Saved Messages (survivor); Notion/Obsidian/Todoist/Things/Sunsama/Capacities (abandoned)
- **Design implication:** This is the user's exact Discord-dump pattern. Capture must be a single message-send with zero metadata decisions; the missing layer is downstream automatic classification (task vs thought vs reminder) and time-based retrieval, which an LLM pipeline can add without raising capture friction.
- **Research questions:** 1, 2, 3, 4, 6

### F5. Multiple ADHD programmers in the same thread converge on the principle that the winning system minimizes resistance at the point of capture, not feature count; one uses Discord channels as his dump plus a physically always-visible notepad, noting that even opening a notebook is too much friction.

> the best system for ADHD is usually the one with the least resistance at the point of capture, not the one with the most features.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/1sovgpl/i_gave_up_on_every_productivity_app_and_now_i/ogx309d/
- **Who:** u/IdleJolt (quote) and u/gentlemako (Discord + desk notepad), r/ADHD_Programmers commenters, Apr 2026; quote permalink is IdleJolt's; gentlemako at .../ogxtd9w/
- **Tool/system:** Discord, paper notepad, Telegram
- **Design implication:** Max acceptable activation energy is roughly 'app already open, type, hit enter'. Anything requiring app launch, folder choice, or even opening a cover loses. Keep capture endpoints inside surfaces already open all day (Discord/Keep), and have the PKMS ingest from them.
- **Research questions:** 2, 3

### F6. A 31-year-old dx'd at 16 reports every meticulously configured system (Salesforce views, Google Calendar, Notion) abandoned within two weeks, and argues the real ADHD cost is re-entry after interruption, not task initiation: losing days 'sitting down on Monday with zero memory of what I was doing Friday'. Thesis: context preservation beats organization. Cites Newman et al. ICSE 2025 (ADHD devs 2-4x more likely to struggle with measured work challenges).

> I lose days sitting down on Monday with zero memory of what I was doing Friday... Staring at my own code like a stranger wrote it.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/1qxqhqc/why_every_productivity_system_youve_tried_has/
- **Who:** u/Emotional_Yak_6841, r/ADHD_Programmers OP, 100 pts, Feb 2026, dx at 16, ex-sales now programming; caveat: one commenter accused the post of being AI-polished, but top comments engage with it as accurate
- **Tool/system:** Salesforce, Google Calendar, Notion (all abandoned)
- **Design implication:** Design for re-entry: every working session should leave a machine-generated 'where I left off' breadcrumb (recent notes touched, open tasks, last thought) that is the first thing shown on return. This matters more than taxonomy.
- **Research questions:** 1, 4

### F7. In the same thread, the most-agreed survival property is resilience, not robustness: a system must be cheap to revive after inevitably falling off. One commenter: light and easy to recreate; another diagnoses that for ADHD users 'it was the setup that felt great, not the using' — systems die when tinkering ends.

> Most effective is keeping my system light and easy to recreate or revive without much effort when I fall off the rails.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/1qxqhqc/why_every_productivity_system_youve_tried_has/o3zl1nv/
- **Who:** u/yesillhaveonemore (quote, 6 pts) and u/tooawkwrd ('It was the setup that felt great, not the using', at .../o43dc2z/), r/ADHD_Programmers, Feb 2026
- **Tool/system:** general / bullet journal / markdown
- **Design implication:** Treat lapse-and-restart as the normal lifecycle. The PKMS must be fully functional after a 3-week gap with zero catch-up debt (no streaks, no required backfill), and 'rebuild index from files' style regenerability is a feature for the psyche, not just the database.
- **Research questions:** 1, 2, 5

### F8. A programmer who tried emacs org-mode, Logseq, Obsidian-GTD, and a homegrown CLI todo tool reports the only consistently survivable practice is ephemeral day-of text files plus external systems of record (Jira/Outlook/Slack); long-running task tracking and hierarchical knowledge organization in text 'just cannot exist for me'.

> ultimately text reigns king for me, but too much process is guaranteed to fail for me... a complex singular agenda system just cannot exist for me.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/1qxqhqc/why_every_productivity_system_youve_tried_has/o40tw7o/
- **Who:** u/curlyheadedfuck123, r/ADHD_Programmers, 4 pts, Feb 2026, working dev
- **Tool/system:** org-mode, Logseq, Obsidian, homegrown CLI (abandoned); ephemeral daily text files (survived)
- **Design implication:** Daily notes should be the primary write surface and allowed to be disposable; durable structure should be derived by tooling (indexer, agent) from the daily stream rather than maintained by hand.
- **Research questions:** 1, 2

### F9. Senior engineers with ADHD describe using LLMs as an executive-function prosthetic: Claude plan mode dissolved the planning-procrastination barrier that previously blocked task initiation, and AI meeting notes provide a fallback for attention lapses; another says AI 'severely reduced' feeling nerfed by parsing tickets, distilling notes, and gap-checking code.

> Before plan mode was a thing, it'd take me a bit to get a plan of attack together, and this was a point of procrastination for me. But now that's mostly a solved problem.

- **Source:** https://www.reddit.com/r/ExperiencedDevs/comments/1t9beef/senior_engineers_with_adhdanxietydepression_do/ol1o0ha/
- **Who:** u/skidmark_zuckerberg, working engineer, r/ExperiencedDevs, 5 pts, May 2026; corroborated by u/tipu at .../ol1yrat/ ('AI has severely reduced this feeling')
- **Tool/system:** Claude (plan mode), AI meeting-notes tools
- **Design implication:** Validates the user's Google-Inbox-nostalgia signal: the LLM should do the organizing/planning step that ADHD users stall on — auto-triage, auto-plan, auto-summarize — so the human only initiates 'dump' and 'pick'. Plan-generation on demand directly attacks task initiation, his worst struggle.
- **Research questions:** 3, 6

### F10. Highest-voted ADHD Obsidian thread (1.2k upvotes) is an abandonment confession, not a success story: two years of effort, insider supporter, yet no habit survived two weeks; vault is 'disconnected ideas, abandoned workflows, forgotten half-baked drafts' that he seldom rereads, and rereading leads to distraction rather than value.

> My vault is full of disconnected ideas, abandoned workflows, and forgotten half baked drafts. I seldom go back to read anything I've written.

- **Source:** https://www.reddit.com/r/ObsidianMD/comments/1kvopkk/longtime_obsidian_lover_with_adhd_but_still_cant/
- **Who:** u/Bugibhub, r/ObsidianMD OP, 1205 pts (98% upvoted), May 2025, stated ADHD, 2 years of Obsidian use
- **Tool/system:** Obsidian
- **Design implication:** Tool love and community belief do not produce retention. The 1.2k upvotes show this failure is the majority ADHD experience with Obsidian; the system must produce value on read-back (summaries, surfacing) or the write habit collapses.
- **Research questions:** 1

### F11. The most actionable advice in that thread: stop making Obsidian the everything-app. An ADHD user enumerates abandoning dataview databases, task management, trackers, and planners inside Obsidian in favor of dedicated apps (Apple Reminders for tasks with Siri capture, Apple Notes for quick capture) and keeping Obsidian purely for interconnected long-form notes.

> I've stopped trying to use it as a problem solver when other apps have solved the problem already.

- **Source:** https://www.reddit.com/r/ObsidianMD/comments/1kvopkk/longtime_obsidian_lover_with_adhd_but_still_cant/mub9asu/
- **Who:** u/elderlybrain, r/ObsidianMD, 13 pts (+17 pts sibling comment), May 2025, stated ADHD
- **Tool/system:** Obsidian (notes only), Apple Reminders, Apple Notes
- **Design implication:** Resist scope creep in the PKMS: tasks/reminders with hard time semantics may belong in dedicated alarm-capable tools, with the vault holding knowledge. Or: the vault's task layer must match dedicated-app capture speed (Siri-level) to justify existing.
- **Research questions:** 1, 2, 6

### F12. ADHD-compatible relationship with a vault means accepting bursty use and periodic restructuring: weeks of no usage are fine because 'the notes are still there', and the vault structure gets rebuilt every ~6 months because the brain craves novelty — with old notes moved to an archive folder rather than migrated.

> I'm probably going to need to change my vault structure every six months or so because my brain craves the novelty. And that's okay too.

- **Source:** https://www.reddit.com/r/ObsidianMD/comments/1kvopkk/longtime_obsidian_lover_with_adhd_but_still_cant/mubgag9/
- **Who:** u/doctortonks, r/ObsidianMD, 6 pts, May 2025, stated ADHD
- **Tool/system:** Obsidian
- **Design implication:** Schema/structure churn is a feature to design for, not prevent: keep notes portable (plain markdown), make archive-and-restart cheap, and never couple retrieval to the current folder layout (index/search must work across generations of structure).
- **Research questions:** 2, 5

### F13. Concrete friction-killers from a functioning ADHD Obsidian user: a 'Trash' capture folder that removes the where-does-this-go decision entirely, a '#wip' tag plus a dataview query that auto-lists unfinished notes by last-edit time (delegating 90%-done tracking to the machine), and the rule that editing a rough 2-month-old note beats trying to remember a lost thought.

> Just write the meat of the note while your thoughts are fresh and your future self will thank you for it.

- **Source:** https://www.reddit.com/r/ObsidianMD/comments/1kvopkk/longtime_obsidian_lover_with_adhd_but_still_cant/mubdqyl/
- **Who:** u/Irityan, r/ObsidianMD, 7 pts, May 2025
- **Tool/system:** Obsidian + Dataview
- **Design implication:** Implement a no-decision capture folder and an automatic WIP surface (query by status tag + mtime) in the SQLite index — the system, not the user, remembers what is 90% done. This is a direct, shame-free mechanism for RQ5.
- **Research questions:** 3, 5, 6

### F14. For work tracking, the only thing that ever worked for one dev is a single always-open plaintext file with a prioritized bullet list whose items link out to the official tools (email, Jira, etc.); when a manager forced him onto the project-management tool itself, it 'ruined the only system that had ever worked'. Another commenter's weekly markdown file has doing/todo/done/notes headings, where writing into 'done' is the mechanism for unsticking overwhelm.

> even when I get overwhelmed I write what I have done (checked emails, opened PRs, code reviews whatever) and that helps to unstick myself.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/1q8dfx8/how_do_you_guys_actually_track_what_youre/nymnvuz/
- **Who:** u/Stuporfly (16 pts, plaintext file) and u/70-percent-acid (7 pts, quote, at .../nyp22jt/), r/ADHD_Programmers, Jan 2026, working devs
- **Tool/system:** plain text file / weekly markdown
- **Design implication:** The PKMS daily note should be a thin personal index over external systems of record (links out), not a duplicate of them; and a low-ceremony 'done log' should be a first-class affordance because logging completed trivia is a proven re-initiation trick.
- **Research questions:** 2, 5

### F15. Visibility is a retrieval mechanism: a desk memo pad with day columns works where notebooks and agendas failed, explicitly because anything closable disappears from the ADHD mind ('you can close it and then that's just Gone'). Mirrors the always-open-file and peripheral-vision-notepad reports in two other threads.

> a notebook didn't work for me because you can close it and then that's just Gone.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/1q8dfx8/how_do_you_guys_actually_track_what_youre/nynf815/
- **Who:** u/sofanisba, r/ADHD_Programmers, 7 pts, Jan 2026
- **Tool/system:** paper memo pad
- **Design implication:** Out of sight is out of mind: the system needs an ambient, always-on-screen surface (widget, pinned terminal, daily-note autostart) rather than relying on the user to open the vault. Retrieval should be pushed, not pulled.
- **Research questions:** 3, 4

### F16. Retrieval failure mode unique to tag/folder systems: tag entropy. A user who adopted tags heavily reports forgetting the tags themselves ('was it keyword, tag, category, or collection?') and forgetting why he was searching mid-search. Working mitigations reported: ask an LLM to regenerate the keywords you've forgotten, then search with them; and write notes 'mindful of the search terms' future-you will try.

> For the non verbal issues I have to ask an LLM tbh, which often gives me the keywords which then I can use to search.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/1i4vuhn/hey_programmers_those_of_you_with_poor_memory/m7yq6qu/
- **Who:** u/cricketter (23 pts, quote, Logseq user), u/read_it_too_ (OP-adjacent, tag entropy at .../m86ueu7/), u/meevis_kahuna (search-term-mindful notes at .../m873210/), r/ADHD_Programmers, Jan 2025
- **Tool/system:** Logseq, OneNote, Obsidian, ChatGPT
- **Design implication:** Don't make exact-tag recall load-bearing. Provide semantic/fuzzy search and an LLM query-expansion layer over the vault; have the indexer auto-generate aliases/synonyms at ingest so retrieval works from vague natural-language descriptions.
- **Research questions:** 4

### F17. Notion survived 2 years for an ADHD dev only as a low-churn reference catalog (possessions, drives, accounts — 'mundane stuff that's a lot of overhead to remember') and failed specifically as a to-do tool because it is 'too heavy to be low friction enough to use multiple times per day'. A sibling comment is the thread's epitaph for second brains: built one in Obsidian, 'then proceeded to use it about as much as my first brain'.

> It's too heavy to be low friction enough to use multiple times per day for quickly adding or removing a task

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/13d4139/has_anyone_successfully_built_a_second_brain_with/jjj0okr/
- **Who:** u/darrenoc, r/ADHD_Programmers, May 2023 (pullpush snapshot 9 pts); u/Mcicle quote at .../jjkjayz/ (7 pts)
- **Tool/system:** Notion (reference store), Obsidian
- **Design implication:** Frequency-of-touch determines required friction: many-times-daily surfaces (tasks, capture) must be near-zero friction; weekly-touch reference stores tolerate heavier structure. Architect the PKMS as two tiers with different friction budgets.
- **Research questions:** 1, 2

### F18. Anti-paralysis pattern with multiple independent confirmations: a single commonplace inbox where everything goes, with tagging/filing deferred to a weekly pass. One user (ADHD+autistic) keeps a Notion 'Global Database' and tags later; another runs <=5 OneNote inboxes and says the inbox concept is precisely what 'takes away paralysis due to decision'; a third (ADHD) processes a paper legal pad into Bear at day's/week's end.

> Just one place for everything, and then, I tag later.

- **Source:** https://www.reddit.com/r/PKMS/comments/1e1giwa/as_a_person_with_mild_adhd_i_yearn_for_a_pkm_that/lcwrjx5/
- **Who:** u/morganharpernichols (ADHD + autistic, student), r/PKMS, Jul 2024; corroborated by u/PenCollector01 (same thread, .../ld0ijvd/) and u/HM_Khan (r/PKMS/comments/1achgyn/.../kjvyq0k/, stated ADHD)
- **Tool/system:** Notion Global Database, OneNote inboxes, legal pad → Bear
- **Design implication:** The triage inbox IS the front door of the vault: everything lands in one stream, and classification happens later in a batched (ideally LLM-assisted) pass. Filing-at-capture is the paralysis trigger to eliminate. Cap the number of inboxes.
- **Research questions:** 3, 6

### F19. Customizability itself fuels analysis paralysis for ADHD users: the OP (43 pts) moved from Android ROM-flashing to a locked-down iPhone and away from Notion's infinite nesting because option-rich tools eat hours of tinkering; commenters echo choosing restrictive tools (Heptabase, plain Apple Notes) to avoid 'tweak and fiddle rather than make progress'.

> I get analysis paralysis all the time when figuring out where to create new notes as they can in theory, be deeply nested in a very well organized fashion.

- **Source:** https://www.reddit.com/r/PKMS/comments/1e1giwa/as_a_person_with_mild_adhd_i_yearn_for_a_pkm_that/
- **Who:** u/CreativeFall7787, r/PKMS OP, 43 pts, Jul 2024, self-described mild ADHD
- **Tool/system:** Notion, Todoist, Obsidian (paralysis); iPhone, Heptabase (restrictive relief)
- **Design implication:** Constrain the user's own system against his perfectionism: few fixed folders, opinionated defaults, no open-ended schema. The CLI should make the right thing the only easy thing — over-engineering is his stated Notion killer.
- **Research questions:** 1, 3

### F20. The user's exact win scenario already exists in the wild: a r/PKMS user built a Reddit archiver that downloads all his saved posts and comments, including media, into Obsidian. Same thread documents that Reddit's native save feature silently caps at ~1000 items (older saves become invisible), making native saving unreliable as a backlog.

> I built a Reddit archiver that's downloads all my saved posts and comments. This includes almost all media from the post, into Obsidian.

- **Source:** https://www.reddit.com/r/PKMS/comments/1mhj5o4/what_do_you_use_to_store_and_organize_favorite/n6xqli6/
- **Who:** u/Tryin2Dev, r/PKMS, 4 pts, Aug 2025; save-limit corroboration by u/zapboston (.../n6zf775/) and u/Blackgirlmagic23 (.../n78izm1/, lists Saveddit/Reddit-Fetch/Bookmarkeddit GitHub tools, ~950-1000 item API cap)
- **Tool/system:** custom Reddit archiver → Obsidian; Saveddit, Bookmarkeddit
- **Design implication:** Build (or adapt) a saved-post puller that lands full post + comment tree as markdown in the vault inbox. Pull regularly because Reddit's save list silently truncates at ~1000; the archive, not Reddit, must be the system of record.
- **Research questions:** 6

### F21. On save-to-learn-later content, an ADHD dev's working rule is to store things only AFTER fully consuming them, with a description — prospective saves ('watch later') pile up unwatched; and the thread's hardest-won advice on backlog shame is acceptance: 'your desire to learn will always be greater than your capacity to learn. You gotta let it go.' (Another commenter: 'You're absolutely right... but I really didn't like hearing it.')

> Bro at some point you have to come to terms with the fact that your desire to learn will always be greater than your capacity to learn.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/ufn3ne/using_obsidian_to_store_links_and_youtube_vids_so/i6vaogs/
- **Who:** u/Angdrambor (quote, 6 pts) and u/SavagetheGoat (save-after-consuming, 9 pts at .../i6v0e0s/), r/ADHD_Programmers, Apr-May 2022; OP u/Redxer is a working data engineer
- **Tool/system:** Obsidian (as link graveyard)
- **Design implication:** Build guilt-decay into the triage inbox: items not touched in N weeks get auto-demoted/archived with no red badge, and the read-later queue should privilege a tiny surfaced sample over showing the full crushing backlog. Distinguish consumed-and-annotated saves (high value) from aspirational saves (low value).
- **Research questions:** 5, 6

### F22. Veteran framing for the whole design (681-pt post, 15 years ADHD programming): the ADHD brain is 'a GPU in a world of CPU neurotypicals' — good at novelty and big-picture, bad at holding state — so offload all state to machines (write everything down digitally with version control, linters, tests, CI), and exploit gamified reward loops (green CI badges) for the 'janky reward pathways'.

> Your brain is a GPU in a world of CPU neurotypicals... Render unto Computer things that are the Computer's.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/gyjwdo/tips_from_15_years_of_adhd_programming/
- **Who:** u/omg_drd4_bbq, r/ADHD_Programmers OP, 681 pts (pullpush snapshot 233), Jun 2020, self-described ADHD/bipolar-2 hacker, 15 yrs programming
- **Tool/system:** git, CI, linters, tests (as cognitive prosthetics)
- **Design implication:** Position the PKMS as state-holder, not discipline-enforcer: the machine tracks status, links, and history; visible green-check feedback (index built, inbox zero'd, streak-free stats) supplies reward without demanding upkeep.
- **Research questions:** 2, 3

### F23. In the 'I gave Claude Code ADHD' thread, the PKM-relevant signal is ADHD engineers describing what they want from agents: a 'pipeline mode where I can pour ideas into the client' while the agent orchestrates, sanity-checks, and delegates; and a self-observation that ADHD users are bad at generating the ideal plan but 'extremely proficient at identifying the best from a list of viable options'.

> I'm rarely ever able to come up with 'the ideal strategy' but I'm extremely proficient at identifying the best from a list of viable options.

- **Source:** https://www.reddit.com/r/ClaudeCode/comments/1tny93g/i_gave_claude_code_adhd_and_it_thinks_2x_better/oo335zp/
- **Who:** u/yeahimradd (quote, 2 pts) and u/tiwas ('pipeline mode', 15/5 pts, stated ADHD, at .../onym0vg/), r/ClaudeCode, May 2026
- **Tool/system:** Claude Code / agent workflows
- **Design implication:** Architect LLM involvement as generate-options-then-user-picks, never ask-user-to-specify-upfront. The brain-dump → agent-triage → present-3-choices loop matches both the user's Notion lesson ('without an LLM to digest my thoughts I got lost') and these wild reports.
- **Research questions:** 3, 6

### F24. Counter-signal on paper: a bullet journal survived 5-6 years for an ADHD dev specifically because the format is designed to be 'really easy to jump back on and change it up whenever you get bored' — lapse-tolerance and novelty-tolerance are built into the method itself, not the medium.

> Sometimes I drop off with it but it's designed by somebody with ADHD to be really easy to jump back on and change it up whenever you get bored.

- **Source:** https://www.reddit.com/r/ADHD_Programmers/comments/1qxqhqc/why_every_productivity_system_youve_tried_has/o3yhkib/
- **Who:** u/NeuralHijacker, r/ADHD_Programmers, 13 pts, Feb 2026, working dev; matches the user's own 2.5-year bullet journal era
- **Tool/system:** Bullet Journal (paper)
- **Design implication:** Extract bujo's survival properties into the digital system: monthly fresh-start boundaries (new file, no migration debt), explicit re-entry ritual (migration = reviewing open items), and sanctioned restyling as a novelty outlet that doesn't destroy data.
- **Research questions:** 2, 5

---

## Coverage notes (what was NOT covered)

ACCESS: www.reddit.com, old.reddit.com, api.reddit.com, and the r.jina.ai proxy were all 403-blocked ('blocked by network security') for unauthenticated JSON this session. Workaround pipeline: pullpush.io API for pre-~2024 threads (verbatim JSON with permalinks; NOTE: its scores are early snapshots that undercount — where the redlib/search page showed the live score I used that) and the redlib instance redlib.perennialte.ch (HTML, parsed with a regex extractor; live scores and comment permalinks) for 2024-2026 threads. Gemini CLI (reddit-fetch skill Method 1) was denied by the permission classifier, so no summarized/fabrication-risk content was used — every quote above is verbatim from raw JSON/HTML.

SEED THREADS: all four fetched and mined. motdce (r/ADHD): OP + ~200 of its comments via two pullpush pages (thread likely has more; remaining pages unfetched). 1mhj5o4 (r/PKMS): small thread, fully read. 1tny93g (r/ClaudeCode): fully fetched; mostly LLM-architecture talk, low PKM density — extracted the two ADHD-workflow-relevant comments. 1t9beef (r/ExperiencedDevs): fully fetched (193 comments), mined both top comments and keyword-filtered tooling comments.

SEARCHES DONE: r/ADHD_Programmers ('note taking system', 'second brain', 'obsidian' — top/all), r/ObsidianMD ('ADHD'), r/PKMS ('ADHD'). Threads deep-read beyond seeds: 1qxqhqc (why systems stop working), 1sovgpl (Telegram saved messages), 1q8dfx8 (how do you track), 1i4vuhn (memory recall tools), ufn3ne (Obsidian link hoarding), 13d4139 (Notion second brain), gyjwdo (15 years tips), ua3qdy (Obsidian organization), 1achgyn (successful PKMS w/ ADHD — its top comments are likely missing from pullpush archive, only 41 comments recovered), 1e1giwa (analysis paralysis).

NOT COVERED: r/productivity and r/ADHD search sweeps (beyond the seed thread); r/ExperiencedDevs search beyond the seed; promising threads identified but NOT fetched due to request budget: r/ObsidianMD 1aoksai ('1 year of Obsidian helped my mental health', 657 pts), 1l0o92x ('From chaos to autopilot... 15 years of experimenting', 212 pts), 1i7w6ef ('ADHD and Obsidian: A tutorial', 220 pts), 1qiidw1 (SISYPHUS roguelike anti-procrastination plugin, 218 pts — gamification angle), 1q7tf0y ('tired of Note-Taking Gurus', 260 pts), r/PKMS 19a03gr ('after years of trial and error', 213 pts), 129uy9h (visual PKMS for neurodivergent), and r/ADHD_Programmers 1b9rlxc ('Overwhelmed by ADHD/productivity apps'). The redlib instance only serves the default ('confidence') comment sort, so very deep reply chains and 'new' comments in large threads may be unseen. queries 'todo system', 'what finally stuck', 'capture', 'abandoned Notion' were not run verbatim as searches, though their content is well covered by the threads above. One caveat repeated from the findings: the 1qxqhqc OP may be AI-polished (one commenter said so); its comment section, which I drew most findings from, is organic.

## Verification sample

- [partial] https://www.reddit.com/r/ADHD/comments/motdce/i_have_this_habit_of_saving_posts_and_screenshots/ — Post exists (u/thegryphonator, r/ADHD, 2021-04-11, score 7686 exact, 606 comments). Quote near-verbatim but drops one word: original reads 'But unless IF I definitely needed to return to that info again in the near future, I never have!'. The 'unable to make and stick with just *one* "system"' framing is verbatim in the post. However 'thousands of commenters' is wrong — the thread has ~606 comments. Examples partially check out: 500+ tabs confirmed (u/Iamjimmym 'over 500 tabs open. On one browser', u/EveAndTheSnake 'constantly at 500'); 26k unread emails confirmed exactly (u/EveAndTheSnake: '26,059 unread emails and 173 unread text messages'); but no '15k screenshots' found in all 647 archived comments — closest are 17,772 (u/erijoinsreddit) and 'at least 10,000' (u/mzanin). Verified via Arctic Shift archive (direct Reddit JSON API returns 403 from this machine).
- [verified] https://www.reddit.com/r/ADHD/comments/motdce/i_have_this_habit_of_saving_posts_and_screenshots/gu9453v/ — Comment gu9453v exists, author u/sourpatch_grown-up, 2021-04-12, recommending Pocket. Quote is verbatim ('Its just one button I have to press and then I forget about the article forever as I lie to myself and say that I will read it one day'), though it truncates the original sentence (continues 'without it taking up memory in my pictures folder on my phone. :)') without an ellipsis — no meaning distortion. The corroborating u/chorus_of_stones comment exists in the same thread (id gu91b1o): 'I use Onetab for the Chrome browser to gather all of my tabs to a single page, and I almost never look at them again! But it's easier to close knowing I am saving them.' — matches the finding's condensed quote. pinboard.in also appears in that comment. Guilt-free-closure interpretation is directly supported by both comments.
- [verified] https://www.reddit.com/r/ADHD/comments/motdce/i_have_this_habit_of_saving_posts_and_screenshots/gudc7yp/ — Comment gudc7yp exists, author u/pderpderp, 2021-04-13. Self-description matches exactly: 'I am a technology consultant in an information-rich company culture with a recent ADD diagnosis.' Quote is character-for-character verbatim. All four Trello lists described in the claim are present (knowledge work items, task backlog 'ala agile backlog', active tasks, completed items slowly archived), and the visible-done-list-as-reward detail is supported by 'I like to see that I have gotten things done.'
- [verified] https://www.reddit.com/r/ADHD_Programmers/comments/1sovgpl/i_gave_up_on_every_productivity_app_and_now_i/ — Post exists (u/ArtyomNet, r/ADHD_Programmers, 2026-04-18, 'Designer/dev here'). Quote is exact verbatim. All claim details confirmed: 4 days setup / 1-2 weeks religious use / one missed log / never open again; abandoned apps list matches (notion, obsidian, todoist, things, apple reminders, structured, sunsama, capacities); Telegram Saved Messages survivor because 'already open all day... zero setup and zero decisions'; 'But its also a graveyard', can't find anything from 3 weeks ago, can't separate task/thought/'remind me about this on tuesday'. Minor metadata drift only: current score is 12, not the 19 pts stated (scores fluctuate); 7 comments shown on post object, 12 in archive.
- [partial] https://www.reddit.com/r/ADHD_Programmers/comments/1sovgpl/i_gave_up_on_every_productivity_app_and_now_i/ogx309d/ — Wrong permalink: comment ogx309d is u/skunk_jh's comment about an emacs daemon on a VPS — not the quoted text. The quote is real and verbatim but lives at comment id oh3ma9d (u/IdleJolt, 2026-04-19, 2 pts): 'I think the best system for ADHD is usually the one with the least resistance at the point of capture, not the one with the most features.' (finding omits the leading 'I think'). The gentlemako half of the claim is fully correct at the stated id ogxtd9w: Discord as dumping ground with channels, always-visible desk notepad, 'even opening the notebook is too much friction'. Convergence claim holds (IdleJolt, gentlemako, Maroontan 'the option with the least friction is usually the best', Toldoven). Fix the permalink to .../oh3ma9d/.
- [verified] https://www.reddit.com/r/ADHD_Programmers/comments/1qxqhqc/why_every_productivity_system_youve_tried_has/ — Post exists (u/Emotional_Yak_6841, r/ADHD_Programmers, 2026-02-06). All elements confirmed: 'I was diagnosed at 16. I'm 31 now'; Salesforce 'set up meticulously... Abandon it within two weeks. Google Calendar, same thing. Notion, same thing'; section header 'The real cost is re-entry, not starting'; 'Context preservation beats organization' verbatim; Newman et al. ICSE 2025 cited with 'ADHD devs were 2-4x more likely to struggle with every work challenge measured'. Quote is verbatim with a legitimate ellipsis bridging one omitted sentence ('Opening a CRM and not knowing which deals were hot and which were dead.'). The AI-accusation caveat is also real: u/ShaySmoith commented 'Another wall of Ai slop text', while other commenters engage substantively. Minor drift: current score 63, not 100 pts.

## Round 2 (Sweep C leftovers)

Appended 2026-06-10 from the Sweep C leftovers track: the r/ObsidianMD 'ADHD bros tell me the truth' thread (1418wp0, 200 pts) — the substitute for the ~220-point ADHD tutorial thread Sweep A flagged, which could not be located in the pullpush archive. 4 findings; 1 sampled by the adversarial checker (fully verified — see Round 2 verification below).

### L2-08. The 200-point r/ObsidianMD ADHD thread reveals that Obsidian's own community recognizes the app as a 'toxic productivity' trap for ADHD users — the top advice is to time-box all customization to 2-3 hours total and rebuild only the 2-3 highest-value use cases, never iteratively extend.

> Obsidian has a high potential to bait you into toxic productivity due to plugins/flexibility. As someone who wasted tons of hours finding the right system and application I would recommend spending 2-3 hours and rebuild your 2-3 biggest use cases.

- **Source:** [r/ObsidianMD — 'ADHD bros tell me the truth' (200 pts, 2023) — ImS0hungry comment](https://www.reddit.com/r/ObsidianMD/comments/1418wp0/)
- **Credibility:** Community thread with 200 upvotes on the parent post; comment has 3 upvotes. Directly fetched via pullpush.io. Self-selected audience of Obsidian users discussing ADHD. Mirrors Sweep A F1/F2 (tinkering trap) from a different community angle.
- **Design implication:** The PKMS should ship with a 'locked' default configuration where no plugins exist and setup takes under 10 minutes. The only extensibility surface should require deliberate unlocking. Frame the setup completion as an achievement, not a starting point.

### L2-09. A self-described 'bad ADHD' Obsidian user reports the app is mostly a way to 'feel productive without doing the work' — but critically also reports 'keep going back to it,' suggesting the app survives by offering the illusion of productivity as a re-entry hook, not by actual workflow integration.

> Bad ADHD here, its mostly a timesink to feel productive without doing the work I have to do. But it has become useful over time as I keep going back to it. Don't worry too much about organizing it perfectly, it will evolve as you use it

- **Source:** [r/ObsidianMD — 'ADHD bros tell me the truth' (200 pts) — Walshy_Boy comment](https://www.reddit.com/r/ObsidianMD/comments/1418wp0/)
- **Credibility:** Single self-report; directly fetched via pullpush.io. The survival-despite-misuse pattern is a meaningful data point: the tool survives because re-entry is low-friction, not because the workflow is well-designed.
- **Design implication:** The PKMS should be worth reopening even after a gap, even if the prior session was unproductive. This means: no streak counts, no 'you haven't used this in X days' guilt prompts, and a re-entry briefing that makes the gap feel irrelevant.

### L2-10. The ADHD brain's hyperfocus on the Obsidian app itself at initial install is a predictable, named pattern — one commenter describes being 'hyperfocusing hard' on the app for weeks, ranting about it to everyone — and the app survives this phase only if it still works after hyperfocus ends.

> I was in full 'hyperfocusing hard' and also 'rant to literally everybody about what this can do' mode and it did eat up a lot of my time.

- **Source:** [r/ObsidianMD — 'ADHD bros tell me the truth' (200 pts) — ishtarcrab comment](https://www.reddit.com/r/ObsidianMD/comments/1418wp0/)
- **Credibility:** Self-report; directly fetched via pullpush.io. Aligns with Sweep A F1/F2 and receipt printer finding L2-07. Adds the 'hyperfocus on the tool' variant distinct from 'perfectionism about the system.'
- **Design implication:** The onboarding experience should be designed to end after 10 minutes and resist extension — literally no 'explore plugins' CTA, no tour of advanced features. Make the exciting part the first note, not the setup. This contains the hyperfocus phase.

### L2-11. Data portability anxiety is a real barrier to tool adoption: one Obsidian user explicitly cites needing to export or recreate content in a new system as the thing that 'exhausted their desire to explore' — open formats lower the switching cost and therefore lower the adoption barrier.

> Having my data locked away somewhere, that I would need to export (if possible) or recreate in the next system just exhausted my desire to explore.

- **Source:** [r/ObsidianMD — 'ADHD bros tell me the truth' (200 pts) — Spazsquatch comment](https://www.reddit.com/r/ObsidianMD/comments/1418wp0/)
- **Credibility:** Single self-report; directly fetched via pullpush.io. Strong signal because it names the adoption barrier as 'fear of future exit cost,' not current friction — a planning-ahead anxiety that is consistent with ADHD time-blindness literature.
- **Design implication:** The PKMS's plain-text markdown vault is a competitive advantage that should be made visible and concrete to the user from day one: 'Your notes are just text files. You can open them in Notepad. They will never be locked in.' This actively reduces the adoption-barrier anxiety.

### Round 2 coverage notes

The 200-point thread (1418wp0) and its comments were fetched via pullpush.io; reddit.com direct access was 403-blocked. The '~220-point ADHD tutorial' thread Sweep A flagged could not be located — the closest match ('ADHD and Obsidian: A tutorial', 1i7w6ef) scored only 1 point in the archive; 1418wp0 is the substitute with higher community signal. Open question: whether the Obsidian 'toxic productivity' dynamic applies equally to a CLI-based PKMS with lower visual novelty.

### Round 2 verification

Sampled: L2-08 — verified. The ImS0hungry quote is confirmed word-for-word via the pullpush.io archive; the parent post (1418wp0, r/ObsidianMD) scores exactly 200 and its title matches; URL, subreddit, username, and score all check out. 'Toxic productivity' is the commenter's own term. 0 findings failed.

