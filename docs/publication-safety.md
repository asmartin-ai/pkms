# PKMS publication safety

> Snapshot as of 2026-08-07. The publication boundary and generated-mirror
> workflow are normative policy. **The split is now live:** `asmartin-ai/pkms-canonical`
> (private, full vault state) and `asmartin-ai/pkms` (public, sanitized mirror).

PKMS has two repos:

- **`pkms-canonical`** (private): the full local repo/vault, including captures, daily notes, personal notes, generated indexes, tokens, local paths, and unscrubbed research. **This is where work happens.** Never push it to a public remote.
- **`pkms`** (public): the public mirror. Push here only after running the mirror build and safety checker.

## Public/private boundary

### Public-safe allowlist

These paths may be copied into a public mirror when they pass the safety checker:

```text
AGENTS.md
DESIGN.md
LICENSE
PRODUCT.md
README.md
pyproject.toml
bin/pkms.cmd
scripts/check_publication_safety.py
scripts/build_public_mirror.py
src/**
tests/**
.github/workflows/**
.agents/skills/**
docs/**
vault/resources/adhd-design-language-repo.md
vault/resources/research/**
vault/projects/pkms-design/*.md
```

The vault entries above are **not** a blanket `vault/**` grant. Public vault content is opt-in by subtree or file, and still needs scrub review.

### Always private denylist

These paths must never be copied to the public mirror:

```text
.secrets/**
.index/**
keep-media/
.venv/**
**/.venv/**
.pytest_cache/**
dist/**
build/**
**/__pycache__/**
*.db
*.sqlite
*.sqlite3
*.db-shm
*.db-wal
.env
*.env.local
*.pem
*.key
*.p12
vault/daily/**
vault/inbox/**
vault/media/**
vault/areas/**
vault/archive/**
vault/**/*.zip
vault/**/*.tar
vault/**/*.tar.gz
vault/**/*.7z
exports/**
spike/**
.impeccable/live/sessions/**
```

- `keep-media/` — the default Keep attachments dir, repo-root anchored
  (`<repo-root>/keep-media/`). Covered by both `.gitignore` and the
  checker's denylist, so attachments cannot leak into the mirror even if
  the `PKMS_KEEP_MEDIA_DIR` env-var override fails.

### Needs scrub / private by default

These paths often contain useful public material, but they are private until intentionally reviewed:

```text
vault/projects/**
vault/resources/reading/**
vault/resources/research/**
.impeccable/critique/**
docs/**
scripts/*.ps1
scripts/*.ahk
```

Examples of scrub targets:

- local Windows or Unix paths (`/path/to/local-resource`, `/path/to/local-resource`, `/path/to/local-resource`)
- raw email addresses, account IDs, client IDs, or API credentials
- tokens, cookies, `.env` values, OAuth secrets, app passwords, and capture tokens
- database paths, generated indexes, exports, caches, archives, and real fixtures
- private daily notes, inbox captures, personal vault notes, or private media

## Public research vs private vault contents

Public research notes should be framed as reusable product/design research. Private vault notes are personal operational state. A research note can be public only when:

1. it does not include raw captures, private daily context, personal account details, local database paths, or unreleased/private third-party data;
2. source excerpts are legally and ethically shareable;
3. local paths and machine-specific commands are replaced with generic placeholders; and
4. the note is included in the allowlist intentionally, not because it happened to live under `vault/`.

If a public research note depends on private vault evidence, summarize the public conclusion and keep the raw evidence private.

## Safety check

Build the generated mirror before publishing:

```powershell
python scripts/build_public_mirror.py
```

The generated output lands in `exports/public-mirror/` (gitignored). It copies only tracked allowlisted files and applies deterministic scrubs for canonical-only local path shapes.

Run the canonical safety check before mirroring or moving work between public/private remotes:

```powershell
python scripts/check_publication_safety.py --history
```

Useful checker variants:

```powershell
python scripts/check_publication_safety.py                   # working tree + tracked content
python scripts/check_publication_safety.py --history         # also scan historical path additions
python scripts/check_publication_safety.py --mirror-manifest # print allowlisted mirror files
```

### Severities

- **FAIL** (blocks publish, exit 1): tracked private path matches the
  denylist; local path in a NON-scrub-suffix file; non-example raw email;
  credential-shaped assignment; allowlist↔denylist overlap in the mirror
  manifest; untracked-but-not-ignored denylist path.
- **WARN** (exit 0): history findings only — paths matching
  `HISTORY_RISK_PATTERNS` added in past commits but removed from the
  current tree. Pre-existing (already public on origin) and unfixable
  without a history rewrite (the user has authorized rewriting next).
- **Exempt from content scan** (`SELF_REFERENTIAL` set in the checker):
  `scripts/check_publication_safety.py`, `scripts/build_public_mirror.py`,
  `tests/test_publication_safety.py` — these contain path/regex/fixture
  literals by design; exempting them is load-bearing. **The mirror copy of
  the builder is additionally scrubbed** (its `SPECIFIC_REPLACEMENTS` table
  rewritten to placeholders, regexes untouched), so the real machine paths
  that table maps cannot leak into the public repo.
- **Mirror-aware path exemption:** files with a suffix in `SCRUB_SUFFIXES`
  = {.cmd, .css, .html, .json, .md, .toml, .txt, .yaml, .yml} skip
  local-path checks because the mirror's `should_scrub` rewrites those
  paths. Email and credential checks apply to every file regardless of
  suffix.

A failure does not automatically mean content must be deleted. Decide whether each finding should be scrubbed, moved to the future private canonical repo, explicitly accepted as public, or handled with a separate history rewrite.

## Recommended workflow

1. Keep or create a private canonical repo/workspace for the full PKMS vault and local state.
2. Generate a public mirror from the allowlist instead of pushing canonical `main` directly.
3. Run `python scripts/build_public_mirror.py` to produce `exports/public-mirror/`.
4. Run `python scripts/check_publication_safety.py --history` on the canonical checkout before changing remotes or history.
5. Review findings manually. Do not rewrite history, delete files, or force-push without an explicit decision and backup bundle.
6. Push only the generated sanitized mirror to the public repo.

## Current repo recommendation

`asmartin-ai/pkms` is already public, so existing pushed history should be treated as already exposed. The safest path is:

- make this repo the public mirror target going forward;
- create a future private canonical repo for full vault/local state;
- avoid raw pushes from private canonical to public; and
- handle any existing public-history scrub as a separate explicit operation.
