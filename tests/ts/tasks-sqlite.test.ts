import { afterEach, describe, expect, test } from "bun:test";
import type { SQLQueryBindings } from "bun:sqlite";
import { join } from "node:path";
import type { DB } from "../../src/pkms/db.ts";
import { connect } from "../../src/pkms/db.ts";
import { indexVault } from "../../src/pkms/indexer.ts";
import { nextActionPerNote, snoozedNotes, staleTasks, taskHash } from "../../src/pkms/tasks.ts";
import { makeVault, mkTmp, rmTmp, writeNote } from "./helpers.ts";
import { isoLocalDate } from "../../src/pkms/tasks.ts";

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) rmTmp(tmpDirs.pop()!);
});

function seed(
  conn: DB,
  opts: { state?: string; firstSeenDaysAgo?: number; text?: string } = {},
): void {
  const state = opts.state ?? "open";
  const text = opts.text ?? "old task";
  const h = taskHash(`[ ] ${text}`);

  const line =
    conn.query<{ c: number }, SQLQueryBindings[]>("SELECT COUNT(*) c FROM tasks").get()!.c + 1;

  conn
    .query("INSERT INTO tasks (note_path, line, text, done, state, hash) VALUES (?,?,?,?,?,?)")
    .run("projects/p.md", line, text, 0, state, h);
  const daysAgo = opts.firstSeenDaysAgo ?? 20;
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  conn
    .query("INSERT INTO task_seen (note_path, hash, first_seen) VALUES (?,?,?)")
    .run("projects/p.md", h, isoLocalDate(d));
}

function connFixture(): DB {
  const dir = mkTmp();
  tmpDirs.push(dir);

  return connect(join(dir, ".index"));
}

describe("test_tasks.py::test_stale_finds_old_open_tasks", () => {
  test("old open task is a reshape candidate", () => {
    const conn = connFixture();
    seed(conn, { firstSeenDaysAgo: 20 });
    const rows = staleTasks(conn);
    expect(rows.length).toBe(1);
    expect(rows[0].text).toBe("old task");
    conn.close();
  });
});

describe("test_tasks.py::test_fresh_and_boundary_tasks_are_not_stale", () => {
  test("13 days is fresh; exactly at the 14-day line is stale", () => {
    const conn = connFixture();
    seed(conn, { firstSeenDaysAgo: 13, text: "fresh" });
    expect(staleTasks(conn)).toEqual([]);
    seed(conn, { firstSeenDaysAgo: 14, text: "exactly at the line" });
    expect(staleTasks(conn).map((r) => r.text)).toEqual(["exactly at the line"]);
    conn.close();
  });
});

describe("test_tasks.py::test_only_open_tasks_reshape", () => {
  test("non-open states never reshape", () => {
    const conn = connFixture();

    for (const state of ["done", "stuck", "not-now", "paused", "iceboxed"]) {
      seed(conn, { state, text: `${state} task` });
    }

    expect(staleTasks(conn)).toEqual([]);
    conn.close();
  });
});

describe("test_today.py::test_one_next_action_per_note_projects_first", () => {
  test("one OPEN task per note, projects first, inbox excluded", () => {
    const { vault, indexDir } = makeVault();
    writeNote(join(vault, "inbox", "raw.md"), "- [ ] raw unfolded task\n", { title: "Capture" });
    indexVault(vault, indexDir);
    const conn = connect(indexDir);
    const rows = nextActionPerNote(conn);
    const notes = rows.map((r) => r.note_path);
    expect(notes.length).toBe(new Set(notes).size);
    expect(notes[0]!.startsWith("projects")).toBe(true);
    const textFor = new Map(rows.map((r) => [r.note_path, r.text]));
    expect(textFor.get("projects/alpha.md")).toBe("open task one");
    expect(notes.some((n) => n.startsWith("inbox"))).toBe(false);
    conn.close();
  });
});

describe("test_today_snoozed.py::test_today_view_reports_snoozed_section_by_default", () => {
  test("not-now-only notes snooze; notes with an open task stay active", () => {
    const { vault, indexDir } = makeVault();
    writeNote(join(vault, "projects", "snoozer.md"), "- [~] parked for later, not now\n", {
      title: "Snoozer Project",
    });
    indexVault(vault, indexDir);
    const conn = connect(indexDir);
    const snoozed = new Set(snoozedNotes(conn).map((r) => r.note_path));
    expect(snoozed).toEqual(new Set(["projects/snoozer.md"]));
    expect(snoozed.has("projects/alpha.md")).toBe(false);
    conn.close();
  });
});
