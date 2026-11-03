import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { TAKEOUT_LEDGER, importTakeout, renderTakeoutReport } from "../../src/pkms/keep_takeout.ts";
import { loadPost } from "../../src/pkms/indexer.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

type FixtureValue = string | number | boolean | null | FixtureValue[] | FixtureObject;

interface FixtureObject {
  [key: string]: FixtureValue;
}

function noteMember(payload: FixtureObject) {
  return strToU8(JSON.stringify(payload, null, 2));
}

function buildTakeoutZip(
  path: string,
  notes: Array<[string, FixtureObject]>,
  attachments: Array<[string, Uint8Array]> = [],
) {
  const files: Record<string, Uint8Array> = {};

  for (const [stem, payload] of notes) files[`Takeout/Keep/${stem}.json`] = noteMember(payload);

  for (const [filename, data] of attachments) files[`Takeout/${filename}`] = data;
  const out = zipSync(files, { level: 0 });
  writeFileSync(path, out);
}

function writeLegacyTakeout(
  path: string,
  notes: Array<[string, FixtureObject]>,
  attachments: Array<[string, Uint8Array]> = [],
) {
  const files: Record<string, Uint8Array> = {};

  for (const [stem, payload] of notes) files[`${stem}.json`] = noteMember(payload);

  for (const [filename, data] of attachments) files[`attachments/${filename}`] = data;
  writeFileSync(path, zipSync(files, { level: 0 }));
}

function writeCurrentTakeout(
  path: string,
  notes: Array<[string, FixtureObject]>,
  attachments: Array<[string, Uint8Array]> = [],
) {
  const files: Record<string, Uint8Array> = {};

  for (const [stem, payload] of notes) files[`Takeout/Keep/${stem}.json`] = noteMember(payload);

  for (const [filename, data] of attachments) files[`Takeout/Keep/${filename}`] = data;
  writeFileSync(path, zipSync(files, { level: 0 }));
}

