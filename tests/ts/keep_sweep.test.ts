import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  SWEEP_STATE,
  recordCompleted,
  renderSweepReport,
  sweepOldUnpinned,
  withKeepLock,
  type KeepClient,
  type KeepNote,
  SweepStateSchema,
} from "../../src/pkms/keep_ingest.ts";
import { mkTmp, rmTmp } from "./helpers.ts";
import { operationalDir } from "../../src/pkms/operational.ts";

class FakeKeep implements KeepClient {
  private notes: KeepNote[];
  trashedIds: string[] = [];
  private syncFail = false;
  syncCalls = 0;
  private failFirst = 0;

  constructor(notes: KeepNote[]) {
    this.notes = notes;
  }
  all(): KeepNote[] {
    return [...this.notes];
  }
  sync(): void {
    this.syncCalls += 1;

    if (this.syncFail || this.failFirst >= this.syncCalls) {
      throw new Error("sync failed");
    }
  }
  setSyncFail(fail = true): void {
    this.syncFail = fail;
  }
  failFirstSyncs(n: number): void {
    this.failFirst = n;
  }
}

function plainNote(
  noteId: string,
  opts: { pinned?: boolean; trashed?: boolean; archived?: boolean } = {},
): KeepNote {
  return {
    id: noteId,
    pinned: opts.pinned ?? false,
    trashed: opts.trashed ?? false,
    archived: opts.archived ?? false,
  };
}

