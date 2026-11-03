import { connect } from "./db.ts";
import { pyStrip } from "./textio.ts";
import { stemOf } from "./search.ts";
import type { SQLQueryBindings } from "bun:sqlite";

const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;

export function extractLinks(content: string): string[] {
  const out: string[] = [];

  for (const m of content.matchAll(WIKILINK_RE)) out.push(m[1]!);

  return out;
}

export interface Orphan {
  target: string;
  sources: string[];
}

export function findOrphans(indexDir: string): Orphan[] {
  const db = connect(indexDir);

  try {
    const stems = new Set<string>();

    for (const row of db
      .query<{ path: string }, SQLQueryBindings[]>("SELECT path FROM notes")
      .all()) {
      const stem = stemOf(row.path).toLowerCase();

      if (stem) stems.add(stem);
    }

    const targetToSources = new Map<string, Set<string>>();

    for (const row of db
      .query<{ source: string; target: string }, SQLQueryBindings[]>(
        "SELECT source, target FROM links",
      )
      .all()) {
      const target = pyStrip(row.target);
      let sources = targetToSources.get(target);

      if (!sources) {
        sources = new Set();
        targetToSources.set(target, sources);
      }

      sources.add(row.source);
    }

    const orphans: Orphan[] = [];

    for (const [target, sources] of targetToSources) {
      if (!stems.has(target.toLowerCase())) {
        orphans.push({ target, sources: [...sources].sort() });
      }
    }

    return orphans;
  } finally {
    db.close();
  }
}
