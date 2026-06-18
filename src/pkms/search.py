"""Full-text search over the notes index."""

import sqlite3
from pathlib import Path

from .db import connect

_SQL = """SELECT n.path, n.title, snippet(notes_fts, 2, '[', ']', '…', 20) AS excerpt
          FROM notes_fts f
          JOIN notes n ON n.id = f.rowid
          WHERE notes_fts MATCH ?
          ORDER BY rank
          LIMIT ?"""


def _sanitize(query: str) -> str:
    """Quote each token so FTS5 operators (-, :, *, NEAR…) in plain text can't break the query."""
    tokens = [t.replace('"', '""') for t in query.split()]
    return " ".join(f'"{t}"' for t in tokens)


def search(query: str, index_dir: Path, limit: int = 20, raw: bool = False) -> list[dict]:
    conn = connect(index_dir)
    if raw:
        try:
            rows = conn.execute(_SQL, (query, limit)).fetchall()
        except sqlite3.OperationalError:
            # Raw query used FTS5 syntax unintentionally (e.g. a hyphenated word) — retry quoted.
            rows = conn.execute(_SQL, (_sanitize(query), limit)).fetchall()
    else:
        rows = conn.execute(_SQL, (_sanitize(query), limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def resolve_note(ref: str, index_dir: Path) -> str | None:
    """Resolve a stem or path fragment to one indexed note path (shortest wins)."""
    stem = Path(ref.strip().replace("\\", "/")).stem
    conn = connect(index_dir)
    row = conn.execute(
        "SELECT path FROM notes WHERE path = ? OR path LIKE ? "
        "ORDER BY LENGTH(path) LIMIT 1",
        (ref, f"%{stem}.md"),
    ).fetchone()
    conn.close()
    return row["path"] if row else None


def backlinks(note_path: str, index_dir: Path) -> list[str]:
    stem = Path(note_path).stem
    conn = connect(index_dir)
    rows = conn.execute(
        "SELECT DISTINCT source FROM links WHERE target=? OR target=?",
        (note_path, stem),
    ).fetchall()
    conn.close()
    return [r["source"] for r in rows]
