"""SQLite schema and connection management."""

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY,
    path        TEXT    NOT NULL UNIQUE,   -- relative to vault root
    title       TEXT    NOT NULL,
    created     TEXT,
    modified    TEXT,
    tags        TEXT,                      -- JSON array
    content     TEXT    NOT NULL,
    indexed_at  TEXT    NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    path UNINDEXED,
    title,
    content,
    content='notes',
    content_rowid='id'
);

-- External-content FTS5 tables must be kept in sync via triggers;
-- direct DELETE/UPDATE on notes_fts corrupts the index.
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, path, title, content)
    VALUES (new.id, new.path, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, path, title, content)
    VALUES ('delete', old.id, old.path, old.title, old.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, path, title, content)
    VALUES ('delete', old.id, old.path, old.title, old.content);
    INSERT INTO notes_fts(rowid, path, title, content)
    VALUES (new.id, new.path, new.title, new.content);
END;

CREATE TABLE IF NOT EXISTS links (
    id          INTEGER PRIMARY KEY,
    source      TEXT NOT NULL,             -- relative path
    target      TEXT NOT NULL,             -- raw wikilink text
    UNIQUE(source, target)
);

CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY,
    note_path   TEXT NOT NULL,
    line        INTEGER NOT NULL,
    text        TEXT NOT NULL,
    done        INTEGER NOT NULL DEFAULT 0,
    UNIQUE(note_path, line)
);
"""


def connect(index_dir: Path) -> sqlite3.Connection:
    index_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(index_dir / "pkms.db")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn
