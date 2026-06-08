"""Full-text search over the notes index."""

from pathlib import Path

from .db import connect


def search(query: str, index_dir: Path, limit: int = 20) -> list[dict]:
    conn = connect(index_dir)
    rows = conn.execute(
        """SELECT n.path, n.title, snippet(notes_fts, 2, '[', ']', '…', 20) AS excerpt
           FROM notes_fts f
           JOIN notes n ON n.id = f.rowid
           WHERE notes_fts MATCH ?
           ORDER BY rank
           LIMIT ?""",
        (query, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def backlinks(note_path: str, index_dir: Path) -> list[str]:
    stem = Path(note_path).stem
    conn = connect(index_dir)
    rows = conn.execute(
        "SELECT DISTINCT source FROM links WHERE target=? OR target=?",
        (note_path, stem),
    ).fetchall()
    conn.close()
    return [r["source"] for r in rows]
