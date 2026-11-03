import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { indexVault } from "../../src/pkms/indexer.ts";
import { backlinks, resolveNote, sanitize, search } from "../../src/pkms/search.ts";
import { makeVault, mkTmp, rmTmp, writeNote } from "./helpers.ts";

describe("search (ports src/pkms/search.py)", () => {
  const fixture = makeVault();
  indexVault(fixture.vault, fixture.indexDir);
  const indexed = fixture.indexDir;
  afterAll(() => rmTmp(fixture.vault, fixture.indexDir));

  test("search finds note", () => {
    const results = search("gamma", indexed);
    expect(results.map((r) => r.path)).toEqual(["projects/alpha.md"]);
    expect(results[0]!.title).toBe("Alpha Project");
    expect(results[0]!.excerpt).toContain("gamma");
  });

  test("search no results", () => {
    expect(search("zzzznothing", indexed)).toEqual([]);
  });

  test("search respects limit", () => {
    expect(search("note", indexed, { limit: 1 }).length).toBe(1);
  });

  test("hyphenated query does not crash", () => {
    const results = search("external-content", indexed);
    expect(results.map((r) => r.path)).toEqual(["resources/beta.md"]);
  });

  for (const query of ["NEAR(", 'unbalanced "quote', "trailing-", "wild*card ("]) {
    test(`operator-laden query does not crash: ${query}`, () => {
      search(query, indexed);
    });
  }

  test("sanitize quotes every token", () => {
    expect(sanitize("external-content fts5")).toBe('"external-content" "fts5"');
    expect(sanitize('say "hi"')).toBe('"say" """hi"""');
  });

  test("backlinks by stem and path", () => {
    expect(backlinks("beta", indexed)).toEqual(["projects/alpha.md"]);
    expect(backlinks("resources/beta.md", indexed)).toEqual(["projects/alpha.md"]);
    expect(backlinks("no-such-note", indexed)).toEqual([]);
  });

  test("resolve note by stem, full path, and fragment", () => {
    expect(resolveNote("beta", indexed)).toBe("resources/beta.md");
    expect(resolveNote("resources/beta.md", indexed)).toBe("resources/beta.md");
    expect(resolveNote("alpha", indexed)).toBe("projects/alpha.md");
    expect(resolveNote("no-such-note", indexed)).toBeNull();
  });

  const f3 = makeVault();
  indexVault(f3.vault, f3.indexDir);
  afterAll(() => rmTmp(f3.vault, f3.indexDir));

  for (const empty of ["", "   ", "\t", "\n  \n"]) {
    test(`empty or whitespace query returns empty list: ${JSON.stringify(empty)}`, () => {
      expect(search(empty, f3.indexDir)).toEqual([]);
    });
  }

  test("nonempty query still matches", () => {
    const result = search("alpha", f3.indexDir);
    expect(result.length).toBe(1);
    expect(result[0]!.path).toBe("projects/alpha.md");
  });
});

interface SeedVault {
  vault: string;
  indexDir: string;
}

describe("resolve_note disambiguation (C3)", () => {
  function seeded(): SeedVault {
    const root = mkTmp();
    const vault = join(root, "vault");

    writeNote(join(vault, "projects", "plan.md"), "The real plan", { title: "Plan" });
    writeNote(join(vault, "a", "myplan.md"), "Only ends in plan", { title: "My Plan" });
    const indexDir = join(root, ".index");
    indexVault(vault, indexDir);

    return { vault, indexDir };
  }

  test("a stem resolves to the exact basename, not a shorter suffix match", () => {
    const { vault, indexDir } = seeded();

    try {
      expect(resolveNote("plan", indexDir)).toBe("projects/plan.md");
      expect(resolveNote("projects/plan", indexDir)).toBe("projects/plan.md");
      expect(resolveNote("projects/plan.md", indexDir)).toBe("projects/plan.md");
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("_ and % in the stem are escaped, not treated as wildcards", () => {
    const root = mkTmp();
    const vault = join(root, "vault");

    writeNote(join(vault, "b", "plan-x.md"), "Decoy: the underscore matched it", {
      title: "Decoy",
    });
    writeNote(join(vault, "zzz", "plan_x.md"), "The real note", { title: "Real" });
    writeNote(join(vault, "b", "50-x.md"), "Decoy: the percent matched it", { title: "Decoy 2" });
    writeNote(join(vault, "zzz", "50%.md"), "The real percent note", { title: "Real 2" });
    const indexDir = join(root, ".index");
    indexVault(vault, indexDir);

    try {
      expect(resolveNote("plan_x", indexDir)).toBe("zzz/plan_x.md");
      expect(resolveNote("50%", indexDir)).toBe("zzz/50%.md");
    } finally {
      rmTmp(vault, indexDir);
    }
  });
});
