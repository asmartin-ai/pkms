---
title: Academic evidence — EF scaffolding, motivation, retrieval
tags: [pkms-design, research, adhd, academic, executive-function, motivation, retrieval, habits]
created: 2026-06-10
modified: 2026-06-10
status: draft
---

# 16 — Academic evidence — EF scaffolding, motivation, retrieval

Merged findings from three academic research tracks: (1) executive-function scaffolding & assistive technology, (2) habit, motivation & shame, (3) retrieval & resurfacing. 36 findings (12 per track); 9 sample-verified by an adversarial fact-checker — 5 initially failed quote-level verification. Quote-hardening pass (2026-06-10): all 5 flagged quotes were re-checked against primary sources and replaced with confirmed verbatim text or corrected citations, and the unsampled motivation-track quotes were spot-checked the same way (MO2 and MO10 also fixed; MO8/MO9/MO11 verified verbatim). All blockquotes below are confirmed verbatim from their cited sources.
Program: [[00-ground-truths]] - Synthesis target: [[10-synthesis]]

## Top takeaways

1. **Externalize at the point of performance or fail.** ADHD is a performance problem, not a knowledge problem: internally held information, internal motivation, and far-off deadlines exert near-zero control over behavior (Barkley; SC1, SC2, MO3, RT8). The system must push open loops into the user's field of view at the moment of action — any design that depends on remembering to check the vault, or on a self-initiated weekly review, is predicted to collapse.
2. **Retrieval is intact; encoding and initiation are the bottlenecks.** Adult ADHD memory deficits trace to getting information *in*, not getting it back out (RT3, meta-analysis). So show candidates and let recognition do the work — resurfaced cards, recent/related lists — rather than making a blank search box the front door (RT4). And event/context cues land reliably where time/schedule cues do not (RT2).
3. **Offloading is the right bet, but it transfers total custody.** External reminders cut intention-forgetting from roughly 45% to about 5% (SC3) — and offloading also erodes memory of what was stored (SC4). Once captured, the system owns resurfacing forever; a captured task that never resurfaces is a silent failure mode worse than no capture at all.
4. **Reminders are a depleting currency — and review debt kills.** Alert acceptance drops about 30% per repeated prompt (SC8). Never repeat an unchanged nag, never show a growing overdue counter, and let missed queues silently decay (RT6, RT7). Anchor resurfacing to distinctive contextual moments (opening a project, creating the daily note), not clocks (SC9).
5. **Reward must be immediate and front-loaded onto the initiation moment.** Meta-analytic delay-discounting evidence (MO9) and Barkley's temporal-myopia model (MO5, RT11) converge: deferred payoffs like "a great knowledge base someday" are discounted to near-zero. Every capture needs an instant, tangible payoff, and activation energy to start must be near zero (MO12).
6. **Encode tasks as if-then next actions.** Implementation intentions ("when X happens, I will do Y") show roughly d=1.0 for goal attainment in clinical samples (SC10). A lightweight, optional trigger field at capture is the strongest single behavioral technique found — and it gives the resurfacing engine its firing context (uniting SC9 and SC10 in one schema field).
7. **Scaffolding is permanent prosthetics, not training wheels — and it must be shame-free.** Organizational gains persist only while the supports persist (SC11, SC12), so build routines into the tool and frame continued reliance as correct use. ADHD adults have measurably lower self-compassion (MO8), and anything that reads as criticism drives quiet abandonment (MO7): no guilt-laden badges, no accusatory backlogs, welcome the user back after gaps. When work stalls, offer one tiny re-entry rung, not the whole abandoned project (MO11).
8. **Treat interest/novelty frameworks and gamification as heuristics, not laws.** The "interest-based nervous system" is influential clinical observation, not validated science (MO6); gamification's benefit is real but modest, and its durability beyond short pediatric trials is untested (MO10). Use bounded, unpredictable, user-pulled resurfacing for engagement (RT12) — and keep the core capture-and-retrieve loop intrinsically useful so value never depends on a points layer. Marketplace "ADHD features" carry no efficacy evidence at all (SC7).

---

# Part 1 — EF scaffolding & assistive tech

### SC1. Internally held information (working memory, self-talk, mental notes) is exceptionally weak at steering behavior in ADHD, so information must be made physical and visible in the environment — "externalized" — to control behavior.

> Since covert or private information is weak as a source of stimulus control, making that information overt and public may assist with strengthening control of behavior by that information.

- **Source:** [The Important Role of Executive Functioning and Self-Regulation in ADHD (Russell A. Barkley, factsheet)](https://www.russellbarkley.org/factsheets/ADHD_EF_and_SR.pdf)
- **Credibility:** Theory/clinical-principles factsheet by the field's most-cited ADHD researcher (author of 280+ scientific articles), based on his 2012 book on executive functioning and self-regulation. Not itself an empirical trial, but the externalization principle synthesizes decades of EF research; treat as authoritative clinical theory, not trial evidence.
- **Design implication:** The vault cannot be a passive archive the user remembers to consult. The PKMS must push the relevant note/task into the user's sensory field at the moment of action (e.g., terminal greeting with today's open loops, daily note auto-opened, due items surfaced unprompted) — any design that depends on the user spontaneously recalling that information exists inside the system will fail.

### SC2. Interventions only work if they operate at the "point of performance" — the place and time where behavior is failing — and ADHD's "temporal myopia" means far-off deadlines exert almost no control, so work must be restructured into small contiguous steps with immediate feedback.

> The point of performance is that place and time in the natural setting of the person's life where they are failing to use what they know... Rather than tell them that a project must be done over the next month, assist them with doing a step a day toward that eventual goal.

