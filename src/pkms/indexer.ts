import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { SQLQueryBindings } from "bun:sqlite";
import { z } from "zod";
import * as yaml from "js-yaml";
import { connect, FTS_TRIGGERS } from "./db.ts";
import { detectSourceFeedback } from "./events.ts";
import { extractLinks } from "./linker.ts";
import { extractTasks, isoLocalDate } from "./tasks.ts";
import { PY_WS, pyStrip } from "./textio.ts";

const FM_BOUNDARY = new RegExp(`^-{3,}[${PY_WS}]*$`, "gm");

const FrontmatterValueSchema: z.ZodType<FrontmatterValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().or(z.nan()),
    z.boolean(),
    z.null(),
    z.array(FrontmatterValueSchema),
    z.record(z.string(), FrontmatterValueSchema),
  ]),
);

export const FrontmatterSchema = z.record(z.string(), FrontmatterValueSchema);

const FrontmatterBooleanSchema = z.boolean();

const FrontmatterNumberSchema = z.number().or(z.nan());

const FrontmatterStringSchema = z.string();

export type FrontmatterValue =
  | string
  | number
  | boolean
  | null
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

function parseYaml(s: string): Frontmatter {
  const parsed: unknown = yaml.load(s, { schema: yaml.CORE_SCHEMA, json: true });
  const result = FrontmatterSchema.safeParse(parsed);

  return result.success ? result.data : {};
}

export function loadPost(text: string) {
  const stripped = pyStrip(text);
  const strippedOffset = stripped ? text.indexOf(stripped) : text.length;
  const body = stripped.startsWith("\ufeff") ? stripped.slice(1) : stripped;
  const matches = [...body.matchAll(FM_BOUNDARY)];

  if (matches.length < 2 || matches[0]!.index !== 0) {
    return { data: {}, content: stripped, contentOffset: strippedOffset };
  }

  const first = matches[0]!;
  const second = matches[1]!;
  const fm = body.slice(first.index! + first[0].length, second.index!);
  const rawContent = body.slice(second.index! + second[0].length);

  const content = pyStrip(rawContent);

  const contentOffset =
    strippedOffset +
    (stripped.startsWith("\ufeff") ? 1 : 0) +
    second.index! +
    second[0].length +
    (content ? rawContent.indexOf(content) : rawContent.length);

  return { data: parseYaml(fm), content, contentOffset };
}

function nowIso(): string {
  const d = new Date();
  const ms = String(d.getMilliseconds()).padStart(3, "0");

  return `${d.toISOString().slice(0, 19)}.${ms}000+00:00`;
}

function jsonEscape(s: string): string {
  let out = '"';

  for (const ch of s) {
    const c = ch.codePointAt(0)!;

    if (c === 0x22) out += '\\"';
    else if (c === 0x5c) out += "\\\\";
    else if (c === 0x08) out += "\\b";
    else if (c === 0x09) out += "\\t";
    else if (c === 0x0a) out += "\\n";
    else if (c === 0x0c) out += "\\f";
    else if (c === 0x0d) out += "\\r";
    else if (c < 0x20) out += `\\u${c.toString(16).padStart(4, "0")}`;
    else if (c < 0x7f) out += ch;
    else if (c <= 0xffff) out += `\\u${c.toString(16).padStart(4, "0")}`;
    else {
      const hi = 0xd800 + ((c - 0x10000) >> 10);
      const lo = 0xdc00 + ((c - 0x10000) & 0x3ff);
      out += `\\u${hi.toString(16).padStart(4, "0")}\\u${lo.toString(16).padStart(4, "0")}`;
    }
  }

  return out + '"';
}

function jsonDumps(v: FrontmatterValue): string {
  if (v === null) return "null";

  const boolean = FrontmatterBooleanSchema.safeParse(v);

  if (boolean.success) return boolean.data ? "true" : "false";

  const number = FrontmatterNumberSchema.safeParse(v);

  if (number.success) return String(number.data);

  const string = FrontmatterStringSchema.safeParse(v);

  if (string.success) return jsonEscape(string.data);

  if (Array.isArray(v)) return `[${v.map(jsonDumps).join(", ")}]`;
  const parts: string[] = [];

  for (const [k, val] of Object.entries(v)) {
    parts.push(`${jsonEscape(k)}: ${jsonDumps(val)}`);
  }

  return `{${parts.join(", ")}}`;
}

const UTF8_FATAL = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function decodeFatal(path: string): string {
  const text = UTF8_FATAL.decode(readFileSync(path));

  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function walkMdFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop()!;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) out.push(full);
    }
  }

  return out.sort();
}

