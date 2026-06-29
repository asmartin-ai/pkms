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
pkms tasks --done     # Done tasks, grouped by note path
pkms tasks --all      # Open/stuck/not-now backlog
pkms tasks --stash    # Paused/iceboxed tasks
pkms search <query>   # Full-text search
pkms promote <url>    # Turn a hoarded Reddit thread into a readable vault note
pkms resurface        # Up to 3 curious questions from the vault, each with a why
pkms index            # Rebuild the full index from the vault
pkms serve            # Web service: capture endpoint + desktop today-view
```

## Start the desktop service

Run the web service from the repo so it uses this checkout and the existing
vault/index at `K:\Projects\PKMS\vault` and `K:\Projects\PKMS\.index\pkms.db`:

```powershell
cd K:\Projects\PKMS
.\.venv\Scripts\python.exe -m pkms.cli serve
```

Leave that terminal open. The service listens on port `8765`.

Health check:

```powershell
curl http://localhost:8765/health
```

Expected output:

```text
ok
```

If port `8765` is already in use, find and stop the old service first:

```powershell
Get-NetTCPConnection -LocalPort 8765 -State Listen |
  Select-Object LocalAddress,LocalPort,OwningProcess

Stop-Process -Id <OwningProcess>
```

Then start the service again with the command above.

## Firefox new-tab setup

1. Start the desktop service.
2. Load the temporary extension from Firefox:

   ```text
   about:debugging#/runtime/this-firefox
   ```

   Click **Load Temporary Add-on…** and select:

   ```text
   K:\Projects\PKMS\src\pkms\web_ext\manifest.json
   ```

3. Get your capture token:

   ```powershell
   Get-Content K:\Projects\PKMS\.secrets\capture-token
   ```

4. Open Firefox add-ons:

   ```text
   about:addons
   ```

   Find **PKMS new-tab** → **Preferences** / **Options** and paste:

   ```text
   http://localhost:8765/web/?token=YOUR_TOKEN
   ```

5. Open a new tab. It should show the PKMS today-view. The top-level page is
   packaged in the extension, so Firefox keeps the address bar clean; live data
   is fetched from `pkms serve` with the token sent as `X-Capture-Token`.

The reading surface shows notes with `reading: queued` frontmatter under
`vault/resources/reading/`. Click a reading item to open the markdown note in
your default local editor/app.

Temporary add-ons disappear when Firefox restarts. For the full walkthrough and
permanent-install options, see `docs/firefox-newtab-setup.md`.

## Agent instructions

Repo-local agent rules live in `AGENTS.md`, layered on top of the global
`C:/Users/Kenja/agent-hub/AGENTS.md`. `CLAUDE.md` is a compatibility shim that
imports `AGENTS.md` for Claude Code.

Project-local Claude skills still live under `.claude/skills/`:

- `/fold` folds `vault/inbox/` captures into the vault after an approval step.
- `/resume` reads/writes the daily breadcrumb around sessions.

## Development

```powershell
.venv\Scripts\python.exe -m pytest tests -q
```

## License

MIT — see [LICENSE](LICENSE).
