# Google Keep ingest — full setup

Install the Bun dependencies first with `bun install --frozen-lockfile`.
The `pkms` CLI connects to Google Keep with its Bun-native mobile-protocol
transport; the Keep transport is part of the PKMS application.

PKMS has three ways to handle Keep notes:

| Command | Auth | What it does | When to use |
|---------|------|--------------|-------------|
| `pkms ingest keep-takeout <zip>` | none (your own Takeout export) | One-shot bulk import into inbox from an offline export. Idempotent within this ramp. | When using a Takeout export instead of live access. |
| `pkms ingest keep` | master token in `.secrets/` | First contact archives every non-trashed note, including Keep-archived notes, then runs routing. Later new/edited active notes go directly to inbox. | Initial searchable archive and ongoing capture. |
| `pkms ingest keep-sweep [--apply]` | master token (destructive) | Trashes from Keep the captured notes that are old + unpinned. **Dry-run by default.** | Periodic cleanup once you trust the import. |

**Attachments** are mirrored to a local media dir (Spec 10 pattern,
sha256-named) and referenced from the capture via `file://` markdown
image links. Default is `<repo-root>/keep-media/` — anchored at the
project root, NOT the caller's working directory. Override with the
`PKMS_KEEP_MEDIA_DIR` env var. The Windows scheduled pull
(`scripts/register-keep-pull.ps1`) pins `PKMS_KEEP_MEDIA_DIR` explicitly.

## Path 1 — Optional Takeout bulk import

Takeout is the official Google export. It's read-only, needs no auth,
brings all your Keep history in one shot, and re-runs are idempotent.

1. Visit <https://takeout.google.com/>.
2. "Deselect all", then enable only **Keep**.
3. Click "Create export" → wait for the email → download the ZIP.
4. Run:
   ```
   pkms ingest keep-takeout ~/Downloads/takeout-20260726.zip
   ```
5. Verify in your vault: `vault/inbox/2026-*.md` captures, and the media
   dir (default `<repo-root>/keep-media/`, or whatever `PKMS_KEEP_MEDIA_DIR`
   is set to) has the attachments (sha256-named).

You can re-run the importer any time with a fresh Takeout ZIP — the
takeout ledger (`.ledger/keep-takeout-ledger.txt`) makes re-runs
idempotent (already-imported notes are skipped).

Both Takeout JSON layouts are accepted: current exports use
`createdTimestampUsec` / `userEditedTimestampUsec` and keep attachments
beside the note JSONs in `Takeout/Keep/`; older exports nest timestamps
under `timestamps` and keep media in `Takeout/attachments/`. The importer
reads `.zip` files only, so unpack and re-zip a `.tgz` export first.

## Path 2 — Live Bun-native sync

The incremental capture path uses PKMS's Bun-native Keep transport. It needs
a **master token** extracted once from an Android device with Keep logged in.
The token has account-wide access: treat it like the capture token and store
it only in `.secrets/`, which is gitignored.

### 1. Get a master token

1. Open a browser where you're logged into Google and visit
   <https://accounts.google.com/EmbeddedSetup>.
2. Sign in and accept the consent screen. The page may remain on a spinner.
3. Open DevTools → Application → Cookies → `https://accounts.google.com`;
   copy the `oauth_token` cookie (starts with `oauth2_4/`).
4. Use a trusted one-time Android OAuth token-exchange tool to exchange that
   OAuth token for a Keep master token. Use a 16-hex-character Android ID.
   The returned master token starts with `aas_et/`. PKMS does not store or
   derive this token; its Bun transport uses it to authenticate directly.

### 2. Store it

```sh
mkdir -p .secrets
printf %s 'you@example.com' > .secrets/keep-email
printf %s 'aas_et/...' > .secrets/keep-master-token
```

Never commit or share either file.

### 3. First pull

```sh
pkms ingest keep
```

When the live ledger file is absent, the first pull archives every non-trashed note
under `vault/sources/keep/`, including notes archived in Keep. Original text,
attachments and OCR are retained. The default rules router sends pinned notes,
notes edited in the last 30 days (`keep.recent_days`) and open checklists edited
in the last year (`keep.checklist_days`) to inbox. Notes you already archived in
Keep stay archived unless pinned; everything else remains a searchable archive.
No LLM setup is required.

The initial ID snapshot and unfinished retries live in `.ledger/keep-bootstrap.json`.
A failed image download leaves that entire note retryable as an archive, even if
other notes finished and new notes arrive before the next pull. Later new/edited
active notes retain the direct-to-inbox behavior. Existing archived Keep notes are
not polled for edits after bootstrap.

