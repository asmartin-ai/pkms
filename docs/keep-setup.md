# Google Keep ingest — full setup

⏱ ~5 min for the master-token route · ▶ run the docker one-liner below
(or the no-docker variant) · ✓ done when `pkms ingest keep` prints
"keep connected ✓" or `pkms ingest keep-takeout <zip>` reports "X keep
notes imported from takeout".

PKMS now has three ways to get Keep notes into the vault:

| Command | Auth | What it does | When to use |
|---------|------|--------------|-------------|
| `pkms ingest keep-takeout <zip>` | none (your own Takeout export) | One-shot bulk import of every Keep note. Idempotent. **Start here.** | First import of all history; periodic re-imports for a fresh snapshot. |
| `pkms ingest keep` | master token in `.secrets/` | Live incremental sync via gkeepapi. First run primes a baseline; new notes flow in from there. | After Takeout, to capture new notes as you make them. |
| `pkms ingest keep-sweep [--apply]` | master token (destructive) | Trashes from Keep the captured notes that are old + unpinned. **Dry-run by default.** | Periodic cleanup once you trust the import. |

**Attachments** are mirrored to `/path/to/local-resource` (Spec 10 pattern,
sha256-named) and referenced from the capture via `file://` markdown
image links. Override with `PKMS_KEEP_MEDIA_DIR` env var.

## Path 1 — Takeout bulk import (recommended starting point)

Takeout is the official Google export. It's read-only, needs no auth,
brings all your Keep history in one shot, and re-runs are idempotent.

1. Visit <https://takeout.google.com/>.
2. "Deselect all", then enable only **Keep**.
3. Click "Create export" → wait for the email → download the ZIP.
4. Run:
   ```
   pkms ingest keep-takeout /path/to/local-resource
   ```
5. Verify in your vault: `vault/inbox/2026-*.md` captures, and
   `/path/to/local-resource` has the attachments (sha256-named).

You can re-run the importer any time with a fresh Takeout ZIP — the
takeout ledger (`.index/keep-takeout-ledger.txt`) makes re-runs
idempotent (already-imported notes are skipped).

## Path 2 — Live gkeepapi sync

This is the incremental capture path. Uses a **master token** extracted
once from an Android device with Keep logged in. The token is
high-blast-radius (it IS Google account access); treat like the capture
token, store in `.secrets/`, gitignore.

### 1. Get a master token

The token dance needs an **OAuth token** first:

1. Open a browser where you're logged into your Google account and visit
   <https://accounts.google.com/EmbeddedSetup>
2. Sign in. On the consent screen ("I agree"), agree — the page may then sit on
   a spinner; that's fine.
3. Open DevTools → Application → Cookies → `https://accounts.google.com` and
   copy the value of the `oauth_token` cookie (starts with `oauth2_4/`).

Then exchange it for a master token. **Docker variant** (gkeepapi's documented
route):

```
docker run --rm -it --entrypoint /bin/sh python:3 -c "pip install gpsoauth; python3 -c 'import gpsoauth; print(gpsoauth.exchange_token(input(\"Email: \"), input(\"OAuth Token: \"), input(\"Android ID: \")))'"
```

**No-docker variant** (uses the project venv; gpsoauth ships with gkeepapi):

```powershell
.\.venv\Scripts\python.exe -c "import gpsoauth; print(gpsoauth.exchange_token(input('Email: '), input('OAuth Token: '), input('Android ID: ')))"
```

Android ID: any 16-hex-char string works (e.g. `0123456789abcdef`).
The output dict's `Token` value (starts with `aas_et/`) is the master token.

### 2. Store it

```powershell
Set-Content -NoNewline .secrets\keep-email "you@example.com"
Set-Content -NoNewline .secrets\keep-master-token "aas_et/..."
```

(`.secrets/` is gitignored, same as the capture token.)

### 3. First pull

```powershell
pkms ingest keep
```

The first run **connects and baselines** — it records what already exists in
Keep without dumping years of history into the inbox. Only notes created after
that point flow in. (Want some history anyway? Run Path 1 first.)

### 4. Optional: scheduled pull

Once the first pull works, register the background pull (every 4 hours, silent,
skips quietly when offline):

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

```powershell
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

```powershell
pkms ingest keep-sweep --age-days 30 --apply
```

The sweep calls `note.trash()` (gkeepapi) which moves the note to Google's
trash — recoverable for ~7 days before Google hard-deletes. The sweep
records what it did in `.index/keep-sweep.json` for audit.

## Notes & caveats

- **Master tokens are long-lived but can be revoked** by security events
  (password change, Google security checkup). Symptom: `pkms ingest keep` or
  `pkms ingest keep-sweep` says the token may have expired → redo Path 2 step 1.
- **The dedupe ledger** lives in `.index/keep-ledger.txt` (live) and
  `.index/keep-takeout-ledger.txt` (Takeout). Wiping `.index` re-primes the
  live baseline; re-running the takeout importer is naturally idempotent.
- **Trashed Keep notes are never ingested.** Archiving in Keep is fine —
  already-ingested notes aren't re-pulled.
- **Pinned notes are never deleted by the sweep.** If you want a pinned
  note gone, unpin it in Keep first, then re-run the sweep.
- **Re-imports from Takeout** after a gkeepapi daemon has been running may
  produce duplicate captures for the same physical note (the takeout
  importer uses synthetic ids, gkeepapi uses Google's internal ids). You
  can de-dupe by title in the vault, or just live with the duplicates —
  the takeout path is the canonical import and gkeepapi is the
  incremental layer on top.

## See also

- ADR 0028 (`/path/to/local-resource`) —
  the design rationale and the safety-gate pattern
- `keep_ingest.py` and `keep_takeout.py` in `src/pkms/`
