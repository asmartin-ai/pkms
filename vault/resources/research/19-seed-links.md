---
title: Seed sources — user-provided links, mined
created: 2026-06-10
modified: 2026-06-10
tags: [research, adhd, pkms-design, seed-sources, capture, triage]
status: draft
---

# 19 — Seed sources: user-provided links, mined

Findings from mining the user-provided seed links: the Hacking Your ADHD podcast back-catalog (6 full transcripts), the seed Reddit image, and re-checks of the seed Reddit threads with different fetch slices. 12 findings; 3 sample-verified by an adversarial fact-checker, 1 flagged.
Program: [[00-ground-truths]] - Synthesis target: [[10-synthesis]]

## Top takeaways

1. **Capture must open already-in-a-textbox (the Drafts pattern) AND deliver an instant "saved, safe" security feeling** — that feeling, not future reading, is what the user is buying at save time (SD1, SD8). The system then owns "later" via scheduled resurfacing, because a save never re-presented is a broken promise.
2. **Don't measure unread captures as failure.** The act of saving is itself cognitive offload with some lab backing (SD9), and rare rediscovery moments are the habit's real reward (SD10) — so spec a deliberate-serendipity card and semantic search over OCR'd screenshots instead of re-open-rate guilt.
3. **Trust is the load-bearing variable for both to-do lists and read-later queues** (SD3, SD4): queues stay alive only when consumption is scheduled into a recurring ritual and intake is choosy; project-shaped items must get LLM-expanded context at triage or they rot into opaque entries like "garden project".
4. **Never depend on a habit forming.** ADHD routines can evaporate on day 91, so reliability comes from forcing functions placed in already-traveled paths (terminal autostart, agent-opened reviews) — the Good-Brain-Day self builds scaffolding for the Bad-Brain-Day self (SD5).
5. **The LLM interaction grammar that works: present-then-ask** (draft first, one clarifying question at a time, never a blank prompt — SD6), and for tasks the human-harness grammar — one next action with time estimate, Done/Stuck/Not-now, full list hidden, guilt-free deferral (SD12). Passive "you're off track" observers die in 15 minutes.

---

## Findings

### SD1. William Curb's surviving mobile capture tool is Drafts, chosen for exactly one property: it opens directly into a blank writing surface, because the seconds spent navigating an app and creating a new note are enough to lose the thought entirely.

> What makes Drafts incredible it opens to a blank page every time I open it. This feature alone sold me on the app because I can't tell you how many times I've had an idea that I wanted to write down only to lose my train of thought in the process of opening up an app and creating a new note.

