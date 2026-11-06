import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { z } from "zod";
import { frontmatterValue } from "./capture.ts";
import { loadPost } from "./indexer.ts";
import { append, load } from "./ledger.ts";
import { operationalDir } from "./operational.ts";
import { emit } from "./events.ts";
import { isoLocalDate } from "./tasks.ts";

const JsonSchema = z.json();

export type JsonValue = z.infer<typeof JsonSchema>;

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

export const READING_DIR = ["resources", "reading"] as const;

export const WPM = 200;

export const MAX_COMMENTS = 150;

export const MAX_DEPTH = 4;

const URL_ID_RE = /(?:redd\.it|reddit\.com)\/(?:r\/[^/]+\/comments\/|comments\/)?([a-z0-9]{5,9})/i;

const BARE_ID_RE = /^(?:t3_)?([a-z0-9]{5,9})$/i;

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

export const ThreadSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  author: z.string().nullable(),
  url: z.string().nullable(),
  created_utc: z.number().nullable(),
  saved_utc: z.number().nullable(),
  subreddit: z.string().nullable(),
  permalink: z.string().nullable(),
  thread_json: z.array(JsonSchema),
});

export type Thread = z.infer<typeof ThreadSchema>;

export const PromotionHandoffSchema = z
  .object({
    version: z.literal(1),
    delivery_id: z.string().regex(/^[a-f0-9]{64}$/),
    destination: z.enum(["inbox", "reading"]),
    ch_item_id: z.string().min(1),
    ch_origin_ref: z.string().min(1),
    ch_captured_at: z.string().min(1),
    text: z.string().trim().min(1),
    title: z.string().optional(),
    url: z.string().optional(),
    context: z.object({ device: z.string(), app: z.literal("content-hoarder") }),
    thread: ThreadSchema.optional(),
  })
  .refine((handoff) => handoff.destination !== "reading" || handoff.thread !== undefined, {
    message: "Reading promotion requires a cached thread",
  });

export type PromotionHandoff = z.infer<typeof PromotionHandoffSchema>;

export interface DeliveryResult {
  version: 1;
  state: "confirmed" | "duplicate" | "failed";
  delivery_id: string;
  note_path?: string;
  error?: string;
}

export const CH_PROMOTE_LEDGER = "ch-promote-ledger.txt";

export interface PromoteCandidate {
  id: string;
  title: string | null;
  subreddit: string | null;
  saved: string;
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

function existingPromotion(vault: string, handoff: PromotionHandoff): string | null {
  if (!existsSync(vault)) return null;
  const directories = [vault];

  while (directories.length > 0) {
    const directory = directories.pop()!;

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) directories.push(path);

      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const { data } = loadPost(readFileSync(path, "utf8"));

      if (data.promotion_delivery_id === handoff.delivery_id) return path;

      if (data.promotion_delivery_id !== undefined) continue;
      const destination = data.reading !== undefined ? "reading" : "inbox";

      if (destination !== handoff.destination) continue;

      if (data.ch_item_id === handoff.ch_item_id) return path;

      if (
        destination === "reading" &&
        handoff.thread?.permalink &&
        data.source === handoff.thread.permalink
      )
        return path;
    }
  }

  return null;
}

