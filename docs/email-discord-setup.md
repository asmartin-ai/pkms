# Slice 8 activation — email-in + Discord bot (Kenja, ~12 min total)

Code is merged and tested; these are the only manual steps. Both ramps are
idempotent — safe to run repeatedly, nothing is captured twice.

## Email-in (~2 min + one test send)

Address shape (K4, decided 2026-07-05): plus-alias `aaronmartin638+pkms@gmail.com`
with a Gmail label. The poller reads the **label**, not the address, so the future
migration to a dedicated account is just new secrets + a new filter — no code change.

1. Gmail → Settings → Filters → Create filter: **To** `aaronmartin638+pkms@gmail.com`
   → Apply label **`pkms`** (create it), optionally Skip Inbox.
2. Create an app password at https://myaccount.google.com/apppasswords (requires 2FA).
3. In the repo root, create two files (gitignored under `.secrets/`):
   - `.secrets/email-address` — `aaronmartin638@gmail.com`
   - `.secrets/email-app-password` — the 16-char app password
4. Run `pkms ingest email`. It prints `email: captured N, skipped M`.
   Different label: `pkms ingest email --label other-label`.
5. **Test the plus-alias from work** — some corporate mail systems strip or reject
   plus-addresses. If yours does, any mail you manually label `pkms` still gets
   captured (the label is the contract).

Dedupe ledger: `.index/email-ledger.txt` (append-only, one Message-ID per line).

## Discord bot (~10 min, K5)

1. https://discord.com/developers/applications → New Application → Bot.
2. **Enable "Message Content Intent"** under Bot → Privileged Gateway Intents —
   without it the bot receives empty message bodies.
3. Reset Token → copy it into `.secrets/discord-bot-token`.
4. Invite it to your server: OAuth2 → URL Generator → scope `bot` → permissions
   **View Channels, Add Reactions** → open the generated URL. (DMs work once you
   share a server with the bot.)
5. Install the dependency into the project venv:
   `.venv\Scripts\python.exe -m pip install -e ".[discord]"`
6. With the capture service running (`pkms serve`), run `pkms discord-bot`.
   DMs are always captured; add `--channel-id <id>` to also listen in one channel.
   A ✅ reaction = saved to `vault/inbox/`.

Dedupe ledger: `.index/discord-ledger.txt`.

## Done-when (build-plan slice 8)

An email sent from a work-ish context and a Discord DM both appear in
`vault/inbox/` and in the next /fold run.
