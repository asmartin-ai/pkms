# PKMS — Personal Knowledge Management System

## Project overview

Hybrid PKMS: markdown files in `vault/` are the source of truth; SQLite database in `.index/pkms.db` is a derived, regenerable index for fast search and backlink tracking.

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

## Dev setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

## Common commands (once built)

```
pkms index          # Rebuild full index from vault
pkms new [title]    # Create a new note
pkms search <query> # Full-text search
pkms backlinks <note> # Show what links to a note
pkms tasks          # List open tasks
pkms daily          # Open/create today's daily note
```
