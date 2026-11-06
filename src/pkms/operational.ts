import { Database, type SQLQueryBindings } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const OPERATIONAL_FILES = [
  "ch-promote-ledger.txt",
  "discord-ledger.txt",
  "whatsapp-ledger.txt",
  "whatsapp-cursor.txt",
  "whatsapp-instinct-notes.txt",
  "keep-ledger.txt",
  "keep-takeout-ledger.txt",
  "keep-state.json",
  "keep-sweep.json",
] as const;

export const OPERATIONAL_TABLES = [
  {
    name: "task_seen",
    columns: ["note_path", "hash", "first_seen"],
    keys: ["note_path", "hash"],
    definition:
      "note_path TEXT NOT NULL, hash TEXT NOT NULL, first_seen TEXT NOT NULL, PRIMARY KEY (note_path, hash)",
  },
  {
    name: "resurface_offers",
    columns: ["path", "offer_count", "rest_until"],
    keys: ["path"],
    definition:
      "path TEXT PRIMARY KEY, offer_count INTEGER NOT NULL DEFAULT 0, rest_until TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "keep_completed",
    columns: ["id", "completed_at", "source", "keep_created_at", "pinned"],
    keys: ["id"],
    definition:
      "id TEXT PRIMARY KEY, completed_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'live', keep_created_at TEXT, pinned INTEGER NOT NULL DEFAULT 0",
  },
] as const;

export function operationalPath(indexDir: string): string {
  return join(dirname(resolve(indexDir)), ".ledger");
}

export function operationalDir(indexDir: string): string {
  for (const name of OPERATIONAL_FILES) {
    if (existsSync(join(indexDir, name))) {
      throw new Error(
        "Operational state remains in the index. Stop PKMS writers and run pkms migrate-durable-state before continuing.",
      );
    }
  }

  return operationalPath(indexDir);
}

export function hasTable(db: Database, name: string): boolean {
  return (
    db
      .query<{ name: string }, SQLQueryBindings[]>(
        "SELECT name FROM main.sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(name) !== null
  );
}

export function attachOperational(db: Database, indexDir: string): void {
  for (const table of OPERATIONAL_TABLES) {
    if (hasTable(db, table.name)) {
      throw new Error(
        "Operational tables remain in the index. Stop PKMS writers and run pkms migrate-durable-state before continuing.",
      );
    }
  }

  const directory = operationalDir(indexDir);
  mkdirSync(directory, { recursive: true });
  db.run("ATTACH DATABASE ? AS operational", [join(directory, "state.db")]);
  db.exec("PRAGMA operational.journal_mode = WAL");

  for (const table of OPERATIONAL_TABLES) {
    db.exec(`CREATE TABLE IF NOT EXISTS operational.${table.name} (${table.definition})`);
  }
}
