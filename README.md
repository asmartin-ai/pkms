# PKMS — Personal Knowledge Management System

A hybrid personal knowledge management system designed around ADHD-friendly
principles: **frictionless capture, no guilt mechanics, recognition over recall.**

Markdown files in `vault/` are the source of truth; a SQLite database in
`.index/pkms.db` is a derived, regenerable index for fast search and backlink
tracking. Delete the index any time — `pkms index` rebuilds it from the vault.

## Design philosophy

The system is built against a shared ADHD design language. Core rules that shape
every surface:

- **Capture is sacred** — dumping a thought takes < 2s and zero decisions.
- **No backlog shame** — no unread counts, overdue badges, or "you haven't…" copy.
- **One next action** — surfaces show the single next step, not a wall of tasks.
- **Resurfacing as curiosity** — old notes return as rationed "still interested in X?"
  questions, never as a counter.

## Vault structure

```
vault/
  daily/       # Daily notes, YYYY-MM-DD.md   (kept local, gitignored)
  inbox/       # Raw captures awaiting folding (kept local, gitignored)
  projects/    # Active project notes
  areas/       # Ongoing responsibilities
  resources/   # Reference material + research
  archive/     # Completed / inactive notes
```

Notes use `[[wikilink]]` syntax for internal links; YAML frontmatter carries
metadata (`tags`, `created`, `modified`, `status`). Tasks are `- [ ]` lines with
optional `⏱size ▶first-action ✓done-when` metadata and state markers
(`[ ]` open · `[x]` done · `[?]` stuck · `[~]` not-now · `[p]` paused · `[i]` iceboxed).

## Setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

## Common commands

```
pkms capture "text"   # Dump a thought into the inbox (zero decisions)
pkms today            # Front door: breadcrumb, inbox-as-progress, next actions
pkms tasks            # One next action per note
pkms search <query>   # Full-text search
pkms promote <url>    # Turn a hoarded Reddit thread into a readable vault note
pkms resurface        # Up to 3 curious questions from the vault, each with a why
pkms index            # Rebuild the full index from the vault
pkms serve            # Web service: capture endpoint + desktop today-view
```

## Development

```powershell
.venv\Scripts\python.exe -m pytest tests -q
```

## License

MIT — see [LICENSE](LICENSE).
