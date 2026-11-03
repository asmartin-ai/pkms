import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { SQLQueryBindings } from "bun:sqlite";
import { chmodSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { connect } from "../../src/pkms/db.ts";
import { indexVault, loadPost } from "../../src/pkms/indexer.ts";
import { makeVault, rmTmp, writeNote } from "./helpers.ts";

const cleaned: string[] = [];

afterEach(() => {
  while (cleaned.length) rmTmp(cleaned.pop()!);
});

describe("test_indexer.py::test_counts_match_fixture", () => {
  test("stats match the fixture", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    expect(indexVault(vault, indexDir)).toEqual({ notes: 3, links: 2, tasks: 3 });
  });
});

describe("test_indexer.py::test_frontmatter_metadata_stored", () => {
  test("frontmatter lands in the notes row, stripped from content", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    indexVault(vault, indexDir);
    const conn = connect(indexDir);

    const row = conn
      .query<{ title: string; tags: string; created: string; content: string }, SQLQueryBindings[]>(
        "SELECT * FROM notes WHERE path LIKE '%alpha.md'",
      )
      .get()!;

    expect(row.title).toBe("Alpha Project");
    expect(JSON.parse(row.tags)).toEqual(["project", "active"]);
    expect(row.created).toBe("2026-06-01");
    expect(row.content).toContain("[[beta]]");
    expect(row.content).not.toContain("title:");
    conn.close();
  });
});

describe("test_indexer.py::test_title_falls_back_to_stem", () => {
  test("no frontmatter title → file stem", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    indexVault(vault, indexDir);
    const conn = connect(indexDir);

    const row = conn
      .query<{ title: string }, SQLQueryBindings[]>(
        "SELECT title FROM notes WHERE path LIKE '%2026-06-01.md'",
      )
      .get()!;

    expect(row.title).toBe("2026-06-01");
    conn.close();
  });
});

describe("test_indexer.py::test_reindex_is_idempotent", () => {
  test("double index keeps counts and FTS rows stable", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    indexVault(vault, indexDir);
    expect(indexVault(vault, indexDir)).toEqual({ notes: 3, links: 2, tasks: 3 });

    const conn = connect(indexDir);
    expect(
      conn.query<{ c: number }, SQLQueryBindings[]>("SELECT count(*) c FROM notes").get()!.c,
    ).toBe(3);
    expect(
      conn.query<{ c: number }, SQLQueryBindings[]>("SELECT count(*) c FROM links").get()!.c,
    ).toBe(2);
    expect(
      conn.query<{ c: number }, SQLQueryBindings[]>("SELECT count(*) c FROM tasks").get()!.c,
    ).toBe(3);
    expect(
      conn
        .query<{ c: number }, SQLQueryBindings[]>(
          "SELECT count(*) c FROM notes_fts WHERE notes_fts MATCH 'alpha'",
        )
        .get()!.c,
    ).toBe(1);
    conn.close();
  });
});

describe("test_indexer.py::test_reindex_removes_deleted_notes", () => {
  test("deleted note disappears from notes, links, tasks, and FTS", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    indexVault(vault, indexDir);
    rmSync(join(vault, "projects", "alpha.md"));
    const stats = indexVault(vault, indexDir);
    expect(stats.notes).toBe(2);

    const conn = connect(indexDir);
    expect(
      conn.query<{ c: number }, SQLQueryBindings[]>("SELECT count(*) c FROM notes").get()!.c,
    ).toBe(2);
    expect(
      conn.query<{ c: number }, SQLQueryBindings[]>("SELECT count(*) c FROM links").get()!.c,
    ).toBe(0);
    expect(
      conn
        .query<{ c: number }, SQLQueryBindings[]>(
          "SELECT count(*) c FROM tasks WHERE note_path LIKE '%alpha.md'",
        )
        .get()!.c,
    ).toBe(0);
    expect(
      conn
        .query<{ c: number }, SQLQueryBindings[]>(
          "SELECT count(*) c FROM notes_fts WHERE notes_fts MATCH 'alpha'",
        )
        .get()!.c,
    ).toBe(0);
    conn.close();
  });
});

describe("test_indexer.py::test_reshape_clock_survives_reindex_and_resets_on_edit", () => {
  test("unchanged line keeps its clock; edited line prunes it and starts fresh", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    indexVault(vault, indexDir);
    const conn = connect(indexDir);

    const row = conn
      .query<{ h: string; first_seen: string }, SQLQueryBindings[]>(
        "SELECT ts.hash h, ts.first_seen FROM task_seen ts JOIN tasks t " +
          "ON t.note_path=ts.note_path AND t.hash=ts.hash WHERE t.text='open task one'",
      )
      .get()!;

    conn.query("UPDATE task_seen SET first_seen='2026-05-01' WHERE hash=?").run(row.h);
    conn.close();
    indexVault(vault, indexDir);
    const conn2 = connect(indexDir);
    expect(
      conn2
        .query<{ first_seen: string }, SQLQueryBindings[]>(
          "SELECT first_seen FROM task_seen WHERE hash=?",
        )
        .get(row.h)!.first_seen,
    ).toBe("2026-05-01");
    conn2.close();

    const alpha = join(vault, "projects", "alpha.md");
    writeFileSync(
      alpha,
      readFileSync(alpha, "utf8").replace("open task one", "open task one, reshaped"),
      "utf8",
    );
    indexVault(vault, indexDir);
    const conn3 = connect(indexDir);
    expect(
      conn3
        .query<{ c: number }, SQLQueryBindings[]>("SELECT count(*) c FROM task_seen WHERE hash=?")
        .get(row.h)!.c,
    ).toBe(0);

    const fresh = conn3
      .query<{ first_seen: string }, SQLQueryBindings[]>(
        "SELECT ts.first_seen FROM task_seen ts JOIN tasks t " +
          "ON t.note_path=ts.note_path AND t.hash=ts.hash " +
          "WHERE t.text='open task one, reshaped'",
      )
      .get()!;

    expect(fresh.first_seen).not.toBe("2026-05-01");
    conn3.close();
  });
});

