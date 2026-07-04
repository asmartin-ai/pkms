# P2 delegation: recent-notes + search endpoints

You are an executor working in the PKMS repo at K:\Projects\PKMS on a Windows
machine. CWD conventions are Windows backslash for executables, forward-slash
for pytest *arguments*. The repo venv is at K:\Projects\PKMS\.venv.

## Goal

Implement two token-gated read-only HTTP endpoints in
`src/pkms/capture_service.py` so the RED oracle
`tests/test_web_search_surfaces.py` goes green. The oracle is read-only context
— DO NOT edit it. The oracle's hash before this run was
`2ae096dde998ef5a365210bea067dc8e87cce4bb` and must remain unchanged.

## Files in scope (the ONLY files you may edit)

- `src/pkms/capture_service.py` — add the two routes to the `do_GET` handler's
  dispatch chain (after `/api/recognition-cards`, before the `else: 404`).
- `src/pkms/today.py` — add a `recent_notes()` helper (see below). Keep the
  module's existing exports intact; this is an ADDITION.

## Read-only context (do not edit)

- `tests/test_web_search_surfaces.py` — the oracle. Read it to learn the exact
  contract: endpoint paths, response shape, sorting, the literal-by-default
  search behavior, and the empty-state requirements.
- `src/pkms/search.py` — `search(query, index_dir, limit=20, raw=False)` is
  the existing literal-by-default search (B4 contract: a plain query is
  sanitized to quoted tokens; raw FTS only behind `raw=True`). USE IT for
  `/api/search?q=`. Do NOT re-implement search.
- `src/pkms/db.py` — `connect(index_dir)` returns a `sqlite3.Connection` with
  `row_factory=sqlite3.Row`. The `notes` table has columns:
  `id, path, title, created, modified, tags, content, indexed_at`.
  `indexed_at` is reset on every reindex (useless for recency). `modified` is
  from frontmatter and often empty. Use file mtime for the recency sort key.
- `tests/test_web_api_surfaces.py` — the existing endpoint test pattern to
  mirror (token-gated, JSON, the `make_server` fixture shape).
- `src/pkms/today.py` — module structure: `JsonDict = dict[str, object]` type
  alias at top, helpers are `_leading_underscore` private, public exports are
  `today_view`, `reading_queue`, `recognition_cards`. Add `recent_notes` as a
  new public function following the same style.

## Endpoint 1: GET /api/recent-notes

Token-gated (the existing `if not self._authed(): return self._send(403, ...)`
check above the dispatch handles this — DO NOT re-add it inside the route).

Returns: `200` with `application/json; charset=utf-8` body = JSON list of
recently-touched notes, capped at 8, sorted most-recent-first. Each entry:
`{"title": str, "path": str, "last_touched": str}` where:
- `title` — the note's title (from the index `notes.title` column; this is
  already populated by the indexer with frontmatter title or file stem).
- `path` — vault-relative path with FORWARD SLASH separators
  (e.g. `projects/alpha.md`). The app.js contract uses `/` — never backslash.
  Use `Path.as_posix()` or `str.replace("\\", "/")`.
- `last_touched` — the note file's mtime as an ISO 8601 string
  (e.g. `datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()`).
  This is ground truth from disk, NOT the index's `indexed_at` (which is
  identical for all notes after a reindex) and NOT `modified` (often empty).

Implementation in `today.py`:
```python
def recent_notes(vault: Path, index_dir: Path, *, limit: int = 8) -> list[JsonDict]:
    """Recently touched notes (recognition-first picker candidates).
    Reuses the index for the candidate set (title + path); mtime from disk is
    the sort key — ground truth, not index-derivable (the index is regenerable
    and `modified` frontmatter is often empty). Read-only, side-effect-free."""
    if not (index_dir / "pkms.db").exists():
        return []
    from .db import connect
    conn = connect(index_dir)
    rows = conn.execute("SELECT path, title FROM notes").fetchall()
    conn.close()
    out: list[JsonDict] = []
    for r in rows:
        p = vault / r["path"]
        if not p.is_file():
            continue
        mtime = p.stat().st_mtime
        out.append({
            "title": r["title"],
            "path": Path(r["path"]).as_posix(),
            "last_touched": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
        })
    out.sort(key=lambda e: e["last_touched"], reverse=True)
    return out[:limit]
```
Make sure `datetime` and `timezone` are imported at the top of `today.py`
(check — `from datetime import date` is there; add `datetime, timezone` to
that import line if not already present). `Path` is already imported.

Route in `capture_service.py` `do_GET` (add as an `elif` branch in the
existing dispatch chain, after the `/api/recognition-cards` branch):
```python
elif path == "/api/recent-notes":
    from .today import recent_notes
    body = json.dumps(recent_notes(vault, index_dir))
    self._send(200, body, "application/json; charset=utf-8")
```

## Endpoint 2: GET /api/search?q=

Token-gated (same existing auth check above the dispatch).

Query param `q` (may be missing or empty — return `200 []` in both cases; do
NOT 500). Use `search.search(query, index_dir)` from `src/pkms/search.py` — it
returns `list[dict]` with keys `path`, `title`, `excerpt`. The literal-by-
default contract (B4) is in `search.search()` already — DO NOT pass `raw=True`.
Return the list as-is (JSON). Cap at the existing `limit=20` default (do not
add a limit param unless the test requires it — it doesn't).

Route in `capture_service.py` `do_GET` (add as another `elif` branch, after
`/api/recent-notes`):
```python
elif path == "/api/search":
    q = parse_qs(urlparse(self.path).query).get("q", [""])[0]
    from .search import search
    body = json.dumps(search(q, index_dir))
    self._send(200, body, "application/json; charset=utf-8")
```
`parse_qs` and `urlparse` are already imported at the top of
`capture_service.py` (the `_authed` method uses them). Do not re-import them
inside the branch; just use them directly.

## Invariants (do not break)

- API contract stability: existing `/api/*` routes, `/capture`, and
  `/api/open-note` MUST keep their current behavior. This is an ADDITION,
  not a refactor.
- No new runtime deps. Stdlib only (already the case).
- Token-gating is enforced by the existing `if not self._authed()` check
  above the dispatch — DO NOT duplicate it inside your routes.
- The index is regenerable — never write to it from these endpoints.
- Empty/missing `q` returns `200 []`, NOT 500.
- Paths in `recent_notes` use forward slashes.

## Acceptance command

```
K:\Projects\PKMS\.venv\Scripts\python.exe -m pytest tests/test_web_search_surfaces.py -q
```

After your changes, all 9 tests in that file should pass. Then run the full
suite to confirm no regressions:
```
K:\Projects\PKMS\.venv\Scripts\python.exe -m pytest -q
```
The baseline before your changes was 372 passing + this oracle's 7 RED = 379
collected, 372 passing. After: 379 collected, 379 passing (the 7 RED go green,
no existing test regresses).

## Anti-gaming

Do NOT edit `tests/test_web_search_surfaces.py` — its hash must remain
`2ae096dde998ef5a365210bea067dc8e87cce4bb`. Do NOT edit any other test file.
Do NOT create stray files. Do NOT hard-code expected outputs. If you can't
make a test pass legitimately, leave it failing — do not weaken it.
