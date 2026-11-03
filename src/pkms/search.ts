import { dirname, resolve } from "node:path";
import { connect } from "./db.ts";
import type { SQLQueryBindings } from "bun:sqlite";
import { emit } from "./events.ts";

const SQL = `SELECT n.path, n.title, snippet(notes_fts, 2, '[', ']', '…', 20) AS excerpt
          FROM notes_fts f
          JOIN notes n ON n.id = f.rowid
          WHERE notes_fts MATCH ?
          ORDER BY rank
          LIMIT ?`;

export interface SearchRow {
  path: string;
  title: string;
  excerpt: string;
}

export function sanitize(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replaceAll('"', '""')}"`)
    .join(" ");
}

export function stemOf(ref: string): string {
  const name = ref.split(/[\\/]/).pop() ?? "";

  return name.replace(/\.md$/i, "");
}

export function search(
  query: string,
  indexDir: string,
  opts: { limit?: number; raw?: boolean } = {},
): SearchRow[] {
  const { limit = 20, raw = false } = opts;

  if (!query.trim()) return [];
  const db = connect(indexDir);

  try {
    let rows: SearchRow[];

    if (raw) {
      try {
        rows = db.query<SearchRow, SQLQueryBindings[]>(SQL).all(query, limit);
      } catch {
        rows = db.query<SearchRow, SQLQueryBindings[]>(SQL).all(sanitize(query), limit);
      }
    } else {
      rows = db.query<SearchRow, SQLQueryBindings[]>(SQL).all(sanitize(query), limit);
    }

    emit(dirname(resolve(indexDir)), "search_executed", {
      source: "pkms",
      ref: query,
      payload: {
        query,
        hits: rows.length,
        has_source_hits: rows.some((row) => row.path.startsWith("sources/")),
      },
    });

    return rows;
  } finally {
    db.close();
  }
}

export function resolveNote(ref: string, indexDir: string): string | null {
  const path = ref.trim().replaceAll("\\", "/");
  const stem = stemOf(path);
  const db = connect(indexDir);

  try {
    const exact = db.query<{ path: string }, SQLQueryBindings[]>(
      "SELECT path FROM notes WHERE path = ? LIMIT 1",
    );

    for (const candidate of [path, `${path}.md`, `${stem}.md`]) {
      const row = exact.get(candidate);

      if (row) return row.path;
    }

    const escaped = stem.replaceAll("%", "\\%").replaceAll("_", "\\_");

    const row = db
      .query<{ path: string }, SQLQueryBindings[]>(
        "SELECT path FROM notes WHERE path LIKE ? ESCAPE '\\' ORDER BY LENGTH(path) LIMIT 1",
      )
      .get(`%/${escaped}.md`);

    return row ? row.path : null;
  } finally {
    db.close();
  }
}

export function backlinks(notePath: string, indexDir: string): string[] {
  const stem = stemOf(notePath);
  const db = connect(indexDir);

  try {
    const rows = db
      .query<{ source: string }, SQLQueryBindings[]>(
        "SELECT DISTINCT source FROM links WHERE target=? OR target=?",
      )
      .all(notePath, stem);

    return rows.map((r) => r.source);
  } finally {
    db.close();
  }
}
