# Task: implement `area_tiles` data source + `/api/area-tiles` endpoint

## Environment
- User: Kenja. Repo: K:\Projects\PKMS (you are already inside it; use relative paths).
- Python package lives in `src/pkms/`. Tests in `tests/`.
- Windows machine, but write portable code (pathlib, forward-slash posix output paths).

## Goal
Make `tests/test_area_tiles.py` pass. That test file is the contract — read it
first and follow it exactly. Do NOT edit any test file.

## Edit exactly two files
1. `src/pkms/today.py` — add a public function `area_tiles(vault: Path, index_dir: Path) -> list[JsonDict]`.
2. `src/pkms/capture_service.py` — add a `GET /api/area-tiles` route.

## `area_tiles` requirements
- Area notes are the `*.md` files directly inside `vault / "areas"` (top level
  only, like `inbox_items` uses `inbox.glob("*.md")`). If the directory is
  missing or empty, return `[]`.
- Return one dict per area note with EXACTLY these keys:
  `title`, `path`, `next_action`, `last_touched`. No other keys.
- `title`: the frontmatter `title` if present, else the file stem. Load
  frontmatter with the `frontmatter` library inside a try/except like
  `inbox_items` does — a malformed note is skipped entirely, never an error.
- `path`: vault-relative POSIX path, e.g. the literal string `"areas/career.md"`.
  Build it the same way `recognition_cards` does: `"/".join(p.relative_to(vault).parts)`.
- `next_action`: the display text of the note's single next action, or `None`.
  Get it by reusing the existing pieces in `today.py` and `tasks.py`:
  - If `(index_dir / "pkms.db")` does not exist, every tile's `next_action` is `None`.
  - Otherwise open the db exactly like `_next_actions` does (`from .db import connect`,
    `connect(index_dir)`, close after), call `tasks.next_action_per_note(conn)`,
    and build a mapping from each row's `note_path` to `_display_text(row["text"])`.
  - A tile's `next_action` is that mapping's value for its `path`, else `None`.
- `last_touched`: the file's mtime as ISO-8601 UTC, exactly like `recent_notes`
  does it: `datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()`.
- Sort tiles by `path` ascending. Cap the list at 8 (`[:8]`).
- Read-only: never write to the vault or the index.
- Write a short docstring in the same voice as `inbox_items` / `recent_notes`
  (mention: Lamplight rule, one next action per tile, no counts, empty state
  returns `[]`, read-only).

## Endpoint requirements
In `capture_service.py` `do_GET`, add an `elif path == "/api/area-tiles":`
branch right after the `/api/inbox-items` branch, following the identical
pattern: lazy `from .today import area_tiles`, then
`self._send(200, json.dumps(area_tiles(vault, index_dir)), "application/json; charset=utf-8")`.
It sits below the existing `_authed()` check so it is already token-gated —
do not add any extra auth code.

## Verify
Run: `.venv/Scripts/python.exe -m pytest tests/test_area_tiles.py -q`
All 15 tests must pass. Do not modify any other file.
