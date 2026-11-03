import { Database, type SQLQueryBindings } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

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
    indexed_at  TEXT    NOT NULL
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
--
-- v4: source ('takeout' or 'live') + keep_created_at + pinned snapshot.
-- The sweep needs the original Keep creation time to compute age; older
-- rows pre-dating v4 will have NULL keep_created_at and are skipped by the
-- sweep (they're grandfathered, which is the safe default for a destructive
-- operation on the user's own data).
CREATE TABLE IF NOT EXISTS keep_completed (
    id              TEXT PRIMARY KEY,
    completed_at    TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT 'live',
    keep_created_at TEXT,
    pinned          INTEGER NOT NULL DEFAULT 0
);

-- Derived source visibility; canonical routing decisions live in frontmatter.
CREATE TABLE IF NOT EXISTS source_routes (
    path        TEXT PRIMARY KEY,
    route       TEXT NOT NULL
);
`;

export const SCHEMA_VERSION = 4;

export type DB = Database;

export function connect(indexDir: string): Database {
  mkdirSync(indexDir, { recursive: true });
  const db = new Database(join(indexDir, "pkms.db"));

  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL");

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

    const kcCols = new Set(
      db
        .query<{ name: string }, SQLQueryBindings[]>("PRAGMA table_info(keep_completed)")
        .all()
        .map((r) => r.name),
    );

    if (kcCols.size > 0 && !kcCols.has("source")) {
      db.exec("ALTER TABLE keep_completed ADD COLUMN source TEXT NOT NULL DEFAULT 'live'");
      db.exec("ALTER TABLE keep_completed ADD COLUMN keep_created_at TEXT");
      db.exec("ALTER TABLE keep_completed ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
    }

    db.exec(SCHEMA);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }

  return db;
}
