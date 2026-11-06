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
- Opt into local semantic search with original Markdown line citations, or ask a configured provider for an evidence-grounded answer with separate per-question consent.

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

## Local semantic search and grounded Ask

Lexical search remains the default. Semantic indexing is an explicit, incremental action:

```sh
./bin/pkms semantic-index
./bin/pkms semantic-index --status
./bin/pkms search --semantic "How can spaced practice improve retention?"
./bin/pkms search --semantic --offline "retrieval practice"
```

`semantic-index` refreshes the lexical inventory, embeds changed Markdown, skips unchanged revisions, and removes vectors for deleted or moved sources. It never sends note text to an embedding provider. The first online indexing run downloads the pinned CPU model `Xenova/all-MiniLM-L6-v2` at revision `751bff37182d3f1213fa05d7196b954e230abad9` (q8, normalized mean pooling, 384 dimensions). `KHAOS_MODEL_CACHE` selects its cache; otherwise it uses `~/.cache/khaos/models`. Index with `--offline` to prohibit model downloads. Queries are always cache-only, even without `--offline`; there is no embedding during startup, import, or typing.

Derived chunks and vectors live only in `.index/pkms.db`. The versioned index uses conservative 240-byte heading/paragraph-aware passages, with original Markdown line ranges including the frontmatter offset. Hybrid retrieval fuses lexical and native SQLite cosine rankings using reciprocal ranks. It checks live source hashes before ranking, excludes stale/deleted evidence, and reports lexical fallback when the index or cached model is unavailable. The native cosine scan is exact rather than an approximate nearest-neighbor index; large libraries may take longer. Status describes known lexical-index notes; run indexing to discover newly created or moved files.

For remote answer generation, configure **PKMS's own** `rag-llm-base-url`, `rag-llm-api-key`, and `rag-llm-model` secrets. The base URL includes the API prefix, for example `https://provider.example/v1`; PKMS appends `/chat/completions`. The existing secret resolver checks systemd's `CREDENTIALS_DIRECTORY`, then `PKMS_SECRET_RAG_LLM_BASE_URL`, `PKMS_SECRET_RAG_LLM_API_KEY`, and `PKMS_SECRET_RAG_LLM_MODEL`, then files with the corresponding names under `.secrets/`. Keep keys out of shell history and source control. No Content Hoarder credential is read implicitly.

```sh
./bin/pkms ask --semantic --allow-remote "What do my notes say about retention?"
```

`--allow-remote` authorizes sending this question and full retrieved passages to that provider. It is separate from routing or AI-hint preferences. Offline mode forbids generation even with consent. Missing provider configuration is an error, not a fabricated answer. Ask supplies bounded, explicitly untrusted evidence, requires known citation IDs, abstains when there is no evidence, and withholds answers if evidence changes during generation. Citation validation is not proof of factual correctness: inspect the cited Markdown.

In the authenticated web app, open **find → Evidence search & Ask**. Use **Update semantic index** explicitly; inspect counts, errors and loading state; choose local evidence search or consent to **Ask provider** for that question only. Click a citation to inspect original numbered source lines. Existing token authentication protects every evidence, indexing, answer and source endpoint.

MCP clients can call `evidence_search` with optional `semantic: true` and use their own assistant to answer; no PKMS answer provider or remote-generation consent is needed for retrieval. MCP `ask` requires `allow_remote: true` per call. See the [MCP guide](docs/hermes-setup.md).

## Your vault and privacy

Notes and tasks are authoritative Markdown under `vault/`. Search tables live in `.index/pkms.db` and can be rebuilt with `./bin/pkms index`. Operational state is authoritative too: `.ledger/` holds import cursors, deduplication ledgers, events and `state.db` (resurface dismissals, task first-seen history and Keep completions). Back up the vault, `.ledger/` and captured media; rebuilding the index cannot recover operational state. The exact storage boundary is defined in [`operational.ts`](src/pkms/operational.ts).

PKMS is local-first, not automatically private from every service: optional integrations connect to external accounts, and optional model-assisted routing can send source metadata and excerpts to a configured provider. Review the relevant setup guide and provider before enabling either. Protect credentials, captures and backups, especially if exposing the web service beyond your machine.

### Upgrade existing operational state

Older checkouts stored operational files and tables inside `.index/`. Do not delete that directory before migration.

1. Stop PKMS servers, bots and import/engagement timers. Back up `vault/`, `.index/`, `.ledger/` and captured media.
2. Run `./bin/pkms migrate-durable-state` to inspect the move without changing files.
3. Resolve any reported conflicts. Migration never overwrites conflicting records; there is no force option.
4. Run `./bin/pkms migrate-durable-state --apply`. It verifies durable copies before removing the index-local originals. Matching copies from an interrupted run are safe to resume.
5. Run `./bin/pkms index`, check the briefing and integrations, then restart the stopped processes.

After migration, `.index/` is disposable. Keep the pre-migration backup until the upgrade is accepted. Deploying source code does not authorize running this migration against live data. See [`migrate_operational.ts`](src/pkms/migrate_operational.ts) for the implementation and `pkms migrate-durable-state --dry-run` for the current inspection report.

## Integration guides

- [Google Keep](docs/keep-setup.md)
- [Gmail and Discord](docs/email-discord-setup.md)
- [WhatsApp](docs/whatsapp-setup.md)
- [Phone capture](docs/phone-capture-setup.md) and [phone PWA](docs/phone-pwa-setup.md)
- [Firefox new-tab extension](docs/firefox-newtab-setup.md)
- [Hermes / MCP](docs/hermes-setup.md)

### Content Hoarder promotion

Run the local Content Hoarder app, then use `pkms promote <url|id|search terms>`. Search still offers a numbered choice; the result remains a queued reading note. PKMS reads a versioned HTTP handoff, not Content Hoarder's SQLite files. `PKMS_HOARDER_URL` selects the local app; its default and the request schemas are in [`promote.ts`](src/pkms/promote.ts). The old `PKMS_HOARDER_DB` setting is no longer used.

Content Hoarder's **Promote to PKMS** action uses the same handoff but keeps the inbox destination. Its configured capture URL sends authenticated JSON to `/capture` with `X-Capture-Token`. A stable delivery ID identifies the destination and source item. Retries recover the existing note, including notes moved within the vault; a deleted, previously delivered note is not silently recreated.

The CH sender stores pending or unconfirmed work and offers manual Retry. It does not resend on startup. Successful results carry `version`, `state`, `delivery_id` and `note_path`; callers do not parse success prose. Ordinary text/JSON captures keep their existing behavior. The broader Life OS contract sketches are not this wire protocol.

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