- **Source:** [Hacking Your ADHD — How to Make your Smart Phone ADHD Friendly (Part 2)](https://www.hackingyouradhd.com/podcast/how-to-make-your-smart-phone-adhd-friendly-part-2), William Curb, 2020-01-27 (full transcript fetched)
- **Credibility:** First-person practitioner account from a dedicated ADHD-strategies podcaster (self-identified ADHD); single anecdote but converges exactly with Sweep A's win+n finding (F4) and the Telegram/Discord survivor pattern.
- **Design implication:** The Pixel 6 capture entry point must open already-in-a-textbox — a homescreen widget/share-target that lands keyboard-up in an empty buffer, zero taps between launch and typing. Any "new note" ceremony fails the bar.

### SD2. Curb names the universal note-system failure mode — forgetting captured notes exist — and his working fix is structural: a standing weekly review slot that includes reading the capture buffer, plus a routing rule that anything time-sensitive must NOT live in notes but in a reminder/calendar with an explicit cue.

> I love having the space to write down my ideas, but the biggest pitfall of any note-taking system is that easy to forget that you ever wrote them down in the first place. Sometimes I'd hear something in a podcast that I wanted to check out later, so I'd jot a quick note, and then it'd disappear into a vortex of me never looking at my notes.

- **Source:** [Hacking Your ADHD — How to Make your Smart Phone ADHD Friendly (Part 2)](https://www.hackingyouradhd.com/podcast/how-to-make-your-smart-phone-adhd-friendly-part-2), William Curb, 2020-01-27 (full transcript fetched; "that easy to forget" is a typo present in the source)
- **Credibility:** Practitioner anecdote with a concrete operating rule he still uses ("I just include that in my weekly reviews on Fridays now"); matches Sweep A's write-only-graveyard findings (F13/F14) from the other direction — a survivor's countermeasure.
- **Design implication:** Two-channel capture semantics: the inbox digest must be wired into a recurring ritual the system itself schedules (e.g., the Friday review opens the unread-capture queue automatically), and capture should offer a one-keystroke "this is time-sensitive" escape hatch that creates a dated reminder instead of a note.

### SD3. Curb's read-later system (Pocket) died the canonical death — endless adds, zero reads — and he frames the mechanism as loss of system trust (a GTD idea he keeps while judging GTD itself not ADHD-friendly); trust is only restored by scheduling consumption time and being choosy about what is allowed into the list.

> When I first started using Pocket I would drop in article after article after article and then I wouldn't read any of them... well unless I was stuck somewhere like a plane and didn't have anything else to do. Which means, I stopped trusting that system. Why bother adding articles to it if I'm not going to read them.

- **Source:** [Hacking Your ADHD — Digital Declutter: Tabs, Tabs, And more Tabs](https://www.hackingyouradhd.com/podcast/digital-declutter-tabs-tabs-and-more-tabs), William Curb, 2021-02-22 (full transcript fetched)
- **Credibility:** Practitioner anecdote; the "trust your systems" framing is borrowed from GTD but the failure story is first-person. Episode also states verbatim that he's "found that the system [GTD] isn't exactly ADHD friendly." Strongly corroborates Sweep A Reddit F2 (guilt-free closure saves).
- **Design implication:** The triage inbox earns trust only if consumption is scheduled, not aspirational: pair the saved-post pipeline with a recurring "deep reading" block that surfaces a small sample, and add gentle intake friction (choose-on-save: read-soon vs reference vs let-go) so the queue stays credible rather than crushing.

### SD4. Curb's diagnosis of abandoned to-do lists: brain-dump lists become massively long dumping grounds, and the specific rot vector is entire projects entered as single opaque tasks whose context evaporates — he later cannot even tell which "garden project" an entry referred to.

> And what I often find with my abandoned to-do lists is that they are just massively long. It just became this massive dumping ground of ideas that I felt needed to go on the list.

- **Source:** [Hacking Your ADHD — Slowing Down: Task Management (Memory)](https://www.hackingyouradhd.com/podcast/slowing-down-task-management-memory), William Curb, 2023-02-06 (full transcript fetched)
- **Credibility:** Practitioner essay-episode, no external evidence cited, but converges with Sweep A HN F5/F6 (backlog death spiral) and adds the projects-as-tasks context-loss mechanism. The "garden project" line is verbatim in the transcript.
- **Design implication:** At triage time (not capture time), the LLM pass should expand any project-shaped item into a note carrying what-done-looks-like and a concrete next step — because an entry without stored context is already dead; and the dump stream must stay separate from the curated active list it feeds.

### SD5. The podcast's 2026 thesis episode argues ADHD habit loops never reach autopilot because reward chemistry is inconsistent — a routine done 90 days straight can evaporate on day 91 — so reliability must come from external scaffolding (forcing functions, environment design) built by your good days to serve your bad days; it also warns that 20 competing reminder-triggers become background wallpaper.

> It was never truly on autopilot; it was just a high-effort routine. You were burning executive function to force it to happen.

- **Source:** [Hacking Your ADHD — Scaffolding the ADHD Brain: How Habits Fail and Systems May Save Us](https://www.hackingyouradhd.com/podcast/scaffolding-the-adhd-brain-how-habits-fail-and-systems-may-save-us), William Curb, 2026-05-29 (full transcript fetched)
- **Credibility:** Practitioner synthesis episode (episode 298), no citations given for the brain-chemistry claims — treat the neuroscience as folk-model, but the design heuristics ("a system is a recurring solution to a recurring problem"; "A well-designed system is ultimately an act of self-kindness. It's a gift that your 'Good Brain Day' self builds to protect and support your 'Bad Brain Day' self." — both verbatim) align with Sweep A F17 (spec against the worst state) and Sweep B Barkley externalization.
- **Design implication:** Never make the PKMS depend on a daily habit forming. Build forcing functions into existing paths (terminal autostart shows the daily note; the agent opens the review, not the user) and ration attention triggers ruthlessly — one ambient surface, not N notifications.

### SD6. Curb's core LLM technique for ADHD planning is inverting the interaction: he works better from something that already exists than from a blank page, so he has the model generate a draft and then asks the model to interview HIM — one question at a time to avoid overwhelm — rather than writing specifications upfront.

> One of the things that I notice about my ADHD is that I'm better working from something that already exists than from a blank page.

- **Source:** [Hacking Your ADHD — Outsourcing Executive Function with AI](https://www.hackingyouradhd.com/podcast/outsourcing-executive-function-with-ai), William Curb, 2024-09-02 (full transcript fetched)
- **Credibility:** Practitioner account; the ask-me-questions-one-at-a-time prompt pattern is described concretely with examples ("where I find making these models really shine is not from what they initially provide but from asking the model to ask you questions" — verbatim). Independently converges with Sweep A Reddit F23 (bad at generating plans, great at picking from options).
- **Design implication:** Every LLM touchpoint in the PKMS should present-then-ask, never ask-then-wait: triage proposes a classification and asks one confirming question; resume proposes the next action; queries against the vault return a draft answer plus one clarifier. No blank prompt boxes.

### ⚠ UNVERIFIED: SD7. The seed image (i.redd.it/p7p9og967o4h1.jpeg, recovered and read) is a Tumblr screenshot of an Ada Powers (@mspowahs) tweet reframing ADHD as goal-directedness failure plus rejection sensitivity — and the artifact itself is a live specimen of the user's meme-screenshot capture habit: emotionally resonant framing saved as a lossy JPEG with no text, no source, no retrievability.

> ADHD is the most poorly-named affliction ever. like hi do you have a profound physical inability to accomplish your goals specifically because they're your goals and also the thought of your friends not liking you makes you want to die? you may have Trouble Sitting Still Disorder

- **Source:** [Seed image — i.redd.it/p7p9og967o4h1.jpeg](https://i.redd.it/p7p9og967o4h1.jpeg) — Tumblr screenshot (premed-with-adhd reblog of @mspowahs tweet, with brawltogethernow tag commentary), 736x736 JPEG fetched via CDN during research
- **Checker's note:** The i.redd.it URL was blocked at verification time, so the image-level claims (Tumblr screenshot framing, the reblog chain, the 736x736 JPEG detail, the tag commentary "#it's so obvious they named it based on how we inconvenience them rather than what it actually does to us") could not be independently confirmed. The core Ada Powers tweet text IS confirmed real via indexed X.com results. Kept because the researcher reports transcribing the image directly this session; treat the framing/reblog details as single-witness.
- **Credibility:** A meme, not evidence — its research value is as a user signal (what he chose to save), and the verbatim text was transcribed from the actual image during the research session.
- **Design implication:** Two consequences: (a) the system's framing must assume self-imposed goals are the weakest motivator — external structure, novelty, and accountability carry the load, never "because you said you would"; (b) image captures like this one need OCR-to-text at ingest, or they are permanently unsearchable — the indexer should extract and store text from screenshots.

### SD8. The highest-scoring tool-relevant comment in the seed r/ADHD hoarding thread (267 pts, missed by Sweep A's partial fetch) names the precise psychology of saving: it is a security transaction that licenses moving on without guilt — and the author's inventory (247 tabs, 1000+ screenshots, 500 watch-later videos) shows the license is always exercised and the debt never repaid.

> I think it's just a security feeling like "yes that's saved not lost forever I can move onto the next thing without feeling guilty or worrying about forgetting about it for later" then later never comes and you forget it exists

- **Source:** [u/Kobeone3, r/ADHD "I have this habit of saving posts and screenshots"](https://www.reddit.com/r/ADHD/comments/motdce/i_have_this_habit_of_saving_posts_and_screenshots/gu5wfel/) (7686-pt thread), Apr 2021, 267 pts (pullpush snapshot)
- **Credibility:** Highest-scored comment in the top-100-by-score fetch of the thread; self-report in a dx-gated sub. Strengthens Sweep A F2 (guilt-free closure) with the explicit "security feeling" mechanism and the strongest vote count.
- **Design implication:** Honor the transaction instead of fighting it: capture must deliver the security feeling instantly ("saved, safe, searchable" confirmation), and the system — not the user — assumes responsibility for "later" via scheduled resurfacing; a save the system never re-presents is a broken promise the user has already priced in.

### SD9. A commenter in the same thread reframes the never-revisited hoard as cognitively functional, citing research that the act of saving itself frees working memory for the next thing — meaning capture has intrinsic value even at a 0% re-open rate.

> Even if you never revisit the information, the act of "saving it" helps your brain "save it" too! I have the same with note taking. I literally never review my note book, but I don't really need to. Just writing shit down, photographing whiteboards, screenshotting conversations helps me a lot with memory retention.

- **Source:** [u/Fuschiznick, r/ADHD motdce thread](https://www.reddit.com/r/ADHD/comments/motdce/i_have_this_habit_of_saving_posts_and_screenshots/gu6m1hn/), Apr 2021, 7 pts; links the [saving-enhances-memory study summary](https://www.sciencedaily.com/releases/2014/12/141210080740.htm)
- **Credibility:** Low-score comment but cites an actual study (Storm & Stone 2014, "saving... may improve our memory for the information we encounter next" per the linked ScienceDaily summary, which the comment quotes); the lab finding is about offloading benefiting NEXT encoding, so the commenter's "retention of what I wrote" gloss slightly overreaches the science. Cross-references Sweep B territory.
- **Design implication:** Set the success metric correctly: do NOT measure or display re-open rates as health indicators, and never frame unread captures as failure. The vault's job description is "cognitive offload first, retrieval second" — shame-free by spec, which directly serves RQ5.

### SD10. A 77-pt comment describes the reinforcement loop that keeps hoarding alive — rare rediscovery moments are genuinely delightful and "provide enough reinforcement to continue the habit" — and pinpoints the retrieval failure: she remembers saved items by spontaneous association but has no idea where they are stored.

> But how often do I go back to browse them (bookmarks, photos, papers, etc)? Not very much. And yet, when I do, and I love seeing them again, and so it provides enough "reinforcement" to continue the habit.

- **Source:** [u/catgirl330, r/ADHD motdce thread](https://www.reddit.com/r/ADHD/comments/motdce/i_have_this_habit_of_saving_posts_and_screenshots/gu5y80u/), Apr 2021, 77 pts (pullpush snapshot)
- **Credibility:** Self-report; second comment by same author (gu5z5fv) is consistent. The where-is-it line is verbatim: "I think of it on my own, and yet have no idea where to find it amidst all my stu[ff]". Complements Sweep A F5's "rediscovering old ideas is gold".
- **Design implication:** Build deliberate serendipity as a reward feature: a small daily/weekly "from your vault" resurfacing card (old captures, anniversary notes) converts the accidental rediscovery joy into the system's retention loop — and retrieval must work from fuzzy association (semantic search over OCR'd/extracted text), never from remembering location.

### SD11. A working triage mechanic from the hoarding thread: the Slidebox app turned a 2,000-screenshot backlog processable by reducing each decision to a single swipe (folder at bottom, trash at top) — evidence that backlog triage succeeds when per-item cost drops to one gesture.

> I found this app called Slidebox useful for this because you can easily swipe through your photos and swipe them into folders at the bottom or trash at the top. Has helped me make a dent in my 2,000 screenshots.

- **Source:** [u/Wellbeastial, r/ADHD motdce thread](https://www.reddit.com/r/ADHD/comments/motdce/i_have_this_habit_of_saving_posts_and_screenshots/gu70qh6/), Apr 2021, 14 pts (pullpush snapshot)
- **Credibility:** Single anecdote, modest score, and "make a dent" is partial success not completion — but it is the only comment in the top-100 describing a triage UI that actually moved a backlog, and it rhymes with Sweep A F18 (batched later-pass) and F13 (no-decision capture).
- **Design implication:** The inbox triage surface (especially on the Pixel) should be a swipe/single-key flow over one item at a time — keep / vault-it / let-go — with the LLM pre-suggesting the destination so the human only confirms; never a form, never a folder picker, never the full list visible.

### SD12. Deep in the seed r/ClaudeCode thread, ADHD engineers state the wanted product shape — "a personal brain unscrambler" you spew thoughts into all day that iterates them toward coherence — and one shipped it inverted as "human-harness", a Claude Code skill whose verified design is: atomize the dump into ONE next action with a time estimate, never show the full list, answer only Done/Stuck/Not-now, and re-inject focus on drift; meanwhile another commenter's passive "ADHD tracker" agent failed within 15 minutes.

> A personal brain unscrambler assistant I can spew my thoughts into throughout the day and it iterates it all towards coherence.

- **Source:** [u/dontwantablowjob (quote), r/ClaudeCode "I gave Claude Code ADHD and it thinks 2x better"](https://www.reddit.com/r/ClaudeCode/comments/1tny93g/i_gave_claude_code_adhd_and_it_thinks_2x_better/oo13qeg/), May 2026; plus u/dhasson04's [human-harness repo](https://github.com/dhasson04/human-harness) (README fetched raw: "Humans with ADHD are just LLMs with a terrible context window and no system prompt. So I gave myself one." / "Not now sends it to the back, no guilt.") and u/Wise-Tap4200's 15-minute tracker failure (comment onyxgkc, 6 pts)
- **Credibility:** Mixed: the demand quote and tracker-failure are low-score comments; human-harness is a self-promoted but real repo whose README was read verbatim (it stores nothing — "The task lives in the session and that is it", so it is a focus loop, not a PKMS). The convergence across three independent commenters in one thread is the signal. (Checker note: the repo author is dhasson04; the research draft's "1hassond" was a transcription slip, corrected here.)
- **Design implication:** Adopt the harness grammar for the PKMS's task surface — one next action, Done/Stuck/Not-now (Stuck = auto-subdivide, Not-now = guilt-free deferral), full list never default-visible — but back it with the vault so deferrals persist; and note the caution: agent nudges that merely observe ("you're off track") die in minutes, while agents that hand you the next concrete step get used.

---

## Coverage notes (what was NOT covered)

HACKINGYOURADHD.COM: site is William Curb's ADHD-strategies podcast (Squarespace; episodes at /podcast/&lt;slug&gt;, full transcripts on-page, tag system). Located candidates via two site-scoped searches plus homepage fetch; downloaded raw HTML and read FULL transcripts of 6 episodes: Smart Phone ADHD Friendly Pt 2 (2020-01-27), How To Create More Effective Reminders (2020-02-24, downloaded but not mined — content overlapped Pt 2's reminder material), Digital Declutter: Tabs (2021-02-22), Slowing Down: Task Management (2023-02-06), Outsourcing Executive Function with AI (2024-09-02), Scaffolding the ADHD Brain (2026-05-29). Dates verified from datePublished meta. All quotes grep-verified against transcript text (note: "that easy to forget" in SD2 is a typo present in the source). NOT covered: episode back-catalog is 300+ episodes; skipped guest interviews and non-PKM topics (sleep, fidgeting, gardening); "Process Over Results", "How to Plan Your Day", "Slowing Down: Activation Energy", and Part 1 of the smartphone series were identified but not fetched. One episode (Smart Phone Pt 2) contains example content on an excluded topic — left out of findings per project rule.

SEED IMAGE: successfully recovered via i.redd.it CDN (curl with browser UA, 200, 64KB, 736x736) and read; transcribed verbatim. Original Reddit post context (which subreddit/thread embedded it) was NOT identified — only the image itself.

REDDIT RE-CHECK: pullpush works for 2021-era content (motdce: top 100 comments by score fetched — a different slice than Sweep A's ~200 chronological, yielding 4 new findings) but returns 0 for 2025/2026 threads; Arctic Shift API covered those (1mhj5o4: 23 comments, fully read, nothing new beyond Sweep A — only a Collabwriting self-promo and confirmation that users don't know whether >1000 saves are deleted or hidden; 1tny93g: 100 comments read, 3 new signals consolidated into SD12; 1t9beef: 100 of ~193 comments retrieved, pagination returned 0 more — remainder unverified; the retrieved set is dominated by discussion of excluded topics with only weak PKM signal: u/shawntco's google-doc running-notes ol75xts, u/Hairy_Garbage_6941's LLM-scope-creep ol318pj — judged below finding threshold). motdce beyond the top-100-by-score slice remains unmined (~300 mid/low-score comments).

OPEN QUESTIONS: whether Reddit's ~1000-save cap deletes or merely hides older saves (matters for the archiver design — assume hidden-but-recoverable is NOT guaranteed); which Hacking Your ADHD guest episodes (e.g., "Attention Different") contain PKM material; the human-harness repo's real-world retention (it's weeks old).

## Verification

Sampled ids: SD1, SD7, SD12 — 2 verified, 1 flagged.

- [verified] SD1 — The HackingYourADHD page was fully fetchable. The quote appears verbatim, the surrounding sentence ("With Drafts, I just pop it open, and I can start writing.") continues naturally, and the author is William Curb. Claim, quote, and attribution all accurate.
- [failed] SD7 — Partially verifiable only. The i.redd.it image URL was blocked at check time, so the image contents (Tumblr screenshot framing, the premed-with-adhd → brawltogethernow reblog chain, the 736x736 JPEG claim, the tag commentary) could not be independently verified. The Ada Powers (@mspowahs) tweet text IS confirmed real via indexed X.com results (appears as a retweet at x.com/unknownmetric/status/1093267522969694208). Verdict false because the image-level claims are unverifiable, though the core tweet text is real. Finding kept with an UNVERIFIED flag above.
- [verified] SD12 — Full Reddit thread fetched via dialog-mcp. The u/dontwantablowjob "brain unscrambler" quote is verbatim (comment oo13qeg, score 2, nested under u/tiwas's "pipeline mode" comment); u/Wise-Tap4200's tracker comment is verbatim (onyxgkc, score 6: "It lasted about 15 minutes and now I've forgotten what I was working on so I'm reading reddit"). The human-harness README confirms all four claimed elements (ADHD-as-LLM tagline, Done/Stuck/Not-now grammar, session-only persistence, guilt-free Not-now). Only inaccuracy: the repo author is dhasson04, not "1hassond" — minor transcription error, corrected in the finding above.

Checker summary: SD1 fully verified word-for-word; SD12 fully verified across thread and repo with one trivial username slip; SD7 unverifiable at the image level (URL blocked) though the underlying tweet text is confirmed real.
