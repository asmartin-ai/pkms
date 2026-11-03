import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { Database, type Statement, type SQLQueryBindings } from "bun:sqlite";
import { z } from "zod";
import { loadPost } from "./indexer.ts";
import { listSources, readSource } from "./sources.ts";
import { readText } from "./textio.ts";

const EventPayloadSchema = z.record(z.string(), z.json());

type EventPayload = z.infer<typeof EventPayloadSchema>;

const SourceLinkSchema = z.object({ source_note: z.string().optional() });

export interface EmitInput {
  source: string;
  ref: string;
  payload?: EventPayload;
  at?: Date;
}

export interface LedgerEvent {
  id: number;
  ts: string;
  kind: string;
  source: string;
  ref: string;
  payload: EventPayload;
}

interface EventRow extends Omit<LedgerEvent, "payload"> {
  payload: string;
}

export interface ReadEventsOptions {
  since?: string;
  kind?: string;
  kinds?: string[];
  limit?: number;
  throwOnError?: boolean;
}

export function ledgerPath(root: string): string {
  return join(root, ".ledger", "events.db");
}

export function eventTs(now: Date = new Date()): string {
  return now.toISOString();
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  ref TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_kind_idx ON events(kind, id);
CREATE UNIQUE INDEX IF NOT EXISTS events_feedback_once ON events(ref)
  WHERE kind IN ('folded', 'dismissed');
`;

const preparedLedgers = new Set<string>();

interface LedgerHandle {
  db: Database;
  insert: Statement<Record<string, never>, SQLQueryBindings[]>;
}

const LEDGER_CACHE_MAX = 8;

const ledgers = new Map<string, LedgerHandle>();

function openLedger(path: string): LedgerHandle {
  if (!preparedLedgers.has(path)) mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);

  try {
    db.exec("PRAGMA busy_timeout = 5000");

    if (!preparedLedgers.has(path)) {
      db.exec(SCHEMA);
      preparedLedgers.add(path);
    }

    return {
      db,
      insert: db.query<Record<string, never>, SQLQueryBindings[]>(
        "INSERT OR IGNORE INTO events (ts, kind, source, ref, payload) VALUES (?, ?, ?, ?, ?)",
      ),
    };
  } catch (error) {
    db.close();
    throw error;
  }
}

function closeLedger(path: string): void {
  const handle = ledgers.get(path);

  if (handle === undefined) return;
  handle.db.close();
  ledgers.delete(path);
}

export function emit(root: string, kind: string, input: EmitInput): void {
  const path = ledgerPath(root);

  try {
    let handle = ledgers.get(path);

    if (handle !== undefined && !existsSync(path)) {
      closeLedger(path);
      preparedLedgers.delete(path);
      handle = undefined;
    }

    if (handle === undefined) {
      handle = openLedger(path);

      while (ledgers.size >= LEDGER_CACHE_MAX) {
        const oldest = ledgers.keys().next().value;

        if (oldest === undefined) break;
        closeLedger(oldest);
      }

      ledgers.set(path, handle);
    }

    handle.insert.run(
      eventTs(input.at),
      kind,
      input.source,
      input.ref,
      JSON.stringify(input.payload ?? {}),
    );
  } catch (error) {
    closeLedger(path);
    preparedLedgers.delete(path);
    console.error(`[ledger] ${kind}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function readEvents(root: string, opts: ReadEventsOptions = {}): LedgerEvent[] {
  if (!existsSync(ledgerPath(root))) return [];

  try {
    const db = new Database(ledgerPath(root), { readonly: true });

    try {
      db.exec("PRAGMA busy_timeout = 5000");
      const where: string[] = [];
      const bindings: (string | number)[] = [];

      if (opts.since !== undefined) {
        where.push("ts >= ?");
        bindings.push(new Date(opts.since).toISOString());
      }

      if (opts.kind !== undefined) {
        where.push("kind = ?");
        bindings.push(opts.kind);
      }

      if (opts.kinds?.length) {
        where.push(`kind IN (${opts.kinds.map(() => "?").join(", ")})`);
        bindings.push(...opts.kinds);
      }

      bindings.push(opts.limit ?? 500);

      const rows = db
        .query<EventRow, (string | number)[]>(
          `SELECT id, ts, kind, source, ref, payload FROM events${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`,
        )
        .all(...bindings);

      return rows.map((row) => ({
        ...row,
        payload: EventPayloadSchema.parse(JSON.parse(row.payload)),
      }));
    } finally {
      db.close();
    }
  } catch (error) {
    console.error(`[ledger] read: ${error instanceof Error ? error.message : String(error)}`);

    if (opts.throwOnError) throw error;

    return [];
  }
}

export function detectSourceFeedback(root: string, vault: string, routedPaths?: readonly string[]) {
  const folded: string[] = [];
  const dismissed: string[] = [];

  try {
    const routed =
      routedPaths === undefined
        ? listSources(vault, { route: "routed" })
        : routedPaths
            .flatMap((path) => {
              try {
                return [readSource(vault, path)];
              } catch {
                return [];
              }
            })
            .sort(
              (a, b) =>
                a.data.received_at.localeCompare(b.data.received_at) ||
                a.relativePath.localeCompare(b.relativePath),
            );

    const candidates = routed.filter(
      (item) => item.data.inbox_note && !existsSync(resolve(vault, item.data.inbox_note)),
    );

    if (!candidates.length) return { folded, dismissed };

    const reported = new Set(
      [
        ...readEvents(root, { kind: "folded", limit: -1 }),
        ...readEvents(root, { kind: "dismissed", limit: -1 }),
      ].map((event) => event.ref),
    );

    const wanted = new Set(
      candidates
        .filter((item) => !reported.has(item.relativePath))
        .map((item) => item.relativePath),
    );

    if (!wanted.size) return { folded, dismissed };

    const locations = new Map<string, string>();
    const stack = [resolve(vault)];

    while (stack.length) {
      const dir = stack.pop()!;

      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        const rel = relative(vault, path).replace(/\\/g, "/");

        if (rel === "sources") continue;

        if (entry.isDirectory()) stack.push(path);
        else if (entry.isFile() && entry.name.endsWith(".md")) {
          const linked = SourceLinkSchema.safeParse(loadPost(readText(path)).data);
          const sourceNote = linked.success ? linked.data.source_note : undefined;

          if (!sourceNote || !wanted.has(sourceNote)) continue;

          if (!locations.has(sourceNote) || rel.startsWith("inbox/"))
            locations.set(sourceNote, rel);
        }
      }
    }

    for (const item of candidates) {
      if (reported.has(item.relativePath)) continue;
      const path = locations.get(item.relativePath);

      if (path?.startsWith("inbox/")) continue;
      const kind = path ? "folded" : "dismissed";
      const payload: EventPayload = { source_note: item.relativePath };

      if (path) payload.path = path;
      emit(root, kind, {
        source: item.data.source,
        ref: item.relativePath,
        payload,
      });
      (path ? folded : dismissed).push(item.relativePath);
    }
  } catch (error) {
    console.error(`[ledger] feedback: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { folded, dismissed };
}