function trashableNote(
  noteId: string,
  opts: { pinned?: boolean; trashed?: boolean; archived?: boolean } = {},
): KeepNote {
  const n = plainNote(noteId, opts);
  n.trash = () => {
    n.trashed = true;
  };

  return n;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function indexDir(): string {
  return join(mkTmp(), ".index");
}

function readState(dir: string) {
  return SweepStateSchema.parse(
    JSON.parse(readFileSync(join(operationalDir(dir), SWEEP_STATE), "utf8")),
  );
}

describe("sweep_old_unpinned (ports tests/test_keep_sweep.py)", () => {
  test("dry run is default and does not call trash", async () => {
    const dir = indexDir();

    try {
      const keep = new FakeKeep([plainNote("a"), plainNote("b")]);
      recordCompleted(dir, "a", { keepCreatedAt: isoDaysAgo(60) });
      recordCompleted(dir, "b", { keepCreatedAt: isoDaysAgo(60) });

      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: true });
      expect(report.dry_run).toBe(true);
      expect(report.eligible).toBe(2);
      expect(report.deleted).toBe(0);
      expect(keep.trashedIds).toEqual([]);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("apply actually deletes eligible notes only", async () => {
    const dir = indexDir();

    try {
      const nOld = trashableNote("old");
      const nRecent = trashableNote("recent");
      const keep = new FakeKeep([nOld, nRecent]);
      recordCompleted(dir, "old", { keepCreatedAt: isoDaysAgo(60) });
      recordCompleted(dir, "recent", { keepCreatedAt: isoDaysAgo(5) });

      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: false });
      expect(report.deleted).toBe(1);
      expect(report.eligible).toBe(1);
      expect(report.skipped_recent).toBe(1);
      expect(nOld.trashed).toBe(true);
      expect(nRecent.trashed).toBe(false);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("age threshold respected", async () => {
    const dir = indexDir();

    try {
      const keep = new FakeKeep([plainNote("a"), plainNote("b"), plainNote("c")]);
      recordCompleted(dir, "a", { keepCreatedAt: isoDaysAgo(10) });
      recordCompleted(dir, "b", { keepCreatedAt: isoDaysAgo(29) });
      recordCompleted(dir, "c", { keepCreatedAt: isoDaysAgo(31) });
      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: true });
      expect(report.eligible).toBe(1);
      expect(report.eligible_ids).toEqual(["c"]);
      expect(report.skipped_recent).toBe(2);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("pinned notes skipped", async () => {
    const dir = indexDir();

    try {
      const keep = new FakeKeep([plainNote("pinned", { pinned: true })]);
      recordCompleted(dir, "pinned", { keepCreatedAt: isoDaysAgo(60) });
      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: true });
      expect(report.eligible).toBe(0);
      expect(report.skipped_pinned).toBe(1);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("uncaptured notes skipped", async () => {
    const dir = indexDir();

    try {
      const keep = new FakeKeep([plainNote("not_imported")]);
      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: true });
      expect(report.eligible).toBe(0);
      expect(report.skipped_uncaptured).toBe(1);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("notes without age data grandfathered", async () => {
    const dir = indexDir();

    try {
      const keep = new FakeKeep([plainNote("no_age")]);
      recordCompleted(dir, "no_age");
      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: true });
      expect(report.eligible).toBe(0);
      expect(report.skipped_grandfathered).toBe(1);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("trashed and archived skipped", async () => {
    const dir = indexDir();

    try {
      const keep = new FakeKeep([
        plainNote("trashed", { trashed: true }),
        plainNote("archived", { archived: true }),
      ]);

      recordCompleted(dir, "trashed", { keepCreatedAt: isoDaysAgo(60) });
      recordCompleted(dir, "archived", { keepCreatedAt: isoDaysAgo(60) });
      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: true });
      expect(report.skipped_trashed).toBe(1);
      expect(report.skipped_archived).toBe(1);
      expect(report.eligible).toBe(0);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("apply never deletes an uncaptured note", async () => {
    const dir = indexDir();

    try {
      const n = trashableNote("never_imported");
      const keep = new FakeKeep([n]);
      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: false });
      expect(report.deleted).toBe(0);
      expect(report.eligible).toBe(0);
      expect(report.skipped_uncaptured).toBe(1);
      expect(n.trashed).toBe(false);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("apply never deletes a recent uncaptured note (double-skip)", async () => {
    const dir = indexDir();

    try {
      const n = trashableNote("fresh_uncaptured");
      const keep = new FakeKeep([n]);
      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: false });
      expect(n.trashed).toBe(false);
      expect(report.skipped_uncaptured).toBe(1);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("deletions recorded in state file", async () => {
    const dir = indexDir();

    try {
      const n = trashableNote("a");
      const keep = new FakeKeep([n]);
      recordCompleted(dir, "a", { keepCreatedAt: isoDaysAgo(60) });
      await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: false });
      const state = readState(dir);
      expect("a" in state.swept).toBe(true);
      expect(state.swept.a.age_days_at_delete).toBeGreaterThanOrEqual(60);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("dry run does not write state file", async () => {
    const dir = indexDir();

    try {
      const keep = new FakeKeep([plainNote("a")]);
      recordCompleted(dir, "a", { keepCreatedAt: isoDaysAgo(60) });
      await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: true });
      expect(existsSync(join(operationalDir(dir), SWEEP_STATE))).toBe(false);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("render says DRY RUN explicitly", async () => {
    const dir = indexDir();

    try {
      const keep = new FakeKeep([plainNote("a")]);
      recordCompleted(dir, "a", { keepCreatedAt: isoDaysAgo(60) });
      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: true });
      const line = renderSweepReport(report);
      expect(line).toContain("DRY RUN");
      expect(line).toContain("eligible 1");
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("sync success records swept and deleted", async () => {
    const dir = indexDir();

    try {
      const n = trashableNote("a");
      const keep = new FakeKeep([n]);
      recordCompleted(dir, "a", { keepCreatedAt: isoDaysAgo(60) });

      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: false });
      expect(report.deleted).toBe(1);
      expect(report.eligible).toBe(1);
      expect(n.trashed).toBe(true);
      const state = readState(dir);
      expect("a" in state.swept).toBe(true);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("sync failure records error, no swept/deleted", async () => {
    const dir = indexDir();

    try {
      const n = trashableNote("a");
      const keep = new FakeKeep([n]);
      keep.setSyncFail(true);
      recordCompleted(dir, "a", { keepCreatedAt: isoDaysAgo(60) });

      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: false });
      expect(report.deleted).toBe(0);
      expect(report.eligible).toBe(1);
      expect(report.errors.length).toBe(1);
      expect(report.errors[0]).toContain("sync failed");
      expect(n.trashed).toBe(true);
      const state = readState(dir);
      expect("a" in state.swept).toBe(false);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("batch sync called exactly once for multiple notes", async () => {
    const dir = indexDir();

    try {
      const a = trashableNote("a");
      const b = trashableNote("b");
      const keep = new FakeKeep([a, b]);
      recordCompleted(dir, "a", { keepCreatedAt: isoDaysAgo(60) });
      recordCompleted(dir, "b", { keepCreatedAt: isoDaysAgo(60) });

      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: false });
      expect(keep.syncCalls).toBe(1);
      expect(report.deleted).toBe(2);
      const state = readState(dir);
      expect(new Set(["a", "b"])).toEqual(
        new Set(Object.keys(state.swept).filter((k) => k === "a" || k === "b")),
      );
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("first sync failure never reports a hidden deletion", async () => {
    const dir = indexDir();

    try {
      const a = trashableNote("a");
      const b = trashableNote("b");
      const keep = new FakeKeep([a, b]);
      keep.failFirstSyncs(1);
      recordCompleted(dir, "a", { keepCreatedAt: isoDaysAgo(60) });
      recordCompleted(dir, "b", { keepCreatedAt: isoDaysAgo(60) });

      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: false });
      expect(keep.syncCalls).toBe(1);
      expect(report.deleted).toBe(0);
      expect(report.errors.length).toBe(1);
      const state = readState(dir);
      expect(Object.keys(state.swept)).toEqual([]);
    } finally {
      rmTmp(dirname(dir));
    }
  });
});

describe("sweep safety (K3)", () => {
  test("a note edited after completion is skipped, not trashed", async () => {
    const dir = indexDir();

    try {
      const edited = trashableNote("edited-note");

      edited.timestamps = {
        created: new Date(Date.now() - 90 * 86_400_000),
        edited: new Date(Date.now() + 3_600_000),
      };
      const keep = new FakeKeep([edited]);
      recordCompleted(dir, "edited-note", { keepCreatedAt: isoDaysAgo(60) });

      const report = await sweepOldUnpinned(keep, dir, { ageDays: 30, dryRun: false });

      expect(report.eligible).toBe(0);
      expect(report.deleted).toBe(0);
      expect(report.skipped_edited).toBe(1);
      expect(edited.trashed).toBe(false);
      expect("edited-note" in readState(dir).swept).toBe(false);
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("renderSweepReport discloses the edited skip", async () => {
    const dir = indexDir();

    try {
      const edited = trashableNote("edited-note");

      edited.timestamps = {
        created: new Date(Date.now() - 90 * 86_400_000),
        edited: new Date(Date.now() + 3_600_000),
      };
      recordCompleted(dir, "edited-note", { keepCreatedAt: isoDaysAgo(60) });

      const report = await sweepOldUnpinned(new FakeKeep([edited]), dir, { ageDays: 30 });

      expect(renderSweepReport(report)).toContain("edited since capture 1");
    } finally {
      rmTmp(dirname(dir));
    }
  });

  test("the sweep cannot run while another Keep worker holds the lock", async () => {
    const root = mkTmp();

    try {
      mkdirSync(join(root, ".ledger"), { recursive: true });
      const holder = new Database(join(root, ".ledger", "keep-lock.db"));

      holder.exec("PRAGMA busy_timeout = 0; BEGIN IMMEDIATE");

      try {
        let ran = false;

        const outcome = await withKeepLock(root, async () => {
          ran = true;

          return "swept";
        });

        expect(ran).toBe(false);
        expect(outcome).toEqual({ busy: true });
      } finally {
        holder.close();
      }
    } finally {
      rmTmp(root);
    }
  });
});
