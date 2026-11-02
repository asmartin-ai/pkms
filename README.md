# PKMS — a personal knowledge system that doesn't shame you

PKMS is a local-first personal knowledge management system built for one
ADHD-shaped brain: **frictionless capture, no guilt mechanics, recognition over
recall.** Thoughts land in an inbox in under two seconds, get folded into
Markdown notes in batches, and come back later only when they're genuinely
useful — never as an unread counter.

Markdown files in `vault/` are the source of truth. A SQLite database in
`.index/pkms.db` is a derived, regenerable index for search and backlinks.
Delete the index any time — `pkms index` rebuilds it from the vault.

## Who it helps

People who save more than they process: the note-taking graveyard, the 400 open
tabs, the "I'll organise it later". PKMS is for a single user on their own
machine, not a team or a hosted service. It assumes:

- capture must be one keystroke and zero decisions, or it doesn't happen;
- any visible backlog becomes a source of shame, so none is shown;
- surfaces should offer **one** next action, not a wall of tasks;
- old notes return as rationed "still interested in this?" questions, never as
  a count.

## What's here

- **CLI** (`pkms`): capture, today view, tasks, search, resurface, promote,
  index, ingest (Google Keep, email, Discord).
- **Local web service** (`pkms serve`): capture endpoint plus a desktop
  today-view, installable as a PWA over a private network.
- **Firefox new-tab extension**: the today-view as the browser's new-tab page.
- **Agent skills** (`.agents/skills/`): `/fold` turns inbox captures into
  vault notes with an approval step; `/resume` leaves and reads a breadcrumb
  across sessions.

## Current state

Working daily driver, single-user dogfood stage. The CLI, the local web/PWA
surface, the Firefox new-tab extension, and the capture ramps (phone shortcut,
email, Discord) are implemented and covered by the test suite in `tests/`.
CI runs lint and tests on Linux; the maintainer's own setup is Windows, and
phone capture goes over a private tailnet. Expect rough edges where the two
meet — the setup docs are the honest record of what was actually run.

## Quick start

Requires Python 3.11+.

**Linux / macOS**

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
pkms capture "a thought worth keeping"
pkms today
```

**Windows (PowerShell)**

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
pkms capture "a thought worth keeping"
pkms today
```

Start the local web service (default port `8765`):

```sh
pkms serve                    # Linux / macOS
```

```powershell
pkms serve                    # Windows, inside the activated venv
```

Check it:

```sh
curl http://localhost:8765/health     # → ok
```

## Common commands

```
pkms capture "text"   # Dump a thought into the inbox (zero decisions)
pkms today            # Front door: breadcrumb, inbox-as-progress, next actions
pkms tasks            # One next action per note
pkms tasks --done     # Done tasks, grouped by note path
pkms tasks --all      # Open/stuck/not-now backlog
pkms tasks --stash    # Paused/iceboxed tasks
pkms search <query>   # Full-text search
pkms promote <url>    # Turn a hoarded Reddit thread into a readable vault note
pkms resurface        # Up to 3 curious questions from the vault, each with a why
pkms did "thing"      # Log a done thing — counts today; retroactive welcome
pkms index            # Rebuild the full index from the vault
pkms serve            # Web service: capture endpoint + desktop today-view
pkms ingest keep      # Pull Google Keep exports into the inbox
pkms ingest email     # Pull labeled Gmail messages into the inbox (IMAP)
pkms discord-bot      # Discord DMs → inbox (see docs/email-discord-setup.md)
```

## Vault layout

```
vault/
  daily/       # Daily notes, YYYY-MM-DD.md   (kept local, gitignored)
  inbox/       # Raw captures awaiting folding (kept local, gitignored)
  projects/    # Active project notes
  areas/       # Ongoing responsibilities
  resources/   # Reference material
  archive/     # Completed / inactive notes
```

Notes use `[[wikilink]]` syntax and YAML frontmatter (`tags`, `created`,
`modified`, `status`). Tasks are `- [ ]` lines with optional
`⏱size ▶first-action ✓done-when` metadata and state markers
(`[ ]` open · `[x]` done · `[?]` stuck · `[~]` not-now · `[p]` paused · `[i]` iceboxed).

## Optional ramps and surfaces

Setup walkthroughs live in `docs/`:

- `docs/pixel-capture-setup.md` — phone capture tile over a private network.
- `docs/pixel-pwa-setup.md` — install the today-view as a phone PWA.
- `docs/firefox-newtab-setup.md` — the new-tab extension, step by step.
- `docs/email-discord-setup.md` — email and Discord in-ramps.
- `docs/keep-setup.md` — Google Keep import.

The Firefox extension is loaded as a temporary add-on from
`src/pkms/web_ext/manifest.json`; the walkthrough covers the permanent-install
options.

## Development

```sh
pip install -e ".[dev]"
ruff check .
pytest tests -q
```

## This repository is a public mirror

PKMS is developed in a **private canonical repository** that also holds the
owner's personal vault state — daily notes, inbox captures, media, reading
queue and research notes. This repository is the reviewed public subset: code,
tests, docs and design notes, with personal content left out. Issues and
roadmap live in the private repo, so the issue tracker here is usually empty by
design.

## License

MIT — see [LICENSE](LICENSE).
