import type { SQLQueryBindings } from "bun:sqlite";
import { z } from "zod";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { inboxCount } from "./capture.ts";
import { connect } from "./db.ts";
import { BREADCRUMB_HEADING, sectionLines } from "./daily.ts";
import { loadPost, type Frontmatter } from "./indexer.ts";
import { candidates, filterNever, markOffered, type Candidate } from "./resurface.ts";
import { stemOf } from "./search.ts";
import { extractTasks, isoLocalDate, nextActionPerNote, snoozedNotes } from "./tasks.ts";
import { readText } from "./textio.ts";

const NullableStringSchema = z.union([z.string(), z.null()]).optional().catch(undefined);

const NoteMetadataSchema = z.object({
  title: NullableStringSchema,
  reading: NullableStringSchema,
  reading_minutes: z.union([z.number(), z.null()]).optional().catch(undefined),
  promoted: NullableStringSchema,
  source: NullableStringSchema,
  captured: NullableStringSchema,
});

type NoteMetadata = z.infer<typeof NoteMetadataSchema>;

export const MAX_NOTES_SHOWN = 8;

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function displayText(text: string): string {
  return text.replace(WIKILINK_RE, (_m, target: string, label?: string) => label || target).trim();
}

function listMd(dir: string): string[] {
  try {
    if (!statSync(dir).isDirectory()) return [];
  } catch {
    return [];
  }

  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

function noteMetadata(data: Frontmatter): NoteMetadata {
  return NoteMetadataSchema.parse(data);
}

function metaStr(meta: NoteMetadata, key: "promoted" | "source" | "captured"): string {
  const value = meta[key];

  if (value === undefined) return "";

  if (value === null) return "None";

  return value;
}

function isoUtc(ms: number): string {
  return new Date(ms).toISOString().replace("Z", "000+00:00");
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export interface Breadcrumb {
  name: string;
  lines: string[];
}

function breadcrumb(vault: string, todayStem: string): Breadcrumb | null {
  const daily = join(vault, "daily");

  if (!isDir(daily)) return null;
  const notes = listMd(daily).reverse();

  for (const name of notes) {
    const lines = sectionLines(readText(join(daily, name)), BREADCRUMB_HEADING);

    if (lines.length > 0) return { name: stemOf(name), lines: lines.slice(0, 4) };
  }

  const prior = notes.filter((n) => stemOf(n) !== todayStem);

  if (prior.length === 0) return null;
  const last = prior[0]!;
  let lines = readText(join(daily, last)).split("\n");

  if (lines.length > 0 && lines[0]!.trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]!.trim() === "---") {
        lines = lines.slice(i + 1);
        break;
      }
    }
  }

  const body: string[] = [];

  for (const ln of lines) {
    const s = ln.trim();

    if (s && !s.startsWith("#") && !s.startsWith("<!--")) body.push(s);
  }

  return { name: stemOf(last), lines: body.slice(-3) };
}

export interface NextAction {
  note: string;
  title: string;
  text: string;
  size: string | null;
  first_action: string | null;
}

function nextActions(indexDir: string): NextAction[] {
  if (!existsSync(join(indexDir, "pkms.db"))) return [];
  const db = connect(indexDir);

  try {
    return nextActionPerNote(db).map((r) => ({
      note: r.note_path,
      title: r.title || stemOf(r.note_path),
      text: displayText(r.text),
      size: r.size,
      first_action: r.first_action,
    }));
  } finally {
    db.close();
  }
}

export interface SnoozedNote {
  note: string;
  title: string;
}

function snoozedNotesView(indexDir: string): SnoozedNote[] {
  if (!existsSync(join(indexDir, "pkms.db"))) return [];
  const db = connect(indexDir);

  try {
    return snoozedNotes(db).map((r) => ({
      note: r.note_path,
      title: r.title || stemOf(r.note_path),
    }));
  } finally {
    db.close();
  }
}

function doneToday(vault: string, todayStem: string): number {
  const path = join(vault, "daily", `${todayStem}.md`);

  if (!existsSync(path)) return 0;

  return extractTasks(readText(path)).filter((t) => t.done).length;
}

interface QueuedNote {
  meta: Pick<NoteMetadata, "title" | "reading_minutes" | "promoted">;
  stem: string;
  rel: string;
}

