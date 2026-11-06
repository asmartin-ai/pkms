# Capture ramps — Gmail archive + Discord bot

Code is merged and tested; these are the only manual steps. Both ramps are
idempotent — safe to run repeatedly, nothing is archived or captured twice. They
register in `src/pkms/ramps/index.ts` (see `src/pkms/ramp.ts` for the contract);
`pkms ingest` lists every registered ramp. Keep and WhatsApp are separate
ramps — see `docs/keep-setup.md` and `docs/whatsapp-setup.md`.

## Gmail archive (whole inbox, IMAP IDLE)

Every message that arrives in the Gmail **inbox** after go-live is archived in
PKMS and searchable; the rules router (README → Routing archived sources) puts
the ones that matter into `vault/inbox/`. Mail from before go-live is not
backfilled.

### 1. Secrets

Create an app password at https://myaccount.google.com/apppasswords (requires 2FA),
then, in the checkout root (gitignored under `.secrets/`):

```sh
printf %s 'you@example.com' > .secrets/email-address
printf %s 'abcd efgh ijkl mnop' > .secrets/email-app-password
```

### 2. First contact

```sh
pkms ingest email
```

The first run selects `INBOX`, records its `UIDVALIDITY`/`UIDNEXT` in
`.ledger/gmail-cursor.json`, and archives nothing:

```
email: first contact — cursor set at UID 48211 (UIDVALIDITY 1); mail arriving from now on is archived
```

Later runs archive every message above the cursor. Without `--watch` the command
runs one pass and exits; with `--watch` it stays connected (below).

### What happens to each message

- The raw message is kept as `vault/sources/email/<yyyy-mm>/<sha256(X-GM-MSGID)>.eml`.
- A source note with the same name and `.md` holds the decoded text body, a
  From/To/Subject/Date list, and a link to the `.eml`. Frontmatter carries
  `from`, `to`, `subject`, `date`, `message_id`, `has_calendar`, and — only when
  the header is present — `list_unsubscribe`, `list_id`, `precedence`,
  `auto_submitted`. It starts as `route: pending`.
