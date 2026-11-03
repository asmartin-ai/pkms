import { describe, expect, test } from "bun:test";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { inboxCount, writeCapture } from "../../src/pkms/capture.ts";
import { atomicWrite, readText } from "../../src/pkms/textio.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

describe("write_capture (ports src/pkms/capture.py)", () => {
  test("test_capture_writes_frontmatter_and_body", () => {
    const vault = mkTmp();

    try {
      const path = writeCapture("a fleeting thought", vault, { source: "cli" });
      expect(join(path, "..")).toBe(join(vault, "inbox"));
      const text = readText(path);
      expect(text.startsWith("---\ncaptured: ")).toBe(true);
      expect(text).toContain("source: cli\n");
      expect(text.trimEnd().endsWith("a fleeting thought")).toBe(true);
    } finally {
      rmTmp(vault);
    }
  });

  test("on-disk bytes match Python text-mode writes (platform EOL)", () => {
    const vault = mkTmp();

    try {
      const path = writeCapture("eol probe", vault, { source: "cli" });
      const raw = readFileSync(path);

      if (process.platform === "win32") {
        const s = raw.toString("latin1");
        expect(s.includes("\r\n")).toBe(true);
        expect(s.replaceAll("\r\n", "").includes("\n")).toBe(false);
      } else {
        expect(raw.includes(Buffer.from("\r"))).toBe(false);
      }
    } finally {
      rmTmp(vault);
    }
  });

  test("test_capture_slug_is_sanitized", () => {
    const vault = mkTmp();

    try {
      const path = writeCapture("Buy milk?! (2% or whole)", vault, { source: "cli" });
      expect(path.endsWith("_buy-milk-2-or-whole.md")).toBe(true);
    } finally {
      rmTmp(vault);
    }
  });

  test("test_capture_unicode_body_survives_even_when_slug_dies", () => {
    const vault = mkTmp();

    try {
      const path = writeCapture("日本語のメモ", vault, { source: "phone" });
      expect(path.replace(/\.md$/, "").endsWith("_capture")).toBe(true);
      expect(readText(path)).toContain("日本語のメモ");
    } finally {
      rmTmp(vault);
    }
  });

  test("test_capture_same_second_collision_gets_suffix", () => {
    const vault = mkTmp();

    try {
      const now = new Date(2026, 5, 12, 12, 0, 0);
      const first = writeCapture("same thought", vault, { source: "cli", now });
      const second = writeCapture("same thought", vault, { source: "cli", now });
      expect(first).not.toBe(second);
      expect(second.replace(/\.md$/, "").endsWith("-2")).toBe(true);
      expect(second).toBe(join(vault, "inbox", "2026-06-12_120000_same-thought-2.md"));
    } finally {
      rmTmp(vault);
    }
  });

  test("test_capture_rejects_empty", () => {
    const vault = mkTmp();

    try {
      expect(() => writeCapture("   \n  ", vault, { source: "cli" })).toThrow("empty capture");
    } finally {
      rmTmp(vault);
    }
  });

  test("empty-capture check uses Python strip() whitespace (NEL/record separators)", () => {
    const vault = mkTmp();

    try {
      expect(() => writeCapture("\x85", vault, { source: "cli" })).toThrow("empty capture");
      expect(() => writeCapture("\x1c \x1f", vault, { source: "cli" })).toThrow("empty capture");
      expect(() => writeCapture("\u2028", vault, { source: "cli" })).toThrow("empty capture");
      expect(() => writeCapture("\u00a0", vault, { source: "cli" })).toThrow("empty capture");
    } finally {
      rmTmp(vault);
    }
  });

  test("extra frontmatter fields render flat (keep ingest keep_id contract)", () => {
    const vault = mkTmp();

    try {
      const path = writeCapture("note body", vault, {
        source: "keep",
        extra: { keep_id: "k-42" },
      });

      const text = readText(path);
      expect(text).toContain("keep_id: k-42\n");
      expect(text).toContain("source: keep\n");
    } finally {
      rmTmp(vault);
    }
  });

  test("test_inbox_count", () => {
    const vault = mkTmp();

    try {
      expect(inboxCount(vault)).toBe(0);
      writeCapture("one", vault, { source: "cli" });
      writeCapture("two", vault, { source: "cli" });
      expect(inboxCount(vault)).toBe(2);
    } finally {
      rmTmp(vault);
    }
  });
});

describe("atomicWrite (textio)", () => {
  test("keeps the target's mode and writes through a symlink", () => {
    const dir = mkTmp();

    try {
      const note = join(dir, "secret.md");

      writeFileSync(note, "old", { mode: 0o600 });
      atomicWrite(note, "new");

      expect(statSync(note).mode & 0o777).toBe(0o600);
      expect(readFileSync(note, "utf8")).toBe("new");

      const real = join(dir, "real.md");

      writeFileSync(real, "real-old", { mode: 0o600 });

      const link = join(dir, "link.md");

      symlinkSync(real, link);
      atomicWrite(link, "through-link");

      expect(lstatSync(link).isSymbolicLink()).toBe(true);
      expect(readFileSync(real, "utf8")).toBe("through-link");
      expect(statSync(real).mode & 0o777).toBe(0o600);
      expect(readdirSync(dir).some((entry) => entry.includes(".tmp"))).toBe(false);
    } finally {
      rmTmp(dir);
    }
  });
});
