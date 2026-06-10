---
title: content-hoarder mining — what the user actually saves
created: 2026-06-10
modified: 2026-06-10
tags: [research, adhd, pkms-design, content-hoarder, capture, triage, resurfacing]
status: draft
---

# 17 — Content-Hoarder Mining (what the user actually saves)

Findings from read-only mining of the user's own save corpus (`K:/Projects/content-hoarder/data/app.db`, 84,250 items). 14 findings; 3 sample-verified by an adversarial fact-checker, 1 failed on its concrete count.
Program: [[00-ground-truths]] - Synthesis target: [[10-synthesis]]

## Top takeaways

1. **The backlog is unprocessable by design:** 97.55% of 84,250 saves have never left 'inbox' across the app's life — build promote-on-demand and guilt-free bulk decay, never a review queue (CH1, CH11).
2. **Saving is the only behavior proven durable >4 years** (HN: 55/55 months active since Nov 2021); processing never happened — anchor the PKMS on the save habit and make everything downstream optional and volume-independent (CH10, CH2).
3. **The win scenario is half-built already:** content-hoarder stores full Reddit post+comment-tree JSON (reddit_threads, 672 cached) and the user saved 9,593 individual comments — the PKMS should promote from this DB, not re-implement capture (CH6).
4. **The user's own curated evidence converges on two mechanisms:** near-in-time accountability/consequence (body doubling, "in a low consequence environment nothing gets done") and radical bar-lowering ("if it's worth doing, it's worth doing poorly" — saved twice from one thread); encode both into the system's interaction loop (CH7, CH8, CH13).
5. **He hoards distilled advice but never re-reads it** (131-tip megapost, 36-app review, 553 LifeProTips), and his tool taste runs plain-text/anti-methodology with ~2-year tool eras — extraction-to-small-notes plus free exit (pure markdown, regenerable index) are survival requirements, not nice-to-haves (CH5, CH9, CH14).

---

## Findings

### CH1. The user's save corpus is 84,250 items of which 97.55% (82,190) still sit in status='inbox'; in the app's lifetime only ~2,060 items were ever triaged (1,989 archived, 69 done, 2 keep) — per-item review of the backlog has effectively never happened and never will.

> ('inbox', 82190) / ('archived', 1989) / ('done', 69) / ('keep', 2)

- **Source:** K:/Projects/content-hoarder/data/app.db (items table) — `SELECT status, COUNT(*) FROM items GROUP BY status; SELECT ROUND(100.0*SUM(status!='inbox')/COUNT(*),2) FROM items`
- **Credibility:** Direct read-only query of the user's own DB; strong. Status field reflects app workflow, not external ground truth.
- **Design implication:** RQ6: the triage inbox must be designed for an effectively infinite, never-fully-processed backlog — promote-on-demand (search/pull) and bulk decay rules, never a per-item review queue, and zero guilt-framing about inbox size.

### CH2. Saves come almost entirely from one-tap native save buttons in apps the user already lives in: Reddit 64,859 (77%), YouTube 10,242, Hacker News 9,042, plus 107 Firefox tab snapshots — capture survived because activation energy was a single tap inside the consumption context.

- **Source:** K:/Projects/content-hoarder/data/app.db (items table) — `SELECT source, COUNT(*) FROM items GROUP BY source ORDER BY 2 DESC`
- **Credibility:** Direct DB query; strong.
- **Design implication:** RQ3: the PKMS capture path must match or beat in-app save buttons (Android share-target / one tap on the Pixel 6); any capture step that requires opening a separate app first will lose to Reddit's save button.

### CH3. 1,342 saved items match 'adhd'; the cluster is dominated by recognition/validation content — r/ADHD 570, meme subs ~465 (adhdmeme 386, ADHDmemes 64, ADHDAlien 10, plus 2meirl4meirl), adhdwomen 104 — while actionable-strategy subs are small (ADHD_Programmers 30); the user saves 'that's me' moments far more often than systems to implement.

