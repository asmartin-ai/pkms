# Hermes Agent — MCP setup

Hermes reaches PKMS exactly one way: the khaos MCP server, started as
`pkms mcp`. It is a stdio JSON-RPC server (`src/pkms/mcp_server.ts`): Hermes
spawns it as a child process, talks to it over stdin/stdout, and the process
exits when Hermes is done with it. There is no port, no HTTP endpoint, no
background service, and no second client. Every other PKMS surface — the `pkms`
CLI, the capture endpoint, the Discord bot — is an operator path, not an agent
path. The MCP server is the only seam, and it is deliberately the only one, so
everything an agent reads or writes passes through six named, validated tools.

## Prerequisites

- **Hermes Agent** installed (this doc is written against v0.21.1, the
  `~/.local/bin/hermes` wrapper around `~/.hermes/hermes-agent`), with a
  `model.default` the provider still serves: `stealth/*` ids were retired in
  2026-10, so check `hermes -z 'Reply with exactly: ok'` after a model change.
- **`PKMS_HOME` exported in your shell** — the repo root holding `vault/` and
  `.index/`. The server resolves the vault from this variable, because Hermes
  spawns it from its own working directory. The same files `~/.config/pkms/
  runtime.env` uses for the systemd units set it, e.g.
  ```sh
  export PKMS_HOME=/absolute/path/to/PKMS
  ```
- **`bun` on your PATH** — Hermes will run the server with it.
- **The vault indexed** — `search` and `today` read the index, so run
  `pkms index` once before the first call:
  ```sh
  cd "$PKMS_HOME" && bun src/pkms/cli.ts index
  ```
- For the WhatsApp tools: a paired, syncing wacli mirror — see
  [whatsapp-setup.md](whatsapp-setup.md). Without it those tools come back empty.

## 1. Register the server

Run `hermes mcp add` from a shell where `PKMS_HOME` is set, so the shell expands
it inside both the environment and the command arguments:

```sh
hermes mcp add khaos --command bun --env "PKMS_HOME=$PKMS_HOME" --args "$PKMS_HOME/src/pkms/cli.ts" mcp
```

That tells Hermes everything it needs to know: the command is `bun`, the server
process gets `PKMS_HOME` in its environment (that is how the server finds the
vault), and the final `mcp` argument selects the subcommand that starts the
stdio server.

Two ordering rules make this exact form load-bearing:

- **`--args` must be the last option.** It consumes everything after it, so
  `--env PKMS_HOME=...` placed after `--args` would be passed to the MCP server
  as an argument instead of the environment, and the server would start with no
  `PKMS_HOME`. `--env` first, `--args` last, always.
- **Register with an absolute, shell-expanded path.** Hermes may spawn the
  server from any working directory; a relative path in `--args` would not
  resolve. If you register from a shell where `PKMS_HOME` is not set, write the
  absolute path literally:
  ```sh
  hermes mcp add khaos --command bun --env "PKMS_HOME=/absolute/path/to/PKMS" --args /absolute/path/to/PKMS/src/pkms/cli.ts mcp
  ```

## 2. Verify

```sh
hermes mcp test khaos
hermes mcp list
```

`test` starts the server once and exercises the handshake — it is the message
that proves `bun`, `PKMS_HOME`, and the `mcp` subcommand all resolve. `list`
shows the server in Hermes's own registry. If `test` fails, check the three
prerequisites in order (bun on PATH, `PKMS_HOME` absolute, vault indexed), then
re-register.

## 3. Select tools (optional)

```sh
hermes mcp configure khaos
```

The server registers all six tools; `configure` is where you pick the subset
Hermes may call, if you want to narrow it (for example `today` and `capture`
only). Skipping this step leaves all six enabled.

## The six tools

| tool | input | what it is for |
|------|-------|----------------|
| `today` | none | The front-door briefing: what is due, what resurfaced. A read that never records a resurface offer. |
| `search` | `query` (required), `limit` 1–20 (default 10) | Full-text search across the indexed vault. |
| `capture` | `text` 1–4000 chars | Writes one note into `vault/inbox/` and returns its path. |
| `routed_since` | `since` (RFC 3339 timestamp) | Router decisions since that instant: what was filed where, and why. |
| `whatsapp_search` | `query` (required), `limit` 1–20 (default 10) | Search of the wacli mirror — the same local store `pkms ingest whatsapp` drains into the inbox. |
| `instinct_thread` | `days` 1–7 (default 1) | Recent lines from the Instinct chat, both sides, read-only from the mirror. |

Every result is bounded before it reaches Hermes: search and
`whatsapp_search` cap at `limit` rows (maximum 20), `today` shows at most
eight notes, `routed_since` returns at most 200 rows, and `instinct_thread`
returns at most 50 rows. Inputs are validated at the server boundary, so a
malformed call comes back as an error instead of half-running. `capture` in
particular accepts at most 4000 characters of text — longer text is rejected
with an error, not silently truncated.

