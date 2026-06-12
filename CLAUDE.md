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
  daily/       # Daily notes, YYYY-MM-DD.md
  projects/    # Active project notes
  areas/       # Ongoing responsibilities (health, finance, etc.)
  resources/   # Reference material
  archive/     # Completed / inactive notes
```

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
- Tasks are `- [ ] task text` lines; done = `- [x]`
- The `.index/` directory is gitignored — rebuild with `pkms index`
- **User-visible state lives in note frontmatter, never only in the index** (e.g.
  `reading: queued` on promoted notes). The SQLite index is a derived, regenerable
  view — task states (slice 5) and any future state must follow the same rule.
- Generated artifacts (reading bundles, exports) go in `exports/`, never in `vault/` — the FTS index must not see duplicate content. Throwaway experiments live in `spike/`.

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
pkms serve            # Capture endpoint :8765 (token in .secrets/, gitignored;
                      #   runs resident via the "PKMS capture service" startup shortcut)
pkms index            # Rebuild full index from vault
pkms search <query>   # Full-text search
pkms backlinks <note> # Show what links to a note
pkms tasks            # List open tasks
pkms new [title]      # Create a new note
pkms daily            # Open/create today's daily note
```

Desktop capture: **Win+N** anywhere (scripts/pkms-capture.ahk, resident via startup
shortcut). Phone capture: docs/pixel-capture-setup.md.