describe("test_indexer.py::test_task_metadata_lands_in_index", () => {
  test("⏱▶✓ metadata + icebox state stored", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    writeNote(
      join(vault, "projects", "meta.md"),
      "- [ ] shaped task ⏱25m ▶ open the file ✓ tests green\n- [i] iced task\n",
      { title: "Meta" },
    );
    indexVault(vault, indexDir);
    const conn = connect(indexDir);

    const task = conn
      .query<
        { size: string; first_action: string; done_when: string; state: string },
        SQLQueryBindings[]
      >("SELECT * FROM tasks WHERE text='shaped task'")
      .get()!;

    expect([task.size, task.first_action, task.done_when]).toEqual([
      "25m",
      "open the file",
      "tests green",
    ]);
    expect(task.state).toBe("open");

    const iced = conn
      .query<{ state: string }, SQLQueryBindings[]>(
        "SELECT state FROM tasks WHERE text='iced task'",
      )
      .get()!;

    expect(iced.state).toBe("iceboxed");
    conn.close();
  });
});

describe("test_indexer.py::test_reindex_picks_up_edits", () => {
  test("edited note reindexes content, tasks, and links", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    indexVault(vault, indexDir);
    const beta = join(vault, "resources", "beta.md");
    writeFileSync(
      beta,
      "---\ntitle: Beta Note\n---\n\nRewritten body, task removed, now links [[alpha]].",
      "utf8",
    );
    const stats = indexVault(vault, indexDir);
    expect(stats.tasks).toBe(2);

    const conn = connect(indexDir);

    const row = conn
      .query<{ content: string }, SQLQueryBindings[]>(
        "SELECT content FROM notes WHERE path LIKE '%beta.md'",
      )
      .get()!;

    expect(row.content).toContain("Rewritten");

    const targets = conn
      .query<{ target: string }, SQLQueryBindings[]>(
        "SELECT target FROM links WHERE source LIKE '%beta.md'",
      )
      .all()
      .map((r) => r.target);

    expect(targets).toEqual(["alpha"]);
    conn.close();
  });
});

describe("test_indexer.py::test_unreadable_note_is_skipped_not_fatal", () => {
  test("broken YAML + non-UTF8 file skips and keeps the last-good copy (C6)", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    const bad = join(vault, "resources", "corrupt.md");
    writeFileSync(bad, "---\ntitle: Was Fine\n---\n\nReadable at first.", "utf8");
    expect(indexVault(vault, indexDir).notes).toBe(4);

    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    try {
      writeFileSync(bad, "---\ntitle: [unclosed\n---\n\xff\xfe garbage", "latin1");
      const stats = indexVault(vault, indexDir);
      expect(stats.notes).toBe(3);
      expect(logSpy.mock.calls.some((a) => String(a[0]).includes("skipped (unreadable)"))).toBe(
        true,
      );
    } finally {
      logSpy.mockRestore();
    }

    const conn = connect(indexDir);

    const rows = conn
      .query<{ path: string }, SQLQueryBindings[]>(
        "SELECT path FROM notes WHERE path LIKE '%corrupt.md'",
      )
      .all();

    expect(rows).toEqual([{ path: "resources/corrupt.md" }]);
    conn.close();
  });
});

describe("indexer transaction (C1)", () => {
  test("an interrupted run leaves source_routes intact", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    const source = join(vault, "sources", "email", "2026-06", "archived.md");

    writeNote(source, "An archived email body", { title: "Archived Mail" });
    expect(indexVault(vault, indexDir).notes).toBe(4);

    const blocked = join(vault, "blocked");

    mkdirSync(blocked, { mode: 0o000 });

    try {
      expect(() => indexVault(vault, indexDir)).toThrow(/EACCES/);

      const conn = connect(indexDir);

      try {
        const routes = conn
          .query<{ path: string; route: string }, SQLQueryBindings[]>(
            "SELECT path, route FROM source_routes",
          )
          .all();

        expect(routes).toEqual([{ path: "sources/email/2026-06/archived.md", route: "pending" }]);
      } finally {
        conn.close();
      }
    } finally {
      chmodSync(blocked, 0o700);
    }
  });
});

describe("indexer duplicate keys (C6)", () => {
  test("a tags-twice note indexes with the last duplicate winning", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    writeFileSync(
      join(vault, "resources", "dupe.md"),
      "---\ntitle: Duplicate Keys\ntags: [a, b]\ntags: [c]\n---\n\nbody\n",
      "utf8",
    );

    expect(indexVault(vault, indexDir).notes).toBe(4);

    const conn = connect(indexDir);

    try {
      const row = conn
        .query<{ title: string; tags: string }, SQLQueryBindings[]>(
          "SELECT title, tags FROM notes WHERE path = ?",
        )
        .get("resources/dupe.md");

      expect(row).toEqual({ title: "Duplicate Keys", tags: '["c"]' });
    } finally {
      conn.close();
    }
  });
});

describe("loadPost BOM (C7)", () => {
  test("frontmatter behind a BOM is still parsed", () => {
    const post = loadPost("\ufeff---\ntitle: BOM Note\n---\n\nbody\n");

    expect(post.data).toEqual({ title: "BOM Note" });
    expect(post.content).toBe("body");
  });

  test("a BOM note without frontmatter keeps its whole text", () => {
    const post = loadPost("\ufeffjust a body\n");

    expect(post.data).toEqual({});
    expect(post.content).toBe("\ufeffjust a body");
  });
});
