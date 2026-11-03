import { describe, expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { append, load } from "../../src/pkms/ledger.ts";
import { readText } from "../../src/pkms/textio.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

describe("ledger (ports pkms/ledger.py)", () => {
  test("test_ledger_roundtrip: missing → empty; append accumulates batches", () => {
    const dir = mkTmp();

    try {
      expect(load(dir, "email-ledger.txt").size).toBe(0);
      append(dir, "email-ledger.txt", ["a@x", "b@y"]);
      append(dir, "email-ledger.txt", ["c@z"]);
      expect([...load(dir, "email-ledger.txt")].sort()).toEqual(["a@x", "b@y", "c@z"]);
    } finally {
      rmTmp(dir);
    }
  });

  test("duplicate ids collapse into the set — dedupe check is set membership", () => {
    const dir = mkTmp();

    try {
      append(dir, "keep-ledger.txt", ["n1", "n1"]);
      expect(load(dir, "keep-ledger.txt")).toEqual(new Set(["n1"]));
    } finally {
      rmTmp(dir);
    }
  });

  test("append creates the index dir when missing (durable-ledger invariant)", () => {
    const dir = mkTmp();

    try {
      const indexDir = join(dir, ".index");
      append(indexDir, "ch-promote-ledger.txt", ["id-1"]);
      expect(existsSync(indexDir)).toBe(true);
      expect(readText(join(indexDir, "ch-promote-ledger.txt"))).toBe("id-1\n");
    } finally {
      rmTmp(dir);
    }
  });

  test("blank lines are skipped and lines trimmed on load", () => {
    const dir = mkTmp();

    try {
      writeFileSync(join(dir, "takeout-ledger.txt"), "a\n\n b \n", "utf8");
      expect([...load(dir, "takeout-ledger.txt")]).toEqual(["a", "b"]);
    } finally {
      rmTmp(dir);
    }
  });

  test("lone-CR ledger lines load like Python read_text (universal newlines)", () => {
    const dir = mkTmp();

    try {
      writeFileSync(join(dir, "cr-ledger.txt"), "a\rb\r", "utf8");
      expect([...load(dir, "cr-ledger.txt")]).toEqual(["a", "b"]);
    } finally {
      rmTmp(dir);
    }
  });
});
