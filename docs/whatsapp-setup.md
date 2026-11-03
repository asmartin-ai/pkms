# WhatsApp-in — setup

PKMS mirrors exactly two WhatsApp chats into the inbox:

| chat | what lands in `vault/inbox/` |
|------|------------------------------|
| your **self-chat** ("Message yourself") | one note per message |
| the **Instinct chat** (both sides) | one rolling note per day, `whatsapp-instinct-<YYYY-MM-DD>.md` |

Every other chat is ignored. PKMS never sends anything: no messages, no read
receipts, no presence — `--presence-mode quiet` below keeps the phone's
notifications authoritative. Like every linked device, the mirror still
acknowledges delivery at the protocol level.

## What wacli is

[wacli](https://wacli.sh) 0.21.0 is an external WhatsApp CLI built on whatsmeow.
It owns **one linked-device session** — the WhatsApp Web device you pair with a
QR code — and mirrors chats into a local SQLite store with full-text search at
`~/.local/state/wacli` (Linux default; override with `WACLI_STORE_DIR` or
`--store`). The store holds `session.db` (the linked device's keys, owned by
whatsmeow) and `wacli.db` (chats, contacts, messages).

PKMS never holds a WhatsApp session of its own. The CLI is the device; PKMS only
reads it. Every PKMS call is read-only — `wacli --read-only --json …` — and
`src/pkms/wacli.ts` is the only place in the codebase that runs the binary.

Docs at v0.21.0:

| doc | what it covers |
|-----|----------------|
| [overview](https://raw.githubusercontent.com/openclaw/wacli/v0.21.0/docs/overview.md) | command map, global flags, store model |
| [sync](https://raw.githubusercontent.com/openclaw/wacli/v0.21.0/docs/sync.md) | follow/once modes, presence, storage caps |
| [doctor](https://raw.githubusercontent.com/openclaw/wacli/v0.21.0/docs/doctor.md) | store, auth, FTS, lock diagnostics |
| [messages](https://raw.githubusercontent.com/openclaw/wacli/v0.21.0/docs/messages.md) | list, search, show, export from the local store |
| [chats](https://raw.githubusercontent.com/openclaw/wacli/v0.21.0/docs/chats.md) | chat listing, `--query` filtering, chat state |
| [integrations](https://raw.githubusercontent.com/openclaw/wacli/v0.21.0/docs/integrations.md) | building read-only tools on top of a synced store |

## What lands in the vault

Self-chat — one capture per message:

```markdown
---
captured: 2026-10-07 08:30:00
source: whatsapp
whatsapp_id: 3EB0A1…
sender: <your-phone>@s.whatsapp.net
---

call the dentist
```

Instinct — one rolling note per day, one timestamped line per message:

```markdown
---
captured: 2026-10-07 08:31:00
source: whatsapp
whatsapp_chat: instinct
---

# Instinct — 2026-10-07

- 08:31 me: plan my day
- 08:31 me: [image]
- 08:32 instinct: Dentist first.
  Then the rent reminder.
```

The `me:` / `instinct:` label comes from the message's `FromMe` flag, so a
sentence you typed on your phone shows up as yours.

A message without text — a photo, voice note, document, sticker, location —
lands as a one-line placeholder naming its kind, with the caption after it when
there is one: `[image]`, `[audio]`, `[image] shelf photo`. A document carries
its file name: `[document: lease.pdf]`. A self-chat photo becomes an inbox note
whose body is that placeholder. PKMS never downloads the media itself; the
placeholder only keeps replies to it readable. Reactions, revoked messages and
messages deleted for you are skipped and counted in the drain's `skipped`
number. The MCP `instinct_thread` and `whatsapp_search` tools show the same
placeholders.

If you fold that day's note out of the inbox, the next Instinct message that day
starts `whatsapp-instinct-<day>-2.md` (then `-3`, …) instead of recreating the
folded note. The notes created per day are recorded in
`.ledger/whatsapp-instinct-notes.txt`.

## How it fits together

1. **The mirror** (`wacli sync --follow`, run by
   [wacli-sync.service](../deploy/systemd/wacli-sync.service)) holds the WhatsApp
   session and keeps the local store current. It is a separate program with its
   own lifecycle: it keeps syncing even when no PKMS process is running.
2. **The ramp** (`pkms ingest whatsapp`) reads the store read-only and writes
   the notes. Messages are deduped by WhatsApp message id against
   `.index/whatsapp-ledger.txt`, so re-running is a no-op and a crash mid-run
   loses nothing.

`.secrets/`, `.index/`, and `.ledger/` are gitignored.

## 1. Pair (QR, once, in a terminal)

```sh
wacli auth
chmod 700 ~/.local/state/wacli
```

`wacli auth` prints a QR code. On your phone open WhatsApp →
**Settings → Linked devices → Link a device** and scan it. The store then holds
a **full-access linked-device session** — the same access your phone hands to any
linked device — so keep it to yourself and never commit it. `chmod 700` above
keeps other users on the box out. Because `wacli auth` needs a terminal to show
the QR, never run it from a service.

## 2. Enable the mirror

```sh
cp deploy/systemd/wacli-sync.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now wacli-sync.service
journalctl --user -u wacli-sync -f
```

The unit runs `wacli sync --follow`, which keeps syncing until stopped, and
`--max-db-size 2GB` caps the store so WhatsApp history cannot fill the disk.

Two details in the unit file are worth knowing:

- **`--presence-mode quiet`** suppresses the "available" presence signal this
  device would otherwise send. It keeps the phone the authoritative chat device,
  so notifications stay audible where you actually read them.
- **The `ExecCondition` on `wacli doctor --json`** is the guard against a crash
  loop. Until you pair, the unit goes **inactive** with one clear journal line
  ("Condition check resulted in … being skipped") instead of restarting every
  five seconds. `RestartPreventExitStatus` cannot do this job: `wacli sync` exits
  1 for every fatal outcome, so gating on exit status 1 would also stop restarts
  on transient failures such as a dropped network. The condition is re-checked on
  every restart, so a device logged out by WhatsApp goes inactive on the next
  cycle rather than looping. To recover, pair (or re-pair) and start the unit
  again.

## 3. Find the Instinct chat

The Instinct chat is named by `.secrets/whatsapp-instinct-jid` (one JID, e.g.
`<phone>@s.whatsapp.net` or `<id>@lid`). While that file is absent the ramp
captures only your self-chat.

```sh
wacli --read-only --json chats list --query instinct
wacli --read-only --json chats list --limit 20
```

`--query` matches on chat name or JID. Take the `jid` of the Instinct chat and
store it:

```sh
mkdir -p .secrets
printf '%s\n' '<jid from chats list>' > .secrets/whatsapp-instinct-jid
chmod 600 .secrets/whatsapp-instinct-jid
```

Optionally write `.secrets/whatsapp-self-jid` when `wacli doctor --json` reports
no `linked_jid` and the self-chat is not resolved automatically. Both files hold
JIDs only — no message text — but treat them as personal data.

Messages from before the ramp first runs are not backfilled (see step 5).

## 4. Enable the ramp

```sh
cp deploy/systemd/pkms-whatsapp.service deploy/systemd/pkms-whatsapp.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now pkms-whatsapp.timer
```

The [timer](../deploy/systemd/pkms-whatsapp.timer) runs the
[service](../deploy/systemd/pkms-whatsapp.service) every five minutes and, being
`Persistent`, catches up after downtime. `PKMS_HOME` comes from
`~/.config/pkms/runtime.env` (see the Keep setup's
[user services section](keep-setup.md#4-linux-user-services--operator-installation)).

### Draining by hand

```sh
pkms ingest whatsapp
```

```
whatsapp: captured 3 (self 1, instinct 2), skipped 0
```

The timer drains every five minutes, so this is only needed to recover, or to
check a change right away. The drain takes a lock in
`.ledger/whatsapp-lock.db`, so a manual run and the timer never interleave — one
drain at a time, always.

## 5. Verify

Send one message in your self-chat and one in the Instinct chat, then run a
drain (or wait for the timer) and expect something like:

```
whatsapp: captured 2 (self 1, instinct 1), skipped 0
```

Check the result:

- **Cursor** — `.index/whatsapp-cursor.txt` records how far the ramp has read.
  The first run only looks at the last **two days**, and every later run
  re-reads the last **hour** before the cursor, so a message that arrived while
  the ramp was down is still caught. History is never backfilled.
- **Dedupe** — every message id lands in `.index/whatsapp-ledger.txt`; re-running
  the drain over the same messages is a no-op.
- **Notes** — the self message is one note in `vault/inbox/`, the Instinct
  message appends a line to that day's rolling note.

The ramp only ever reads the mirror. If a drain reports `captured 0`, check the
mirror first: is `wacli` installed, is the store paired, and is
`wacli-sync.service` active (step 2)?

## See also

- `src/pkms/wacli.ts` — the only place PKMS runs wacli
- `src/pkms/ramps/whatsapp.ts` — the ramp
- `deploy/systemd/wacli-sync.service` — the mirror unit
- `deploy/systemd/pkms-whatsapp.service` — the drain unit
- `deploy/systemd/pkms-whatsapp.timer` — every five minutes
- `docs/keep-setup.md` — `~/.config/pkms/runtime.env`, user services
