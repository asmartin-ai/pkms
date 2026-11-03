# PKMS

PKMS is a personal knowledge management system built for ADHD-friendly capture and re-entry: put a thought somewhere quickly, find it later, and return to one next action instead of a wall of choices.

Your Markdown vault is the source of truth. A local SQLite index supports search, backlinks, tasks and resurfacing; it can be rebuilt from the vault.

## What it does

- Capture thoughts into an inbox and use a daily briefing to pick up where you left off.
- Search notes, follow `[[wikilinks]]` and backlinks, and create daily or project notes.
- Track tasks in Markdown, surface next actions, and revisit older notes with prompts.
- Use a local web interface for capture and the today view, or connect the Firefox new-tab extension.
- Optionally import and route sources from Google Keep, Gmail and WhatsApp, or capture through Discord. These integrations require separate setup and credentials.
- Promote a hoarded Reddit thread into a reading note; connect an MCP client over stdio.

## Quickstart

Install [Bun](https://bun.com/) 1.4.2 or newer, then clone this repository:

```sh
git clone https://github.com/asmartin-ai/pkms.git
cd pkms
bun install --frozen-lockfile
./bin/pkms capture "An idea to revisit"
./bin/pkms index
./bin/pkms today
./bin/pkms search idea
```

The launcher uses this checkout as `PKMS_HOME`. Add its `bin/` directory to your `PATH` to run `pkms` from elsewhere. On Windows, use `bin/pkms.cmd`.

Start the web service with `./bin/pkms serve` or `bun run start`. It listens on `127.0.0.1:8765` by default and prints the today-view address. The service creates a capture token in `.secrets/capture-token` when needed; use it in the address shown by the server and keep it private. Run `./bin/pkms --help` for the command list. Integrations are optional; see the [setup guides](#integration-guides) before enabling one.

## Your vault and privacy

Notes are plain Markdown with YAML frontmatter. Tasks use Markdown checkboxes and support additional states and next-action metadata. Inbox captures and daily notes are kept under `vault/`; the derived index is `.index/pkms.db`. Run `./bin/pkms index` to rebuild it. Operational events and integration state also live locally, separately from the index; rebuilding the index is not a backup of that state.

PKMS is local-first, not automatically private from every service: optional integrations connect to external accounts, and optional model-assisted routing can send source metadata and excerpts to a configured provider. Review the relevant setup guide and provider before enabling either. Protect credentials, captures and backups, especially if exposing the web service beyond your machine.

## Integration guides

- [Google Keep](docs/keep-setup.md)
- [Gmail and Discord](docs/email-discord-setup.md)
- [WhatsApp](docs/whatsapp-setup.md)
- [Phone capture](docs/phone-capture-setup.md) and [phone PWA](docs/phone-pwa-setup.md)
- [Firefox new-tab extension](docs/firefox-newtab-setup.md)
- [Hermes / MCP](docs/hermes-setup.md)

## Status

PKMS is an actively developed personal project, not a hosted service or a packaged release. Interfaces and integrations can change; review setup and back up your own vault before relying on it. The public repository is a sanitized mirror of the TypeScript/Bun canonical project. See [publication safety](docs/publication-safety.md) for the boundary.

### Changed from the Python version

The public repository previously contained a Python implementation. The current implementation is TypeScript running on Bun, with different installation, commands and integrations. Use the instructions above rather than the old Python setup; do not assume existing scripts or integrations are drop-in compatible.

## Related projects

PKMS is part of the Khaos ecosystem alongside [Life OS](https://github.com/asmartin-ai/life-os-public), an architecture and design companion, and [Content Hoarder](https://github.com/asmartin-ai/content-hoarder), a local-first content library.

## Development

```sh
bun install --frozen-lockfile
bun run check
bun run format:check
```

`bun run check` runs lint, comment checks, typechecking, tests and publication safety checks.

## License

[MIT](LICENSE).
