import { Database, type SQLQueryBindings } from "bun:sqlite";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { isoLocalDate } from "./tasks.ts";

const JsonSchema = z.json();

export type JsonValue = z.infer<typeof JsonSchema>;

const MetadataSchema = z
  .object({
    subreddit: z.string().nullable().optional(),
    permalink: z.string().nullable().optional(),
  })
  .passthrough();

const EexistErrorSchema = z.object({ code: z.literal("EEXIST") });

const ListingSchema = z
  .object({
    data: z.object({ children: z.array(JsonSchema) }).passthrough(),
  })
  .passthrough();

const RedditNodeSchema = z
  .object({
    kind: z.string(),
    data: z
      .object({
        author: z.string().nullable().optional(),
        body: z.string().nullable().optional(),
        count: z.number().nullable().optional(),
        replies: JsonSchema.optional(),
        score: z.number().nullable().optional(),
        selftext: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

type RedditNode = z.infer<typeof RedditNodeSchema>;

const StatsSchema = z.object({
  shown: z.number(),
  omitted: z.number(),
});

type Stats = z.infer<typeof StatsSchema>;

const FetchRowSchema = z.object({
  title: z.string().nullable(),
  author: z.string().nullable(),
  url: z.string().nullable(),
  created_utc: z.number().nullable(),
  saved_utc: z.number().nullable(),
  metadata: z.string().nullable(),
  thread_json: z.string(),
});

const SearchRowSchema = z.object({
  fullname: z.string(),
  title: z.string().nullable(),
  saved_utc: z.number().nullable(),
  metadata: z.string().nullable(),
});

function defaultHoarderDb(): string {
  const override = process.env.PKMS_HOARDER_DB;

  if (override) return override;

  return resolve(import.meta.dir, "..", "..", "..", "content-hoarder", "data", "app.db");
}

export const HOARDER_DB = defaultHoarderDb();

export const READING_DIR = ["resources", "reading"] as const;

export const WPM = 200;

export const MAX_COMMENTS = 150;

export const MAX_DEPTH = 4;

const URL_ID_RE = /(?:redd\.it|reddit\.com)\/(?:r\/[^/]+\/comments\/|comments\/)?([a-z0-9]{5,9})/i;

const BARE_ID_RE = /^(?:t3_)?([a-z0-9]{5,9})$/i;

export function connectHoarder(dbPath: string = HOARDER_DB): Database {
  if (!existsSync(dbPath)) {
    throw new Error(`content-hoarder DB not found: ${dbPath}`);
  }

  return new Database(dbPath, { readonly: true });
}

export function extractPostId(query: string): string | null {
  if (query.includes("/") || query.includes(".")) {
    const id = URL_ID_RE.exec(query)?.[1];

    return id?.toLowerCase() ?? null;
  }

  const q = query.trim();
  const id = BARE_ID_RE.exec(q)?.[1];

  if (id && (q.toLowerCase().startsWith("t3_") || /[0-9]/.test(id))) {
    return id.toLowerCase();
  }

  return null;
}

export interface Thread {
  id: string;
  title: string | null;
  author: string | null;
  url: string | null;
  created_utc: number | null;
  saved_utc: number | null;
  subreddit: string | null;
  permalink: string | null;
  thread_json: JsonValue[];
}

export function fetchThread(conn: Database, postId: string): Thread | null {
  const row = conn
    .query<unknown, SQLQueryBindings[]>(
      `SELECT i.title, i.author, i.url, i.created_utc, i.saved_utc, i.metadata,
              rt.thread_json
       FROM reddit_threads rt JOIN items i ON i.fullname = rt.fullname
       WHERE rt.fullname = ?`,
    )
    .get(`reddit:t3_${postId}`);

  if (row === null) return null;
  const parsedRow = FetchRowSchema.parse(row);
  const meta = MetadataSchema.parse(JSON.parse(parsedRow.metadata || "{}"));

  return {
    id: postId,
    title: parsedRow.title,
    author: parsedRow.author,
    url: parsedRow.url,
    created_utc: parsedRow.created_utc,
    saved_utc: parsedRow.saved_utc,
    subreddit: meta.subreddit === undefined ? "" : meta.subreddit,
    permalink: meta.permalink === undefined ? parsedRow.url : meta.permalink,
    thread_json: z.array(JsonSchema).parse(JSON.parse(parsedRow.thread_json)),
  };
}

export interface PromoteCandidate {
  id: string;
  title: string | null;
  subreddit: string | null;
  saved: string;
}

export function searchThreads(conn: Database, terms: string, limit = 8): PromoteCandidate[] {
  const like = `%${terms}%`;

  const rows = conn
    .query<unknown, SQLQueryBindings[]>(
      `SELECT i.fullname, i.title, i.saved_utc, i.metadata
       FROM reddit_threads rt JOIN items i ON i.fullname = rt.fullname
       WHERE i.kind = 'post' AND (i.title LIKE ? OR i.search_text LIKE ?)
       ORDER BY i.saved_utc DESC LIMIT ?`,
    )
    .all(like, like, limit);

  const out: PromoteCandidate[] = [];

  for (const raw of rows) {
    const r = SearchRowSchema.parse(raw);
    const meta = MetadataSchema.parse(JSON.parse(r.metadata || "{}"));
    out.push({
      id: r.fullname.startsWith("reddit:t3_") ? r.fullname.slice("reddit:t3_".length) : r.fullname,
      title: r.title,
      subreddit: meta.subreddit === undefined ? "" : meta.subreddit,
      saved: day(r.saved_utc),
    });
  }

  return out;
}

function day(utc: number | null | undefined): string {
  if (!utc) return "";

  return new Date(utc * 1000).toISOString().slice(0, 10);
}

function asCount(x: number | null | undefined): number {
  return Math.trunc(x ?? 0) || 0;
}

function scoreOf(value: JsonValue): number {
  const node = RedditNodeSchema.parse(value);

  return node.data.score ?? 0;
}

function childrenOf(node: RedditNode): JsonValue[] {
  const listing = ListingSchema.safeParse(node.data.replies);

  return listing.success ? listing.data.data.children : [];
}

function isPyInt(x: number | null | undefined): boolean {
  return x !== null && x !== undefined && Number.isInteger(x);
}

function descendants(value: JsonValue): number {
  const node = RedditNodeSchema.parse(value);

  if (node.kind !== "t1") return asCount(node.data.count);

  return 1 + childrenOf(node).reduce<number>((sum, child) => sum + descendants(child), 0);
}

function commentLines(value: JsonValue, depth: number, lines: string[], stats: Stats): void {
  const node = RedditNodeSchema.parse(value);

  if (stats.shown >= MAX_COMMENTS || depth > MAX_DEPTH) {
    stats.omitted += 1 + descendants(value);

    return;
  }

  if (node.kind !== "t1") {
    stats.omitted += asCount(node.data.count);

    return;
  }

  const body = (node.data.body ?? "").trim();

  if (body === "[deleted]" || body === "[removed]" || body === "") {
  } else {
    stats.shown += 1;
    const q = "> ".repeat(depth);
    const pts = isPyInt(node.data.score) ? ` · ${node.data.score} pts` : "";
    lines.push(`${q}**u/${node.data.author ?? "?"}**${pts}`);

    for (const ln of body.split("\n")) {
      lines.push(`${q}${ln}`);
    }

    lines.push(depth ? q.trimEnd() : "");
  }

  const byScoreDesc = [...childrenOf(node)].sort((a, b) => scoreOf(b) - scoreOf(a));

  for (const child of byScoreDesc) {
    commentLines(child, depth + 1, lines, stats);
  }
}

function wordCount(s: string): number {
  const t = s.trim();

  return t === "" ? 0 : t.split(/\s+/).length;
}

function pyRound(x: number): number {
  const f = Math.floor(x);
  const frac = x - f;

  if (frac > 0.5) return f + 1;

  if (frac < 0.5) return f;

  return f % 2 === 0 ? f : f + 1;
}

function pyJsonDumps(s: string): string {
  let out = '"';

  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;

    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else if (code < 0x7f) out += ch;
    else if (code <= 0xffff) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else {
      const off = code - 0x10000;
      const hi = 0xd800 + (off >> 10);
      const lo = 0xdc00 + (off & 0x3ff);
      out += `\\u${hi.toString(16)}\\u${lo.toString(16)}`;
    }
  }

  return out + '"';
}

export function renderNote(thread: Thread, opts: { today?: string } = {}) {
  const today = opts.today ?? isoLocalDate(new Date());
  const listing = thread.thread_json;
  const post = RedditNodeSchema.parse(ListingSchema.parse(listing[0]).data.children[0]);

  const topComments = listing.length > 1 ? ListingSchema.parse(listing[1]).data.children : [];

  const bodyLines: string[] = [];
  const stats: Stats = { shown: 0, omitted: 0 };

  for (const child of [...topComments].sort((a, b) => scoreOf(b) - scoreOf(a))) {
    const before = bodyLines.length;
    commentLines(child, 0, bodyLines, stats);

    if (bodyLines.length > before) {
      bodyLines.push("---");
      bodyLines.push("");
    }
  }

  while (
    bodyLines.length > 0 &&
    (bodyLines[bodyLines.length - 1] === "" || bodyLines[bodyLines.length - 1] === "---")
  ) {
    bodyLines.pop();
  }

  const selftext = (post.data.selftext ?? "").trim();

  const words =
    wordCount(post.data.title ?? "") +
    wordCount(selftext) +
    bodyLines.reduce((s, ln) => s + wordCount(ln), 0);

  const minutes = Math.max(1, pyRound(words / WPM));

  let discussion = `## Discussion (${stats.shown} comments`;

  if (stats.omitted) {
    discussion += ` shown · ${stats.omitted} more in the [full thread](${thread.permalink})`;
  }

  discussion += ")";

  const postScore = post.data.score;

  const headBits = [
    thread.subreddit ? `r/${thread.subreddit}` : "",
    `u/${thread.author}`,
    isPyInt(postScore) ? `${postScore} pts` : "",
    `posted ${day(thread.created_utc)}`,
    `[thread](${thread.permalink})`,
    `~${minutes} min read`,
  ];

  const fm = [
    `title: ${pyJsonDumps(String(thread.title ?? ""))}`,
    `created: ${today}`,
    "tags: [reading, promoted]",
    "reading: queued",
    `reading_minutes: ${minutes}`,
    `source: ${thread.permalink}`,
    `subreddit: ${thread.subreddit}`,
    `author: ${thread.author}`,
    `posted: ${day(thread.created_utc)}`,
    `saved: ${day(thread.saved_utc)}`,
    `promoted: ${today}`,
  ];

  const note = [
    "---",
    ...fm.filter((ln) => !ln.endsWith(": ")),
    "---",
    "",
    `# ${thread.title}`,
    "",
    `*${headBits.filter((b) => b !== "").join(" · ")}*`,
    "",
    ...(selftext !== "" ? [selftext, ""] : thread.url ? [`Link post → ${thread.url}`, ""] : []),
    discussion,
    "",
    ...bodyLines,
    "",
  ].join("\n");

  return { note, minutes };
}

export function writeNote(note: string, title: string, vault: string): string {
  const reading = join(vault, ...READING_DIR);
  mkdirSync(reading, { recursive: true });

  const slug =
    title
      .slice(0, 60)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "thread";

  let path = join(reading, `${slug}.md`);
  let n = 1;

  for (;;) {
    try {
      writeFileSync(path, note, { encoding: "utf8", flag: "wx" });

      return path;
    } catch (error) {
      if (!EexistErrorSchema.safeParse(error).success) throw error;
      n += 1;
      path = join(reading, `${slug}-${n}.md`);
    }
  }
}

export interface PromoteResult {
  note?: string;
  minutes?: number;
  title?: string | null;
  candidates?: PromoteCandidate[];
  missing?: string;
}

export function promote(query: string, vault: string, dbPath?: string): PromoteResult {
  const conn = connectHoarder(dbPath || HOARDER_DB);

  try {
    const postId = extractPostId(query);

    if (postId === null) {
      return { candidates: searchThreads(conn, query) };
    }

    const thread = fetchThread(conn, postId);

    if (thread === null) {
      return { missing: postId };
    }

    const { note, minutes } = renderNote(thread);
    const path = writeNote(note, String(thread.title ?? ""), vault);

    return { note: path, minutes, title: thread.title };
  } finally {
    conn.close();
  }
}
