import { Database, type SQLQueryBindings } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { attachOperational } from "./operational.ts";

export const FTS_TRIGGERS = `
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
`;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY,
    path        TEXT    NOT NULL UNIQUE,   -- relative to vault root
    title       TEXT    NOT NULL,
    created     TEXT,
    modified    TEXT,
    tags        TEXT,                      -- JSON array
    content     TEXT    NOT NULL,
    indexed_at  TEXT    NOT NULL,
    source_hash TEXT    NOT NULL DEFAULT ''
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    path UNINDEXED,
    title,
    content,
    content='notes',
    content_rowid='id'
);

${FTS_TRIGGERS}

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

-- Derived source visibility; canonical routing decisions live in frontmatter.
CREATE TABLE IF NOT EXISTS source_routes (
    path        TEXT PRIMARY KEY,
    route       TEXT NOT NULL
);

-- Rebuildable semantic evidence; never contains operational state.
CREATE TABLE IF NOT EXISTS rag_sources (
    path TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    version TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rag_chunks (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    embedding BLOB NOT NULL,
    UNIQUE(path, ordinal)
);
CREATE INDEX IF NOT EXISTS rag_chunks_path ON rag_chunks(path);
CREATE TABLE IF NOT EXISTS rag_state (
    id INTEGER PRIMARY KEY CHECK(id=1),
    pid INTEGER,
    updated_at TEXT,
    error TEXT
);
`;

export const SCHEMA_VERSION = 7;

export type DB = Database;

export function connect(indexDir: string): Database {
  mkdirSync(indexDir, { recursive: true });
  const db = new Database(join(indexDir, "pkms.db"));

  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL");
    attachOperational(db, indexDir);

    const curVersion = db
      .query<{ user_version: number }, SQLQueryBindings[]>("PRAGMA user_version")
      .get()!.user_version;

    const current =
      curVersion === SCHEMA_VERSION &&
      db
        .query<{ n: number }, SQLQueryBindings[]>(
          "SELECT 1 AS n FROM sqlite_master WHERE type='table' AND name='source_routes'",
        )
        .get() !== null;

    if (!current && curVersion <= SCHEMA_VERSION) {
      const cols = new Set(
        db
          .query<{ name: string }, SQLQueryBindings[]>("PRAGMA table_info(tasks)")
          .all()
          .map((r) => r.name),
      );

      if (cols.size > 0 && !cols.has("state")) {
        db.exec("DROP TABLE tasks");
      }

      const noteCols = db.query<{ name: string }, []>("PRAGMA table_info(notes)").all();

      if (noteCols.length && !noteCols.some((column) => column.name === "source_hash")) {
        db.exec("ALTER TABLE notes ADD COLUMN source_hash TEXT NOT NULL DEFAULT ''");
      }

      db.exec(SCHEMA);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    }

    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
