## Role & tier
You are the EXECUTOR for one bounded task handed down by a T1-frontier orchestrator.
Do exactly the task; do not re-scope, refactor beyond it, or touch unrelated files.

## Environment
- User: Kenja. OS: Windows.
- Repo root: K:\Projects\PKMS. Python package lives in src/pkms/.
- The oracle tests are read-only context. Do NOT modify any file under tests/.

## Task
Implement PKMS slice 8: two capture ramps (email-in and Discord bot). The failing tests
tests/test_email_ingest.py and tests/test_discord_capture.py are the contract — make them
pass. Four files are editable: src/pkms/email_ingest.py, src/pkms/discord_capture.py,
src/pkms/cli.py, pyproject.toml.

### 1. src/pkms/email_ingest.py (currently a placeholder docstring)
Standard library only (imaplib, email, hashlib, pathlib). Implement:

- `EMAIL_LEDGER = "email-ledger.txt"` — append-only dedupe ledger in the .index dir,
  one id per line. Follow the exact shape of `load_ledger` / `append_ledger` in
  src/pkms/keep_ingest.py (provided read-only).
- `load_email_ledger(index_dir: Path) -> set[str]`
- `append_email_ledger(index_dir: Path, ids: list[str]) -> None` — create index_dir if missing.
- `capture_text_from(msg: email.message.Message) -> str` — returns the capture body:
  the Subject header as the first line, then a blank line, then the message body text.
  If there is no subject, return the body only. For multipart messages prefer the
  text/plain part; if none exists fall back to the first text/* part. Decode payloads
  with `get_payload(decode=True)` and the part's charset (default utf-8). Strip
  leading/trailing whitespace from the body.
- `ingest_email(vault: Path, index_dir: Path, *, fetch: Callable[[], list[bytes]]) -> dict`
  — `fetch()` returns a list of raw RFC822 messages as bytes. For each raw message:
  parse with `email.message_from_bytes`; compute its id as the Message-ID header with
  surrounding angle brackets and whitespace stripped, or, if the header is missing,
  `hashlib.sha256(raw).hexdigest()`. If the id is already in the ledger, count it as
  skipped. Otherwise call `write_capture(text, vault, source="email", extra={"email_id": id})`
  (import from pkms.capture, provided read-only), then append the id to the ledger
  immediately (per message, after the write succeeds). Return `{"captured": n, "skipped": m}`.
- `make_imap_fetch(address: str, password: str, label: str = "pkms") -> Callable[[], list[bytes]]`
  — returns a zero-arg callable that connects `imaplib.IMAP4_SSL("imap.gmail.com")`,
  logs in with `address` / `password`, selects the Gmail label as a mailbox (quote the
  name: `select('"' + label + '"')`), searches ALL, fetches each message with RFC822,
  logs out, and returns the list of raw message bytes. This function is not covered by
  the tests; keep it small and defensive (return [] if select fails).

### 2. src/pkms/discord_capture.py (currently a placeholder docstring)
Standard library only at module level (urllib.request, pathlib). The `discord` package
must NOT be imported at module level — the test suite runs without it installed.
Implement:

- `DISCORD_LEDGER = "discord-ledger.txt"` plus `load_discord_ledger(index_dir)` /
  `append_discord_ledger(index_dir, ids)` — same ledger shape as above.
- `should_capture(*, author_is_bot: bool, is_dm: bool, channel_id: str | None, allowed_channel_id: str | None) -> bool`
  — False if author_is_bot. True if is_dm. Otherwise True only when allowed_channel_id
  is not None and channel_id == allowed_channel_id.
- `make_poster(base_url: str, token: str) -> Callable[[str], None]` — returns a callable
  that POSTs the given text to `{base_url}/capture?source=discord` with header
  `X-Capture-Token: {token}` and the raw utf-8 text as the request body, using
  urllib.request. Let urllib's HTTPError propagate on non-2xx.
- `capture_message(text: str, message_id: str, index_dir: Path, *, post: Callable[[str], None]) -> bool`
  — if message_id is already in the ledger return False without posting. Otherwise call
  `post(text)` FIRST (exceptions propagate and the id must NOT be ledgered on failure),
  then append message_id to the ledger and return True.
- `run_bot(bot_token: str, index_dir: Path, *, base_url: str, capture_token: str, allowed_channel_id: str | None = None) -> None`
  — the discord.py wiring, NOT covered by tests. Import discord lazily inside this
  function. Create a discord.Client with default intents plus `message_content = True`.
  In on_message: compute is_dm as `message.guild is None`, channel_id as
  `str(message.channel.id)`, author_is_bot as `message.author.bot`; if
  `should_capture(...)` passes, call `capture_message(message.content, str(message.id),
  index_dir, post=make_poster(base_url, capture_token))` and on True add a "✅" reaction
  to the message. Finally `client.run(bot_token)`.

### 3. src/pkms/cli.py — add two typer commands, following the existing style
(e.g. the ingest_keep_cmd command and how it derives the vault / index / root paths —
reuse the same helpers the other commands use).

- `pkms ingest-email` (command name "ingest-email"): read the address from
  `.secrets/email-address` and the password from `.secrets/email-app-password` using
  `read_secret` from pkms.keep_ingest. If either is missing, print a short message
  telling the user to create those two files and exit with code 1. Option
  `--label` (default "pkms"). Build `fetch = make_imap_fetch(address, password, label)`,
  run `ingest_email(vault, index_dir, fetch=fetch)`, print a one-line report like
  "captured 2, skipped 5".
- `pkms discord-bot` (command name "discord-bot"): read the bot token from
  `.secrets/discord-bot-token` via `read_secret`; if missing, print how to create it and
  exit 1. Resolve the capture-service token with `resolve_token(root)` imported from
  pkms.capture_service (signature: `resolve_token(root: Path, token: str | None = None) -> str`).
  Options: `--base-url` (default "http://127.0.0.1:8765"), `--channel-id` (optional str,
  default None). Call `run_bot(bot_token, index_dir, base_url=base_url,
  capture_token=capture_token, allowed_channel_id=channel_id)`.

### 4. pyproject.toml
Add "discord.py>=2" as a new optional-dependencies group named "discord"
(alongside the existing "dev" group). Do not change anything else in the file.

## Style
Match the repo: type hints, concise docstrings, ruff line-length 100, Python 3.11+.

## Done-when
`K:\Projects\PKMS\.venv\Scripts\python.exe -m pytest tests/test_email_ingest.py tests/test_discord_capture.py -q`
is fully green, with no edits to any test file.
