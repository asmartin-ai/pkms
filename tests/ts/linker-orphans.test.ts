import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { indexVault } from "../../src/pkms/indexer.ts";
import { findOrphans } from "../../src/pkms/linker.ts";
import { makeVault, rmTmp } from "./helpers.ts";

const cleaned: string[] = [];

afterEach(() => {
  while (cleaned.length) rmTmp(cleaned.pop()!);
});

describe("test_linker_orphans.py::test_orphan_wikilinks_are_reported_with_sources", () => {
  test("gamma is orphaned with alpha as source; beta resolves", () => {
    const { vault, indexDir } = makeVault();
    cleaned.push(join(vault, ".."));
    indexVault(vault, indexDir);

    const orphans = findOrphans(indexDir);
    expect(orphans.length).toBeGreaterThan(0);

    const targets = new Set(orphans.map((o) => o.target));
    expect(targets.has("gamma")).toBe(true);

    const gamma = orphans.find((o) => o.target === "gamma")!;
    expect(gamma.sources).toContain("projects/alpha.md");

    expect(targets.has("beta")).toBe(false);
  });
});
