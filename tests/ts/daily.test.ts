import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readText } from "../../src/pkms/textio.ts";
import {
  appendDid,
  BREADCRUMB_HEADING,
  dailyPath,
  ensureDaily,
  FOLDED_HEADING,
  sectionLines,
} from "../../src/pkms/daily.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

const DAY = new Date(2026, 5, 12);

describe("daily note (ports src/pkms/daily.py)", () => {
  test("test_template_carries_section_anchors", () => {
    const vault = mkTmp();

    try {
      const [path, created] = ensureDaily(join(vault, "vault"), DAY);
      expect(created).toBe(true);
      const text = readText(path);
      expect(text.startsWith("---\ntitle: 2026-06-12\n")).toBe(true);
      expect(text).toContain("tags: [daily]");
      expect(text).toContain(BREADCRUMB_HEADING);
      expect(text).toContain(FOLDED_HEADING);
      expect(text).toContain("## notes");
    } finally {
      rmTmp(vault);
    }
  });

  test("test_ensure_daily_never_overwrites", () => {
    const vault = join(mkTmp(), "vault");

    try {
      const [path] = ensureDaily(vault, DAY);
      writeFileSync(path, "user wrote this", "utf8");
      const [again, created] = ensureDaily(vault, DAY);
      expect(again).toBe(path);
      expect(created).toBe(false);
      expect(readText(path)).toBe("user wrote this");
    } finally {
      rmTmp(vault);
    }
  });

  test("test_daily_path_uses_iso_date", () => {
    expect(dailyPath(mkTmp(), DAY).endsWith("2026-06-12.md")).toBe(true);
  });

  test("test_section_lines_extracts_content_drops_comments", () => {
    const text =
      "# 2026-06-12\n\n## breadcrumb\n<!-- where you left off -->\n" +
      "stopped mid-refactor of today.py\n▶ rerun the today tests\n\n" +
      "## folded today\n- folded a thing\n";

    expect(sectionLines(text, BREADCRUMB_HEADING)).toEqual([
      "stopped mid-refactor of today.py",
      "▶ rerun the today tests",
    ]);
    expect(sectionLines(text, FOLDED_HEADING)).toEqual(["- folded a thing"]);
  });

  test("test_section_lines_empty_or_absent_section_is_empty", () => {
    const templated = "## breadcrumb\n<!-- placeholder -->\n\n## notes\n";
    expect(sectionLines(templated, BREADCRUMB_HEADING)).toEqual([]);
    expect(sectionLines("no sections here", BREADCRUMB_HEADING)).toEqual([]);
  });
});

describe("append_did (did command contract, tests/test_cli.py)", () => {
  test("did lands inside the ## did section, after existing entries", () => {
    const vault = mkTmp();

    try {
      appendDid(vault, "shipped the thing", DAY);
      appendDid(vault, "another one", DAY);
      const text = readText(join(vault, "daily", "2026-06-12.md"));
      expect(text).toContain("## did");
      expect(text).toContain("- [x] shipped the thing");
      expect(text).toContain("- [x] another one");
      const did = text.indexOf("## did");
      const notes = text.indexOf("## notes");
      const first = text.indexOf("- [x] shipped the thing");
      const second = text.indexOf("- [x] another one");
      expect(did).toBeGreaterThan(-1);
      expect(first).toBeGreaterThan(did);
      expect(second).toBeGreaterThan(first);
      expect(notes).toBeGreaterThan(second);
    } finally {
      rmTmp(vault);
    }
  });

  test("pre-slice-5 note without ## did gets the section inserted before ## notes", () => {
    const vault = mkTmp();

    try {
      const path = join(vault, "daily", "2026-06-12.md");
      mkdirSync(join(vault, "daily"), { recursive: true });
      writeFileSync(path, "# 2026-06-12\n\n## notes\n", "utf8");
      appendDid(vault, "retro", DAY);
      expect(readText(path)).toBe("# 2026-06-12\n\n## did\n- [x] retro\n\n## notes\n");
    } finally {
      rmTmp(vault);
    }
  });

  test("note with neither section gets ## did appended at the end", () => {
    const vault = mkTmp();

    try {
      const path = join(vault, "daily", "2026-06-12.md");
      mkdirSync(join(vault, "daily"), { recursive: true });
      writeFileSync(path, "just a stub", "utf8");
      appendDid(vault, "appended", DAY);
      expect(readText(path)).toBe("just a stub\n\n## did\n- [x] appended\n");
    } finally {
      rmTmp(vault);
    }
  });

  test("fresh-template append ends with a single trailing newline (splitlines parity)", () => {
    const vault = mkTmp();

    try {
      appendDid(vault, "first", DAY);
      const text = readText(join(vault, "daily", "2026-06-12.md"));
      expect(text.endsWith("## notes\n\n")).toBe(true);
      expect(text.endsWith("## notes\n\n\n")).toBe(false);
      expect(text).toContain(
        '## did\n<!-- pkms did "thing" lands here — retroactive entries welcome -->\n- [x] first\n',
      );
    } finally {
      rmTmp(vault);
    }
  });
});
