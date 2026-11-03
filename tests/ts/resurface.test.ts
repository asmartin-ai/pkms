import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SQLQueryBindings } from "bun:sqlite";
import { connect } from "../../src/pkms/db.ts";
import { indexVault } from "../../src/pkms/indexer.ts";
import { candidates, dismiss, filterNever, letGo, markOffered } from "../../src/pkms/resurface.ts";
import { mkTmp, rmTmp, writeNote } from "./helpers.ts";

describe("resurface", () => {
  const TODAY = new Date(2026, 5, 12);

  function makeGarden() {
    const root = mkTmp();
    const vault = join(root, "vault");
    writeNote(
      join(vault, "projects", "active.md"),
      "Working here, references [[old-gold]] often.\n",
      {
        title: "Active Project",
        created: "2026-06-10",
      },
    );
    writeNote(
      join(vault, "resources", "old-gold.md"),
      "An old idea that the active project links to.\n",
      {
        title: "Old Gold",
        created: "2026-01-15",
      },
    );
    writeNote(
      join(vault, "resources", "old-orphan.md"),
      "Old, unlinked, still mildly interesting.\n",
      {
        title: "Old Orphan",
        created: "2026-02-01",
      },
    );
    writeNote(join(vault, "daily", "2026-03-01.md"), "a daily\n", {
      title: "2026-03-01",
      created: "2026-03-01",
    });
    const indexDir = join(root, ".index");
    indexVault(vault, indexDir);

    return { vault, indexDir };
  }

  let garden: { vault: string; indexDir: string };
  beforeEach(() => {
    garden = makeGarden();
  });
  afterEach(() => rmTmp(garden.vault, garden.indexDir));

  test("linked to active outranks orphan and why says so", () => {
    const db = connect(garden.indexDir);
    const cands = candidates(db, { today: TODAY });
    db.close();
    const titles = cands.map((c) => c.title);
    expect(titles[0]).toBe("Old Gold");
    expect(cands[0]!.why).toContain("Active Project");
    expect(titles).toContain("Old Orphan");
  });

  test("recent daily and reading notes never surface", () => {
    writeNote(join(garden.vault, "resources", "reading", "queued-thread.md"), "promoted thread\n", {
      title: "Queued Thread",
      created: "2026-01-01",
    });
    writeNote(join(garden.vault, "projects", "fresh.md"), "Too young to wonder about.\n", {
      title: "Fresh",
      created: "2026-06-01",
    });
    indexVault(garden.vault, garden.indexDir);
    const db = connect(garden.indexDir);
    const titles = new Set(candidates(db, { today: TODAY, k: 10 }).map((c) => c.title));
    db.close();
    expect(titles.has("Queued Thread")).toBe(false);
    expect(titles.has("Fresh")).toBe(false);
    expect(titles.has("2026-03-01")).toBe(false);
    expect(titles.has("Active Project")).toBe(false);
  });

  test("offered card rests then question varies", () => {
    const db = connect(garden.indexDir);
    const first = candidates(db, { today: TODAY })[0]!;
    markOffered(db, [first.path], { today: TODAY });
    const tomorrow = candidates(db, { today: new Date(2026, 5, 13) }).map((c) => c.path);
    expect(tomorrow).not.toContain(first.path);

    const later = candidates(db, { today: new Date(2026, 5, 16) }).find(
      (c) => c.path === first.path,
    );

    expect(later).toBeDefined();
    expect(later!.question).not.toBe(first.question);
    db.close();
  });

  test("dismiss is a thirty day silence", () => {
    const db = connect(garden.indexDir);
    const target = candidates(db, { today: TODAY })[0]!.path;
    dismiss(db, target, { today: TODAY });
    const jul11 = candidates(db, { today: new Date(2026, 6, 11) }).map((c) => c.path);
    const jul13 = candidates(db, { today: new Date(2026, 6, 13) }).map((c) => c.path);
    expect(jul11).not.toContain(target);
    expect(jul13).toContain(target);
    db.close();
  });

  test("let go is reversible and filters out", () => {
    const db = connect(garden.indexDir);
    const cands = candidates(db, { today: TODAY });
    const target = cands[0]!;
    letGo(garden.vault, target.path);
    const kept = filterNever(garden.vault, cands);
    expect(kept.map((c) => c.path)).not.toContain(target.path);
    const text = readFileSync(join(garden.vault, target.path), "utf8");
    expect(text).toContain("resurface: never");
    expect(text).toContain("An old idea");
    db.close();
  });

  test("let_go dumps sorted block YAML", () => {
    const vault = garden.vault;

    const note = (rel: string, fm: string) => {
      mkdirSync(join(vault, rel, ".."), { recursive: true });
      const p = join(vault, rel);
      writeFileSync(p, fm, "utf8");

      return p;
    };

    const p1 = note(
      "resources/dump-a.md",
      "---\ntitle: Old Gold\ncreated: 2026-01-15\ntags: [resource, old]\n---\n\nAn old idea that the active project links to.\n",
    );

    letGo(vault, "resources/dump-a.md");
    expect(readFileSync(p1, "utf8")).toBe(
      "---\ncreated: 2026-01-15\nresurface: never\ntags:\n- resource\n- old\ntitle: Old Gold\n---\n\nAn old idea that the active project links to.",
    );

    const p2 = note(
      "resources/dump-b.md",
      "---\ntitle: Alex's notes\ncreated: 2026-01-15\n---\n\nbody text\n",
    );

    letGo(vault, "resources/dump-b.md");
    expect(readFileSync(p2, "utf8")).toBe(
      "---\ncreated: 2026-01-15\nresurface: never\ntitle: Alex's notes\n---\n\nbody text",
    );

    const p3 = note(
      "resources/dump-c.md",
      '---\ntitle: "Note: important"\ncreated: 2026-01-15\n---\n\nbody text\n',
    );

    letGo(vault, "resources/dump-c.md");
    expect(readFileSync(p3, "utf8")).toBe(
      "---\ncreated: 2026-01-15\nresurface: never\ntitle: 'Note: important'\n---\n\nbody text",
    );

    const p4 = note(
      "resources/dump-d.md",
      '---\ntitle: "2026 plans"\ncreated: 2026-01-15\n---\n\nbody text\n',
    );

    letGo(vault, "resources/dump-d.md");
    expect(readFileSync(p4, "utf8")).toBe(
      "---\ncreated: 2026-01-15\nresurface: never\ntitle: 2026 plans\n---\n\nbody text",
    );

    const p5 = note(
      "resources/dump-e.md",
      '---\ntitle: "yes"\ncreated: 2026-01-15\n---\n\nbody text\n',
    );

    letGo(vault, "resources/dump-e.md");
    expect(readFileSync(p5, "utf8")).toBe(
      "---\ncreated: 2026-01-15\nresurface: never\ntitle: 'yes'\n---\n\nbody text",
    );

    const p6 = note("resources/dump-f.md", "No frontmatter here at all.\n");
    letGo(vault, "resources/dump-f.md");
    expect(readFileSync(p6, "utf8")).toBe(
      "---\nresurface: never\n---\n\nNo frontmatter here at all.",
    );

    const p7 = note("resources/dump-g.md", "---\ntitle: Null Created\ncreated:\n---\n\nbody\n");
    letGo(vault, "resources/dump-g.md");
    expect(readFileSync(p7, "utf8")).toBe(
      "---\ncreated: null\nresurface: never\ntitle: Null Created\n---\n\nbody",
    );
  });

  test("an interrupted letGo leaves the note intact", () => {
    const vault = garden.vault;
    const rel = `resources/${"l".repeat(238)}.md`;
    const original = "---\ntitle: Long Name\ncreated: 2026-01-01\n---\n\nbody text\n";
    const p = join(vault, ...rel.split("/"));

    writeFileSync(p, original, "utf8");
    expect(() => letGo(vault, rel)).toThrow();
    expect(readFileSync(p, "utf8")).toBe(original);
  });

  test("letGo on a BOM note produces one frontmatter block", () => {
    const vault = garden.vault;
    const p = join(vault, "resources", "bom.md");

    writeFileSync(p, "\ufeff---\ntitle: BOM\ncreated: 2026-01-01\n---\n\nbody\n", "utf8");
    letGo(vault, "resources/bom.md");

    const text = readFileSync(p, "utf8");

    expect(text).toBe("---\ncreated: 2026-01-01\nresurface: never\ntitle: BOM\n---\n\nbody");
  });
});

