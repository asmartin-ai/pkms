import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEDGER,
  completedKeepIds,
  ingestKeep,
  recordCompleted,
  toAwareMs,
  type IngestKeepOptions,
  type KeepClient,
  type KeepNote,
} from "../../src/pkms/keep_ingest.ts";
import type { KeepImage } from "../../src/pkms/keep_transport.ts";
import { append, load } from "../../src/pkms/ledger.ts";
import { writeCapture } from "../../src/pkms/capture.ts";
import { mkTmp, rmTmp } from "./helpers.ts";
import { readText } from "../../src/pkms/textio.ts";
import { listSources } from "../../src/pkms/sources.ts";

class FakeKeep implements KeepClient {
  private notes: KeepNote[];
  constructor(notes: KeepNote[]) {
    this.notes = notes;
  }
  all() {
    return this.notes;
  }
  getMediaLink(blob: KeepImage) {
    return `https://keep.example/${blob.id}`;
  }
}

function note(
  nid: string,
  opts: {
    text?: string | null;
    title?: string | null;
    trashed?: boolean;
    images?: KeepImage[];
    archived?: boolean;
    timestamps?: KeepNote["timestamps"];
    pinned?: boolean;
    hasUnchecked?: boolean;
  } = {},
) {
  return {
    id: nid,
    text: opts.text ?? "some text",
    title: opts.title ?? "",
    trashed: opts.trashed ?? false,
    images: opts.images ?? [],
    archived: opts.archived ?? false,
    pinned: opts.pinned ?? false,
    hasUnchecked: opts.hasUnchecked ?? false,
    timestamps: opts.timestamps ?? undefined,
  };
}