Opening today triggers a background pull when `.ledger/last_pull_at` is more than
two minutes old. The HTTP response does not await it; bulk work runs in a separate
Bun process. Repeated opens share one worker, and a cross-process lock prevents a
timer/manual pull from overlapping ingestion. Background errors are logged.

### 4. Linux user services — operator installation

The checked-in [user units](../deploy/systemd/) are not installed or enabled by
development checks. After approving live operation, create
`~/.config/pkms/runtime.env` with an absolute checkout path:

```ini
PKMS_HOME=/absolute/path/to/PKMS
```

Keep credentials remain in `.secrets/keep-email` and `.secrets/keep-master-token`;
do not put credentials in this environment file. Units include the usual Bun
locations in `PATH`; override `PATH` in the environment file if your install differs.
An operator can then run from the checkout:

```sh
mkdir -p ~/.config/systemd/user
cp deploy/systemd/pkms-keep.service deploy/systemd/pkms-keep.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now pkms-keep.timer
```

The calendar timer runs every ten minutes and catches up after downtime through
`Persistent=true`. Its installed calendar controls scheduling; changing
`keep_poll_minutes` in tuning alone does not rewrite the installed timer.
Gmail and WhatsApp service definitions share the environment file but are installed
separately after their account setup.

Unit behavior follows the official [command expansion](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html#Command%20Lines),
[environment-file](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#EnvironmentFile=)
and [persistent timer](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html#Persistent=) contracts.

### 5. Optional Windows scheduled pull

After the first pull works, register the background pull (every four hours):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-keep-pull.ps1
```

## Path 3 — Destructive sweep

**Only after Path 1 or Path 2 has imported the note.** A note is never
eligible for the sweep unless `keep_completed` (the durable SQLite index)
records it. This is the load-bearing safety property: a Keep note that
exists in your account but was never imported will never be deleted, even
if you pass `--apply`.

A note is eligible when ALL are true:

- in `keep_completed` (imported)
- older than `--age-days` (per the original Keep `createdAt`)
- not pinned (live snapshot — re-checked at sweep time)
- not already trashed or archived (live check)
- has a `keep_created_at` snapshot (grandfather clause for pre-v4 imports)

### Dry-run first

```sh
pkms ingest keep-sweep --age-days 30
```

Output:

```
DRY RUN · scanned 42 · eligible 3 (≥30d, unpinned, captured)
       · grandfathered (no age data) 5 · pinned 2 · too recent 4
       · not in vault 28
  re-run with --apply to delete 3 notes from Keep
```

### Apply (destructive)

After reading the dry-run report, if you're sure:

```sh
pkms ingest keep-sweep --age-days 30 --apply
```

The Bun-native transport moves trashed notes to Google's trash, recoverable
for about seven days before Google hard-deletes them. The sweep records its
actions in `.index/keep-sweep.json` for audit.

## Notes & caveats

- **Master tokens are long-lived but can be revoked** by security events
  (password change, Google security checkup). Symptom: `pkms ingest keep` or
  `pkms ingest keep-sweep` prints `keep login failed (auth HTTP 4xx)` or a
  Google error name → redo Path 2 step 1. The message names the reason on
  purpose: Google's auth endpoint also answers 5xx and drops connections under
  load, and that case is retried twice and then just passes on the next timer
  run, so it is not a revoked token.
- **Keep operational state lives in `.ledger/`**, separate from the disposable
  search index. It includes completion records, dedupe ledgers, sync state,
  sweep state, bootstrap retries and pull timestamps. Canonical source archives
  remain in `vault/sources/`. Existing installations must complete the
  [explicit state migration](../README.md#upgrade-existing-operational-state)
  before deleting their old index. Back up `.ledger/` with the vault and media.
- **Trashed Keep notes are never ingested.** Keep-archived notes are included on
  first contact; later pulls preserve the existing active-note-only policy.
- **Pinned notes are never deleted by the sweep.** If you want a pinned
  note gone, unpin it in Keep first, then re-run the sweep.
- Re-imports from Takeout after live sync may create duplicate captures for one
  note: Takeout uses synthetic IDs, while live sync uses Google's internal
  IDs. Choose live archive/routing or the offline Takeout bulk path deliberately
  rather than assuming the two ID namespaces deduplicate one another.

## See also

- ADR 0028 (life-os repo, `decisions/0028-google-keep-onramp.md`; purged from the
  working tree in life-os `fd152a0`, still in its git history) —
  the design rationale and the safety-gate pattern
- `src/pkms/keep_ingest.ts` and `src/pkms/keep_transport.ts`.