function writePromotion(path: string, text: string): boolean {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);

  try {
    writeFileSync(fd, text, "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }

  try {
    try {
      linkSync(temporary, path);
    } catch (error) {
      if (EexistErrorSchema.safeParse(error).success) return false;
      throw error;
    }

    const directoryFd = openSync(directory, "r");

    try {
      fsyncSync(directoryFd);
    } finally {
      closeSync(directoryFd);
    }

    return true;
  } finally {
    unlinkSync(temporary);
  }
}

export function receivePromotion(
  handoff: PromotionHandoff,
  vault: string,
  indexDir: string,
): DeliveryResult {
  const stateDir = operationalDir(indexDir);
  const ledger = load(stateDir, CH_PROMOTE_LEDGER);
  const result = { version: 1 as const, delivery_id: handoff.delivery_id };
  const existing = existingPromotion(vault, handoff);

  if (existing) {
    if (!ledger.has(handoff.delivery_id))
      append(stateDir, CH_PROMOTE_LEDGER, [handoff.delivery_id]);

    return { ...result, state: "duplicate", note_path: relative(vault, existing) };
  }

  if (
    ledger.has(handoff.delivery_id) ||
    (handoff.destination === "inbox" && ledger.has(handoff.ch_item_id))
  ) {
    return {
      ...result,
      state: "failed",
      error:
        "This delivery was recorded, but its note is no longer present. The note was not recreated.",
    };
  }

  const extra = {
    promotion_delivery_id: handoff.delivery_id,
    promotion_destination: handoff.destination,
    ch_item_id: handoff.ch_item_id,
    ch_origin_ref: handoff.ch_origin_ref,
    ch_captured_at: handoff.ch_captured_at,
    context_device: handoff.context.device,
    context_app: handoff.context.app,
  };

  const fields = Object.entries(extra)
    .map(([key, value]) => `${key}: ${frontmatterValue(value)}`)
    .join("\n");

  const body =
    handoff.destination === "reading"
      ? renderNote(ThreadSchema.parse(handoff.thread)).note
      : `---\ncaptured: ${new Date().toISOString()}\nsource: content-hoarder\n---\n\n${handoff.text}\n`;

  const content = `---\n${fields}\n${body.slice(4)}`;

  const directory =
    handoff.destination === "reading" ? join(vault, ...READING_DIR) : join(vault, "inbox");

  const path = join(directory, `ch-${handoff.delivery_id}.md`);
  const created = writePromotion(path, content);

  if (!created) {
    const { data } = loadPost(readFileSync(path, "utf8"));

    if (data.promotion_delivery_id !== handoff.delivery_id)
      throw new Error("Promotion filename is occupied by a different note");
  }

  append(stateDir, CH_PROMOTE_LEDGER, [handoff.delivery_id]);
  const notePath = relative(vault, path);

  if (created)
    emit(dirname(vault), "capture_written", {
      source: "content-hoarder",
      ref: notePath,
      payload: { path: notePath },
    });

  return { ...result, state: created ? "confirmed" : "duplicate", note_path: notePath };
}

export interface PromoteResult {
  note?: string;
  minutes?: number;
  title?: string | null;
  candidates?: PromoteCandidate[];
  missing?: string;
  error?: string;
}

const CandidatesSchema = z.object({
  version: z.literal(1),
  candidates: z.array(
    z.object({
      id: z.string(),
      title: z.string().nullable(),
      subreddit: z.string().nullable(),
      saved: z.string(),
    }),
  ),
});

export async function promote(
  query: string,
  vault: string,
  options: { indexDir?: string; baseUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<PromoteResult> {
  const base = (options.baseUrl ?? process.env.PKMS_HOARDER_URL ?? "http://127.0.0.1:8788").replace(
    /\/+$/,
    "",
  );

  const postId = extractPostId(query);

  const path =
    postId === null ? `?q=${encodeURIComponent(query)}` : `/${encodeURIComponent(postId)}`;

  const response = await (options.fetchImpl ?? fetch)(`${base}/api/promotion/threads${path}`, {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });

  if (postId !== null && response.status === 404) return { missing: postId };

  if (!response.ok)
    throw new Error(
      `Content Hoarder lookup failed (HTTP ${response.status}). Start the local app and check PKMS_HOARDER_URL.`,
    );

  if (postId === null)
    return { candidates: CandidatesSchema.parse(await response.json()).candidates };

  const payload = z
    .object({ version: z.literal(1), handoff: PromotionHandoffSchema })
    .parse(await response.json());

  if (payload.handoff.destination !== "reading" || payload.handoff.thread?.id !== postId)
    throw new Error("Content Hoarder returned a different promotion");

  const receipt = receivePromotion(
    payload.handoff,
    vault,
    options.indexDir ?? join(dirname(vault), ".index"),
  );

  if (receipt.state === "failed") return { error: receipt.error };

  return {
    note: join(vault, receipt.note_path!),
    minutes: renderNote(payload.handoff.thread).minutes,
    title: payload.handoff.thread.title,
  };
}
