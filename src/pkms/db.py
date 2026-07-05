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
    id           INTEGER PRIMARY KEY,
    note_path    TEXT NOT NULL,
    line         INTEGER NOT NULL,
    text         TEXT NOT NULL,             -- cleaned: metadata tokens stripped
    done         INTEGER NOT NULL DEFAULT 0,
    state        TEXT NOT NULL DEFAULT 'open',
    size         TEXT,                      -- ⏱
    first_action TEXT,                      -- ▶
    done_when    TEXT,                      -- ✓
    hash         TEXT,                      -- line identity, joins task_seen
    UNIQUE(note_path, line)
);

-- Reshape clock (slice 5). Survives reindexes: INSERT OR IGNORE keeps the
-- original first_seen while a line is unchanged; an edited line gets a new
-- hash and a fresh clock (human touch strips machine marks, §4).
CREATE TABLE IF NOT EXISTS task_seen (
    note_path   TEXT NOT NULL,
    hash        TEXT NOT NULL,
    first_seen  TEXT NOT NULL,              -- ISO date this exact line appeared
    PRIMARY KEY (note_path, hash)
);

-- Durable, queryable record of keep IDs that have been fully captured
-- (slice 4 + G1 oracle). The flat ledger at .index/keep-ledger.txt is
-- append-only and cheap, but if a crash interrupts a batch the file alone
-- cannot answer "which notes *completed* before the failure?" — the SQLite
-- store can. The ingest code records here right after write_capture succeeds.
CREATE TABLE IF NOT EXISTS keep_completed (
    id          TEXT PRIMARY KEY,
    completed_at TEXT NOT NULL
);
"""

SCHEMA_VERSION = 3


def connect(index_dir: Path) -> sqlite3.Connection:
    index_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(index_dir / "pkms.db")
    conn.row_factory = sqlite3.Row
    # The index is a derived view: a pre-slice-5 tasks table is rebuilt, not
    # migrated in place — `pkms index` repopulates it from the vault.
    if conn.execute("PRAGMA user_version").fetchone()[0] < SCHEMA_VERSION:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(tasks)").fetchall()}
        if cols and "state" not in cols:
            conn.execute("DROP TABLE tasks")
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
    conn.executescript(SCHEMA)
    conn.executescript(SCHEMA)
    conn.commit()
    return conn