describe("resurface undated notes (C8)", () => {
  const TODAY = new Date(2026, 5, 12);

  test("a None or slash-formatted created date is treated as undated", () => {
    const root = mkTmp();
    const vault = join(root, "vault");

    mkdirSync(join(vault, "resources"), { recursive: true });
    writeFileSync(
      join(vault, "resources", "stub.md"),
      "---\ntitle: Empty Created\ncreated:\n---\n\nno date\n",
      "utf8",
    );
    writeFileSync(
      join(vault, "resources", "slash.md"),
      "---\ntitle: Slash Date\ncreated: 10/05/2026\n---\n\nno date\n",
      "utf8",
    );
    const indexDir = join(root, ".index");
    indexVault(vault, indexDir);

    try {
      const db = connect(indexDir);

      try {
        const rows = db
          .query<{ path: string; created: string }, SQLQueryBindings[]>(
            "SELECT path, created FROM notes ORDER BY path",
          )
          .all();

        expect(rows).toEqual([
          { path: "resources/slash.md", created: "10/05/2026" },
          { path: "resources/stub.md", created: "None" },
        ]);

        const cands = candidates(db, { today: TODAY, k: 10 });

        for (const candidate of cands) expect(Number.isFinite(candidate.score)).toBe(true);
        const titles = cands.map((candidate) => candidate.title);

        expect(titles).not.toContain("Slash Date");
        expect(titles).not.toContain("Empty Created");
      } finally {
        db.close();
      }
    } finally {
      rmTmp(root);
    }
  });
});