- **Source:** K:/Projects/content-hoarder/data/app.db (items table) — `SELECT json_extract(metadata,'$.subreddit'), COUNT(*) FROM items WHERE title LIKE '%adhd%' OR body LIKE '%adhd%' OR url LIKE '%adhd%' GROUP BY 1 ORDER BY 2 DESC`
- **Credibility:** Direct DB query; theme split by subreddit is a reasonable but coarse proxy (LIKE matching includes some incidental mentions).
- **Design implication:** Resurfacing (RQ4) should classify saves as 'relatable/identity' vs 'actionable' at triage time — resurfacing a 3-year-old meme as a task is noise, but resurfacing the 30 ADHD_Programmers strategy posts has real value.

### CH4. ADHD-related saving has a long arc: 982 of the 1,342 matched items were created 2019–2022 (peak era), then a near-total gap in 2023–24 (15 items in 2024), then a resurgence of 175 items in 2025–26 — interest in the topic is durable across 6+ years but episodic.

- **Source:** K:/Projects/content-hoarder/data/app.db (items table) — `SELECT strftime('%Y',created_utc,'unixepoch'), COUNT(*) FROM items WHERE title/body/url LIKE '%adhd%' GROUP BY 1`
- **Credibility:** Direct DB query, but created_utc is the content's creation date, not the save date (Reddit API does not expose save timestamps), so this is a lower-bound proxy for when saving happened.
- **Design implication:** RQ2/RQ4: design for episodic engagement — the vault must tolerate months-long dormancy without rotting, and resurfacing should reactivate old clusters when the user returns to a topic rather than assuming continuous use.

### CH5. The user repeatedly saves giant pre-distilled tip compilations — e.g. a 27k-char r/ADHD post condensing 700 comments into 131 categorized tips (t3_ioi1my, 2020) and a 20k-char review of 36 productivity apps tried over 500 days (t3_r2zi3r, 2021), plus 553 LifeProTips saves — yet all of them still sit unprocessed in the inbox; distillation by others gets hoarded, not absorbed.

> I read through the 700+ comments and paraphrased, merged and categorised all the tips.

