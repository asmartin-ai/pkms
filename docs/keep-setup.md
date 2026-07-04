# Google Keep ingest — one-time setup

⏱ ~5 min · ▶ run the docker one-liner below (or the no-docker variant) · ✓ done
when `pkms ingest keep` prints "keep connected ✓"

`pkms ingest keep` pulls **new** Keep notes into `vault/inbox/` (images land in
`vault/media/keep/` with their text OCR'd straight into the capture). It uses
gkeepapi, the unofficial mobile-Keep API — the official API is Workspace-only.
Auth needs a **master token**, obtained once.

## 1. Get a master token

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

## 2. Store it

```powershell
Set-Content -NoNewline .secrets\keep-email "you@example.com"
Set-Content -NoNewline .secrets\keep-master-token "aas_et/..."
```

(`.secrets/` is gitignored, same as the capture token.)

## 3. First pull

```powershell
pkms ingest keep
```

The first run **connects and baselines** — it records what already exists in
Keep without dumping years of history into the inbox. Only notes created after
that point flow in. (Want some history anyway? Share those notes' text into any
capture ramp, or ask Claude to pull specific ones.)

## 4. Optional: scheduled pull

Once the first pull works, register the background pull (every 4 hours, silent,
skips quietly when offline):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-keep-pull.ps1
```

## Notes & caveats

- Master tokens are long-lived but **can** be revoked by security events
  (password change, Google security checkup). Symptom: `pkms ingest keep` says
  the token may have expired → redo step 1.
- The dedupe ledger lives in `.index/keep-ledger.txt`. If you ever delete
  `.index/` entirely, the next run re-baselines: notes created between the
  wipe and that run won't be ingested — share anything important into a
  capture ramp manually.
- Trashed Keep notes are never ingested. Archiving in Keep is fine — already-
  ingested notes aren't re-pulled.
