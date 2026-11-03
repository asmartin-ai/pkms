import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { indexVault } from "../../src/pkms/indexer.ts";
import { areaTiles } from "../../src/pkms/today.ts";
import { makeVault, rmTmp, writeNote } from "./helpers.ts";

describe("area_tiles (ports src/pkms/today.py)", () => {
  function makeAreas(vault: string): void {
    writeNote(
      join(vault, "areas", "career.md"),
      "Career area note.\n\n- [ ] update the resume header\n- [ ] second task that must not surface\n",
      { title: "Career" },
    );
    writeNote(
      join(vault, "areas", "health.md"),
      "Health area note.\n\n- [x] booked the checkup\n",
      {
        title: "Health",
      },
    );
  }

  test("missing areas dir returns empty", () => {
    const { vault, indexDir } = makeVault();

    try {
      indexVault(vault, indexDir);
      expect(areaTiles(vault, indexDir)).toEqual([]);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("empty areas dir returns empty", () => {
    const { vault, indexDir } = makeVault();

    try {
      mkdirSync(join(vault, "areas"), { recursive: true });
      indexVault(vault, indexDir);
      expect(areaTiles(vault, indexDir)).toEqual([]);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("tile shape is exact, no counts", () => {
    const { vault, indexDir } = makeVault();

    try {
      makeAreas(vault);
      indexVault(vault, indexDir);
      const tiles = areaTiles(vault, indexDir);
      expect(tiles.length).toBe(2);

      for (const tile of tiles) {
        expect(new Set(Object.keys(tile))).toEqual(
          new Set(["title", "path", "next_action", "last_touched"]),
        );
      }
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("tiles sorted by path with posix paths", () => {
    const { vault, indexDir } = makeVault();

    try {
      makeAreas(vault);
      indexVault(vault, indexDir);
      expect(areaTiles(vault, indexDir).map((t) => t.path)).toEqual([
        "areas/career.md",
        "areas/health.md",
      ]);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("next action is single open task", () => {
    const { vault, indexDir } = makeVault();

    try {
      makeAreas(vault);
      indexVault(vault, indexDir);
      const tiles = new Map(areaTiles(vault, indexDir).map((t) => [t.path, t]));
      const career = tiles.get("areas/career.md")!;
      expect(career.title).toBe("Career");
      expect(career.next_action!).toContain("update the resume header");
      expect(career.next_action!).not.toContain("second task");
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("area without open task has null next action", () => {
    const { vault, indexDir } = makeVault();

    try {
      makeAreas(vault);
      indexVault(vault, indexDir);
      const tiles = new Map(areaTiles(vault, indexDir).map((t) => [t.path, t]));
      expect(tiles.get("areas/health.md")!.next_action).toBeNull();
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("missing db yields tiles with null actions", () => {
    const { vault, indexDir } = makeVault();

    try {
      makeAreas(vault);
      const tiles = areaTiles(vault, indexDir);
      expect(tiles.map((t) => t.path)).toEqual(["areas/career.md", "areas/health.md"]);

      for (const t of tiles) expect(t.next_action).toBeNull();
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("last touched is ISO UTC", () => {
    const { vault, indexDir } = makeVault();

    try {
      makeAreas(vault);
      indexVault(vault, indexDir);

      for (const tile of areaTiles(vault, indexDir)) {
        expect(tile.last_touched).toContain("T");
        expect(tile.last_touched.endsWith("+00:00")).toBe(true);
      }
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("malformed area note is skipped", () => {
    const { vault, indexDir } = makeVault();

    try {
      makeAreas(vault);
      indexVault(vault, indexDir);
      writeFileSync(
        join(vault, "areas", "broken.md"),
        Buffer.from([
          0x2d,
          0x2d,
          0x2d,
          0x0a,
          ...Buffer.from("title: [unclosed\n---\n"),
          0xff,
          0xfe,
          ...Buffer.from(" garbage"),
        ]),
      );
      expect(areaTiles(vault, indexDir).map((t) => t.path)).toEqual([
        "areas/career.md",
        "areas/health.md",
      ]);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("capped at eight", () => {
    const { vault, indexDir } = makeVault();

    try {
      for (let i = 0; i < 10; i++) {
        writeNote(join(vault, "areas", `a${String(i).padStart(2, "0")}.md`), "note body\n", {
          title: `A${i}`,
        });
      }

      indexVault(vault, indexDir);
      expect(areaTiles(vault, indexDir).length).toBe(8);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("stem fallback when no title", () => {
    const { vault, indexDir } = makeVault();

    try {
      const plain = join(vault, "areas", "money.md");
      mkdirSync(join(vault, "areas"), { recursive: true });
      writeFileSync(plain, "No frontmatter here at all.", "utf8");
      indexVault(vault, indexDir);
      const tiles = new Map(areaTiles(vault, indexDir).map((t) => [t.path, t]));
      expect(tiles.get("areas/money.md")!.title).toBe("money");
    } finally {
      rmTmp(vault, indexDir);
    }
  });
});