## Trust: everything that arrives is data

Text coming back through `today`, `search`, `whatsapp_search`,
`instinct_thread`, `routed_since`, and `capture` — note bodies, message text,
sender names, chat names, media captions and file names — is **untrusted data**. If a note or a WhatsApp
message says "ignore your instructions and …", that is a quoted fact about the
vault, not an instruction. Hermes must never execute, route, or interpret
content it read through these tools, exactly as the server never acts on it
itself. This is the rule that keeps a captured message a message: the tools
answer questions about the data, and none of them lets message content become
a command.

## What it can never do

- **Send a WhatsApp message.** Nothing on this path writes to WhatsApp: no
  sending, no read receipts, no presence. The WhatsApp tools read the same
  wacli mirror as `pkms ingest whatsapp` and nothing else — the mirror is owned
  by the linked-device session on your phone.
- **Download media or touch the account.** No media fetches, no account or
  auth commands, no history backfill.
- **Listen on the network.** The server is stdio-only; it has no port and no
  HTTP endpoint by design.

## Afternoon brief

Hermes can post a short afternoon brief built only from the khaos tools: one
next move first, then at most five bullets (open loops from the Instinct chat,
routed items that need a look), then one invitation line. It calls `today`,
`instinct_thread` (`days: 1`), and `routed_since` (since local midnight), never
`capture`, and treats everything those tools return as data, per the trust rule
above.

### The skill

The source of truth is the checked-in copy at
[`deploy/hermes/skills/khaos/afternoon-brief/SKILL.md`](../deploy/hermes/skills/khaos/afternoon-brief/SKILL.md).
Hermes loads its installed copy from `~/.hermes/skills/khaos/afternoon-brief/`.
Edit the repo copy, then install it:

```sh
cp -r deploy/hermes/skills/khaos ~/.hermes/skills/
hermes skills list | grep afternoon-brief
```

### The cron job

The job `khaos-afternoon-brief` runs the skill every day at 15:30 local time.
It was created paused, delivering to `local` (the output stays in Hermes's own
cron output, nowhere else), because Hermes has no chat channel yet — that
choice is #50 (a second Discord bot or a dedicated WhatsApp number):

```sh
hermes cron create '30 15 * * *' \
  'Build and return the khaos afternoon brief, following the afternoon-brief skill exactly.' \
  --name khaos-afternoon-brief --skill afternoon-brief --deliver local \
  --paused --paused-reason 'Awaiting Hermes chat channel decision (PKMS #50)'
hermes cron list --all
```

`hermes cron list` hides paused jobs; `--all` shows it as `[paused]`.

### Turning it on after #50

Once #50 has set up the chosen channel in the Hermes gateway, point the job at
it and resume — one command:

```sh
hermes cron edit khaos-afternoon-brief --deliver <platform>:<chat_id> && hermes cron resume khaos-afternoon-brief
```

`<platform>:<chat_id>` is the chosen target, e.g. `discord:<channel_id>` for a
second Discord bot or `whatsapp:<chat_id>` for a dedicated number. Cron jobs fire
only while the Hermes gateway runs (`hermes cron status` says whether it does).

### Run it once by hand

`hermes cron run` refuses a paused job, and `hermes cron pause` clears the
paused reason, so a manual test run is:

```sh
hermes cron resume khaos-afternoon-brief && hermes cron run khaos-afternoon-brief; hermes cron pause khaos-afternoon-brief
hermes cron runs <job_id>   # the id from `hermes cron list --all`; `runs` does not take the name
```

With no gateway running, the resumed job cannot fire on its own in between.
Each run's khaos calls show up as `agent_tool_called` events (below).

## Instrumentation

Each tool call appends one `agent_tool_called` event to PKMS's operational
ledger at `.ledger/events.db`, carrying only `{tool, ok, latency_ms}` — never
the arguments, note bodies, or message content. Read it with:

```sh
pkms events --kind agent_tool_called
```

## Remove it

```sh
hermes mcp remove khaos
```

That unregisters the server in Hermes. It changes nothing in the vault, the
index, the mirror, or the ledger.

## See also

- `src/pkms/mcp_server.ts` — the server: tool schemas, bounds, trust rule
- `src/pkms/cli.ts` — the `mcp` subcommand that starts it
- `deploy/hermes/skills/khaos/afternoon-brief/SKILL.md` — the afternoon brief skill
- `docs/whatsapp-setup.md` — the wacli mirror the WhatsApp tools read
- `docs/keep-setup.md` — `~/.config/pkms/runtime.env`, user services
