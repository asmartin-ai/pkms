import { describe, expect, test } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "../../src/pkms/db.ts";
import { connect } from "../../src/pkms/db.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

function noteRow(
  path = "a.md",
  content = "alpha original",
): [string, string, string, string, string, string, string] {
  return [path, "A", "", "", "[]", content, "2026-06-10T00:00:00+00:00"];
}

function insert(conn: DB, kw: Partial<{ path: string; content: string }> = {}) {
  const [path, title, created, modified, tags, content, indexedAt] = noteRow(kw.path, kw.content);
  conn
    .query(
      `INSERT INTO notes (path, title, created, modified, tags, content, indexed_at)
       VALUES (?,?,?,?,?,?,?)`,
    )
    .run(path, title, created, modified, tags, content, indexedAt);
}

function ftsPaths(conn: DB, query: string): string[] {
  return conn
    .query<{ path: string }, SQLQueryBindings[]>(
      "SELECT path FROM notes_fts WHERE notes_fts MATCH ?",
    )
    .all(query)
    .map((r) => r.path);
}

describe("test_db.py::test_schema_objects_created", () => {
  test("schema objects exist after connect", () => {
    const root = mkTmp();
    const dir = join(root, ".index");
    mkdirSync(dir, { recursive: true });
    const conn = connect(dir);

    const names = new Set(
      conn
        .query<{ name: string }, SQLQueryBindings[]>(
          "SELECT name FROM sqlite_master WHERE type IN ('table', 'trigger')",
        )
        .all()
        .map((r) => r.name),
    );

    expect(
      ["notes", "links", "tasks", "notes_ai", "notes_ad", "notes_au"].every((n) => names.has(n)),
    ).toBe(true);
    conn.close();
    rmTmp(root);
  });
});

describe("test_db.py::test_connect_is_idempotent", () => {
  test("re-running the CREATE IF NOT EXISTS script must not fail", () => {
    const root = mkTmp();
    const dir = join(root, ".index");
    connect(dir).close();
    const conn = connect(dir);
    insert(conn);
    conn.close();
    rmTmp(root);
  });
});

describe("test_db.py::test_pre_slice5_tasks_table_is_rebuilt_not_crashed", () => {
  test("a v1 index (no state column) upgrades transparently on connect", () => {
    const root = mkTmp();
    const dir = join(root, ".index");
    mkdirSync(dir, { recursive: true });
    const old = new Database(join(dir, "pkms.db"));
    old.exec(
      "CREATE TABLE tasks (id INTEGER PRIMARY KEY, note_path TEXT NOT NULL, " +
        "line INTEGER NOT NULL, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, " +
        "UNIQUE(note_path, line))",
    );
    old.query("INSERT INTO tasks (note_path, line, text) VALUES ('a.md', 1, 'old row')").run();
    old.close();

    const conn = connect(dir);

    const cols = new Set(
      conn
        .query<{ name: string }, SQLQueryBindings[]>("PRAGMA table_info(tasks)")
        .all()
        .map((r) => r.name),
    );

    expect(["state", "size", "first_action", "done_when", "hash"].every((c) => cols.has(c))).toBe(
      true,
    );
    expect(
      conn.query<{ c: number }, SQLQueryBindings[]>("SELECT count(*) c FROM tasks").get()!.c,
    ).toBe(0);
    expect(
      conn.query<{ c: number }, SQLQueryBindings[]>("SELECT count(*) c FROM task_seen").get()!.c,
    ).toBe(0);
    conn.close();
    rmTmp(root);
  });
});

describe("test_db.py::test_fts_tracks_insert_update_delete", () => {
  test("FTS follows notes insert/update/delete via triggers", () => {
    const root = mkTmp();
    const dir = join(root, ".index");
    mkdirSync(dir, { recursive: true });
    const conn = connect(dir);
    insert(conn);
    expect(ftsPaths(conn, "original")).toEqual(["a.md"]);

    conn.query("UPDATE notes SET content='alpha replaced' WHERE path='a.md'").run();
    expect(ftsPaths(conn, "original")).toEqual([]);
    expect(ftsPaths(conn, "replaced")).toEqual(["a.md"]);

    conn.query("DELETE FROM notes WHERE path='a.md'").run();
    expect(ftsPaths(conn, "alpha")).toEqual([]);
    conn.close();
    rmTmp(root);
  });
});

describe("test_db.py::test_fts_integrity_after_churn", () => {
  test("integrity-check passes after trigger-synced churn", () => {
    const root = mkTmp();
    const dir = join(root, ".index");
    mkdirSync(dir, { recursive: true });
    const conn = connect(dir);
    insert(conn, { path: "a.md" });
    insert(conn, { path: "b.md", content: "beta text" });

    for (let i = 0; i < 3; i++) {
      conn.query("UPDATE notes SET content = content || ' more' WHERE path='a.md'").run();
    }

    conn.query("DELETE FROM notes WHERE path='b.md'").run();
    conn.query("INSERT INTO notes_fts(notes_fts, rank) VALUES ('integrity-check', 1)").run();
    conn.close();
    rmTmp(root);
  });
});

describe("test_db.py::test_fts_integrity_check_detects_real_corruption", () => {
  test("bypassing the triggers must be reported corrupt", () => {
    const root = mkTmp();
    const dir = join(root, ".index");
    mkdirSync(dir, { recursive: true });
    const conn = connect(dir);
    insert(conn);
    conn.exec("DROP TRIGGER notes_au");
    conn.query("UPDATE notes SET content='silently changed' WHERE path='a.md'").run();
    expect(() =>
      conn.query("INSERT INTO notes_fts(notes_fts, rank) VALUES ('integrity-check', 1)").run(),
    ).toThrow();
    conn.close();
    rmTmp(root);
  });
});

describe("db connection concurrency (C1)", () => {
  test("connect arms the busy timeout and WAL so a waiting writer does not fail", () => {
    const root = mkTmp();
    const dir = join(root, ".index");
    mkdirSync(dir, { recursive: true });
    const conn = connect(dir);

    try {
      expect(
        conn.query<{ timeout: number }, SQLQueryBindings[]>("PRAGMA busy_timeout").get(),
      ).toEqual({ timeout: 5000 });
      expect(
        conn.query<{ journal_mode: string }, SQLQueryBindings[]>("PRAGMA journal_mode").get(),
      ).toEqual({ journal_mode: "wal" });
    } finally {
      conn.close();
    }

    const first = connect(dir);
    const second = connect(dir);

    try {
      insert(first, { path: "held.md" });
      insert(second, { path: "waited.md" });
    } finally {
      first.close();
      second.close();
    }

    const check = connect(dir);

    try {
      const paths = check
        .query<{ path: string }, SQLQueryBindings[]>("SELECT path FROM notes ORDER BY path")
        .all()
        .map((row) => row.path);

      expect(paths).toEqual(["held.md", "waited.md"]);
    } finally {
      check.close();
      rmTmp(root);
    }
  });
});
