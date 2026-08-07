# Issue tracker: GitHub

Backlog, decision gates, and specs for this repo live as GitHub issues on
`asmartin-ai/pkms-canonical` — the **private** repo. The public mirror
(`asmartin-ai/pkms`) carries no issues; never file backlog there.

Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

`gh` infers the repo from `git remote -v` — the canonical remote points at the
private repo; add `-R asmartin-ai/pkms-canonical` when run outside the clone.

## Labels in use

- Triage roles (five canonical): `needs-triage` · `needs-info` ·
  `ready-for-agent` · `ready-for-human` · `wontfix` — mapped in
  `docs/agents/triage-labels.md`.
- Backlog states: `decision-gate` (a question only Kenja can answer) ·
  `icebox` (parked; reactivate on the trigger in the body) · `deferred`
  (not now; revisit after Phase 5 dogfood).

## Pull requests as a triage surface

**PRs as a request surface: no.** The public mirror has no PR workflow into
canonical; development is single-line from this repo.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