- **Source:** [The Important Role of Executive Functioning and Self-Regulation in ADHD (Russell A. Barkley, factsheet)](https://www.russellbarkley.org/factsheets/ADHD_EF_and_SR.pdf)
- **Credibility:** Same Barkley factsheet as SC1 — authoritative clinical theory from the leading EF/ADHD researcher; the point-of-performance principle is widely cited across the ADHD treatment literature but is a design principle, not a measured effect size.
- **Design implication:** Resurfacing must be context-anchored, not review-session-anchored: when the user opens a project note, show that project's open tasks and stale items right there. Deadlines should be decomposed by the system into a visible next-step-today, because a date three weeks out is functionally invisible. A weekly-review-dependent design is predicted by this model to collapse.

### SC3. Offloading delayed intentions to external reminders produces one of the largest known prospective-memory improvements — roughly 45% forgetting with internal memory versus about 5% with external reminders — and people with poorer memory ability both use and benefit from offloading most.

> external reminders can have a large impact on whether or not individuals fulfil their delayed intentions

- **Source:** [Outsourcing Memory to External Tools: A Review of "Intention Offloading" (Gilbert et al., Psychonomic Bulletin & Review, 2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9971128/)
- **Credibility:** Peer-reviewed narrative review of a substantial experimental literature by Sam Gilbert's UCL lab, the leading group on cognitive offloading. Lab paradigms with general-population samples, not ADHD-diagnosed samples — but the finding that lower-memory individuals benefit most supports generalization to EF-impaired users.
- **Design implication:** Capture-everything-into-the-system is the empirically correct bet, not a crutch to feel guilty about. But the corollary is total: once an intention is captured, the SYSTEM owns its resurfacing. A task that goes into the vault and never gets surfaced again is worse than not capturing it (false sense of being handled), so every captured task needs a guaranteed resurface path.

### SC4. Cognitive offloading boosts immediate task performance but measurably weakens internal memory for the offloaded content — people remember less of what they store externally.

> offloading memory demands encourages a reduced engagement in intentional or top-down memory strategies/efforts, leading to lower memory performance in general

- **Source:** [Consequences of cognitive offloading: Boosting performance but diminishing memory (Grinschgl et al., 2021)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8358584/)
- **Credibility:** Peer-reviewed experimental studies (Quarterly Journal of Experimental Psychology), healthy adult samples. Consistent replicated effect in the offloading literature (also flagged in Risko & Gilbert's 2016 Trends in Cognitive Sciences review). Not ADHD-specific.
- **Design implication:** Assume the user will NOT remember what is in the vault — design retrieval-first (fast full-text search, backlinks, tags that work with partial recall) and let serendipitous resurfacing (random-note, on-this-day, related-notes) compensate for the recall the offloading itself erodes. Never gate a feature on the user remembering a note exists.

### SC5. Digital interventions for ADHD work but modestly: across 25 RCTs the pooled effect on overall ADHD symptoms was SMD -0.33, with inattention (-0.31) improving more than hyperactivity/impulsivity (-0.15).

> digital interventions proved beneficial for individuals with ADHD by alleviating symptoms of ADHD, inattention, and hyperactivity/impulsivity

- **Source:** [The effect of digital interventions on attention deficit hyperactivity disorder (ADHD): A meta-analysis of randomized controlled trials (Journal of Affective Disorders, 2024)](https://pubmed.ncbi.nlm.nih.gov/39191306/)
- **Credibility:** 2024 PRISMA-compliant meta-analysis, 25 RCTs, N=1,780, six databases, Cochrane bias assessment. Strong method, but interventions are heterogeneous (cognitive training, VR, apps, telehealth) and samples mix children and adults, so the pooled number is a blunt average.
- **Design implication:** Calibrate ambition: a tool can meaningfully scaffold but will not transform executive function. Optimize the PKMS for what tools demonstrably do well (reduce friction, externalize memory, prompt at the right moment) rather than building elaborate self-improvement machinery that implicitly promises symptom change it cannot deliver — that over-promise is exactly the perfectionism trap.

### SC6. In a head-to-head RCT with 60 adults with ADHD, the same psychoeducation program delivered via a smartphone app beat the pen-and-paper version on inattention, impulsivity, and homework compliance — the delivery medium itself changed adherence and outcomes.

> the smartphone-assisted psychoeducation was significantly more effective in improving inattention and impulsivity and led to higher homework compliance than the brochure-assisted psychoeducation

- **Source:** [Smartphone-assisted psychoeducation in adult attention-deficit/hyperactivity disorder: A randomized controlled trial (Selaskowski et al., Psychiatry Research, 2022)](https://pubmed.ncbi.nlm.nih.gov/36041353/)
- **Credibility:** Randomized controlled trial, adult ADHD sample (n=60, 30 per arm), observer-rated outcomes (IDA-R), published in a peer-reviewed journal. Small-to-moderate sample; single site; the app bundled reminders and tracking so the active ingredient is the medium-plus-prompting package, not isolated.
- **Design implication:** Put the scaffolding inside tools the user already lives in. For this user that means capture and resurfacing must work from the terminal/editor they already have open all day (and the phone they carry), not in a separate app that requires a deliberate visit — adherence followed the always-carried device, not the content.

### SC7. A systematic review of 109 commercially available ADHD apps found none with published evidence of efficacy — the app marketplace's "ADHD features" are marketing, not validated mechanisms.

> a recent systematic review of mobile apps for ADHD identified 109 apps, few contained information regarding app development, and none contained data on efficacy/effectiveness

- **Source:** [Attention-deficit/hyperactivity disorder mobile apps: A systematic review (Păsărelu et al., International Journal of Medical Informatics, 2020)](https://www.sciencedirect.com/science/article/abs/pii/S138650561830323X)
- **Credibility:** Peer-reviewed systematic review of the app marketplace (109 apps assessed). Reviews the absence of evidence rather than producing effect sizes; the quoted summary sentence is as rendered in a peer-reviewed paper citing it (search-confirmed across multiple sources). Verifier confirmed the 109-app count and zero-efficacy finding via multiple corroborating sources; verbatim quote check blocked by paywall.
- **Design implication:** Do not copy features from popular ADHD apps as if they were evidence-based — they aren't. Build instead on the validated mechanisms in this track (externalization at point of performance, intention offloading, distinctive cue-based reminders, if-then encoding) and ignore marketplace conventions like streaks/badges unless they map to a mechanism.

### SC8. Reminders habituate fast and measurably: in a cohort of 112 clinicians, the likelihood of accepting an alert dropped about 30% for each additional reminder received in the same encounter, and repetition itself (not workload) drove the tune-out.

> The likelihood of reminder acceptance dropped by 30% for each additional reminder received per encounter, and by 10% for each five percentage point increase in proportion of repeated reminders.

- **Source:** [Effects of workload, work complexity, and repeated alerts on alert fatigue in a clinical decision support system (Ancker et al., BMC Medical Informatics and Decision Making, 2017)](https://pubmed.ncbi.nlm.nih.gov/28395667/)
- **Credibility:** Retrospective cohort study, 112 ambulatory clinicians, 3.5 years of EHR alert data. Robust within its domain, but it is clinical-informatics analogue evidence, not an ADHD sample — directly comparable habituation studies in ADHD adults were not found. The mechanism (habituation to repeated identical signals) is general.
- **Design implication:** Treat notifications as a strictly rationed, depleting currency. Hard-cap daily prompts, deduplicate aggressively (never re-show the same nag unchanged), and when something genuinely must escalate, change its form/salience instead of repeating it. A PKMS that nags about every stale note will train the user to ignore the PKMS within weeks.

### SC9. Reminders tied to a distinctive cue encountered at the moment of opportunity outperform generic written/timed reminders — and distinctiveness relative to the surrounding environment is what makes the cue work.

> cue-based reminders are more potent when the cues they employ are distinctive relative to (a) other regularly encountered stimuli and (b) other stimuli encountered concurrently

- **Source:** [Reminders Through Association (Rogers & Milkman, Psychological Science, 2016)](https://pubmed.ncbi.nlm.nih.gov/27207873/)
- **Credibility:** Peer-reviewed paper in Psychological Science with multiple lab experiments plus a 500-customer field experiment (coffee-shop coupon redemption). General-population samples, not ADHD; effect direction aligns with Barkley's stimulus-control account, which strengthens confidence for this user.
- **Design implication:** Anchor resurfacing to contexts, not clocks: show a project's open loops when the project is opened, surface "capture inbox has 12 items" when the daily note is created — moments when the user can act. And keep surfaced prompts visually distinctive and varied; a resurfacing panel that always looks identical will perceptually disappear into the interface.

### SC10. Encoding goals as if-then implementation intentions ("when X happens, I will do Y") yields a large goal-attainment effect in clinical populations (d+ = 0.99 across 29 studies), and ADHD-specific experiments show if-then plans improve inhibition and delay-of-gratification performance.

> large-sized effect on goal attainment (d+ = 0.99, k = 28, N = 1,636)... Implementation intentions proved effective across different mental health problems and goals

- **Source:** [Does forming implementation intentions help people with mental health problems to achieve goals? A meta-analysis (Toli, Webb & Hardy, British Journal of Clinical Psychology, 2016)](https://pubmed.ncbi.nlm.nih.gov/25965276/)
- **Credibility:** Meta-analysis of 29 experimental studies (N≈1,636) in clinical and analogue samples — strong evidence, though publication bias inflates implementation-intention effects generally. ADHD-specific support (Gawrilow & Gollwitzer 2008; Gawrilow et al. 2011, confirmed via search) is pediatric and lab-task-based; adult-ADHD field trials were not found. Honest read: mechanism very well supported, ADHD-adult dose unproven.
- **Design implication:** Bake the if-then format into task capture: when a task enters the system, prompt (lightly, optionally) for a trigger — "when/where will this happen?" — and store it, so the task reads "after standup → email recruiter" rather than "email recruiter". The trigger field also gives the resurfacing engine a context to fire on, uniting SC9 and SC10 in one schema field.

### SC11. Organizational skills training for ADHD produces moderate-to-large gains (parent-rated g=0.83, teacher-rated g=0.54), and its active ingredients are concrete external structures — planners, checklists, materials-management routines — practiced with immediate reinforcement, not abstract skill knowledge.

> OST leads to moderate improvements in organizational skills of children with ADHD as rated by teachers and large improvements as rated by parents.

- **Source:** [Meta-analysis of organizational skills interventions for children and adolescents with ADHD (Bikic et al., Clinical Psychology Review, 2017)](https://pubmed.ncbi.nlm.nih.gov/28088557/)
- **Credibility:** Meta-analysis of 12 studies, N=1,054. Solid pediatric evidence; effect sizes from unblinded raters (parents) run high. Crucially this is a CHILD literature — generalization to a 30-something engineer is an extrapolation; see SC12 for the adult bridge.
- **Design implication:** The PKMS should BE the planner/checklist/routine rather than expecting the user to maintain one: auto-created daily notes, checklist-style task syntax, and a fixed home for incoming material replicate OST's active ingredients as permanent infrastructure instead of trained behavior the user must sustain by willpower.

### SC12. The OST logic does transfer to adults: a 12-week meta-cognitive therapy RCT (n=88 adults with ADHD) targeting time-management, organization, and planning significantly reduced inattentive symptoms versus an attention-matched control — but Barkley's caveat applies, that gains persist only while the environmental supports persist.

> changes in behavior are likely to be maintained only so long as those environmental adjustments or accommodations are as well

- **Source:** [Efficacy of Meta-Cognitive Therapy for Adult ADHD (Solanto et al., American Journal of Psychiatry, 2010)](https://psychiatryonline.org/doi/10.1176/appi.ajp.2009.09081123)
- **Credibility:** Well-designed RCT (n=88, attention-matched control, independent evaluators) in a top psychiatry journal — the strongest adult evidence that organizational scaffolding works. NOTE: the quote above is from the Barkley factsheet (SC1 source), not from the Solanto paper — a deliberate dual-source structure confirmed by the verifier; the RCT supplies the evidence, Barkley supplies the maintenance caveat. Knouse & Safren's CBT review (PubMed 20599129, search-confirmed) similarly endorses "structured, skills-based" approaches.
- **Design implication:** Design for permanent scaffolding, not graduation. Features framed as training wheels to be removed ("once I build the habit I won't need the reminder") are wrong by this evidence — the daily-note prompt, the surfaced open loops, the inbox sweep should be understood as prosthetics that stay, which also reframes continued reliance on the system as correct use rather than failure (directly serving the no-shame requirement of RQ5).

---

# Part 2 — Habit, motivation & shame

### MO1. Habit formation is genuinely harder in ADHD because the pre-automatic phase of a habit relies on exactly the executive functions (working memory, time awareness, inhibition, consistent repetition) that ADHD impairs, so the common advice to "just make it a habit" targets the weakest link.

> Building a new habit isn't just about repetition. In the early stages, it draws heavily on executive functions, mental processes like planning, working memory, and initiating tasks... Importantly, once a habit is fully automated... it depends less on executive function. The challenge for many ADHD and autistic individuals is getting there. That early stage, when the behavior is still intentional and effortful, demands consistent executive function engagement that may be harder to sustain.

- **Source:** [Why Building Habits Is Harder for ADHD and Autistic Brains (And What Actually Helps)](https://feno.co/blogs/news/why-building-habits-is-harder-for-adhd-and-autistic-brains-and-what-actually-helps)
- **Credibility:** Popular clinician/commercial blog synthesizing established EF science; the underlying mechanism (habits offload to automatic brain systems once formed, but acquisition needs effortful executive control) is well-supported, the ADHD-specific framing is interpretive. Treat as a reasonable popular summary, not primary evidence. (Quote re-verified verbatim against the source 2026-06-10.)
- **Design implication:** Do not design the PKMS around the user "building a capture habit" through willpower/repetition. Assume the effortful acquisition phase may never complete; lean on always-present external cues and zero-friction entry points instead of expecting internal automaticity.

### MO2. Habits in everyone (and especially ADHD) form most reliably when tethered to a stable environmental cue and context, which is why habit-stacking and same-place/same-time triggers outperform motivation-based approaches even though the time-to-automaticity is long and highly variable.

> A habit is a behavior that becomes automatic over time through regular repetition in the same context... These contextual cues allow your brain to latch onto a habit more firmly, making remembering and following through on a behavior easier... In fact, studies have shown that how long it takes to create a habit varies widely, ranging from 4 to 335 days.

- **Source:** [Building Habits With ADHD: Time it Takes & How to Succeed — ADDA](https://add.org/building-habits/)
- **Credibility:** ADDA (Attention Deficit Disorder Association) professionally-reviewed popular education, citing the habit-automaticity literature (Lally-line research; the page's own cited range is 4–335 days). Cue-context mechanism is solid behavioral science; ADHD-specific efficacy claims are extrapolated, not directly tested. (Quote-hardening 2026-06-10: original blockquote's first sentence was actually from a different source; replaced with verbatim text from this page.)
- **Design implication:** Anchor capture to an existing stable cue the user already performs (opening the editor, a daily-note shortcut) rather than a new standalone ritual. The system should be the cue — surface itself at the moment of intent — rather than asking the user to remember to use it.

### MO3. Barkley's executive-function model frames ADHD as a disorder of performance, not knowledge: people know what to do but fail to do it at the "point of performance", so interventions must engineer the moment-and-place of action rather than teach more strategy.

> Disorders of EF or self-regulation, like ADHD, pose great consternation... because they create disorders mainly of performance rather than of knowledge or skills... Conveying more knowledge does not prove as helpful as altering the parameters associated with the performance of that behavior at its appropriate point of performance.

- **Source:** [The Important Role of Executive Functioning and Self-Regulation in ADHD — Russell A. Barkley, Ph.D.](https://www.russellbarkley.org/factsheets/ADHD_EF_and_SR.pdf)
- **Credibility:** High. Russell Barkley is a leading ADHD researcher (Clinical Professor of Psychiatry, MUSC; ~280 papers); this is his own factsheet summarizing his peer-reviewed EF/self-regulation model. Theoretical/clinical synthesis rather than a single empirical study, but authoritative and widely cited.
- **Design implication:** A vault full of well-organized knowledge does not fix an ADHD performance gap. Invest design effort at the point of performance — capturing the thought the instant it occurs, resurfacing the task when the user is in context — not in teaching the user a better methodology.

### MO4. Barkley argues internally generated motivation is itself weak in ADHD, so external "artificial" rewards and prompts act as motivational prostheses — and crucially, externalizing information alone fails unless motivation is externalized too.

> Given that the model hypothesizes a deficit in internally generated and represented forms of motivation that are needed to drive goal-directed behavior, those with EF deficits will require the provision of externalized sources of motivation... Such artificial reward programs become for the person with EF deficits what prosthetic devices such as mechanical limbs are to the physically disabled.

- **Source:** [The Important Role of Executive Functioning and Self-Regulation in ADHD — Russell A. Barkley, Ph.D.](https://www.russellbarkley.org/factsheets/ADHD_EF_and_SR.pdf)
- **Credibility:** High (same Barkley factsheet). The motivation-deficit component is part of his established model; the "prosthesis" analogy is his clinical framing. Note the depletion/ego-depletion literature he cites has been contested in recent replication work, so treat the willpower-as-resource sub-claim cautiously.
- **Design implication:** Build small, immediate, frequent positive feedback directly into capture and task actions (visible streak, satisfying confirmation, progress made tangible). Do not assume the user will be driven by the abstract long-term value of a knowledge base — make each interaction rewarding in the moment.

### MO5. ADHD produces "temporal myopia" — behavior is governed by the immediate now, so deadlines and payoffs that are far away exert little pull; bridging this means collapsing big future goals into a-step-a-day with immediate feedback.

> they create a temporal myopia in which the individual's behavior is governed even more than normal by events close to or within the temporal now... Rather than tell them that a project must be done over the next month, assist them with doing a step a day toward that eventual goal... done in small daily work periods with immediate feedback and incentives.

- **Source:** [The Important Role of Executive Functioning and Self-Regulation in ADHD — Russell A. Barkley, Ph.D.](https://www.russellbarkley.org/factsheets/ADHD_EF_and_SR.pdf)
- **Credibility:** High (Barkley factsheet); converges with the independent delay-discounting meta-analytic evidence (see MO9), which strengthens it beyond a single-author claim.
- **Design implication:** Surface "what can I do right now / today" rather than long-horizon project structure. Default views should foreground the next tiny action and recent activity, not a backlog whose payoff is months away (which the ADHD brain discounts to near-zero).

### MO6. Dodson's "interest-based nervous system" — that ADHD attention is unlocked by Interest, Challenge/competition, Novelty, and Urgency rather than by importance/reward — is a clinically influential observation, NOT an established research construct with direct empirical validation.

> A person with an ADHD nervous system has never been able to use the idea of importance or rewards to start and do a task... People with an ADHD nervous system know that, if they get engaged with a task, they can do it.

- **Source:** [Secrets of Your ADHD Brain — William Dodson, M.D., LF-APA (ADDitude, updated Nov 3 2025)](https://www.additudemag.com/secrets-of-the-adhd-brain/)
- **Credibility:** Mixed. Author is a board-certified psychiatrist on ADDitude's medical panel, lending clinical authority, but the construct is a synthesis from clinical practice, not peer-reviewed/operationalized in the formal literature. Its component parts (novelty-seeking, reward/urgency sensitivity) DO have empirical backing; the packaged framework does not. Cite as influential clinical heuristic, flagged.
- **Design implication:** Make capture and task surfaces tap interest, novelty, challenge, and urgency: vary how notes resurface (novelty), allow playful/curiosity-driven re-entry, and let the user self-impose lightweight urgency. But don't hard-code the framework as fact — treat it as a design heuristic to A/B against the user's own response, not a law.

### MO7. Rejection-sensitive dysphoria (RSD) is a popular Dodson-coined clinical term for extreme pain from perceived rejection/criticism, but the formal evidence base is thin — the ADHD/rejection-sensitivity link remains relatively unexplored, with few studies and only tiny qualitative samples.

> An aspect of emotional dysregulation which remains relatively unexplored in ADHD, is rejection sensitivity... To date, few studies have investigated the potential association between ADHD and rejection sensitivity. Moreover, these studies, for the most part, have attempted to establish the *extent* of the rejection sensitivity/ADHD association, rather than explore the *nature* of the association.

- **Source:** [The lived experience of rejection sensitivity in ADHD — a qualitative exploration (Rowney-Smith et al., 2026)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12822938/)
- **Credibility:** The cited qualitative study is very small (5 undergraduates, focus groups, thematic analysis) — illustrative not generalizable. RSD is real as a lived experience and clinically salient, thin as a validated construct. Report both. (Quote re-verified verbatim against the article 2026-06-10; the earlier scoping-review sentence was not in this source and was removed.)
- **Design implication:** Avoid any UI that reads as judgment, surveillance, or "failure" — overdue-task red badges, guilt-laden empty states, streak-break shaming. The withdrawal/masking response means a system that feels critical will be abandoned rather than corrected. Frame everything as neutral or supportive.

### MO8. Adults with ADHD have significantly lower self-compassion than non-ADHD adults, and that low self-compassion statistically mediates their worse depression, anxiety, stress and wellbeing — making self-compassion a plausible intervention target.

> adults with high traits of ADHD had significantly lower levels of self-compassion... low self-compassion contributes to poorer mental health in adults with ADHD compared to adults without ADHD... self-compassion may be a potential target to improve mental health in this population.

- **Source:** [The role of self-compassion in the mental health of adults with ADHD (Beaton, Sirois & Milne, 2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9790285/)
- **Credibility:** Moderate-to-good. Peer-reviewed, large sample (n=856; 543 ADHD), but cross-sectional self-report with SEM mediation — establishes association/mediation, not causation. Self-compassion intervention efficacy in ADHD specifically is still under-tested (mostly inferred from other populations).
- **Design implication:** Bake shame-free, self-compassionate framing into copy and defaults: stale/unfinished notes are normal, not a personal failing. Re-entry after a gap should be welcomed ("welcome back") rather than confronting the user with an accusatory backlog — directly addressing the self-criticism loop.

### MO9. Meta-analytic evidence confirms people with ADHD reliably choose small-immediate over large-delayed rewards (steeper delay discounting), and making the reward real rather than hypothetical nearly doubles this pull.

> participants with ADHD choose small immediate over large delayed rewards more frequently than controls... offering real rewards in the SCP almost doubled the odds ratio for participants with ADHD.

- **Source:** [ADHD and the Choice of Small Immediate Over Larger Delayed Rewards: A Comparative Meta-Analysis (Marx et al., 2021)](https://pubmed.ncbi.nlm.nih.gov/29806533/)
- **Credibility:** High. Peer-reviewed meta-analysis, 37 group comparisons, 3,763 participants, small-to-medium effect sizes. One of the most robust quantitative findings in the set.
- **Design implication:** The payoff of using the PKMS must be immediate and tangible, not deferred ("this will help future-you"). Every capture should give an instant, concrete reward (it's saved, it's findable now). Long-delayed benefits like "a comprehensive knowledge base" are precisely what the ADHD reward system discounts away.

### MO10. Gamified digital interventions produce a real but modest benefit for ADHD outcomes (g≈0.28), but the trials are short with no long-term follow-up, so the worry that gamification's pull fades once novelty wears off is neither confirmed nor refuted — and within the pediatric trials, participant age showed no significant association with treatment effects.

> The random-effects meta-analysis found a modest therapeutic effect of identified gamified DMHIs on ADHD outcomes compared to control conditions (g, 0.28; 95% CI, 0.09 to 0.48)... no significant associations between average participant age and treatment effects were found.

- **Source:** [Efficacy of Gamified Digital Mental Health Interventions for Pediatric Mental Health Conditions: A Systematic Review and Meta-Analysis (Bryant, Sisk & McGuire, JAMA Pediatrics 2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11420825/)
- **Credibility:** High for what it covers (peer-reviewed meta-analysis, 11 RCTs, 771 ADHD participants, JAMA Pediatrics) but pediatric and short-term; explicitly lacks post-intervention follow-up, so durability/novelty-decay is an open question. (Quote-hardening 2026-06-10: an earlier draft quoted an "efficacy decreases in adolescents" sentence that is not in the article — the meta-analysis actually found no significant age moderation. The caution for an adult user is that all evidence is pediatric — an extrapolation gap, not a measured decline.)
- **Design implication:** Use gamification sparingly and assume it decays: prefer mechanics that renew (varied resurfacing, fresh serendipitous connections) over fixed point-scoring that becomes wallpaper. Don't let the system's value depend on a streak/badge layer the user will tune out; make the core capture-and-retrieve loop intrinsically useful.

### MO11. Behavioral activation with graded task assignment — breaking an intimidating goal into a ladder of tiny doable rungs — has controlled evidence for raising task/homework completion versus "just try harder", supporting a "minimum viable day" approach to restarting stalled work.

> Graded Task Assignment slices an intimidating goal into a ladder of doable rungs, ordered from easiest to hardest... Controlled studies show that graded task assignment raise homework completion and speed depression recovery compared with "just try harder" advice.

- **Source:** [Graded Task Assignment: CBT Exercises, Worksheets, Videos](https://dialecticalbehaviortherapy.com/cbt/behavioral-activation-exposure/graded-task-assignment/)
- **Credibility:** Weak source page (popular CBT-tools site, no named author) but describing a well-established CBT/behavioral-activation technique with a genuine depression RCT base (Jacobson, Dimidjian, Cuijpers meta-analyses). Crossover to ADHD is by analogy — label it as depression-literature extrapolation, though it aligns with Barkley's "a step a day" (MO5).
- **Design implication:** Let the user shrink any task to a trivially small next action and make that the default unit. After a gap or a stall, the system should offer one tiny re-entry rung ("add one line", "open the note") rather than the whole abandoned project — restarting momentum beats confronting scope.

### MO12. The "four motivators" map cleanly onto the user's own reported profile (surviving tools were zero-friction dumps; systems died when organizing outpaced capture), reinforcing that motivation, not capability, gates ADHD productivity — and that the engagement trigger is Dodson's observation that people with ADHD, once engaged with a task, can do it.

> People with ADHD primarily get in the zone by being interested in, or intrigued by, what they are doing. I call it an interest-based nervous system... People with an ADHD nervous system know that, if they get engaged with a task, they can do it.

- **Source:** [Secrets of Your ADHD Brain — William Dodson, M.D. (ADDitude)](https://www.additudemag.com/secrets-of-the-adhd-brain/)
- **Credibility:** Clinical-observation source (see MO6 credibility caveat). Included because it directly converges with the user's questionnaire signals (task-initiation as #1 struggle; organizing effort killing systems) and Barkley's performance-not-knowledge model — triangulation across three independent framings raises confidence in the design direction even if the specific framework is unvalidated. (Quote re-verified verbatim against the article 2026-06-10.)
- **Design implication:** Optimize ruthlessly for the initiation moment: the single highest-leverage design target is reducing activation energy to start a capture to near zero. Any organizing/structuring work must be optional, deferred, and ideally automated — because the documented failure mode is organizing effort overtaking capture and killing the system.

---

# Part 3 — Retrieval & resurfacing

### RT1. Adults with ADHD show clear prospective-memory failures in everyday life, and the deficit is driven mainly by impaired PLANNING/self-initiation rather than by forgetting the content itself.

> Impairments of prospective memory mainly emerged from deficient planning abilities in adults with ADHD.

- **Source:** [Complex Prospective Memory in Adults with Attention Deficit Hyperactivity Disorder (PLOS ONE, 2013)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3590133/)
- **Credibility:** Peer-reviewed case-control study, 45 ADHD adults vs 45 matched controls; complex prospective-memory paradigm. Solid primary source. Caveat: lab task, not naturalistic; authors note everyday impairments are larger. Verifier confirmed the quote verbatim and the planning-deficit conclusion (plan recall 86.5% vs 86.7%; planning execution d = 1.60).
- **Design implication:** Do not rely on the user to "remember to act later." The PKMS must own initiation: surface the next action at the moment/place it is actionable rather than storing it and assuming a future trigger will fire.

### RT2. TIME-based prospective memory (act at a time) is much weaker in ADHD than EVENT-based (act when you see a cue) — the same-paradigm comparison shows a large impairment for time-based but no group difference for event-based.

> Although groups did not differ in event-based PM, results demonstrated a large-sized impairment in individuals with ADHD in time-based PM.

- **Source:** [Altgassen, Kretschmer & Kliegel — Task Dissociation in Prospective Memory Performance in Individuals With ADHD (J Atten Disord, 2014)](https://pubmed.ncbi.nlm.nih.gov/22660916/)
- **Credibility:** Peer-reviewed within-subjects study, 25 ADHD vs 25 controls, parallel task constraints (Dresden Breakfast Task). Small N but the matched-paradigm design is exactly the time-vs-event question.
- **Design implication:** Prefer event/context cues over time/schedule cues. A reminder tied to an observable trigger ("when you open this project", "when you hit the terminal") will land far more reliably than "review at 9am Friday." De-emphasize timed digests; emphasize contextual resurfacing.

### RT3. In adult ADHD, long-term memory problems trace to ENCODING (weak, effortful learning at input), while RETRIEVAL processes are essentially intact — the deficit is getting it in, not getting it back out.

> In contrast, no retrieval problems were observable. The results suggest that memory deficits in adult ADHD reflect a learning deficit induced at the stage of encoding.

- **Source:** [Skodzik, Holling & Pedersen — Long-Term Memory Performance in Adult ADHD: A Meta-Analysis (J Atten Disord, 2017)](https://journals.sagepub.com/doi/10.1177/1087054713510561)
- **Credibility:** Meta-analysis (strongest evidence tier here); verbal long-term-memory deficit mediated by acquisition, retrieval intact. Verbal more affected than visual. Highly relevant and credible.
- **Design implication:** Lower the bar at retrieval, not encoding: since retrieval machinery works, give the user retrieval CUES. The system's job is to re-present material (so the intact retrieval/recognition system can grab it), not to demand the user reconstruct it from a blank box.

### RT4. Recognition (picking the right item from shown candidates) leans on the intact retrieval side, whereas free recall (producing keywords from nothing) compounds the ADHD encoding weakness — so SHOWING candidates beats asking the user to recall search terms.

> an initial deficit in acquisition but no increase in effect size in subsequent testing of free delayed memory or recognition

- **Source:** [Andersen, Egeland & Øie — Learning and memory impairments in children and adolescents with ADHD (J Learn Disabil, 2013)](https://pubmed.ncbi.nlm.nih.gov/22392892/)
- **Credibility:** Peer-reviewed case-control (131 youth). Honest nuance: recognition is NOT fully spared here — but the deficit doesn't grow from acquisition to recognition, i.e. it's encoding-bound, not a retrieval/recognition failure. Pediatric sample; combine with RT3 (adult meta-analysis) for the adult case.
- **Design implication:** Design the primary interface around RECOGNITION: resurfaced cards, candidate lists, visible recent/related notes the user can say "yes, that one" to. Treat keyword search as a fallback, not the front door — a blank search box asks for exactly the free-recall the user is worst at.

### RT5. Retrieval practice (active recall / testing effect) DOES benefit ADHD learners as much as non-ADHD — but it can't compensate for shallow encoding, so the win comes from making recall happen, not from heavier study sessions.

> Although retrieval practice is effective in this group, improved strategy use may be necessary to ensure performance that is fully equivalent to that of students without ADHD.

- **Source:** [Minear et al. — Is practice good enough? Retrieval benefits students with ADHD but does not compensate for poor encoding (Frontiers in Psychology, 2023)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1186566/full)
- **Credibility:** Peer-reviewed experiment, 72 college students (36 ADHD), 2-day retention. Direct, recent, on-point for the spaced-repetition question.
- **Design implication:** Lightweight resurfacing that prompts a moment of active recall ("what was this note about?") is genuinely worth building — the mechanism works for ADHD. But pair it with better capture/encoding (forcing a one-line "why I saved this"), since resurfacing thin notes won't rescue thin encoding.

### RT6. Spaced-repetition systems fail ADHD users primarily through review-queue DEBT: a missed stretch compounds into an overwhelming backlog, which triggers avoidance and abandonment — the shame of the due-count, not the algorithm, kills it.

> A common failure mode is to use Anki for two weeks, then drop it, and pick it back up six months later to find you have 600 cards due for review.

- **Source:** [Catching Up On Your Anki Reviews — Control-Alt-Backspace](https://controlaltbackspace.org/catch-up/)
- **Credibility:** Community/practitioner blog (not peer-reviewed) — labeled as folklore-grade but widely echoed; the compounding-backlog mechanic is real and quantifiable (≈7 reviews spawned per new card). Use as design signal, not clinical proof.
- **Design implication:** NEVER show a growing "X items overdue" counter. No accumulating debt: if the user misses days, the queue should silently decay/reshuffle, not pile up. Cap any review surface to a tiny fixed set, and make skipping consequence-free. The system absorbs the lapse instead of billing the user for it.

### RT7. The scheduled "weekly review" ritual (GTD's keystone) is, for ADHD, simultaneously the most valuable and the hardest-to-sustain habit — it reliably lapses, after which the system rots into a graveyard of stale items.

> Here's the thing about GTD: the system only works if you regularly review it. For ADHDers, this review habit is both the hardest part to maintain AND the most valuable. Without regular reviews, your system becomes a graveyard of outdated tasks and forgotten projects.

- **Source:** [How to Start Using GTD Without Getting Overwhelmed — Work Brighter](https://workbrighter.co/gtd-getting-started/)
- **Credibility:** Practitioner blog (lived-experience + coaching), not academic. Consistent with RT2 (time-based prospective-memory failure explains why a SCHEDULED review lapses). Treat as credible folklore corroborated by mechanism. (Quote-hardening 2026-06-10: citation corrected from /gtd-adhd/ to this page, and quote replaced with the page's exact wording.)
- **Design implication:** Do not architect the PKMS around a mandatory periodic review the user must self-initiate (it will lapse, per RT2). Replace the big weekly ritual with continuous, ambient, event-triggered micro-resurfacing so "review" happens passively even when the ritual dies.

### RT8. Barkley's core EF principle: because internal/working memory is too weak to control behavior in ADHD, the fix is to EXTERNALIZE information as physical cues placed in the environment at the point of performance.

> they will be best assisted by "externalizing" those forms of information; the provision of physical representations of that information will be needed in the setting at the point of performance.

- **Source:** [Russell A. Barkley — The Important Role of Executive Functioning and Self-Regulation in ADHD (factsheet)](https://www.russellbarkley.org/factsheets/ADHD_EF_and_SR.pdf)
- **Credibility:** Authoritative clinical theorist (Barkley) factsheet, synthesizing his EF model; not a single study but a leading expert's framework. Top-tier for design rationale.
- **Design implication:** The PKMS is a prosthetic external memory: its value is putting the right cue in the user's sensory field at the moment of action. Favor surfacing notes INTO the user's active context (editor, terminal, current project view) over a separate "go open your vault and remember to look" destination.

### RT9. Re-instating the original CONTEXT at retrieval reliably improves memory (environmental context-dependent memory), and the reinstatement can be MENTAL — a snapshot/visualization of the encoding context works, not just physically returning to it.

> across all studies, environmental context effects were reliable... mental reinstatement of appropriate context cues at test... reduce the effect of environmental manipulations

- **Source:** [Smith & Vela — Environmental Context-Dependent Memory: A Review and Meta-Analysis (Psychon Bull Rev, 2001)](https://pubmed.ncbi.nlm.nih.gov/11495110/)
- **Credibility:** Classic, heavily-cited meta-analysis (general memory, not ADHD-specific). Strong evidence the effect is real and that mental cue-reinstatement substitutes for physical return. Cross-apply to ADHD with appropriate caution.
- **Design implication:** Capture and store CONTEXT alongside each note: what file/project/page/conversation you were in, time, surrounding breadcrumbs. On resurfacing, replay that context ("you saved this while working on X") to reinstate the encoding state — a "where was I" snapshot is a genuine retrieval aid.

### RT10. After an interruption, a retrieval CUE left at the breakpoint sharply reduces the "resumption lag" needed to get back into a suspended task — externalized goal cues let you re-establish where you were instead of rebuilding it from memory.

> cues available immediately before an interruption facilitate performance immediately afterwards (reducing the resumption lag)

- **Source:** [Altmann & Trafton — Task Interruption: Resumption Lag and the Role of Cues (Cognitive Science, 2004)](https://www.interruptions.net/literature/Altmann-CogSci04.pdf)
- **Credibility:** Peer-reviewed cognitive-science work backed by the Memory-for-Goals model (Altmann & Trafton 2002). General population, but the mechanism (suspended-goal activation decays; cues re-prime it) maps directly onto ADHD's interruptibility/hyperfocus-switching. Note: verbatim quote taken from a corroborating search snippet, not the raw PDF.
- **Design implication:** Build first-class "breadcrumb on exit" capture: when the user drops a task/note, let them leave a one-line resumption cue ("next: wire up the parser"). On return, lead with that cue. This directly serves the user's task-initiation struggle by removing the re-orientation cost.

### RT11. ADHD involves temporal myopia and strong pull toward immediate reward — behavior is governed by the "now," so distant/predictable payoffs under-motivate; salient, near-term reinforcement is what drives engagement.

> much of one's behavior will be aimed at maximizing the immediate rewards and escaping from immediate hardships... without concern for the delayed consequences

- **Source:** [Russell A. Barkley — The Important Role of Executive Functioning and Self-Regulation in ADHD (factsheet)](https://www.russellbarkley.org/factsheets/ADHD_EF_and_SR.pdf)
- **Credibility:** Barkley framework (expert synthesis) + converging delay-aversion/steeper-discounting literature in ADHD (e.g., smaller-sooner reward preference; see MO9). Strong conceptually; the engagement-design leap is inference, label accordingly.
- **Design implication:** Resurfacing must pay off NOW: an immediately interesting/useful re-encounter, not "this will help future-you." Make each surfaced item feel like a small immediate win (a delightful old idea, a usable snippet) rather than a chore owed to a distant goal.

### RT12. Unpredictable (variable-ratio/interval) rewards drive more persistent engagement than predictable ones — the same intermittent-reinforcement mechanic that makes feeds compulsive can make serendipitous note re-encounter sticky — but it is double-edged and can tip into compulsion.

> Variable ratio schedules reward after an unpredictable number of actions (e.g., random slot pulls)—producing faster, more persistent behavior... Variable rewards are extraordinarily good at inflating wanting while delivering relatively little liking. That gap, between how hard you pursue something and how much you actually enjoy it when it arrives, is where compulsive behavior lives.

- **Source:** [Variable Reward Psychology: The Science Behind Unpredictable Reinforcement — Neurolaunch](https://neurolaunch.com/variable-reward-psychology/)
- **Credibility:** Popular-science synthesis of well-established operant-conditioning principles (variable-ratio schedules are textbook Skinner). The behavioral law is solid; the specific application to note-resurfacing is untested inference. Honest weak link: no ADHD-specific or PKMS-specific study. (Quote re-verified verbatim against the page 2026-06-10; the earlier paraphrased compulsion sentence was replaced with the page's actual wording.)
- **Design implication:** Make serendipitous resurfacing UNPREDICTABLE rather than a fixed daily digest — a "surprise me" / random-old-note surface taps variable reward and likely sustains return visits better than a scheduled review (which also dodges the lapse problem in RT7). Guardrail: keep it bounded and user-pulled so it aids re-encounter without becoming a compulsive slot-machine.

---

## Coverage notes

**Scaffolding track.** SEARCHED: PubMed/PMC and Google Scholar trails for smartphone/assistive-tech trials in adult ADHD; digital-intervention meta-analyses 2023–24; prospective-memory smartphone reminder RCTs; cognitive offloading / intention offloading (Risko & Gilbert; Gilbert lab reviews); implementation intentions (Gawrilow/Gollwitzer ADHD work; Toli et al. clinical meta-analysis); organizational-skills-training meta-analysis (Bikic 2017) and the adult bridge (Solanto 2010; Knouse & Safren CBT review); reminder habituation/alert fatigue (Ancker 2017, primary source chased from secondary citations); cue-based reminder properties (Rogers & Milkman 2016); ADHD app marketplace review (Păsărelu 2020); wearable/haptic reminder pilots. FETCHED AND READ: Barkley EF/SR factsheet full text (PDF extracted via pypdf — verbatim quotes from the actual document), Gilbert intention-offloading review (PMC), Selaskowski RCT abstract, Bikic meta abstract, Toli meta abstract, Ancker abstract, 2024 digital-interventions meta abstract. GAPS/HONESTY: (a) no reminder-habituation study in an ADHD-diagnosed adult sample found — SC8 is clinical-informatics analogue evidence; (b) implementation-intention evidence in ADHD specifically is pediatric and lab-based — adult-ADHD field trials of if-then planning appear not to exist yet; (c) full texts behind ScienceDirect/Wiley paywalls not retrieved — abstracts and PMC versions used; (d) wearable/haptic evidence is pilot-grade and was left out as too weak; (e) an arXiv scoping review of assistive tech for adults with ADHD surfaced but is a preprint and was not relied on. OPEN QUESTIONS: optimal notification dose/spacing before habituation in ADHD adults; durability of adult organizational gains after support withdrawal; whether distinctive-cue rotation actually prevents interface banner blindness in long-term tool use.

**Motivation track.** Searched and fetched across all six assigned subtopics. PRIMARY/STRONG sources secured: Barkley EF/self-regulation factsheet (full text via pypdf — verbatim quotes on performance-not-knowledge, point of performance, externalized motivation, temporal myopia, step-a-day); Marx et al. 2021 delay-discounting meta-analysis; Bryant et al. 2024 gamification meta-analysis (JAMA Pediatrics via PMC); Beaton, Sirois & Milne 2022 self-compassion study (PMC, n=856); Rowney-Smith et al. 2026 RSD qualitative study (PMC). MIXED/CLINICAL sources flagged honestly: Dodson's interest-based nervous system and RSD (ADDitude, clinician-authored but not peer-reviewed/operationalized); ADDA and a commercial blog for ADHD habit-formation mechanism (popular education built on real EF science). For graded task assignment the only page fetched was a weak CBT-tools site — the technique itself rests on solid behavioral-activation RCTs (Jacobson/Dimidjian/Cuijpers) not fetched individually; flagged as depression-literature crossover. SKIPPED/COULDN'T FULLY REACH: no primary self-compassion-intervention RCT in ADHD retrieved (efficacy inferred from association + other populations); original Lally et al. automaticity paper cited via ADDA, not fetched; the ego-depletion replication debate bearing on Barkley's willpower-as-resource sub-claim not chased — noted as a caution. Out-of-scope content in sources was excluded per project rules. OPEN QUESTIONS for the designer: (1) does gamification durability hold for an adult software engineer? (untested — the pediatric trials lack follow-up, and within them age showed no significant moderation) (2) is there direct evidence self-compassion framing improves tool *adherence* (vs. mental health)? — untested. (3) the interest-based-nervous-system framework is a heuristic to validate against THIS user's behavior, not a settled fact.

**Retrieval track.** SEARCHED & READ (fetched/confirmed): prospective memory in adult ADHD (PLOS ONE 2013; Altgassen 2014 time-vs-event); long-term memory meta-analysis (Skodzik 2017 — encoding deficit, retrieval intact); recall vs recognition (Andersen 2013); retrieval-practice/testing effect in ADHD (Minear 2023); Anki/SRS backlog failure (Control-Alt-Backspace community); GTD weekly-review-and-ADHD (Work Brighter); Barkley EF/SR factsheet (full text via pypdf for verbatim externalization + temporal-myopia quotes); context-dependent memory meta-analysis (Smith & Vela 2001); task-resumption cues (Altmann & Trafton 2004 + Memory-for-Goals 2002); ADHD reward/delay-aversion studies; variable-ratio reinforcement (Neurolaunch synthesis); object-permanence/out-of-sight popular sources (consulted, folded into RT8 rather than cited standalone). SKIPPED/COULDN'T REACH: Springer prospective-memory-mediates-procrastination paper hit an auth redirect — confirmed via search abstract but not fetched, so left out of formal findings; Barkley and Altmann PDFs were binary to WebFetch (Barkley resolved via pypdf; Altmann verbatim taken from a corroborating search snippet, not the raw PDF). No spaced-repetition-adherence RCT specifically in ADHD found — RT6 rests on community evidence, honestly labeled. EVIDENCE QUALITY MAP: strongest = RT3, RT9 (meta-analyses), RT2/RT4/RT5 (peer-reviewed studies), RT10 (peer-reviewed + formal model), RT1. Framework-grade = RT8, RT11 (Barkley). Weakest/folklore (labeled) = RT6, RT7 (community/coaching blogs), RT12 (textbook principle, untested in this application). OPEN QUESTIONS: (1) no direct study tests "show candidates vs. search box" for ADHD retrieval — RT3+RT4 support it by mechanism, but it's an inference worth a small in-product A/B; (2) no ADHD-specific evidence that unpredictable resurfacing sustains engagement better than digests (RT12 is extrapolation); (3) the compulsion risk of variable-reward resurfacing is unquantified for a single-user knowledge tool; (4) whether mental context reinstatement (RT9, general-population) holds as strongly in ADHD given the encoding deficit is untested.

## Verification

Nine findings sampled across the three tracks (three per track) by an adversarial fact-checker. A follow-up quote-hardening pass (2026-06-10) fixed all five flagged findings against their primary sources and spot-checked the unsampled motivation-track quotes (MO2, MO8, MO9, MO10, MO11); MO3/MO4/MO5 were skipped as already verified clean against the Barkley PDF.

**Sampled — scaffolding track (3/3 verified):**

- [verified] SC1 — Exact quote appears verbatim in the Barkley PDF at the stated URL, listed as Principle 1 of his EF-deficit management framework; surrounding text fully supports the broader externalization claim.
- [verified] SC7 — Paper exists at the stated ScienceDirect URL (paywalled, 403 for verbatim check), but multiple independent corroborating sources (ResearchGate listing, a 2024 PMC review citing it, abstract-derived summaries) confirm the 109-app count and the zero-efficacy-evidence finding. Verbatim phrase "few contained information regarding app development" could not be confirmed word-for-word without journal access.
- [verified] SC12 — The Solanto 2010 RCT is real and matches all stated parameters (AJP 167(8), n=88, 12-week meta-cognitive therapy vs attention-matched control, significant inattentive-symptom reduction). Structural note: the attached quote is from the Barkley factsheet, not the Solanto paper — a deliberate dual-source structure the finding's own credibility note discloses; a reader checking only the Solanto URL will not find the quote there.

**Sampled — motivation track (all three initially failed quote-level verification; all fixed):**

- [fixed 2026-06-10] MO1 — Original quote contained "dopamine signaling"/"frontostriatal networks" language absent from the source; replaced with confirmed verbatim text from the feno.co article (early-stage habits draw on executive functions; the effortful pre-automatic stage is harder to sustain).
- [fixed 2026-06-10] MO7 — Original scoping-review passage does not appear in the PMC article; replaced with confirmed verbatim text from the article's abstract and introduction ("remains relatively unexplored... To date, few studies have investigated the potential association between ADHD and rejection sensitivity"); claim heading reworded to match what the source actually says.
- [fixed 2026-06-10] MO12 — "If I can get engaged, I can do anything" does not appear in the ADDitude article; replaced with the real verbatim sentences ("People with ADHD primarily get in the zone by being interested in, or intrigued by, what they are doing... if they get engaged with a task, they can do it"); heading reworded to drop the fabricated inner quote.

Original checker's summary for this track stands as history: all three failed verbatim-quote verification, but in each case the cited source existed and broadly supported the underlying claim and design implication. The 2026-06-10 pass also spot-checked the unsampled motivation-track quotes against their primary sources:

- [verified 2026-06-10] MO8 — All three quote fragments appear verbatim in the PMC article (abstract Results/Conclusions and introduction).
- [verified 2026-06-10] MO9 — Quote appears verbatim in the PubMed abstract (ellipsis spans only the connective "Moderation analyses show that").
- [verified 2026-06-10] MO11 — Both sentences appear verbatim on the cited page, including the source's own grammar ("graded task assignment raise homework completion").
- [fixed 2026-06-10] MO2 — Original quote's first sentence ("Research on context stability shows...") is actually from the feno.co article (MO1's source), not add.org; replaced with confirmed verbatim add.org text. The 4-to-335-days sentence was genuine and was kept in its exact source form.
- [fixed 2026-06-10] MO10 — Original quote's second sentence ("gamification's efficacy decreases in adolescents... compensatory strategies and ceiling effects") does not appear in the JAMA Pediatrics article, and the article's moderator analysis actually found NO significant age association. Quote replaced with confirmed verbatim abstract/results text; the "efficacy drops with age" claim removed from the heading, takeaways, and coverage notes.

**Sampled — retrieval track (1/3 verified):**

- [verified] RT1 — Quote appears verbatim in the paper's conclusions; the planning-deficit interpretation is the study's central finding (plan recall nearly identical between groups, planning execution d = 1.60).
- [fixed 2026-06-10] RT7 — Citation corrected to workbrighter.co/gtd-getting-started/ (where the statements actually live) and the quote replaced with the page's exact wording ("For ADHDers, this review habit is both the hardest part to maintain AND the most valuable" — the earlier rendering had also lightly rephrased this sentence).
- [fixed 2026-06-10] RT12 — Quote trimmed to confirmed verbatim text: first sentence restored to its exact source form (including the "(e.g., random slot pulls)" parenthetical the earlier rendering silently dropped), and the paraphrased compulsion sentence replaced with the page's actual verbatim wanting-vs-liking/compulsion passage.

**Overall:** original sample: 4/9 findings fully verified, 5/9 failed at the quote/citation level — no sampled claim was substantively false; every failure was a quote that didn't appear in the cited source, appeared on a different page, or was a paraphrase dressed as verbatim. After the 2026-06-10 quote-hardening pass: all 5 flagged findings fixed with confirmed verbatim quotes and corrected citations, and 5 unsampled motivation-track findings spot-checked (3 verified clean, 2 fixed — including MO10, where a secondary "decays with age" claim contradicted the source's own moderator analysis and was corrected throughout the note). Every blockquote in this note has now been either checker-verified or re-extracted verbatim from its primary source, except SC7 (paywalled — corroborated via secondary sources, flagged inline) and RT10 (verbatim taken from a corroborating search snippet, not the raw PDF, flagged inline).
