# AGENTS.md — PKMS project rules

Layers on top of `C:/Users/Kenja/agent-hub/AGENTS.md` (global rules).
This file is the repo-local source of truth for agents that understand the AGENTS.md standard.
`CLAUDE.md` is kept only as a Claude Code compatibility shim that imports this file.

---

## Remote setup

This local clone works against two GitHub remotes:

| Remote | URL | Visibility | Role |
|--------|-----|------------|------|
| `canonical` | `asmartin-ai/pkms-canonical` | **private** | Full vault state — push work here |
| `origin` | `asmartin-ai/pkms` | public | Sanitized mirror — push via `scripts/build_public_mirror.py` |

**Rule:** push canonical `main` to `canonical` (private). Never push canonical raw to
`origin` (public). Public updates use the mirror build pipeline. Full policy:
`docs/publication-safety.md`.

---

# PKMS — Personal Knowledge Management System

## Project overview

Hybrid PKMS: markdown files in `vault/` are the source of truth; SQLite database in `.index/pkms.db` is a derived, regenerable index for fast search and backlink tracking.

**Design language:** before designing any surface, flow, copy, or automation, read
`K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md` — the shared ADHD design language
(single source of truth with content-hoarder; reference by path, never copy; rules for
editing it are in that repo's README).

## Vault structure

```
vault/
  daily/       # Daily notes, YYYY-MM-DD.md   (gitignored — kept local)
  inbox/       # Raw captures awaiting /fold   (gitignored — kept local)
  projects/    # Active project notes
  areas/       # Ongoing responsibilities (health, finance, etc.) — currently empty
  resources/   # Reference material
  archive/     # Completed / inactive notes — currently empty
```

`vault/daily/`, `vault/inbox/`, and `vault/media/` are gitignored (personal content
kept local; the app recreates the dirs on demand). The rest of the vault is tracked.

## Source layout

```
src/pkms/      # Core library
  db.py        # SQLite schema, migrations
  indexer.py   # Vault scanner → DB
  search.py    # Full-text search
  linker.py    # [[wikilink]] parsing, backlink graph
  tasks.py     # TODO/task extraction and tracking
  cli.py       # Entry point (Typer CLI)
tests/
scripts/       # One-off maintenance scripts
```

## Key conventions

- Notes use `[[wikilink]]` syntax for internal links
- Frontmatter (YAML) carries metadata: `tags`, `created`, `modified`, `status`
- Tasks are `- [ ] task text` lines with optional `⏱size ▶first action ✓done-when`
  metadata in any order. States by marker: `[ ]` open · `[x]` done · `[?]` stuck ·
  `[~]` not-now · `[p]` paused (text carries its reactivation condition) ·
  `[i]` iceboxed. The reshape clock (14d, `task_seen` in the index) resets on any
  edit to the line — flipping a marker counts as a human touch.
- The `.index/` directory is gitignored — rebuild with `pkms index`
- **User-visible state lives in note frontmatter, never only in the index** (e.g.
  `reading: queued` on promoted notes). The SQLite index is a derived, regenerable
  view — task states (slice 5) and any future state must follow the same rule.
- Throwaway generated artifacts (export bundles, e.g. `scripts/build_reading_bundle.py`) go in `exports/`, never in `vault/` — the FTS index must not see duplicate content. Throwaway experiments live in `spike/`. (Distinct from `pkms promote` output: a promoted reading note is *first-class* vault content in `vault/resources/reading/` with `reading: queued` frontmatter, and is meant to be indexed.)
- **Unattended/scheduled steps must not depend on an optional interactive service.**
  Anything that runs on a timer or in the background (e.g. the Keep pull) picks a
  self-contained engine over one that needs a server up: OCR-at-ingest uses
  tesseract, not a local vision model, so a scheduled pull can't silently fail
  when the LLM server is down (slice 4 decision).

## Dev setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

## Common commands

`pkms` works globally in any shell (shim at `bin\pkms.cmd`, on the user PATH; it sets
`PKMS_HOME` so cwd doesn't matter).

```
pkms capture "text"   # Dump a thought into vault/inbox/ (zero decisions)
pkms today            # Front door: breadcrumb, inbox-as-progress, next actions
pkms serve            # Web service :8765 — capture endpoint + desktop today-view
                      #   at /?token=… (data via /api/today; token in .secrets/,
                      #   gitignored). Runs resident via the "PKMS capture service"
                      #   startup shortcut — restart it to pick up code changes.
pkms index            # Rebuild full index from vault
pkms search <query>   # Full-text search
pkms backlinks <note> # Show what links to a note
pkms promote <url|terms> # Hoarded Reddit thread → readable note in vault/resources/reading/
                      #   (comment tree + provenance; reading: queued for the today-view)
pkms tasks            # One next action per note (--all backlog · --stash · --stale · --done)
pkms did "thing"      # Log a done thing into today's note (retroactive welcome)
pkms resurface        # Up to 3 curious questions from the vault, each with a why
                      #   (--not-now <stem>: rest 30d · --let-go <stem>: stop asking forever)
pkms new [title]      # Create a new note
pkms daily            # Open/create today's daily note (--no-open: ensure only — agent use)
pkms ingest keep      # Pull new Google Keep notes; images OCR'd at ingest
                      #   (setup: docs/keep-setup.md; scheduled pull:
                      #   scripts/register-keep-pull.ps1; ledger in .index/)
```

Desktop capture: **Win+N** anywhere (scripts/pkms-capture.ahk, resident via startup
shortcut). Phone capture: docs/pixel-capture-setup.md.

## Agent layer (slice 3)

- **/fold** (`.claude/skills/fold/`): folds `vault/inbox/` captures into the vault —
  proposal first, ONE pick-list question, applies on approval. **/resume**
  (`.claude/skills/resume/`): reads back the breadcrumb at session start; writes it at
  session end ("wrapping up" triggers write mode).
- Daily notes carry stable section anchors (`## breadcrumb`, `## folded today`,
  `## notes` — `src/pkms/daily.py`): agents edit section *content*, never the headings.
  Today-view reads the newest non-empty `## breadcrumb` (today's note included).
- Shame-free copy rules live **inside the skill prompts** — when editing a skill, keep
  the constraint blocks; they are design-language bindings (§3/§9, G8's one-question
  budget), not style suggestions.
- Session-start briefing: the PowerShell profile runs `pkms today` in interactive
  shells only (guarded against `-NonInteractive`, so agent/tool shells never see it;
  `$env:PKMS_NO_BRIEFING=1` silences it).