- **Source:** [r/ADHD: 'I went through 700 reddit comments and collected'](https://www.reddit.com/r/ADHD/comments/ioi1my/) — K:/Projects/content-hoarder/data/app.db; `SELECT fullname,title,length(body) FROM items WHERE (title LIKE '%adhd%' OR body LIKE '%adhd%') AND length(body)>2000 ORDER BY length(body) DESC` — top hits t3_ioi1my (27,040 chars), t3_r2zi3r (20,156 chars)
- **Credibility:** Strong: verbatim body text read from the DB; quote is exact.
- **Design implication:** RQ4/RQ6: saving a distillation is not the same as using it — the vault needs an extraction step that pulls individual claims/tips out of saved long-form into small, resurfaceable notes, otherwise compilations become the deepest-buried items of all.

### CH6. The win scenario (capture a post WITH its comment discussion) is both validated and partially built: the user saved 9,593 individual comments (avg 545 chars, 494 over 2k chars, longest ~10k), 8,398 items have bodies over 500 chars, and the content-hoarder DB already hydrates full Reddit comment trees into reddit_threads (672 threads cached, avg 148KB JSON, max 8.2MB).

> reddit_threads ( fullname TEXT PRIMARY KEY, thread_json TEXT NOT NULL, -- raw Reddit \<permalink\>.json (post + comment tree) hydrated_at INTEGER )

- **Source:** K:/Projects/content-hoarder/data/app.db (reddit_threads table + schema) — `SELECT COUNT(*), AVG(length(thread_json)), MAX(length(thread_json)) FROM reddit_threads; SELECT COUNT(*), AVG(length(body)) FROM items WHERE kind='comment'`
- **Credibility:** Strong: schema and counts read directly; quote is the verbatim CREATE TABLE comment text (whitespace collapsed across lines).
- **Design implication:** RQ6: do not rebuild thread capture in the PKMS — define a promote pipeline from content-hoarder (which already stores post+comment-tree JSON) into vault notes, rendering the thread to markdown at promote time.

### CH7. The 30 r/ADHD_Programmers saves (2020–2026) recur on four work-specific themes: task-breakdown pain, external accountability as the only working mechanism, procrastination as task-aversion rather than laziness, and discriminating ADHD-tested advice from generic advice — including a 2026 save arguing accountability/consequence proximity is the lever.

> Basically the gist of it is that folks with ADHD need more accountability and not less. There needs to be more accountability and more consequence and more often and near in time. In a low consequence environment ***nothing gets done.***

- **Source:** [r/ADHD_Programmers: 'This is the only thing that works for my adhd' (2026-02-20)](https://www.reddit.com/r/ADHD_Programmers/comments/1r9k2z8/) — `SELECT title, body FROM items WHERE json_extract(metadata,'$.subreddit')='ADHD_Programmers'`, quote from reddit:t3_1r9k2z8
- **Credibility:** Strong: verbatim body excerpt read from the DB; the saved post itself is anecdote, but what matters here is that the user chose to save it.
- **Design implication:** RQ5: build visible, near-in-time consequence into the vault loop (e.g. notes/tasks that surface on a schedule with a tiny commitment), since the user's own curated evidence says low-consequence environments produce nothing.

### CH8. The user saved BOTH the post and a top comment of the same r/ADHD thread about the '1% rule' (doing 1% beats doing nothing) — a double-save signaling that anti-perfectionism framing strongly resonates.

> My favorite version of this is "If it's worth doing, it's worth doing poorly".

- **Source:** [r/ADHD: 'The 1 rule is working for me' (post + saved comment, 2023-01)](https://www.reddit.com/r/ADHD/comments/106wrzb/) — `SELECT fullname, title, body FROM items WHERE title LIKE 'The 1 rule is working for me%'` — returns post reddit:t3_106wrzb and comment reddit:t1_j3k2ypu
- **Credibility:** Strong: verbatim comment body from the DB; double-save is an unusually clear engagement signal.
- **Design implication:** RQ5: make '1% interactions' first-class — a note that got one line added, an item that got skimmed and tagged, counts as progress in the UI; never display completeness metrics that frame partial notes as failures.

### CH9. PKM tool curiosity is HN-mediated and skeptical of heavy systems: 10 Obsidian items (incl. 'Ditching Obsidian and building my own', 'Obsidian Bases', 'My Obsidian note-taking workflow'), 10 note-taking-app items, 'I tried every todo app and ended up with a .txt file' (HN 2025), 'Why I Deleted My Second Brain' (YouTube 2025) — and zero saves for zettelkasten, Roam, or PKM methodology.

> I tried every todo app and ended up with a .txt file

- **Source:** K:/Projects/content-hoarder/data/app.db (HN/YouTube saves, 2022–2026) — `SELECT source,title,url FROM items WHERE title LIKE '%obsidian%' OR title LIKE '%note-taking%' OR title LIKE '%zettelkasten%' ...` — e.g. hackernews:44864134 ([al3rez.com todo-txt journey](https://www.al3rez.com/todo-txt-journey)), hackernews:44022448 ([amberwilliams.io: building my own PKMS](https://amberwilliams.io/blogs/building-my-own-pkms)), youtube:CjSWwmg-JRM
- **Credibility:** Strong: verbatim HN title from the DB. Interpretation (skepticism) is inferred from which items were saved, not from stated opinion.
- **Design implication:** RQ1/RQ2: the user gravitates to plain-text minimalism and build-your-own narratives, not methodology culture — keep the PKMS markdown-first with near-zero ontology, and treat every structural feature as something the saved evidence says he'll eventually want to ditch if it's heavy.

### CH10. HN favoriting is the one capture habit with timestamps, and it shows a durable 4.5-year practice (2021-11 through 2026-05, all 55 months active, median 120 saves/month) that is bursty and slowly declining (max 354 in Dec 2021; lows of 10–27/month in early 2026 then back to 84 in May 2026) — saving itself is the behavior that survives >1yr, not processing.

- **Source:** K:/Projects/content-hoarder/data/app.db (HN saved_utc) — `SELECT strftime('%Y-%m',saved_utc,'unixepoch'), COUNT(*) FROM items WHERE source='hackernews' AND saved_utc>0 GROUP BY 1` (7,113 timestamped rows)
- **Credibility:** Strong for HN; Reddit/YouTube saves carry no save timestamp (saved_utc=0), so the pattern is confirmed for only one of three sources.
- **Design implication:** RQ2: build the PKMS around the proven durable behavior (continuous low-effort saving) and make everything else optional; assume monthly volume swings of 10x and design resurfacing to be volume-independent.

### CH11. The hoard is mostly entertainment/identity content — NonCredibleDefense 3,951, hololive/anime-adjacent subs roughly 5,500+, feedthebeast 1,170, leagueoflegends 544 — while knowledge-relevant subs are a thin slice (ADHD 570, LifeProTips 553, programming 319, space 412, aviation 328); vault-worthy material is plausibly only 10–20% of the inbox.

- **Source:** K:/Projects/content-hoarder/data/app.db (subreddit distribution) — `SELECT json_extract(metadata,'$.subreddit'), COUNT(*) FROM items WHERE source='reddit' GROUP BY 1 ORDER BY 2 DESC LIMIT 30`
- **Credibility:** Strong counts; the 10–20% vault-worthy estimate is researcher judgment from the distribution, not a measured label.
- **Design implication:** RQ6: the inbox-to-vault boundary must include a cheap source-level prefilter (subreddit/source allowlists or scoring) so triage attention is never spent on the ~80% entertainment bulk; entertainment saves should have a separate, guilt-free fate (auto-archive).

### CH12. Career/job-search saves exist but are diffuse and mostly news or memes rather than playbooks — interview 164, hiring 40, resume 37, layoff 24, job search 16, leetcode 10 — with recent relevant items like 'After 131 rejections 45 interviews and 12 months' (r/jobsearchhacks 2026), 'Job-seekers are dodging AI interviewers' (HN 2025), and 'The Last Technical Interview' (HN 2026).

- **Source:** K:/Projects/content-hoarder/data/app.db (career keyword counts) — `SELECT COUNT(*) FROM items WHERE title LIKE '%interview%'` (etc. per keyword); sample: `SELECT ... WHERE created_utc > strftime('%s','2024-01-01')`
- **Credibility:** Moderate: keyword counts include false positives (celebrity 'interview', meme 'resume'); the qualitative read (diffuse, no playbook) is from sampled titles.
- **Design implication:** RQ6: job-search-2026 ops cannot be fed by the hoard — it needs its own structured workspace in the vault, with the hoard contributing only occasional promoted references (market signals, interview-prep links) via the same promote pipeline.

### CH13. External-accountability content recurs across years and sources: the HN save 'The ADHD body double: A unique tool for getting things done' (add.org, 2025) plus the r/ADHD_Programmers accountability post (CH7) and 'Been studying procrastination in 1000 adhd devs' (2025), whose author found procrastination is task-aversion, not laziness.

> turns out like 96% of us dont procrastinate because we're lazy. we procrastinate because the task literally feels *wrong* t

- **Source:** [add.org: The ADHD body double](https://add.org/the-body-double/) (HN save, 2025) + [r/ADHD_Programmers: 'Been studying procrastination in 1000 adhd devs' (2025-12)](https://www.reddit.com/r/ADHD_Programmers/comments/1pjz11t/) — `SELECT title,url,body FROM items WHERE fullname IN ('hackernews:43597425','reddit:t3_1pjz11t')`
- **Credibility:** Verbatim excerpt from DB (truncated at 400 chars in the read, hence trailing 't'); the underlying 1027-response 'study' is an informal community survey, not research — but the user's repeated saving of the theme is the datum.
- **Design implication:** RQ3/RQ5: consider body-double-style mechanics in the system itself (e.g. an agent or session companion that co-works triage) and frame stuck items as 'task feels wrong — reshape it' rather than as user failure.

### CH14. ⚠ UNVERIFIED: The user's organizational tools come in eras that fade: a bullet-journal save cluster in 2019–2021 (8 items, r/bulletjournal + a bujo tips megapost), then productivity-app-review saves circa 2021, then Obsidian/plain-text/build-your-own saves in 2024–2026 — each era's tool was abandoned rather than migrated.

**Checker found:** the 2019–2021 bullet-journal era and the save cluster are real, but the stated count of '8 items' is wrong — the verifying query returns 16 items in that date range (excluding one YouTube item with a null-epoch timestamp artifact), so the claim's only concrete number is off by a factor of two. The era/abandonment narrative itself is an interpretation not directly falsifiable from the DB.

- **Source:** K:/Projects/content-hoarder/data/app.db (bullet journal era saves) — `SELECT title, strftime('%Y',created_utc,'unixepoch') FROM items WHERE title LIKE '%bullet journal%' OR title LIKE '%bujo%' ORDER BY created_utc`
- **Credibility:** Moderate, and weakened by the failed count check: era inference comes from save dates of related content; that the user personally used then abandoned each tool is inferred (consistent with known surviving tools being Keep/Discord/Obsidian).
- **Design implication:** RQ1/RQ2: assume the PKMS itself will face an abandonment attempt within ~2 years — make exit free (plain markdown, regenerable index, no proprietary state) so a future tool era can absorb the vault instead of stranding it, and design re-entry after dormancy as a first-class flow.

---

## Coverage notes

Method: read-only sqlite3 (URI mode=ro) against `K:/Projects/content-hoarder/data/app.db` via temp Python scripts. Explored the full schema (items, items_fts/trgm, reddit_threads, reddit_unsave, settings, auth_tokens, triggers), then ran LIKE-based mining (FTS5 tables exist but LIKE on title/body/url was sufficient and avoids tokenizer surprises). The ADHD match count here is 1,342 (title OR body OR url LIKE '%adhd%'), larger than the ~591 mentioned in the brief — that figure likely counted title-only or FTS-token matches; the broader net includes body mentions.

Caveats: (1) Reddit item titles are stored normalized (punctuation stripped, sentence-cased) by the ingestion pipeline, so title 'quotes' are as-stored, not as-published; body text appears verbatim, so all quote fields except the schema quote come from bodies or HN titles. (2) saved_utc is populated only for HN (7,113 rows); Reddit/YouTube saves have saved_utc=0, so save-burst analysis for them uses created_utc (content creation date) as a lower-bound proxy — the 2022 peak (19,648 items created in 2022) confirms a heavy-saving era but not exact save dates. (3) Keyword counts have substring false positives; an inflated 'anki' count (matched 'banking'/'ranking') was discarded rather than reported.

Skipped: deep-reading thread_json blobs in reddit_threads (sampled metadata only), YouTube item content mining beyond keyword hits, the .bak databases, and reddit_copy.db.

Open questions: what fraction of the 672 hydrated threads were hydrated deliberately vs by batch job (bears on how much the user values full-thread capture); whether the 2023–24 ADHD save gap reflects disengagement or a different platform; the actual vault-worthy fraction of the inbox (the 10–20% figure is judgment, could be measured with an LLM labeling pass).

## Verification

Sampled ids: CH1, CH8, CH14 — 2 verified, 1 failed.

- [verified] CH1 — All numbers confirmed exactly against the DB: `SELECT status, COUNT(*) FROM items GROUP BY status` returns ('inbox', 82190), ('archived', 1989), ('done', 69), ('keep', 2), total=84250. The 97.55% inbox figure is confirmed (2.45% triaged per the ROUND query), and the ~2,060 triaged count equals 1989+69+2=2060 exactly. Claim and quote fully supported.
- [verified] CH8 — Both items confirmed in the DB: reddit:t3_106wrzb is a post titled 'The 1 rule is working for me' (subreddit=ADHD per metadata) and reddit:t1_j3k2ypu is a comment whose body begins with the verbatim quoted line. Both items have is_saved=1, confirming the double-save. Claim and quote fully supported.
- [failed] CH14 — The 2019–2021 date range and the existence of a bullet-journal save cluster are confirmed, but the claim's '8 items' count is wrong: the query returns 16 items in that range (a 17th is a YouTube video with created_utc=0, a data artifact). The era-abandonment narrative is interpretation, not directly falsifiable from the DB, but the claim's only concrete number is off by a factor of two. Kept above with an UNVERIFIED flag.

Checker summary: CH1 fully verified (exact status breakdown and percentage split match the DB precisely); CH8 fully verified (both saved items exist, subreddit confirmed via metadata JSON, verbatim quote matches the comment body exactly); CH14 not verified — the bullet-journal era is real but its stated item count is double-counted wrong (8 claimed vs 16 found).