function queuedReading(vault: string): QueuedNote[] {
  const dir = join(vault, "resources", "reading");

  if (!isDir(dir)) return [];
  const out: QueuedNote[] = [];

  for (const name of listMd(dir)) {
    let data: Frontmatter;

    try {
      data = loadPost(readText(join(dir, name))).data;
    } catch {
      continue;
    }

    const metadata = noteMetadata(data);

    if (metadata.reading === "queued") {
      out.push({
        meta: {
          title: metadata.title,
          reading_minutes: metadata.reading_minutes,
          promoted: metadata.promoted,
        },
        stem: stemOf(name),
        rel: `resources/reading/${name}`,
      });
    }
  }

  return out;
}

function sortByPromoted<T extends { promoted: string }>(items: T[]): T[] {
  return items
    .slice()
    .sort((a, b) => (a.promoted < b.promoted ? -1 : a.promoted > b.promoted ? 1 : 0));
}

export interface NextRead {
  title: string;
  minutes: number | null;
  promoted: string;
}

function nextRead(vault: string): NextRead | null {
  const queued = queuedReading(vault);

  if (queued.length === 0) return null;

  const items = sortByPromoted(
    queued.map((q) => ({
      title: String(q.meta.title || q.stem),
      minutes: q.meta.reading_minutes ?? null,
      promoted: metaStr(q.meta, "promoted"),
    })),
  );

  return items[0]!;
}

export interface ReadingItem extends NextRead {
  why: string;
  path: string;
}

export function readingQueue(vault: string): ReadingItem[] {
  return sortByPromoted(
    queuedReading(vault).map((q) => ({
      title: String(q.meta.title || q.stem),
      minutes: q.meta.reading_minutes ?? null,
      promoted: metaStr(q.meta, "promoted"),
      why: "next up in your reading queue",
      path: q.rel,
    })),
  );
}

function resurfaceCard(vault: string, indexDir: string, recordOffer: boolean): Candidate | null {
  if (!existsSync(join(indexDir, "pkms.db"))) return null;
  const db = connect(indexDir);

  try {
    const cands = filterNever(vault, candidates(db, { k: 3 })).slice(0, 1);

    if (cands.length > 0 && recordOffer)
      markOffered(
        db,
        cands.map((c) => c.path),
      );

    return cands.length > 0 ? cands[0]! : null;
  } finally {
    db.close();
  }
}

export interface RecognitionCard {
  kind: "reading" | "resurface";
  title: string;
  why: string;
  minutes?: number | null;
  promoted?: string;
  path: string;
}

export function recognitionCards(
  vault: string,
  indexDir: string,
  opts: { k?: number } = {},
): RecognitionCard[] {
  const k = opts.k ?? 3;

  const readingCards = sortByPromoted(
    queuedReading(vault).map(
      (q) =>
        ({
          kind: "reading",
          title: String(q.meta.title || q.stem),
          why: "next in your reading queue",
          minutes: q.meta.reading_minutes ?? null,
          promoted: metaStr(q.meta, "promoted"),
          path: q.rel,
        }) satisfies RecognitionCard,
    ),
  );

  let resurfaceCards: RecognitionCard[] = [];

  if (existsSync(join(indexDir, "pkms.db"))) {
    const db = connect(indexDir);

    try {
      const cands = filterNever(vault, candidates(db, { k }));
      resurfaceCards = cands.map((c): RecognitionCard => ({
        kind: "resurface",
        title: c.title,
        why: c.why,
        path: c.path,
      }));
    } finally {
      db.close();
    }
  }

  const result: RecognitionCard[] = [];
  let ri = 0;
  let si = 0;

  while (result.length < k) {
    if (ri < readingCards.length) {
      result.push(readingCards[ri]!);
      ri += 1;
    }

    if (result.length >= k) break;

    if (si < resurfaceCards.length) {
      result.push(resurfaceCards[si]!);
      si += 1;
    }

    if (ri >= readingCards.length && si >= resurfaceCards.length) break;
  }

  return result;
}

export interface TodayView {
  date: string;
  breadcrumb: Breadcrumb | null;
  inbox_new: number;
  done_today: number;
  next_read: NextRead | null;
  resurface: Candidate | null;
  next_actions: NextAction[];
  more_notes: number;
  snoozed: SnoozedNote[];
}