- Gmail gets the label **`khaos`** on the message.
- The router decides. Noise gets the Gmail label **`khaos/noise`**. It stays in
  the Gmail inbox unless `gmail_auto_archive` in `tuning.json` is `true`; then the
  ramp removes the `\Inbox` label (Gmail's archive). Routed items get an inbox
  capture linked to the source note.

The ramp never deletes mail and never marks it read (bodies are fetched with
`BODY.PEEK[]`). The cursor advances only after a message is archived and
labeled, so an interrupted pass repeats at most the message it was on, and a
repeat reuses the existing note (deduplicated by X-GM-MSGID).

`pkms route` runs outside a Gmail session, so its email label changes are queued
in `.ledger/gmail-label-retry.json` and applied at the start of the next Gmail
pass. The same queue holds a label change that failed because the connection
dropped. Labels reach the message in All Mail if it already left the inbox.

If Gmail ever changes `UIDVALIDITY`, the next pass rechecks inbox mail received
since the last sync, archives what is missing, and continues on the new UIDs
(`gmail_uidvalidity_reset` in `pkms events`).

### 3. Watch mode and the user service

```sh
pkms ingest email --watch
```

Watch mode syncs, then waits in IMAP `IDLE` until Gmail reports new mail. It
ends and restarts `IDLE` every 28 minutes, under Gmail's 29-minute limit. A
dropped connection reconnects with backoff from 5 seconds up to 5 minutes and
resumes from the cursor. Output is one block per pass that archived or labeled
something; connection errors go to stderr. `SIGTERM`/`SIGINT` end `IDLE` and log
out cleanly. Only one Gmail ingester runs per checkout
(`.ledger/gmail-lock.db`); a second one reports that another is running.

The checked-in [user unit](../deploy/systemd/pkms-gmail.service) runs
`bin/pkms ingest email --watch` with `Restart=always`. It reads `PKMS_HOME` from
`~/.config/pkms/runtime.env` (see `docs/keep-setup.md` → Linux user services).
After the first-contact run above:

```sh
mkdir -p ~/.config/systemd/user
cp deploy/systemd/pkms-gmail.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now pkms-gmail.service
journalctl --user -u pkms-gmail -f
```

### Offline testing

`PKMS_IMAP_HOST`, `PKMS_IMAP_PORT`, and `PKMS_IMAP_TLS=0` point the ramp at
another IMAP server (the tests use a loopback fake in `tests/ts/fake_imap.ts`).
Plaintext is refused for any host other than loopback. Leave all three unset for
Gmail (`imap.gmail.com:993`, TLS).

The earlier label-pull ramp (`--label`, the `pkms` Gmail filter, and
`.index/email-ledger.txt`) is gone; the filter and the old ledger file can be
deleted.

## Discord bot (~10 min, K5)

> **Fast path:** run `bash scripts/discord-bot-wizard.sh` — it opens each portal
> page, captures the token into `.secrets/discord-bot-token`, and confirms every
> stage. The manual steps below are what the wizard automates.

1. https://discord.com/developers/applications → New Application → Bot.
2. **Enable "Message Content Intent"** under Bot → Privileged Gateway Intents —
   without it the bot receives empty message bodies.
3. Reset Token → copy it into `.secrets/discord-bot-token`.
4. Invite it to your server: OAuth2 → URL Generator → scope `bot` → permissions
   **View Channels, Send Messages, Add Reactions** → open the generated URL. (DMs work once you
   share a server with the bot.)
5. From the repo root, install the frozen Bun dependencies:
   `bun install --frozen-lockfile`
6. With the capture service running (`pkms serve`), run `pkms discord-bot`.
   Put your allowed Discord user ids in `.secrets/discord-user-ids` as a
   comma-separated list (or pass `--user-ids <id>,<id>`). Only those accounts
   can run commands or leave captures; an empty list denies everyone. IDs
   must be numeric Discord user ids; a malformed list stops startup. Add
   `--channel-id <id>` to also listen in one channel. A ✅ reaction = saved to
   `vault/inbox/`.

Dedupe ledger: `.ledger/discord-ledger.txt`; existing installations need the [state migration](../README.md#upgrade-existing-operational-state). A session the Gateway refuses
(bad token, disallowed intent — close 4004/4010–4014) stops the bot with a
logged reason instead of retrying forever.

### Two-way agent commands (WO-003 Track B)

The same bot speaks `!`-prefixed commands in DMs and the allowed channel;
plain text still captures as before, so nothing already working changes:

```
!today            streak line + any if–then plans due within 6 h
!search <q>       top 5 hits, title + vault path
!did <thing>      counts a done thing (same as `pkms did`)
!plan <thing>     saves a plan; reply with the quick picks or an ISO time
!streak           days + freezes left this month
!help
```

Every command emits `agent_tool_called`. `.secrets/discord-user-ids` (or
`--user-ids`) controls commands and captures. On the VPS it is loaded from
the encrypted `discord-user-ids` credential. When upgrading a single-account
bot, move its command/capture allowlist to this plural name; `--user-id`
is no longer a bot option.

Keep `.secrets/discord-user-id` separate: it is the single Track C ping DM
recipient, together with `.secrets/discord-bot-token`
(`pkms-engagement.timer` drives them; quiet hours and the daily cap stay in
`tuning.json`). The tick sends each brief/reminder through `sendDm` and records
`nudge_sent` only when the DM went out — with either secret missing, nothing is
delivered and no `nudge_sent` is written, so the cap and the once-per-day refs
stay open. The `pkms-discord.service` unit runs the bot; the architect installs
it.

## Done-when

A new email from a person appears under `vault/sources/email/`, carries the
`khaos` label in Gmail, and is routed to `vault/inbox/`; a Discord DM appears in
`vault/inbox/`. Both show up in the next /fold run.
