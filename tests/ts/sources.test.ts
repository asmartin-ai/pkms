import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { connect } from "../../src/pkms/db.ts";
import { indexVault } from "../../src/pkms/indexer.ts";
import { candidates } from "../../src/pkms/resurface.ts";
import { listSources, readSource, setRoute, writeSource } from "../../src/pkms/sources.ts";
import { nextActionPerNote } from "../../src/pkms/tasks.ts";
import { recentNotes, todayView } from "../../src/pkms/today.ts";

const roots: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pkms-sources-"));
  roots.push(root);
  const vault = join(root, "vault");
  mkdirSync(vault);

  return { root, vault, indexDir: join(root, ".index") };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("canonical source archive", () => {
  test("duplicate source identity preserves body and human routing state across delivery dates", () => {
    const { vault } = fixture();

    const path = writeSource(vault, "original body", {
      source: "email",
      source_id: "message-1",
      received_at: "2026-01-01T00:00:00Z",
      route: "pending",
      subject: "Original",
    });

    setRoute(vault, path, { route: "noise", route_reason: "Already handled" });

    const deliveredAgain = writeSource(vault, "different body", {
      source: "email",
      source_id: "message-1",
      received_at: "2026-02-01T00:00:00Z",
      route: "pending",
    });

    expect(deliveredAgain).toBe(path);
    expect(readSource(vault, path).body).toBe("original body");
    expect(readSource(vault, path).data.route).toBe("noise");
    expect(listSources(vault, { route: "pending" })).toEqual([]);
    expect(listSources(vault, { route: "noise" }).map((item) => item.data.source_id)).toEqual([
      "message-1",
    ]);
  });

  test("source identity is namespaced and untrusted IDs never become path segments", () => {
    const { root, vault } = fixture();

    const keep = writeSource(vault, "keep text", {
      source: "keep",
      source_id: "../../escape",
      received_at: "2026-01-01T00:00:00Z",
      route: "pending",
    });

    const email = writeSource(vault, "email text", {
      source: "email",
      source_id: "../../escape",
      received_at: "2026-01-01T00:00:00Z",
      route: "pending",
    });

    expect(keep).not.toBe(email);
    expect(relative(root, keep)).toMatch(/^vault\/sources\/keep\/[a-f0-9]{64}\.md$/);
    expect(relative(root, email)).toMatch(/^vault\/sources\/email\/2026-01\/[a-f0-9]{64}\.md$/);
    expect(listSources(vault, { source: "email" }).map((item) => item.body)).toEqual([
      "email text",
    ]);
  });

  test("one hand-edited note neither blocks archiving nor forces a re-parse", () => {
    const { vault, indexDir } = fixture();
    const log = spyOn(console, "error").mockImplementation(() => {});

    try {
      const first = writeSource(vault, "first note", {
        source: "keep",
        source_id: "note-1",
        received_at: "2026-01-01T00:00:00Z",
        route: "pending",
        title: "First",
      });

      writeFileSync(first, "---\ntitle: 2024\n---\nFirst note\n", "utf8");

      const second = writeSource(vault, "second note", {
        source: "keep",
        source_id: "note-2",
        received_at: "2026-01-02T00:00:00Z",
        route: "pending",
        title: "Second",
      });

      expect(
        writeSource(vault, "second again", {
          source: "keep",
          source_id: "note-2",
          received_at: "2026-01-03T00:00:00Z",
          route: "pending",
        }),
      ).toBe(second);

      expect(() => listSources(vault, { source: "keep" })).not.toThrow();
      expect(listSources(vault, { source: "keep" }).map((item) => item.data.source_id)).toEqual([
        "note-2",
      ]);
      expect(readSource(vault, second).body).toBe("second note");
      expect(() => indexVault(vault, indexDir)).not.toThrow();

      const db = connect(indexDir);

      try {
        const paths = db
          .query<{ path: string }, []>("SELECT path FROM notes")
          .all()
          .map((row) => row.path)
          .sort();

        expect(paths).toEqual([relative(vault, first), relative(vault, second)].sort());
      } finally {
        db.close();
      }
    } finally {
      log.mockRestore();
    }
  });

  test("routing preserves the exact body suffix including whitespace, CRLF, and Unicode", () => {
    const { vault } = fixture();
    const body = "\r\n  original \r\n---\r\n日本語\r\n\r\n";

    const path = writeSource(vault, body, {
      source: "keep",
      source_id: "note-1",
      received_at: "2026-01-01T00:00:00Z",
      route: "pending",
      title: "Title: with punctuation",
    });

    setRoute(vault, path, {
      route: "routed",
      inbox_note: "inbox/capture.md",
      routed_at: "2026-01-02T00:00:00Z",
    });
    expect(readSource(vault, path).body).toBe(body);
    expect(readSource(vault, path).data.title).toBe("Title: with punctuation");
    expect(readFileSync(path, "utf8").endsWith(body)).toBe(true);
    expect(() => setRoute(vault, path, { route: "hold", route_reason: "bad\nreason" })).toThrow();
    expect(readSource(vault, path).data.route).toBe("routed");
  });

  test("source directory and route paths cannot escape through traversal or symlinks", () => {
    const { root, vault } = fixture();
    const outside = join(root, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(vault, "sources"), "dir");
    expect(() =>
      writeSource(vault, "private", {
        source: "keep",
        source_id: "id",
        received_at: "2026-01-01T00:00:00Z",
        route: "pending",
      }),
    ).toThrow("escapes vault");
    rmSync(join(vault, "sources"));
    writeFileSync(join(root, "other.md"), "untouched");
    expect(() => setRoute(vault, "../other.md", { route: "noise" })).toThrow(
      "invalid source note path",
    );
    expect(readFileSync(join(root, "other.md"), "utf8")).toBe("untouched");
  });

  test("pending/noise/hold stay searchable but only routed archives enter active surfaces", () => {
    const { vault, indexDir } = fixture();

    const path = writeSource(vault, "archiveneedle\n\n- [ ] Investigate archive", {
      source: "keep",
      source_id: "note-visibility",
      received_at: "2025-01-01T00:00:00Z",
      route: "pending",
      title: "Archived idea",
      created: "2025-01-01",
    });

    const rel = relative(vault, path);

    for (const route of ["pending", "noise", "hold", "routed", "pending"] as const) {
      setRoute(vault, path, { route });
      indexVault(vault, indexDir);
      const db = connect(indexDir);

      try {
        expect(
          db
            .query<{ path: string }, []>(
              "SELECT path FROM notes_fts WHERE notes_fts MATCH 'archiveneedle'",
            )
            .all(),
        ).toEqual([{ path: rel }]);
        expect(nextActionPerNote(db).map((item) => item.note_path)).toEqual(
          route === "routed" ? [rel] : [],
        );
        expect(candidates(db).map((item) => item.path)).toEqual(route === "routed" ? [rel] : []);
      } finally {
        db.close();
      }

      expect(recentNotes(vault, indexDir).map((item) => item.path)).toEqual(
        route === "routed" ? [rel] : [],
      );
      expect(todayView(vault, indexDir).next_actions.map((item) => item.note)).toEqual(
        route === "routed" ? [rel] : [],
      );
    }
  });
});