export function todayView(
  vault: string,
  indexDir: string,
  opts: { recordOffer?: boolean; hideSnoozed?: boolean } = {},
): TodayView {
  const { recordOffer = false, hideSnoozed = false } = opts;
  const todayStem = isoLocalDate(new Date());
  const actions = nextActions(indexDir);

  return {
    date: todayStem,
    breadcrumb: breadcrumb(vault, todayStem),
    inbox_new: inboxCount(vault),
    done_today: doneToday(vault, todayStem),
    next_read: nextRead(vault),
    resurface: resurfaceCard(vault, indexDir, recordOffer),
    next_actions: actions.slice(0, MAX_NOTES_SHOWN),
    more_notes: Math.max(0, actions.length - MAX_NOTES_SHOWN),
    snoozed: hideSnoozed ? [] : snoozedNotesView(indexDir),
  };
}

export interface RecentNote {
  title: string | null;
  path: string;
  last_touched: string;
}

export function recentNotes(
  vault: string,
  indexDir: string,
  opts: { limit?: number } = {},
): RecentNote[] {
  const limit = opts.limit ?? 8;

  if (!existsSync(join(indexDir, "pkms.db"))) return [];
  const db = connect(indexDir);
  let rows: { path: string; title: string | null }[];

  try {
    rows = db
      .query<{ path: string; title: string | null }, SQLQueryBindings[]>(
        "SELECT path, title FROM notes WHERE path NOT LIKE 'sources/%' OR path IN " +
          "(SELECT path FROM source_routes WHERE route = 'routed')",
      )
      .all();
  } finally {
    db.close();
  }

  const out: RecentNote[] = [];

  for (const r of rows) {
    const p = join(vault, ...r.path.split("/"));
    let st;

    try {
      st = statSync(p);
    } catch {
      continue;
    }

    if (!st.isFile()) continue;
    out.push({ title: r.title, path: r.path, last_touched: isoUtc(st.mtimeMs) });
  }

  out.sort((a, b) =>
    a.last_touched < b.last_touched ? 1 : a.last_touched > b.last_touched ? -1 : 0,
  );

  return out.slice(0, limit);
}

export interface InboxItem {
  preview: string;
  source: string;
  captured: string;
  path: string;
}

export function inboxItems(vault: string, opts: { limit?: number } = {}): InboxItem[] {
  const limit = opts.limit ?? 10;
  const inbox = join(vault, "inbox");

  if (!isDir(inbox)) return [];
  const out: InboxItem[] = [];

  for (const name of listMd(inbox).reverse()) {
    let metadata: NoteMetadata;
    let content: string;

    try {
      const post = loadPost(readText(join(inbox, name)));
      metadata = noteMetadata(post.data);
      content = post.content;
    } catch {
      continue;
    }

    const body = content.trim();
    let firstLine = "";

    for (const ln of body.split("\n")) {
      if (ln.trim()) {
        firstLine = ln.trim();
        break;
      }
    }

    const cps = Array.from(firstLine);

    if (cps.length > 120) firstLine = `${cps.slice(0, 117).join("").replace(/\s+$/, "")}…`;
    out.push({
      preview: firstLine,
      source: metaStr(metadata, "source"),
      captured: metaStr(metadata, "captured"),
      path: `inbox/${name}`,
    });

    if (out.length >= limit) break;
  }

  out.sort((a, b) => (a.captured < b.captured ? 1 : a.captured > b.captured ? -1 : 0));

  return out.slice(0, limit);
}

export interface AreaTile {
  title: string;
  path: string;
  next_action: string | null;
  last_touched: string;
}

export function areaTiles(vault: string, indexDir: string): AreaTile[] {
  const areas = join(vault, "areas");

  if (!isDir(areas)) return [];

  const nextActionFor = new Map<string, string>();

  if (existsSync(join(indexDir, "pkms.db"))) {
    const db = connect(indexDir);

    try {
      for (const r of nextActionPerNote(db)) nextActionFor.set(r.note_path, displayText(r.text));
    } finally {
      db.close();
    }
  }

  const out: AreaTile[] = [];

  for (const name of listMd(areas)) {
    const p = join(areas, name);
    let meta: Pick<NoteMetadata, "title">;

    try {
      meta = noteMetadata(loadPost(readText(p)).data);
    } catch {
      continue;
    }

    const rel = `areas/${name}`;
    out.push({
      title: String(meta.title || stemOf(name)),
      path: rel,
      next_action: nextActionFor.get(rel) ?? null,
      last_touched: isoUtc(statSync(p).mtimeMs),
    });
  }

  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return out.slice(0, 8);
}
