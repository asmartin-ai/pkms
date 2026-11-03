import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SQLQueryBindings } from "bun:sqlite";
import { connect } from "../../src/pkms/db.ts";
import { indexVault } from "../../src/pkms/indexer.ts";
import { recognitionCards } from "../../src/pkms/today.ts";
import { mkTmp, rmTmp, writeNote } from "./helpers.ts";

describe("recognition_cards", () => {
  function makeCardsVault() {
    const root = mkTmp();
    const vault = join(root, "vault");
    const reading = join(vault, "resources", "reading");
    mkdirSync(reading, { recursive: true });
    const mins = [12, 30];

    for (let i = 0; i < 2; i++) {
      writeFileSync(
        join(reading, `thread-${i}.md`),
        `---\ntitle: Reading ${i}\ncreated: 2026-06-1${i}\nreading: queued\n` +
          `reading_minutes: ${mins[i]}\npromoted: 2026-06-0${i + 1}\n---\n\nbody ${i}\n`,
        "utf8",
      );
    }

    for (let i = 0; i < 4; i++) {
      writeNote(
        join(vault, "resources", `old-${i}.md`),
        `An old idea ${i} worth revisiting one day.\n`,
        {
          title: `Old Idea ${i}`,
          created: "2026-01-01",
        },
      );
    }

    const indexDir = join(root, ".index");
    indexVault(vault, indexDir);

    return { vault, indexDir };
  }

  function offerCountTotal(indexDir: string): number {
    const db = connect(indexDir);

    try {
      const row = db
        .query<{ s: number }, SQLQueryBindings[]>(
          "SELECT COALESCE(SUM(offer_count), 0) AS s FROM resurface_offers",
        )
        .get();

      return row ? row.s : 0;
    } catch {
      return 0;
    } finally {
      db.close();
    }
  }

  test("recognition cards is a curated row not the raw pile", () => {
    const { vault, indexDir } = makeCardsVault();

    try {
      const cards = recognitionCards(vault, indexDir);
      expect(cards.length).toBeGreaterThanOrEqual(1);
      expect(cards.length).toBeLessThanOrEqual(3);

      for (const c of cards) {
        expect(["reading", "resurface", "capture"]).toContain(c.kind);
        expect(c.title.length).toBeGreaterThan(0);
        expect(c.why.length).toBeGreaterThan(0);
      }
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("recognition cards span multiple sources with consume cost", () => {
    const { vault, indexDir } = makeCardsVault();

    try {
      const cards = recognitionCards(vault, indexDir);
      const kinds = new Set(cards.map((c) => c.kind));
      expect(kinds.has("reading")).toBe(true);
      expect(kinds.has("resurface")).toBe(true);
      const reading = cards.filter((c) => c.kind === "reading");
      expect(reading.length).toBeGreaterThan(0);
      expect(reading.some((c) => Boolean(c.minutes))).toBe(true);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("assembling recognition cards is side effect free", () => {
    const { vault, indexDir } = makeCardsVault();

    try {
      const before = offerCountTotal(indexDir);
      recognitionCards(vault, indexDir);
      recognitionCards(vault, indexDir);
      const after = offerCountTotal(indexDir);
      expect(after).toBe(before);
      expect(before).toBe(0);
    } finally {
      rmTmp(vault, indexDir);
    }
  });
});
