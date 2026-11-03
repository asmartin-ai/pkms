# AGENTS.md — PKMS project rules

Layers on top of the user's global agent rules.
This file is the repo-local source of truth for agents that understand the AGENTS.md standard.

## Remotes

| Remote | Repository | Visibility | Role |
|--------|-----|------------|------|
| `canonical` | `pkms-canonical` | **private** | Full vault state — push work here |
| `origin` | `pkms` | public | Sanitized mirror — publish with the Bun/TypeScript mirror tools |

Push canonical `main` to `canonical` (private), and only when the user asks. Never
push canonical raw to `origin` (public); public updates go through the mirror build
pipeline. Full policy: `docs/publication-safety.md`.

In the canonical checkout, agents must work in a `git worktree` under `/tmp/`
branched off `main` — never in the live checkout: systemd services run from it.
Only the architect fast-forwards canonical `main` in place, after `bun run check`
on each merged branch.

## Project overview

Markdown files in `vault/` are the source of truth; the SQLite database
`.index/pkms.db` (v4 + FTS5) is a derived, regenerable index for search, backlinks,
tasks, and resurfacing.

- **Runtime:** TypeScript on Bun (`src/pkms/*.ts`, tests in `tests/ts/`). Nunjucks
  renders server-side htmx partials; TypeScript islands only where a surface needs
  ephemeral client view state; client plugins ship as compiled ES modules (import
  maps, no consumer build step). No React.
- **Design language:** before designing any surface, flow, copy, or automation, read
  `DESIGN.md`. Canonical contributors also consult the shared design language when
  available; it is not included in the public mirror.

## Data safety and no-touch paths

- `.secrets/` holds tokens and credentials (Keep account-access token, capture
  token). Never read, print, or commit its contents.
- `vault/daily/`, `vault/inbox/`, and `vault/media/` are gitignored personal content
  kept local; the app recreates the dirs on demand. The rest of the vault is tracked.
- `.index/` is gitignored and derived — rebuild with `pkms index`, never hand-edit.
- **User-visible state lives in note frontmatter, never only in the index** (e.g.
  `reading: queued` on promoted notes, task states).
- Throwaway generated artifacts go in `exports/`, never in `vault/` — the FTS index
  must not see duplicate content. Throwaway experiments live in `spike/`.
- Unattended/scheduled steps (e.g. the Keep pull) must not depend on an optional
  interactive service: OCR-at-ingest uses tesseract, not a local vision model.

```
vault/
  daily/       # Daily notes, YYYY-MM-DD.md   (gitignored — kept local)
  inbox/       # Raw captures awaiting /fold   (gitignored — kept local)
  projects/    # Active project notes
  areas/       # Ongoing responsibilities
  resources/   # Reference material
  archive/     # Completed / inactive notes
```

## No comments in code

Code carries no comments: no `//`, `/* */`, JSDoc, `#`, `<!-- -->` or `{# #}`. Put the why in a
test name, a doc beside the code or the commit message; turn an invariant into a test.
`bun run check` enforces it: the oxlint rule `khaos/no-comments` (`tools/oxlint/khaos/`,
`oxlint --fix` removes them) covers TS/JS, and `scripts/check-no-comments.ts` (`--fix` removes
them) covers CSS, HTML, Nunjucks, shell and PowerShell. Shebangs and vendored code
(`src/pkms/web/htmx.min.js`, `src/pkms/web/ext/json-enc.js`, `.agents/`,
`tools/oxlint/anti-slop/`) are exempt. Markdown in `vault/` and `docs/` is not code.

## Source layout

```
src/pkms/      # Bun-native TypeScript application
tests/ts/      # Bun test suite
scripts/       # Maintenance and integration tools
```

## Build and checks

```sh
bun install --frozen-lockfile
bun run check      # lint (oxlint --deny-warnings) + typecheck + tests
```

`bun run check` must be green before reporting work done. Do not bypass the strict
anti-slop rules in `.oxlintrc.json`.

## Key conventions

- Notes use `[[wikilink]]` syntax for internal links.
- Frontmatter (YAML) carries metadata: `tags`, `created`, `modified`, `status`.
- Tasks are `- [ ] task text` lines with optional `⏱size ▶first action ✓done-when`
  metadata in any order. States by marker: `[ ]` open · `[x]` done · `[?]` stuck ·
  `[~]` not-now · `[p]` paused (text carries its reactivation condition) ·
  `[i]` iceboxed. The reshape clock (14d, `task_seen` in the index) resets on any
  edit to the line — flipping a marker counts as a human touch.
- Daily notes carry stable section anchors (`## breadcrumb`, `## folded today`,
  `## notes` — `src/pkms/daily.ts`): agents edit section *content*, never the headings.
- Input ramps implement `InputRamp` (`src/pkms/ramp.ts`) and register in
  `src/pkms/ramps/index.ts`; each points at its setup doc under `docs/`.

## Common commands

`bin/pkms` launches the Bun CLI and sets `PKMS_HOME`.

```
pkms capture "text"   # Dump a thought into vault/inbox/
pkms today            # Breadcrumb, inbox, next actions
pkms serve            # Web service :8765 — capture endpoint + today-view
                      #   (token in .secrets/; restart to pick up code changes)
pkms index            # Rebuild full index from vault
pkms search <query>   # Full-text search
pkms backlinks <note> # Show what links to a note
pkms promote <url|terms> # Hoarded Reddit thread → note in vault/resources/reading/
pkms tasks            # One next action per note (--all · --stash · --stale · --done)
pkms did "thing"      # Log a done thing into today's note
pkms resurface        # Questions from the vault, each with a why
pkms new [title]      # Create a new note
pkms daily            # Open/create today's daily note (--no-open for agent use)
pkms ingest [ramp]    # List ramps / pull one (keep, email, whatsapp, …)
```

Ramp setup: `docs/keep-setup.md`, `docs/email-discord-setup.md`,
`docs/whatsapp-setup.md`, `docs/phone-capture-setup.md`.

## Canonical contributor context

The private canonical checkout includes additional agent skills and contributor
guidance that are not published in the mirror. Its `/fold` skill handles inbox
captures with a proposal and approval; `/resume` reads and writes session breadcrumbs.

Backlog, decision gates, and specs track as GitHub issues on `pkms-canonical`
(private; the public mirror carries no issues). The canonical checkout's
`NEXT.md` holds the current focus and next actions. Its private contributor
guidance covers the issue tracker, triage labels, and domain docs.
