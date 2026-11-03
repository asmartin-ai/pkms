import { createHash } from "node:crypto";
import type { DB } from "./db.ts";
import type { SQLQueryBindings } from "bun:sqlite";
import { pyStrip } from "./textio.ts";

export type TaskState = "open" | "done" | "stuck" | "not-now" | "paused" | "iceboxed";

type TaskMarker = " " | "x" | "?" | "~" | "p" | "i";

export const TASK_STATE_BY_MARKER: Record<TaskMarker, TaskState> = {
  " ": "open",
  x: "done",
  "?": "stuck",
  "~": "not-now",
  p: "paused",
  i: "iceboxed",
};

export const TASK_RE = /^- \[([ x?~pi])\] (.+)$/gm;

const TASK_METADATA_DELIMITER = /([⏱▶✓])/;

const WAKE_RE = /\(wake:\s*([^)]+)\)/;

export const STALE_TASK_DAYS = 14;

export interface Task {
  state: TaskState;
  done: boolean;
  text: string;
  line: number;
  hash: string;
  size: string | null;
  first_action: string | null;
  done_when: string | null;
  wake: string | null;
}

export function taskHash(rawLine: string): string {
  return createHash("sha1").update(pyStrip(rawLine), "utf8").digest("hex").slice(0, 16);
}

type TaskMetadata = Pick<Task, "size" | "first_action" | "done_when">;

function splitMeta(raw: string): [string, TaskMetadata] {
  const parts = raw.split(TASK_METADATA_DELIMITER);
  const meta: TaskMetadata = { size: null, first_action: null, done_when: null };

  for (let i = 1; i + 1 < parts.length; i += 2) {
    const token = parts[i];
    const value = pyStrip(parts[i + 1] ?? "");

    if (!value) continue;

    switch (token) {
      case "⏱":
        meta.size = value;
        break;
      case "▶":
        meta.first_action = value;
        break;
      case "✓":
        meta.done_when = value;
        break;
    }
  }

  return [pyStrip(parts[0]!), meta];
}

function isTaskMarker(marker: string | undefined): marker is TaskMarker {
  return marker !== undefined && marker in TASK_STATE_BY_MARKER;
}

export function extractTasks(content: string): Task[] {
  const out: Task[] = [];

  for (const m of content.matchAll(TASK_RE)) {
    const marker = m[1];

    if (!isTaskMarker(marker)) continue;
    const state = TASK_STATE_BY_MARKER[marker];

    const raw = pyStrip(m[2] ?? "");
    let wake: string | null = null;

    if (state === "paused") {
      const wm = raw.match(WAKE_RE);

      if (wm) wake = pyStrip(wm[1] ?? "");
    }

    const [text, meta] = splitMeta(raw);
    const line = content.slice(0, m.index).split("\n").length;
    out.push({
      state,
      done: state === "done",
      text,
      line,
      hash: taskHash(`[${marker}] ${raw}`),
      ...meta,
      wake,
    });
  }

  return out;
}

export interface StaleRow {
  note_path: string;
  title: string | null;
  text: string;
  size: string | null;
  first_action: string | null;
  first_seen: string;
}

export function isoLocalDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${d.getFullYear()}-${m}-${day}`;
}

export function staleTasks(db: DB, opts: { days?: number; today?: Date } = {}): StaleRow[] {
  const days = opts.days ?? STALE_TASK_DAYS;
  const today = opts.today ?? new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  const cutoffIso = isoLocalDate(cutoff);

  return db
    .query<StaleRow, SQLQueryBindings[]>(
      `SELECT t.note_path, n.title, t.text, t.size, t.first_action, s.first_seen
       FROM tasks t
       JOIN task_seen s ON s.note_path = t.note_path AND s.hash = t.hash
       LEFT JOIN notes n ON n.path = t.note_path
       WHERE t.state = 'open' AND s.first_seen <= ?
       ORDER BY s.first_seen`,
    )
    .all(cutoffIso);
}

export interface NextActionRow {
  note_path: string;
  title: string | null;
  text: string;
  size: string | null;
  first_action: string | null;
  state: string;
  "MIN(t.line)": number;
}

export function nextActionPerNote(db: DB): NextActionRow[] {
  return db
    .query<NextActionRow, SQLQueryBindings[]>(
      `SELECT t.note_path, n.title, t.text, t.size, t.first_action, t.state, MIN(t.line)
       FROM tasks t LEFT JOIN notes n ON n.path = t.note_path
       WHERE t.state='open' AND t.note_path NOT LIKE 'inbox%'
       GROUP BY t.note_path
       ORDER BY CASE WHEN t.note_path LIKE 'projects%' THEN 0 ELSE 1 END, t.note_path`,
    )
    .all();
}

export interface SnoozedRow {
  note_path: string;
  title: string | null;
}

export function snoozedNotes(db: DB): SnoozedRow[] {
  return db
    .query<SnoozedRow, SQLQueryBindings[]>(
      `SELECT t.note_path, n.title
       FROM tasks t LEFT JOIN notes n ON n.path = t.note_path
       WHERE t.state = 'not-now' AND t.note_path NOT LIKE 'inbox%'
         AND t.note_path NOT IN (
             SELECT note_path FROM tasks
             WHERE state = 'open' AND note_path NOT LIKE 'inbox%'
         )
       GROUP BY t.note_path
       ORDER BY t.note_path`,
    )
    .all();
}
