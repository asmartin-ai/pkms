---
title: "job-search-2026 distillation — what already sticks for this user"
created: 2026-06-10
modified: 2026-06-10
tags: [pkms-design, research, adhd, first-party]
status: draft
---

# 21 — job-search-2026 Distillation (First-Party Ground Truth)

Direct inspection of `K:\Projects\job-search-2026\` — the user's own active job-search workspace,
read-only. This is first-party evidence: what the user actually built and demonstrably used, not what
they report using. 14 findings, organized JS1–JS14.
Program: [[00-ground-truths]] — Synthesis target: [[10-synthesis]]

## Top takeaways

1. **The ADHD-shaped TODO format is the most-used convention.** TODO.md is 12,635 bytes, updated the day
   before inspection (2026-06-09), actively maintained, and every task section carries the full ⏱/▶/✓
   marker set. It is the highest-evidence "stuck" convention in the workspace.
2. **HANDOFF.md works and was actively maintained.** A 5,745-byte cross-session continuity doc updated
   2026-06-09, with explicit "suggested first action" for a cold-start agent — the user built and used this
   pattern, not just designed it.
3. **The achievement ledger is genuinely alive.** It carries timestamped entries, a 2026-06-09 update
   annotating a Codex round-trip, and a forward-looking "Future Entries" section — it is being written into,
   not just read.
4. **The Icebox section works precisely because it is explicit.** Four items are deliberately parked with
   no guilt attached — the Icebox is a real written section with named items, not just a vague future pile.
5. **The "sanctioned hyperfocus side-lane" is a named design pattern that solved a real problem.** FPGA/DV
   interest is explicitly granted a lane in TODO.md (no schedule, no guilt), keeping it from competing with
   the primary lane — a concrete anti-shame mechanism.
6. **One major designed feature has not yet been used:** the kanban PNG (task_board.py was written and
   task-board.png generated, but there is no evidence of recurring use or update — it appears to have run
   once). The weekly engine is also paused. These are the honest "designed but not demonstrated sustained"
   exceptions.

---

## Findings

### JS1. ADHD-shaped TODO markers (⏱ / ▶ / ✓) — demonstrably used, not just designed

**Claim:** Every task in TODO.md carries a ⏱ size estimate, a ▶ first-action starter (~10 min), and a
✓ done-when closure criterion. The header explains the format in plain English. This is the primary task
management surface.

**Evidence:** TODO.md, LastWriteTime 2026-06-09 17:26:11, Length 12,635 bytes. The file is densely
populated across 178 lines. Every non-trivial open task in the flagship, quick-wins, and weekly-engine
sections carries the three markers. The "How to use this list" preamble is explicit: "Work the sections
top to bottom: Decision gate → 15-min unblocks → Weekly engine → Flagship." The format also appears in
HANDOFF.md (tasks referenced back to TODO.md for their ⏱/▶/✓ details).

**Source:** `K:\Projects\job-search-2026\TODO.md`

**Design implication:** The three-part marker set is low enough friction to be applied universally across
a real workspace under real time pressure. The PKMS task format should make these three fields a
first-class affordance — not optional metadata, but the visible body of every task.

---

### JS2. Decision gates as a top-of-file section — demonstrably used

**Claim:** "STEP 0 — The decisions that gate everything" is a named section at the top of TODO.md,
distinct from actionable tasks. Two current open decisions are listed here (stay/go, pick a lane), both
with explicit done-when criteria and no artificial deadlines.

**Evidence:** TODO.md lines 22–34. Section header reads "## 🎯 STEP 0 — The decisions that gate
everything." The preamble says "Work the sections top to bottom: Decision gate → …" — showing the
decision-gate section comes first by design, not accident. One decision (stay/go) was explicitly added
2026-06-09, indicating active maintenance.

**Source:** `K:\Projects\job-search-2026\TODO.md`

**Design implication:** Unmade decisions are a first-class entity in this user's system, not implicit
blockers buried under tasks. The PKMS should model decisions separately from tasks and surface them first.
A "decisions pending" view before the task queue is appropriate for this user.

---

### JS3. Icebox section with named items — demonstrably used

**Claim:** TODO.md has an explicit "Icebox" section containing four named items that are deliberately
out-of-scope for the current working period, each with a brief rationale.

**Evidence:** TODO.md lines 161–167. Items are: MISRA-C module, CAN/ARINC-825 logger, UAV capstone,
FPGA hardware purchase, and two study courses. Each is named but has no ⏱/▶/✓ markers — deliberately
kept inert. The preamble explicitly says "One task at a time; everything else stays out of sight in the
Icebox." The Icebox section is present and populated with real future items, not a placeholder heading.

**Source:** `K:\Projects\job-search-2026\TODO.md`

**Design implication:** The Icebox is a shame-free parking lot that makes strategy real — by naming what
is NOT being worked on, the user avoids the guilt of ignoring items scattered across the main list. The
PKMS should support an explicit Icebox/deferred-to concept that keeps items visible in one place but
invisible in default task views.

---

### JS4. HANDOFF.md cross-session continuity pattern — demonstrably used

**Claim:** HANDOFF.md is a 5,745-byte self-contained briefing document for resuming the project from
cold start. It includes who, where the work lives, what's done, what's open (by number), guardrails,
how-to, and a "suggested first action." It was updated the same day as TODO.md.

**Evidence:** HANDOFF.md, LastWriteTime 2026-06-09 17:26:27. The document is dense, structured, and
cross-references TODO.md explicitly. The "Suggested first action" section ends with a concrete instruction:
"Ask Aaron which of #7/#8/#10 to draft first … then proceed." The 2026-06-09 timestamp shows it was
maintained alongside the rest of the session's work — not just written once and abandoned.

**Source:** `K:\Projects\job-search-2026\HANDOFF.md`

**Design implication:** Continuity across sessions is a solved problem here: one document, self-contained,
with a concrete entry point. For the PKMS this maps to a per-project "resume-from-here" affordance —
probably a pinned section in the project note. The key feature is the explicit "first action" that makes
cold-resume low-cost.

---

### JS5. Done section with datestamped entries — demonstrably used

**Claim:** TODO.md has a "Done" section at the bottom that lists completed work items by date, with file
references and brief descriptions. Tasks are moved here when completed, providing a visible achievement
record without inflation.

**Evidence:** TODO.md lines 168–178. Five completed items are listed with dates (2026-06-02 through
2026-06-09). Each entry names the output file and a brief description. The section grew from the
2026-06-02 initial entries to new 2026-06-08 and 2026-06-09 entries — showing active use over the span
of the project. Completed tasks in the body of the doc carry "[x]" markers (e.g. the three 15-minute
unblocks resolved 2026-06-09 in one sitting).

**Source:** `K:\Projects\job-search-2026\TODO.md`

**Design implication:** Closure is the reward — moving a task to Done and seeing the list grow is
documented behavior here. The PKMS should make task closure satisfying and visible. A done-log that
shows recent completions (today/this week) is more motivating than a global count.

---

### JS6. Achievement ledger with structured evidence — demonstrably used

**Claim:** `codex-findings/resume-achievement-ledger.md` is a 9,320-byte structured log of career
accomplishments with per-entry fields: Score, System area, What I owned, Impact/result, Metric, Evidence
source, Metric confidence, Resume angle, Notes. It was updated 2026-06-09 with a new entry.

**Evidence:** resume-achievement-ledger.md, LastWriteTime 2026-06-09 16:59:23. The file has 8
substantive baseline entries (2022–2026) plus a 2026-06-09 update annotation. The template at the top
defines a repeatable schema. The "Future Entries / newest first" section shows the intended maintenance
pattern. Multiple entries carry "needs follow-up" metric confidence, showing honest calibration rather
than inflation.

**Source:** `K:\Projects\job-search-2026\codex-findings\resume-achievement-ledger.md`

**Design implication:** The ledger pattern — append-only, structured, honest about metric confidence — is
close to the "Captain's Log" found in HN research (F9 in 11-hn.md). For the PKMS, a per-project ledger
or log section with a fixed schema reduces the friction of recording accomplishments while they are fresh.
The "needs follow-up" tag is a first-class citizen, not a failure state.

---

### JS7. Sanctioned hyperfocus lane — a named anti-shame pattern

**Claim:** TODO.md explicitly names a "Sanctioned hyperfocus side-lane (FPGA/DV — no guilt, no schedule)"
within the flagship project section. This is a designed affordance for ADHD interest-switching, not an
accidental task.

**Evidence:** TODO.md line 104: "**Sanctioned hyperfocus side-lane (FPGA/DV — no guilt, no schedule):**"
followed by two specific tasks (EDA Playground testbench, FIR filter simulation). The phrase "no guilt"
is explicit. The FPGA project is also separately spec'd in `projects/fpga-dsp-filter.md` (LastWriteTime
2026-06-06, 3,148 bytes) — showing the lane was planned out, not just noted.

**Source:** `K:\Projects\job-search-2026\TODO.md`, `K:\Projects\job-search-2026\projects\fpga-dsp-filter.md`

**Design implication:** This user actively names and legitimizes their hyperfocus interests rather than
fighting them. The PKMS should support multi-lane task organization where switching lanes is a sanctioned
action, not a failure. A "side project" or "when the interest hits" lane in the task view, explicitly
labeled as guilt-free, could embody this.

---

### JS8. Kanban PNG generation — designed and run once, no evidence of recurring use

**Claim:** `build/task_board.py` is a matplotlib script that generates a 3-column kanban PNG
(THINK/DO/BUILD) with card content, footer, and a warm color scheme. task-board.png exists on disk.

**Evidence:** task_board.py, LastWriteTime 2026-06-09 14:15:49, Length 4,116 bytes. task-board.png,
LastWriteTime 2026-06-09 17:02:18, Length 179,622 bytes. The script is complete and functional. However,
the PNG is a single file (no version history, no `task-board-YYYY-MM-DD.png` series), and there is no
task in TODO.md for "update kanban weekly" or similar. The kanban content references decisions and tasks
that predate the 2026-06-09 TODO updates — suggesting it was generated once but not re-run after the
session's task changes.

**Source:** `K:\Projects\job-search-2026\build\task_board.py`, `K:\Projects\job-search-2026\task-board.png`

**Design implication:** Visual kanban boards are appealing to design but hard to sustain as a parallel
artifact alongside a text TODO. The evidence here matches the general pattern from HN research: automated
tooling runs once during setup energy, then drifts out of sync. For the PKMS, kanban views should be
derived automatically from the same source-of-truth tasks (SQLite index) rather than requiring a manual
re-run.

---

### JS9. Weekly engine section — designed but paused; honest status marking

**Claim:** TODO.md has a "Weekly engine" section with recurring tasks (apply, study sessions, git commits).
The section is marked with a prominent pause note and an explicit rationale.

**Evidence:** TODO.md lines 55–81. The section header is "## 🔁 The weekly engine (recurring — small,
fixed, non-negotiable)." Immediately below it: "**⏸ APPLY ENGINE PAUSED (2026-06-09, Aaron's call):**
not yet decided on leaving the current job." The apply task is prefixed "(PAUSED)" and has a specific
reactivation condition ("the day that decision flips to 'go'"). Study sessions and commit cadence remain
active. The pause note includes the reason and the trigger to un-pause — a clean suspension, not an
abandonment.

**Source:** `K:\Projects\job-search-2026\TODO.md`

**Design implication:** This user marks paused work explicitly with a reactivation condition rather than
deleting it or leaving it as zombie open tasks. This is the "pause over delete" principle in action
(matches the ADHD-shaped planning guideline). The PKMS should support a "paused" task state with a
resume-condition field, visible in one place but excluded from the active view.

---

### JS10. ADHD-tailored study playbooks (two companion files) — written and referenced

**Claim:** `adhd-self-study.md` and `adhd-self-study-playbook.md` are two companion research synthesis
documents (combined ~14,000 bytes) written 2026-06-06 and referenced from TODO.md's weekly engine.

**Evidence:** adhd-self-study.md, LastWriteTime 2026-06-06 16:14:45, 6,772 bytes. adhd-self-study-playbook.md,
LastWriteTime 2026-06-06 15:39:51, 7,325 bytes. Both are substantive (not stubs), with sourced tactics
(HN, r/ADHD, CHADD), concrete weekly templates, and a "concrete starter loop" tied directly to the user's
aerospace/MBD study plan. TODO.md links to adhd-self-study-playbook.md by filename in the weekly engine.
The 2026-06-06 LastWriteTime places them 3 days before the most recent TODO updates — they were written
and then built upon.

**Source:** `K:\Projects\job-search-2026\adhd-self-study.md`, `K:\Projects\job-search-2026\adhd-self-study-playbook.md`

**Design implication:** The user actively synthesizes external ADHD research into personal operational
guidance, and this synthesis is referenced (not just filed). The PKMS should support a "playbook" note
type — a living operational guide that links to tasks and stays visible in the active working context.
The format these files use (named tactics, sourced quotes, concrete weekly template) is a model for how
the PKMS could structure "how I work" notes.

---

### JS11. Codex export/import round-trip pattern — used at least once

**Claim:** The workspace contains a structured `export/codex-package-2026-06-09/` folder with a brief,
guardrails, current resume content, and achievement ledger — packaged for a separate AI agent (Codex on
the work machine). Outputs came back in `codex-output/` and were folded into the ledger and the resume
generator on the same day.

**Evidence:** export/codex-package-2026-06-09/ (4 files, LastWriteTime 2026-06-09 14:56–14:57).
codex-output/ (5 files, LastWriteTime 2026-06-09 16:54). resume-achievement-ledger.md updated
2026-06-09 16:59 with a "Codex Evidence Pass" annotation. The README-BRIEF explicitly names the tasks
and output specification for the remote agent. This is a complete workflow, not a fragment.

**Source:** `K:\Projects\job-search-2026\export\codex-package-2026-06-09\00-README-BRIEF.md`

**Design implication:** The user naturally structures multi-agent workflows as briefing packages (context
+ guardrails + task spec + output format) rather than ad-hoc prompts. This is exactly the pattern the
PKMS should support for LLM-assisted note triage: a brief that the indexer or an agent can consume,
with outputs landing in a known location. The export/findings/codex-output separation also mirrors
inbox/process/archive stages.

---

### JS12. Guardrails document — maintained and referenced across tools

**Claim:** `export/codex-package-2026-06-09/02-guardrails.md` (and its parent in HANDOFF.md) codifies
explicit do-not-claim rules for resume content. It is referenced by the Codex brief, the HANDOFF, and
the resume generator comment conventions.

**Evidence:** export/codex-package-2026-06-09/02-guardrails.md, LastWriteTime 2026-06-09 14:56:53,
1,820 bytes. HANDOFF.md "Guardrails" section (lines 64–78) names the same constraints. The achievement
ledger template includes "Notes to sanitize" as a per-entry field. The do-not-claim list (RTOS,
Lauterbach, JTAG, DOORS, MISRA, DO-178C experience) appears consistently across documents updated on
different dates.

**Source:** `K:\Projects\job-search-2026\HANDOFF.md`, `K:\Projects\job-search-2026\export\codex-package-2026-06-09\02-guardrails.md`

**Design implication:** The user maintains a "ground truth" document that constrains what can be claimed
elsewhere — a source-of-constraints pattern. For the PKMS, this maps to a project-level policy note that
is referenced (linked) from task documents rather than duplicated. The PKMS linker could surface
"this note is referenced by N others" to indicate which notes are load-bearing.

---

### JS13. 15-minute unblock batching — used, closed in one sitting

**Claim:** TODO.md has an "Unblock batch" section that groups several small decisions into a single
sitting. All three were resolved on 2026-06-09 and marked [x], with a "RESOLVED 2026-06-09 (all three
answered in one sitting)" annotation.

**Evidence:** TODO.md lines 37–47. The section header: "## ✅ The 15-minute unblocks — RESOLVED
2026-06-09 (all three answered in one sitting)." All three items carry [x]. The tasks (resume location,
LinkedIn URL decision, website push decision) are genuinely small but previously blocking. The annotation
is honest about the mechanism: "all three answered in one sitting."

**Source:** `K:\Projects\job-search-2026\TODO.md`

**Design implication:** This validates the "batch tiny unblocks" ADHD planning principle — one activation
cost, multiple closures. The PKMS should have a first-class "quick unblocks" or "2-minute decisions"
section that groups small blockers for a single sitting. Closing all of them in one annotation is the
reward.

---

### JS14. Interview story bank with per-story status markers — written, none practiced yet

**Claim:** `interview-prep.md` is a 20,234-byte document with 15 STAR stories, each with an evidence-safe
draft, memory-fill prompts, and a safe sound bite. Each story has a status marker: `[ ]`, `[~]`, or `[x]`.

**Evidence:** interview-prep.md, LastWriteTime 2026-06-08 16:16:37. All 15 stories carry `[~]` (rough
notes, needs memory fill) — none carry `[x]` (practiced out loud). The "Quick-start" note explicitly
names which stories to practice first (#1 and #5). TODO.md references "Interview prep — memory fill"
as an open task with the ▶ first action "one story per day, out loud, 10 min." The story bank was
written 2026-06-08; there is no evidence of any oral practice having occurred in the subsequent days.

**Source:** `K:\Projects\job-search-2026\interview-prep.md`

**Design implication:** High-quality structured artifacts that require a follow-on human action (practicing
out loud) can sit unstarted even when the artifact itself is polished. The gap between "written" and "used"
is the task-initiation problem. The PKMS should distinguish content-ready items from action-complete ones,
and the first action for a practice task should be as small and concrete as possible (one story, timed,
out loud — the `▶` marker here is correct but the task hasn't fired). This is a real-world instance of
the HN finding that closure matters more than capture.

---

## Coverage notes

**Files read:** TODO.md (full), HANDOFF.md (full), README.md (full), adhd-self-study-playbook.md (full),
adhd-self-study.md (full), codex-findings/resume-achievement-ledger.md (full), codex-findings/resume-quarterly-snapshot-2026-Q2.md (full), build/task_board.py (full), export/codex-package-2026-06-09/00-README-BRIEF.md (full), projects/fpga-dsp-filter.md (full), pivot-projects.md (full), job-leads.md (full), skills-investment-plan.md (full), interview-prep.md (first 140 lines + story status scan), semiconductor-pivot.md (first 60 lines).

**Files not read in full:** interview-prep.md stories 3–15 (structure confirmed via grep, content skipped),
masters-programs.md (first 50 lines read; 32,793 bytes — content is reference material, not convention evidence),
codex-findings/ research files (structure confirmed via listing, content not needed for convention evidence),
compensation-history.md, ai-sentiment-research.md, ai-sentiment-research.md, github-profile/README.md
(supplementary reference material). The `private/` folder contains compensation PDFs — not read (not
relevant to conventions; also sensitive).

**Scope note:** job-search-2026 is NOT a git repo (confirmed: `fatal: not a git repository`). Modification
times are the primary temporal signal. The project spans 2026-06-02 to 2026-06-09 — approximately 8 days
of documented work. This is a short time window; "stuck" here means "actively maintained through the
visible session," not "survived >1 year." Where duration is claimed, it is scoped to this window.

---

## Verification

**Evidence type:** Direct file and metadata inspection of `K:\Projects\job-search-2026\`. All findings
are grounded in file contents and filesystem modification times read in this session. No user self-report
relied upon.

**Key files and mtimes relied upon:**

| File | LastWriteTime | Significance |
|---|---|---|
| TODO.md | 2026-06-09 17:26:11 | Primary task surface; most recent update |
| HANDOFF.md | 2026-06-09 17:26:27 | Cross-session continuity doc; co-updated with TODO |
| codex-findings/resume-achievement-ledger.md | 2026-06-09 16:59:23 | Ledger active; 2026-06-09 entry present |
| build/task_board.py | 2026-06-09 14:15:49 | Kanban script; generated once |
| task-board.png | 2026-06-09 17:02:18 | Single output file; no update series |
| adhd-self-study-playbook.md | 2026-06-06 15:39:51 | Written 3 days before final session |
| interview-prep.md | 2026-06-08 16:16:37 | All 15 stories at `[~]`, none at `[x]` |
| export/codex-package-2026-06-09/ | 2026-06-09 14:56–14:57 | Export/import round-trip used once |
| codex-output/ | 2026-06-09 16:54:38 | Round-trip outputs received and folded |

**Git history:** Not available — job-search-2026 is not a git repository. Temporal ordering relies
entirely on LastWriteTime metadata.

**Confidence:** High for JS1–JS6, JS9, JS13 (directly in the most-recent TODO.md). Medium for JS7–JS8,
JS11–JS12 (multi-file evidence, one of which could have been generated by an agent rather than the user
directly choosing the convention). JS14 is high-confidence as a "written but not practiced" finding —
the `[~]` markers are unambiguous.
