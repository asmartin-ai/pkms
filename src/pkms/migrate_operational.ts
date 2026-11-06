import { Database, type SQLQueryBindings } from "bun:sqlite";
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { hasTable, OPERATIONAL_FILES, OPERATIONAL_TABLES, operationalPath } from "./operational.ts";

type StateRow = Record<string, string | number | null>;

type Table = (typeof OPERATIONAL_TABLES)[number];

export interface MigrationReport {
  applied: boolean;
  files: string[];
  rows: Record<string, number>;
  conflicts: string[];
}

function rowsFor(db: Database | null, table: Table): StateRow[] {
  if (db === null || !hasTable(db, table.name)) return [];

  const columns = new Set(
    db
      .query<{ name: string }, SQLQueryBindings[]>(`PRAGMA table_info(${table.name})`)
      .all()
      .map((row) => row.name),
  );

  const defaults: Record<string, string> =
    table.name === "keep_completed"
      ? { source: "'live'", keep_created_at: "NULL", pinned: "0" }
      : {};

  const selection = table.columns
    .map((column) => {
      if (columns.has(column)) return column;
      const fallback = defaults[column];

      if (fallback === undefined)
        throw new Error(`Unsupported legacy schema: ${table.name}.${column}`);

      return `${fallback} AS ${column}`;
    })
    .join(", ");

  return db.query<StateRow, SQLQueryBindings[]>(`SELECT ${selection} FROM ${table.name}`).all();
}

function matchingRow(db: Database | null, table: Table, row: StateRow): StateRow | null {
  if (db === null || !hasTable(db, table.name)) return null;

  return db
    .query<StateRow, SQLQueryBindings[]>(
      `SELECT ${table.columns.join(", ")} FROM ${table.name} WHERE ${table.keys.map((key) => `${key} = ?`).join(" AND ")}`,
    )
    .get(...table.keys.map((key) => row[key]!));
}

function sameRow(table: Table, left: StateRow, right: StateRow): boolean {
  return table.columns.every((column) => left[column] === right[column]);
}

export function migrateOperational(
  indexDir: string,
  { apply = false }: { apply?: boolean } = {},
): MigrationReport {
  const directory = operationalPath(indexDir);
  const sourcePath = join(indexDir, "pkms.db");
  const destinationPath = join(directory, "state.db");

  const source = existsSync(sourcePath)
    ? new Database(sourcePath, apply ? undefined : { readonly: true })
    : null;

  let destination = existsSync(destinationPath)
    ? new Database(destinationPath, apply ? undefined : { readonly: true })
    : null;

  const report: MigrationReport = { applied: false, files: [], rows: {}, conflicts: [] };
  let sourceLocked = false;

  try {
    if (apply && source !== null) {
      source.exec("PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE");
      sourceLocked = true;
    }

    const tables = OPERATIONAL_TABLES.map((table) => ({ table, rows: rowsFor(source, table) }));

    const files = OPERATIONAL_FILES.filter((name) => existsSync(join(indexDir, name))).map(
      (name) => ({ name, bytes: readFileSync(join(indexDir, name)) }),
    );

    report.files = files.map((file) => file.name);

    for (const file of files) {
      const target = join(directory, file.name);

      if (existsSync(target) && !file.bytes.equals(readFileSync(target)))
        report.conflicts.push(file.name);
    }

    for (const { table, rows } of tables) {
      report.rows[table.name] = rows.length;

      for (const row of rows) {
        const existing = matchingRow(destination, table, row);

        if (existing !== null && !sameRow(table, existing, row)) {
          report.conflicts.push(table.name);
          break;
        }
      }
    }

    if (!apply || report.conflicts.length > 0) return report;
    mkdirSync(directory, { recursive: true });
    destination ??= new Database(destinationPath);
    destination.exec("PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL");
    const target = destination;
    target.transaction(() => {
      for (const { table, rows } of tables) {
        target.exec(`CREATE TABLE IF NOT EXISTS ${table.name} (${table.definition})`);

        const insert = target.query(
          `INSERT OR IGNORE INTO ${table.name} (${table.columns.join(", ")}) VALUES (${table.columns.map(() => "?").join(", ")})`,
        );

        for (const row of rows) {
          const existing = matchingRow(target, table, row);

          if (existing !== null && !sameRow(table, existing, row))
            throw new Error(`State changed during migration: ${table.name}`);
          insert.run(...table.columns.map((column) => row[column]!));
        }
      }
    })();

    for (const file of files) {
      const original = join(indexDir, file.name);
      const copied = join(directory, file.name);

      if (!file.bytes.equals(readFileSync(original)))
        throw new Error(`State changed during migration: ${file.name}`);

      if (!existsSync(copied)) copyFileSync(original, copied, constants.COPYFILE_EXCL);

      if (!file.bytes.equals(readFileSync(copied)))
        throw new Error(`State copy verification failed: ${file.name}`);
    }

    for (const { table, rows } of tables) {
      for (const row of rows) {
        const copied = matchingRow(target, table, row);

        if (copied === null || !sameRow(table, copied, row))
          throw new Error(`State copy verification failed: ${table.name}`);
      }
    }

    for (const path of [
      ...files.map((file) => join(directory, file.name)),
      directory,
      dirname(directory),
    ]) {
      const fd = openSync(path, "r");

      try {
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    }

    for (const { table } of tables) source?.exec(`DROP TABLE IF EXISTS ${table.name}`);

    if (sourceLocked) {
      source!.exec("COMMIT");
      sourceLocked = false;
    }

    for (const file of files) {
      const original = join(indexDir, file.name);

      if (!file.bytes.equals(readFileSync(original)))
        throw new Error(`State changed during migration: ${file.name}`);
      unlinkSync(original);
    }

    report.applied = true;

    return report;
  } finally {
    if (sourceLocked) source!.exec("ROLLBACK");
    source?.close();
    destination?.close();
  }
}
