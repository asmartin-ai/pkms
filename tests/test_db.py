"""Schema creation and FTS5 trigger-sync regression tests."""

import pytest

from pkms.db import connect


def _note_row(path="a.md", content="alpha original"):
    return (path, "A", "", "", "[]", content, "2026-06-10T00:00:00+00:00")


def _insert(conn, **kw):
    conn.execute(
        "INSERT INTO notes (path, title, created, modified, tags, content, indexed_at)"
        " VALUES (?,?,?,?,?,?,?)",
        _note_row(**kw),
    )


def _fts_paths(conn, query):
    return [r["path"] for r in conn.execute("SELECT path FROM notes_fts WHERE notes_fts MATCH ?", (query,))]


def test_schema_objects_created(index_dir):
    conn = connect(index_dir)
    names = {
        r["name"]
        for r in conn.execute("SELECT name FROM sqlite_master WHERE type IN ('table', 'trigger')")
    }
    assert {"notes", "links", "tasks", "notes_ai", "notes_ad", "notes_au"} <= names
    conn.close()


def test_connect_is_idempotent(index_dir):
    connect(index_dir).close()
    conn = connect(index_dir)  # re-running the CREATE IF NOT EXISTS script must not fail
    _insert(conn)
    conn.close()


def test_pre_slice5_tasks_table_is_rebuilt_not_crashed(index_dir):
    """A v1 index (no state column) must upgrade transparently on connect."""
    import sqlite3
    index_dir.mkdir(parents=True, exist_ok=True)
    old = sqlite3.connect(index_dir / "pkms.db")
    old.execute(
        "CREATE TABLE tasks (id INTEGER PRIMARY KEY, note_path TEXT NOT NULL, "
        "line INTEGER NOT NULL, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, "
        "UNIQUE(note_path, line))"
    )
    old.execute("INSERT INTO tasks (note_path, line, text) VALUES ('a.md', 1, 'old row')")
    old.commit()
    old.close()

    conn = connect(index_dir)
    cols = {r[1] for r in conn.execute("PRAGMA table_info(tasks)").fetchall()}
    assert {"state", "size", "first_action", "done_when", "hash"} <= cols
    # rebuilt empty: pkms index repopulates from the vault (index = derived view)
    assert conn.execute("SELECT count(*) c FROM tasks").fetchone()["c"] == 0
    assert conn.execute("SELECT count(*) c FROM task_seen").fetchone()["c"] == 0
    conn.close()


def test_fts_tracks_insert_update_delete(index_dir):
    conn = connect(index_dir)

    _insert(conn)
    assert _fts_paths(conn, "original") == ["a.md"]

    conn.execute("UPDATE notes SET content='alpha replaced' WHERE path='a.md'")
    assert _fts_paths(conn, "original") == []
    assert _fts_paths(conn, "replaced") == ["a.md"]

    conn.execute("DELETE FROM notes WHERE path='a.md'")
    assert _fts_paths(conn, "alpha") == []
    conn.close()


def test_fts_integrity_after_churn(index_dir):
    """Regression: external-content FTS5 corrupted when rows were rewritten without
    trigger sync. The 'integrity-check' command raises if index and table diverge."""
    conn = connect(index_dir)
    _insert(conn, path="a.md")
    _insert(conn, path="b.md", content="beta text")
    for _ in range(3):
        conn.execute("UPDATE notes SET content = content || ' more' WHERE path='a.md'")
    conn.execute("DELETE FROM notes WHERE path='b.md'")

    # rank=1 verifies the FTS index against the external content table itself
    conn.execute("INSERT INTO notes_fts(notes_fts, rank) VALUES ('integrity-check', 1)")
    conn.close()


def test_fts_integrity_check_detects_real_corruption(index_dir):
    """Sanity check that the integrity check used above can actually fail:
    bypass the triggers and the index must be reported corrupt."""
    import sqlite3

    conn = connect(index_dir)
    _insert(conn)
    conn.execute("DROP TRIGGER notes_au")
    conn.execute("UPDATE notes SET content='silently changed' WHERE path='a.md'")
    with pytest.raises(sqlite3.DatabaseError):
        conn.execute("INSERT INTO notes_fts(notes_fts, rank) VALUES ('integrity-check', 1)")
    conn.close()