function readCapture(path: string) {
  const raw = readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  expect(raw.startsWith("---\n")).toBe(true);
  const end = raw.indexOf("\n---\n", 4);
  const fmBlock = raw.slice(4, end);
  const body = raw.slice(end + 5).replace(/^\n+/, "");
  const fm: Record<string, string> = {};

  for (const line of fmBlock.split("\n")) {
    const idx = line.indexOf(":");

    if (idx !== -1) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  return [fm, body] satisfies [Record<string, string>, string];
}

describe("keep_takeout (ports src/pkms/keep_takeout.py)", () => {
  test("import_takeout writes one capture per note", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "takeout.zip");

    try {
      buildTakeoutZip(zpath, [
        [
          "a",
          {
            title: "Buy milk",
            textContent: "and eggs",
            timestamps: { createTime: 1_700_000_000_000_000 },
          },
        ],
        [
          "b",
          {
            title: "Read PKMS docs",
            textContent: "",
            timestamps: { createTime: 1_700_000_001_000_000 },
          },
        ],
      ]);

      const media = join(root, "media");
      const report = await importTakeout(zpath, vault, index, { mediaDir: media });

      expect(report.notes).toBe(2);
      expect(report.attachments_mirrored).toBe(0);
      expect(report.errors).toEqual([]);
      const captures = listMd(vault);
      expect(captures.length).toBe(2);
      const fm = readCapture(captures[0]!)[0];
      const created = fm.keep_created_at;
      expect(created).toBeDefined();
      expect(created!.startsWith("2023-")).toBe(true);
    } finally {
      rmTmp(root);
    }
  });

  test("frontmatter records keep metadata", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "takeout.zip");

    try {
      const iso = "2024-01-15T10:30:00+00:00";
      buildTakeoutZip(zpath, [
        [
          "shopping",
          {
            title: "Groceries",
            textContent: "milk, eggs, bread",
            timestamps: { createTime: iso, updateTime: iso },
            isPinned: true,
            color: "RED",
            labels: [{ name: "shopping" }],
          },
        ],
      ]);

      await importTakeout(zpath, vault, index, { mediaDir: join(root, "media") });
      const capture = listMd(vault)[0]!;
      const [fm, body] = readCapture(capture);
      expect(fm.source).toBe("keep-takeout");
      expect(fm.keep_id?.startsWith("takeout:")).toBe(true);
      expect(loadPost(readFileSync(capture, "utf8")).data.pinned).toBe("true");
      expect(fm.color).toBe("RED");
      expect(fm.labels).toBe("shopping");
      expect(fm.keep_created_at).toBe(iso);
      expect(body.split("\n")[0]).toBe("Groceries");
      expect(body).toContain("milk, eggs, bread");
    } finally {
      rmTmp(root);
    }
  });

  test("mirrors attachments with a file link", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "takeout.zip");

    try {
      const pngBytes = strToU8("\x89PNG\r\n\x1a\n" + "fake-png-data".repeat(10));
      buildTakeoutZip(
        zpath,
        [
          [
            "img-note",
            {
              title: "pic",
              textContent: "see attached",
              annotations: [{ mimeType: "image/png", filename: "shot.png" }],
            },
          ],
        ],
        [["attachments/shot.png", pngBytes]],
      );

      const media = join(root, "media");
      const report = await importTakeout(zpath, vault, index, { mediaDir: media });

      expect(report.attachments_mirrored).toBe(1);
      const files = listFiles(media, ".png");
      expect(files.length).toBe(1);
      const capture = listMd(vault)[0]!;
      const [, body] = readCapture(capture);
      expect(body).toContain("![keep attachment](file:///");
      expect(body).not.toContain("shot.png");
      const stem = files[0]!.split(/[\\/]/).pop()!.replace(".png", "");
      expect(body).toContain(stem);
    } finally {
      rmTmp(root);
    }
  });

  test("current export timestamps and same-folder attachments import idempotently", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "takeout.zip");

    try {
      const pngBytes = strToU8("\x89PNG\r\n\x1a\n" + "current-format".repeat(8));
      writeCurrentTakeout(
        zpath,
        [
          [
            "current",
            {
              title: "Current export",
              textContent: "attachment lives beside the note JSON",
              createdTimestampUsec: 1_700_000_000_000_000,
              userEditedTimestampUsec: 1_700_000_300_000_000,
              timestamps: { createTime: 1_000_000_000_000_000, updateTime: 1_000_000_000_000_000 },
              attachments: [{ filePath: "photo.png", mimetype: "image/png" }],
            },
          ],
        ],
        [["photo.png", pngBytes]],
      );

      const media = join(root, "media");
      const first = await importTakeout(zpath, vault, index, { mediaDir: media });

      expect(first.notes).toBe(1);
      expect(first.attachments_mirrored).toBe(1);
      expect(first.attachments_skipped).toBe(0);
      expect(first.errors).toEqual([]);

      const captures = listMd(vault);

      expect(captures.length).toBe(1);
      const [fm, body] = readCapture(captures[0]!);

      expect(new Date(fm.keep_created_at!).getTime()).toBe(1_700_000_000_000);
      expect(new Date(fm.keep_updated_at!).getTime()).toBe(1_700_000_300_000);

      const files = listFiles(media, ".png");

      expect(files.length).toBe(1);
      expect(readFileSync(files[0]!)).toEqual(Buffer.from(pngBytes));
      const stem = files[0]!.split(/[\\/]/).pop()!.replace(".png", "");

      expect(body).toContain("![keep attachment](file:///");
      expect(body).toContain(stem);
      expect(body).not.toContain("photo.png");

      const second = await importTakeout(zpath, vault, index, { mediaDir: media });

      expect(second.notes).toBe(0);
      expect(second.skipped_already_imported).toBe(1);
      expect(second.attachments_mirrored).toBe(0);
      expect(listMd(vault).length).toBe(1);
      expect(listFiles(media, ".png").length).toBe(1);
    } finally {
      rmTmp(root);
    }
  });

  test("renders checklist as a task list", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "takeout.zip");

    try {
      buildTakeoutZip(zpath, [
        [
          "todo",
          {
            title: "Today",
            textContent: "",
            listContent: [
              { text: "first", checked: false },
              { text: "second", checked: true },
            ],
          },
        ],
      ]);
      await importTakeout(zpath, vault, index, { mediaDir: join(root, "media") });
      const capture = listMd(vault)[0]!;
      const [, body] = readCapture(capture);
      expect(body).toContain("- [ ] first");
      expect(body).toContain("- [x] second");
    } finally {
      rmTmp(root);
    }
  });

  test("import_takeout is idempotent", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "takeout.zip");

    try {
      buildTakeoutZip(zpath, [["dup", { title: "same", textContent: "body" }]]);
      const r1 = await importTakeout(zpath, vault, index, { mediaDir: join(root, "media") });
      const r2 = await importTakeout(zpath, vault, index, { mediaDir: join(root, "media") });
      expect(r1.notes).toBe(1);
      expect(r2.notes).toBe(0);
      expect(r2.skipped_already_imported).toBe(1);
      expect(listMd(vault).length).toBe(1);
    } finally {
      rmTmp(root);
    }
  });

  test("skips trashed notes", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "takeout.zip");

    try {
      buildTakeoutZip(zpath, [
        ["live", { title: "live", textContent: "kept" }],
        ["dead", { title: "dead", textContent: "trashed", isTrashed: true }],
      ]);
      const report = await importTakeout(zpath, vault, index, { mediaDir: join(root, "media") });
      expect(report.notes).toBe(1);
      expect(report.skipped_trashed).toBe(1);
    } finally {
      rmTmp(root);
    }
  });

  test("handles the legacy flat format", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "takeout.zip");

    try {
      writeLegacyTakeout(zpath, [["legacy", { title: "old", textContent: "shape" }]]);
      const report = await importTakeout(zpath, vault, index, { mediaDir: join(root, "media") });
      expect(report.notes).toBe(1);
      expect(report.errors).toEqual([]);
    } finally {
      rmTmp(root);
    }
  });

  test("missing attachment is skipped, not fatal", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "takeout.zip");

    try {
      buildTakeoutZip(zpath, [
        [
          "ref",
          {
            title: "broken ref",
            textContent: "where is it",
            annotations: [{ mimeType: "image/png", filename: "missing.png" }],
          },
        ],
      ]);
      const report = await importTakeout(zpath, vault, index, { mediaDir: join(root, "media") });
      expect(report.notes).toBe(1);
      expect(report.attachments_skipped).toBe(1);
    } finally {
      rmTmp(root);
    }
  });

  test("report is quiet when nothing imported", () => {
    const r = {
      notes: 0,
      skipped_already_imported: 0,
      skipped_trashed: 0,
      skipped_empty: 0,
      attachments_mirrored: 0,
      attachments_skipped: 0,
      errors: [],
      media_dir: "",
    };

    expect(renderTakeoutReport(r)).toBe("takeout: nothing new");
  });

  test("empty zip errors cleanly", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "empty.zip");

    try {
      writeFileSync(zpath, zipSync({ "readme.txt": strToU8("no notes here") }, { level: 0 }));
      const report = await importTakeout(zpath, vault, index, { mediaDir: join(root, "media") });
      expect(report.notes).toBe(0);
      expect(report.errors).toEqual([]);
      expect(listMd(vault)).toEqual([]);
    } finally {
      rmTmp(root);
    }
  });

  test("dedupes from the takeout ledger when the DB is fresh", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const index = join(root, ".index");
    const zpath = join(root, "takeout.zip");

    try {
      buildTakeoutZip(zpath, [["dup", { title: "same", textContent: "body" }]]);

      const r1 = await importTakeout(zpath, vault, index, { mediaDir: join(root, "media") });
      expect(r1.notes).toBe(1);
      expect(existsSync(join(index, TAKEOUT_LEDGER))).toBe(true);

      const db = join(index, "pkms.db");

      if (existsSync(db)) rmSync(db);

      const r2 = await importTakeout(zpath, vault, index, { mediaDir: join(root, "media") });
      expect(r2.notes).toBe(0);
      expect(r2.skipped_already_imported).toBe(1);
      expect(listMd(vault).length).toBe(1);
    } finally {
      rmTmp(root);
    }
  });
});

function listMd(dir: string): string[] {
  const inbox = join(dir, "inbox");

  if (!existsSync(inbox)) return [];

  return readdirSync(inbox)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(inbox, f))
    .sort();
}

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f))
    .sort();
}
