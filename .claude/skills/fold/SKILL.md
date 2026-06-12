---
name: fold
description: Fold vault/inbox/ captures into the vault — propose filing, wikilinks, and task extraction as a pick list, apply on approval. Use when the user says /fold, "fold the inbox", "process my captures", or when captures are waiting and the user asks what's next in the vault.
---

# /fold — the inbox folds itself

You are the organizing half of the PKMS division of labor: **Kenja dumps, you
structure** (decisions G3/G9). Captures in `vault/inbox/` are one file each with
`captured:`/`source:` frontmatter. Folding moves their content to where it belongs,
logs what happened, and leaves the inbox empty — with Kenja only ever picking from
options you present.

## Hard rules (design language — these are constraints, not style)

- **Present-then-ask, ONE question max.** Build the complete proposal first, then ask
  a single question whose answers are options, never a blank prompt (§9). Use
  AskUserQuestion. Skipping must always be a free, offered option.
- **Shame-free copy.** Never say how long a capture sat, never count the inbox as a
  backlog, never frame anything as overdue or behind. A gap since the last fold is
  not mentioned. Skipped items are simply "left for later" — no tally.
- **Filing is cosmetic** (G3). Nothing depends on location; retrieval survives churn.
  When the right home is unclear, the daily note's `## notes` section is a fine
  destination — never agonize, never ask a second question to resolve placement.
- **Dedupe is your job, silently** (§1). Before proposing, `pkms search` a key phrase
  from each capture. If it duplicates an existing note, propose "merge into [[that]]"
  — duplicates are normal, never remark on them critically.
- **Nothing is ever thrown away.** Content always lands somewhere before its inbox
  file is removed. If a capture looks like a throwaway test, offer "let it go" as an
  option — Kenja choosing deletion is control; you never propose-and-apply it alone.

## Procedure

1. Read every `vault/inbox/*.md`, oldest first. If empty: say "inbox clear — nothing
   to fold" and stop (empty state is a win, not a void).
2. For each capture decide a proposal:
   - **append** to an existing note (cite it as `[[stem]]`) — when search shows a home;
   - **new note** in `projects/`, `areas/`, or `resources/` — only when it clearly
     starts something; title it plainly;
   - **daily note** `## notes` — ephemera, journal-ish lines, anything unclear;
   - **task**: lines shaped like to-dos become `- [ ] …` in the destination note
     (plain checkboxes for now — the ⏱▶✓ task model is slice 5);
   - **let it go** — offered only for obvious test/noise captures, never preselected.
   Weave `[[wikilinks]]` into folded content where targets actually exist (verify
   with `pkms backlinks`/`pkms search`, don't invent stems).
3. Present the whole plan compactly (one line per capture: excerpt → destination),
   then ask the ONE question: options like "fold all as proposed", per-item
   alternates when few items, and "leave it all for later" (free).
4. On approval, apply:
   - Carry provenance: folded content keeps a quiet trailing line
     `*(captured 2026-06-12 · hotkey)*`.
   - Ensure today's daily note exists: `pkms daily --no-open`.
   - Log each fold under `## folded today`: `- "short excerpt" → [[destination]]`
     (done things stay visible — §6 done-log).
   - Delete each inbox file ONLY after its content verifiably landed.
5. `pkms index`, then verify by content: `pkms search` a folded phrase and confirm it
   hits the destination, not the inbox. Report honestly if anything failed.
6. Close quietly: "N folded · inbox clear". No celebration theater, no totals-over-time.

## Question budget

The approval pick in step 3 is your one question. Zero "still interested?" questions
belong to /fold — that budget (max one per briefing, G8) is owned by the briefing
surface, not here.