function awareIso(year = 2025, month = 1, day = 1, hour = 12, minute = 0, second = 0) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+00:00`;
}

function project() {
  const root = mkTmp();

  return { vault: join(root, "vault"), indexDir: join(root, ".index"), root };
}

function inboxFiles(vault: string) {
  const inbox = join(vault, "inbox");

  if (!existsSync(inbox)) return [];

  return readdirSync(inbox)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => join(inbox, f));
}

describe("Keep ingest", () => {
  test("first contact archives every non-trashed note including Keep-archived notes", async () => {
    const { vault, indexDir, root } = project();

    try {
      const keep = new FakeKeep([
        note("a1"),
        note("a2", { archived: true }),
        note("trashed", { trashed: true }),
      ]);

      const report = await ingestKeepSync(vault, indexDir, root, keep);
      expect(report.archived).toBe(2);
      expect(report.new).toBe(0);
      expect(
        listSources(vault)
          .map((item) => [item.data.source_id, item.data.keep_archived, item.data.route])
          .sort(),
      ).toEqual([
        ["a1", "false", "hold"],
        ["a2", "true", "hold"],
      ]);
      expect(load(indexDir, LEDGER)).toEqual(new Set(["a1", "a2"]));
      expect(existsSync(join(vault, "inbox"))).toBe(false);
      expect((await ingestKeepSync(vault, indexDir, root, keep)).archived).toBe(0);
    } finally {
      rmTmp(root);
    }
  });

  test("initial pinned, current open-checklist, and recently edited notes route while the rest stay archived", async () => {
    const { vault, indexDir, root } = project();

    try {
      const keep = new FakeKeep([
        note("pinned", { pinned: true, archived: true }),
        note("checklist", { hasUnchecked: true, timestamps: { edited: "2026-03-01T00:00:00Z" } }),
        note("stale-checklist", {
          hasUnchecked: true,
          timestamps: { edited: "2016-03-23T00:00:00Z" },
        }),
        note("recent", { timestamps: { edited: "2026-10-06T00:00:00Z" } }),
        note("recent-filed", { archived: true, timestamps: { edited: "2026-10-06T00:00:00Z" } }),
        note("old", { timestamps: { edited: "2025-01-01T00:00:00Z" } }),
      ]);

      const report = await ingestKeepSync(vault, indexDir, root, keep, {
        now: new Date("2026-10-07T00:00:00Z"),
      });

      expect(report.archived).toBe(6);
      expect(report.new).toBe(3);
      expect(
        listSources(vault, { route: "routed" })
          .map((item) => item.data.source_id)
          .sort(),
      ).toEqual(["checklist", "pinned", "recent"]);
      expect(
        listSources(vault, { route: "hold" })
          .map((item) => item.data.source_id)
          .sort(),
      ).toEqual(["old", "recent-filed", "stale-checklist"]);
      expect(inboxFiles(vault)).toHaveLength(3);
    } finally {
      rmTmp(root);
    }
  });

  test("failed initial media remains archive-bound on retry while a later new note goes directly to inbox", async () => {
    const { vault, indexDir, root } = project();

    try {
      const originals = [
        note("good"),
        note("retry", { archived: true, images: [{ id: "receipt" }] }),
      ];

      const failed = await ingestKeepSync(vault, indexDir, root, new FakeKeep(originals), {
        fetchBytes: () => {
          throw new Error("offline media failure");
        },
      });

      expect(failed.archived).toBe(1);
      expect(failed.media_failed).toBe(1);
      expect(completedKeepIds(indexDir)).toEqual(new Set(["good"]));
      expect(listSources(vault).map((item) => item.data.source_id)).toEqual(["good"]);

      const retried = await ingestKeepSync(
        vault,
        indexDir,
        root,
        new FakeKeep([...originals, note("later")]),
        {
          fetchBytes: () => new Uint8Array([0xff, 0xd8, 0x00]),
          ocr: () => "Extracted receipt text",
        },
      );

      expect(retried.archived).toBe(1);
      expect(retried.new).toBe(1);
      const archived = listSources(vault);
      expect(archived.map((item) => item.data.source_id).sort()).toEqual(["good", "retry"]);
      expect(archived.find((item) => item.data.source_id === "retry")!.body).toContain(
        "Extracted receipt text",
      );
      expect(archived.find((item) => item.data.source_id === "retry")!.body).toContain(
        "![keep attachment](file:///",
      );
      expect(inboxFiles(vault)).toHaveLength(1);
      expect(readText(inboxFiles(vault)[0]!)).toContain("keep_id: later");
      expect(completedKeepIds(indexDir)).toEqual(new Set(["good", "retry", "later"]));
    } finally {
      rmTmp(root);
    }
  });

  test("empty ledger FILE means initialized, not first contact", async () => {
    const { vault, indexDir, root } = project();

    try {
      mkdirSync(indexDir, { recursive: true });
      writeFileSync(join(indexDir, LEDGER), "", "utf8");
      const keep = new FakeKeep([note("a1"), note("a2")]);
      const report = await ingestKeepSync(vault, indexDir, root, keep);
      expect(report.new).toBe(2);
      expect(load(indexDir, LEDGER)).toEqual(new Set(["a1", "a2"]));
    } finally {
      rmTmp(root);
    }
  });

  test("zero-note first contact still initializes the ledger", async () => {
    const { vault, indexDir, root } = project();

    try {
      expect(await ingestKeepSync(vault, indexDir, root, new FakeKeep([]))).toEqual({
        archived: 0,
        new: 0,
        images: 0,
        ocr_missing: 0,
        media_failed: 0,
      });
      expect(existsSync(join(indexDir, LEDGER))).toBe(true);

      const report = await ingestKeepSync(
        vault,
        indexDir,
        root,
        new FakeKeep([note("b1", { text: "first real thought" })]),
      );

      expect(report.new).toBe(1);
      const body = readText(inboxFiles(vault)[0]!);
      expect(body).toContain("first real thought");
    } finally {
      rmTmp(root);
    }
  });

  test("second run ingests only new notes", async () => {
    const { vault, indexDir, root } = project();

    try {
      await ingestKeepSync(vault, indexDir, root, new FakeKeep([note("a1")]));

      const report = await ingestKeepSync(
        vault,
        indexDir,
        root,
        new FakeKeep([note("a1"), note("b2", { text: "fresh thought" })]),
      );

      expect(report.new).toBe(1);
      const files = inboxFiles(vault);
      expect(files.length).toBe(1);
      const text = readFileSync(files[0]!, "utf8");
      expect(text).toContain("source: keep");
      expect(text).toContain("keep_id: b2");
      expect(text).toContain("fresh thought");
      expect(load(indexDir, LEDGER).has("b2")).toBe(true);
      expect(
        (await ingestKeepSync(vault, indexDir, root, new FakeKeep([note("a1"), note("b2")]))).new,
      ).toBe(0);
    } finally {
      rmTmp(root);
    }
  });

  test("seen IDs come from ledger union completed DB", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["a1"]);
      recordCompleted(indexDir, "b2", { keepCreatedAt: awareIso() });
      const keep = new FakeKeep([note("a1"), note("b2", { text: "already captured" })]);
      const report = await ingestKeepSync(vault, indexDir, root, keep);
      expect(report.new).toBe(0);
      expect(existsSync(join(vault, "inbox"))).toBe(false);
    } finally {
      rmTmp(root);
    }
  });

  test("title lands above text; trashed skipped", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);

      const keep = new FakeKeep([
        note("t1", { text: "body", title: "Heading" }),
        note("t2", { trashed: true }),
      ]);

      const report = await ingestKeepSync(vault, indexDir, root, keep);
      expect(report.new).toBe(1);
      const body = readText(inboxFiles(vault)[0]!);
      expect(body).toContain("Heading\n\nbody");
    } finally {
      rmTmp(root);
    }
  });

  test("archived notes excluded from ingest", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);

      const keep = new FakeKeep([
        note("live", { text: "active note" }),
        note("archived", { text: "archived note", archived: true }),
      ]);

      const report = await ingestKeepSync(vault, indexDir, root, keep);
      expect(report.new).toBe(1);
      expect(load(indexDir, LEDGER).has("live")).toBe(true);
      expect(load(indexDir, LEDGER).has("archived")).toBe(false);
      const files = inboxFiles(vault);
      expect(files.length).toBe(1);
      expect(readFileSync(files[0]!, "utf8")).toContain("active note");
    } finally {
      rmTmp(root);
    }
  });

  test("image downloaded, sha-mirrored, OCR text inlined", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);
      const media = join(root, "media");

      const keep = new FakeKeep([note("i1", { text: "see pic", images: [{ id: "blob1" }] })]);

      const report = await ingestKeepSync(vault, indexDir, root, keep, {
        mediaDir: media,
        fetchBytes: () =>
          new Uint8Array([0xff, 0xd8, ...new TextEncoder().encode("fake-jpg-bytes")]),
        ocr: () => "words inside the image",
      });

      expect(report.images).toBe(1);
      expect(report.ocr_missing).toBe(0);
      const body = readText(inboxFiles(vault)[0]!);
      expect(body).toContain("words inside the image");
      expect(body).toContain("![keep attachment](file:///");
      expect(existsSync(media)).toBe(true);
    } finally {
      rmTmp(root);
    }
  });

  test("missing OCR engine disclosed, not fatal", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);
      const media = join(root, "media");
      const keep = new FakeKeep([note("i2", { images: [{ id: "b" }] })]);

      const report = await ingestKeepSync(vault, indexDir, root, keep, {
        mediaDir: media,
        fetchBytes: () => new Uint8Array([0xff, 0xd8, 0x00]),
        ocr: () => null,
      });

      expect(report.new).toBe(1);
      expect(report.ocr_missing).toBe(1);
    } finally {
      rmTmp(root);
    }
  });

  test("a truncated media file is rewritten instead of reused", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);
      const media = join(root, "media");
      mkdirSync(media, { recursive: true });
      const data = new Uint8Array([0xff, 0xd8, ...new TextEncoder().encode("full-image-bytes")]);
      const dest = join(media, `${createHash("sha256").update(data).digest("hex")}.jpg`);

      writeFileSync(dest, new Uint8Array([0xff, 0xd8]));

      const keep = new FakeKeep([note("i7", { text: "see pic", images: [{ id: "blob7" }] })]);

      const report = await ingestKeepSync(vault, indexDir, root, keep, {
        mediaDir: media,
        fetchBytes: () => data,
        ocr: () => "words inside the image",
      });

      expect(report.images).toBe(1);
      expect(new Uint8Array(readFileSync(dest))).toEqual(data);
      expect(readdirSync(media)).toEqual([
        `${createHash("sha256").update(data).digest("hex")}.jpg`,
      ]);
    } finally {
      rmTmp(root);
    }
  });

  test("failed media skips the entire note — retryable", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);
      const media = join(root, "media");

      const keep = new FakeKeep([note("i4", { text: "txt", images: [{ id: "b" }] })]);

      const report = await ingestKeepSync(vault, indexDir, root, keep, {
        mediaDir: media,
        fetchBytes: () => {
          throw new Error("network");
        },
      });

      expect(report.media_failed).toBe(1);
      expect(report.new).toBe(0);
      expect(inboxFiles(vault).length).toBe(0);
      expect(completedKeepIds(indexDir).has("i4")).toBe(false);
      expect(load(indexDir, LEDGER).has("i4")).toBe(false);
    } finally {
      rmTmp(root);
    }
  });

  test("no token reports setup_needed", async () => {
    const { vault, indexDir, root } = project();

    try {
      const report = await ingestKeepSync(vault, indexDir, root, null);
      expect(report).toEqual({
        setup_needed: true,
        archived: 0,
        new: 0,
        images: 0,
        ocr_missing: 0,
        media_failed: 0,
      });
    } finally {
      rmTmp(root);
    }
  });

  test("aware datetime emits UTC ISO", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);
      const ts = { created: awareIso(2025, 6, 15, 10, 30, 0) };
      const keep = new FakeKeep([note("dt1", { text: "aware ts note", timestamps: ts })]);
      const report = await ingestKeepSync(vault, indexDir, root, keep);
      expect(report.new).toBe(1);
      const body = readText(inboxFiles(vault)[0]!);
      expect(body).toContain("keep_created_at");
      expect(body).toContain("2025-06-15T10:30:00+00:00");
    } finally {
      rmTmp(root);
    }
  });

  test("legacy epoch-microsecond timestamp parsed as UTC", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);
      const ts = { created: 1749983400000000 };
      const keep = new FakeKeep([note("legacy1", { text: "legacy ts note", timestamps: ts })]);
      const report = await ingestKeepSync(vault, indexDir, root, keep);
      expect(report.new).toBe(1);
      const body = readText(inboxFiles(vault)[0]!);
      expect(body).toContain("keep_created_at");
      expect(body).toContain("2025-06-15T10:30:00+00:00");
    } finally {
      rmTmp(root);
    }
  });

  test("naive ISO string treated as UTC", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);
      const ts = { created: "2025-06-15T10:30:00" };
      const keep = new FakeKeep([note("legacy2", { text: "naive iso note", timestamps: ts })]);
      const report = await ingestKeepSync(vault, indexDir, root, keep);
      expect(report.new).toBe(1);
      const body = readText(inboxFiles(vault)[0]!);
      expect(body).toContain("2025-06-15T10:30:00+00:00");
    } finally {
      rmTmp(root);
    }
  });

  test("edited note is recaptured; completion refreshed", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);
      const nowMs = Date.now();
      const oldUpdated = new Date(nowMs - 3_600_000).toISOString();
      const created = new Date(nowMs - 172_800_000).toISOString();

      const keep1 = new FakeKeep([
        note("r1", { text: "original text", timestamps: { created, updated: oldUpdated } }),
      ]);

      await ingestKeepSync(vault, indexDir, root, keep1);
      expect(completedKeepIds(indexDir).has("r1")).toBe(true);
      const body1 = readText(inboxFiles(vault)[0]!);
      expect(body1).toContain("original text");

      const newUpdated = new Date(nowMs + 3_600_000).toISOString();

      const keep2 = new FakeKeep([
        note("r1", { text: "updated text", timestamps: { created, updated: newUpdated } }),
      ]);

      const report = await ingestKeepSync(vault, indexDir, root, keep2);
      expect(report.new).toBe(1);
      expect(completedKeepIds(indexDir).has("r1")).toBe(true);
      const bodies = inboxFiles(vault).map((p) => readText(p));
      expect(bodies.some((b) => b.includes("updated text"))).toBe(true);
    } finally {
      rmTmp(root);
    }
  });

  test("unchanged note is NOT recaptured", async () => {
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);
      const nowMs = Date.now();
      const updated = new Date(nowMs - 3_600_000).toISOString();
      const created = new Date(nowMs - 172_800_000).toISOString();
      const ts = { created, updated };
      await ingestKeepSync(
        vault,
        indexDir,
        root,
        new FakeKeep([note("r2", { text: "text", timestamps: ts })]),
      );

      const report = await ingestKeepSync(
        vault,
        indexDir,
        root,
        new FakeKeep([note("r2", { text: "text", timestamps: ts })]),
      );

      expect(report.new).toBe(0);
    } finally {
      rmTmp(root);
    }
  });

  test.each([1e30, Infinity, -1e30])("absurd timestamp %p degrades to null", async (bogus) => {
    expect(toAwareMs(bogus)).toBeNull();
    const { vault, indexDir, root } = project();

    try {
      append(indexDir, LEDGER, ["seed"]);

      const keep = new FakeKeep([
        note("bad", {
          text: "note with a corrupt timestamp",
          timestamps: { created: bogus, updated: bogus },
        }),
      ]);

      const report = await ingestKeepSync(vault, indexDir, root, keep);
      expect(report.new).toBe(1);
      const body = readText(inboxFiles(vault)[0]!);
      expect(body).toContain("corrupt timestamp");
    } finally {
      rmTmp(root);
    }
  });
});

async function ingestKeepSync(
  vault: string,
  indexDir: string,
  root: string,
  keep: KeepClient | null,
  opts: IngestKeepOptions = {},
) {
  return ingestKeep(vault, indexDir, root, { keep, ...opts });
}

test("completed note recoverable from SQLite after mid-batch failure", async () => {
  const root = mkTmp();
  const vault = join(root, "vault");
  const indexDir = join(root, ".index");

  try {
    append(indexDir, LEDGER, ["seed-existing"]);
    const notes = [note("n1", { text: "first note" }), note("n2", { text: "second note" })];
    const keep: KeepClient = { all: () => notes };

    let calls = 0;

    const flakyWrite: typeof writeCapture = (text, vlt, opts) => {
      calls += 1;

      if (calls === 2) throw new Error("simulated mid-batch failure on the 2nd note");

      return writeCapture(text, vlt, opts);
    };

    await ingestKeep(vault, indexDir, root, { keep, writeCaptureFn: flakyWrite }).catch(() => {});

    const recovered = completedKeepIds(indexDir);
    expect(recovered.has("n1")).toBe(true);
    expect(recovered.has("n2")).toBe(false);
  } finally {
    rmTmp(root);
  }
});

test("completed note ledgered even when a later note fails", async () => {
  const root = mkTmp();
  const vault = join(root, "vault");
  const indexDir = join(root, ".index");

  try {
    append(indexDir, LEDGER, ["seed-existing"]);
    const notes = [note("n1", { text: "first note" }), note("n2", { text: "second note" })];
    const keep: KeepClient = { all: () => notes };

    let calls = 0;

    const flakyWrite: typeof writeCapture = (text, vlt, opts) => {
      calls += 1;

      if (calls === 2) throw new Error("simulated mid-batch failure on the 2nd note");

      return writeCapture(text, vlt, opts);
    };

    await ingestKeep(vault, indexDir, root, { keep, writeCaptureFn: flakyWrite }).catch(() => {});

    const ledger = load(indexDir, LEDGER);
    expect(ledger.has("n1")).toBe(true);
    expect(ledger.has("n2")).toBe(false);
  } finally {
    rmTmp(root);
  }
});