function stemOf(path: string): string {
  return basename(path).replace(/\.md$/i, "");
}

export interface IndexStats {
  notes: number;
  links: number;
  tasks: number;
}

export function indexVault(
  vaultRoot: string,
  indexDir: string,
  opts: { verbose?: boolean } = {},
): IndexStats {
  const verbose = opts.verbose ?? false;
  const db = connect(indexDir);
  const stats: IndexStats = { notes: 0, links: 0, tasks: 0 };
  const seen = new Set<string>();
  const routedSources: string[] = [];
  const today = isoLocalDate(new Date());

  const insertNote = db.query(
    `INSERT INTO notes (path, title, created, modified, tags, content, indexed_at, source_hash)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(path) DO UPDATE SET
       title=excluded.title, created=excluded.created,
       modified=excluded.modified, tags=excluded.tags,
       content=excluded.content, indexed_at=excluded.indexed_at, source_hash=excluded.source_hash`,
  );

  const deleteLinks = db.query("DELETE FROM links WHERE source=?");
  const insertLink = db.query("INSERT OR IGNORE INTO links (source, target) VALUES (?,?)");
  const deleteTasks = db.query("DELETE FROM tasks WHERE note_path=?");

  const insertTask = db.query(
    `INSERT OR IGNORE INTO tasks
       (note_path, line, text, done, state, size, first_action, done_when, hash)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  );

  const insertSeen = db.query(
    "INSERT OR IGNORE INTO task_seen (note_path, hash, first_seen) VALUES (?,?,?)",
  );

  const run = db.transaction((): void => {
    db.exec(
      "DROP TRIGGER IF EXISTS notes_ai; DROP TRIGGER IF EXISTS notes_ad; DROP TRIGGER IF EXISTS notes_au",
    );
    db.exec("DELETE FROM source_routes");
    const insertSourceRoute = db.query("INSERT INTO source_routes (path, route) VALUES (?, ?)");

    for (const mdPath of walkMdFiles(vaultRoot)) {
      const rel = relative(vaultRoot, mdPath).replace(/\\/g, "/");
      let post: { data: Frontmatter; content: string };
      let sourceHash: string;

      try {
        const raw = decodeFatal(mdPath);
        post = loadPost(raw);
        sourceHash = createHash("sha256").update(raw).digest("hex");
      } catch {
        console.log(`  skipped (unreadable): ${rel}`);
        seen.add(rel);
        continue;
      }

      seen.add(rel);
      const content = post.content;
      const meta = post.data;
      const isSource = rel.startsWith("sources/");
      const route = meta.route === "routed" ? "routed" : "pending";

      if (isSource) {
        insertSourceRoute.run(rel, route);

        if (route === "routed") routedSources.push(rel);
      }

      const title = String(meta.title || stemOf(mdPath));
      const tags = jsonDumps(meta.tags || []);
      const created = meta.created === null ? "None" : String(meta.created ?? "");
      const modified = meta.modified === null ? "None" : String(meta.modified ?? "");

      insertNote.run(
        rel,
        title,
        created,
        modified,
        tags,
        content.startsWith("\ufeff") ? "\ufeff" + content : content,
        nowIso(),
        sourceHash,
      );

      deleteLinks.run(rel);

      for (const target of extractLinks(content)) {
        insertLink.run(rel, target);
        stats.links += 1;
      }

      deleteTasks.run(rel);

      for (const t of isSource && route !== "routed" ? [] : extractTasks(content)) {
        insertTask.run(
          rel,
          t.line,
          t.text,
          t.done ? 1 : 0,
          t.state,
          t.size,
          t.first_action,
          t.done_when,
          t.hash,
        );
        insertSeen.run(rel, t.hash, today);
        stats.tasks += 1;
      }

      stats.notes += 1;

      if (verbose) console.log(`  indexed ${rel}`);
    }

    const allNotes = db.query<{ path: string }, SQLQueryBindings[]>("SELECT path FROM notes").all();

    for (const row of allNotes) {
      if (!seen.has(row.path)) {
        db.query("DELETE FROM notes WHERE path=?").run(row.path);
        deleteLinks.run(row.path);
        deleteTasks.run(row.path);

        if (verbose) console.log(`  removed ${row.path}`);
      }
    }

    db.exec("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')");
    db.exec(FTS_TRIGGERS);
  });

  run();

  db.close();
  detectSourceFeedback(dirname(resolve(vaultRoot)), vaultRoot, routedSources);

  return stats;
}
