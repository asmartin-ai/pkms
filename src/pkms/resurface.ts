import { z } from "zod";
import type { SQLQueryBindings } from "bun:sqlite";
import { join } from "node:path";
import type { DB } from "./db.ts";
import { FrontmatterSchema, loadPost, type Frontmatter, type FrontmatterValue } from "./indexer.ts";
import { stemOf } from "./search.ts";
import { isoLocalDate } from "./tasks.ts";
import { atomicWrite, readText } from "./textio.ts";

const FilesystemErrorSchema = z.object({ code: z.string() }).passthrough();

const YamlBooleanSchema = z.boolean();

const YamlNumberSchema = z.number().or(z.nan());

const YamlStringSchema = z.string();

export const OFFER_REST_DAYS = 3;

export const DISMISS_REST_DAYS = 30;

export const ACTIVE_WINDOW_DAYS = 21;

export const DORMANT_AFTER_DAYS = 30;

const EXCLUDED_PREFIXES = ["daily/", "inbox/", "resources/reading/", "archive/"];

const TEMPLATES = [
  "still thinking about {title}?",
  "remember {title}?",
  "{title} — worth another look?",
  "does {title} still spark anything?",
];

export interface Candidate {
  path: string;
  title: string;
  question: string;
  why: string;
  score: number;
}

interface NoteRow {
  path: string;
  title: string | null;
  created: string | null;
  modified: string | null;
}

interface OfferRow {
  path: string;
  offer_count: number;
  rest_until: string;
}

function shiftDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function daysBetween(later: Date, earlierIso: string): number {
  const [y, m, d] = earlierIso.slice(0, 10).split("-").map(Number);
  const laterUtc = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());

  return Math.round((laterUtc - Date.UTC(y!, m! - 1, d!)) / 86_400_000);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function noteDate(row: NoteRow): string {
  const value = String(row.modified || row.created || "");

  return ISO_DATE_RE.test(value) ? value : "";
}

export function candidates(db: DB, opts: { today?: Date; k?: number } = {}): Candidate[] {
  const today = opts.today ?? new Date();
  const k = opts.k ?? 3;
  const todayIso = isoLocalDate(today);
  const activeCutoff = isoLocalDate(shiftDays(today, -ACTIVE_WINDOW_DAYS));
  const dormantCutoff = isoLocalDate(shiftDays(today, -DORMANT_AFTER_DAYS));

  const notes = db
    .query<NoteRow, SQLQueryBindings[]>(
      "SELECT path, title, created, modified FROM notes " +
        "WHERE path NOT LIKE 'sources/%' OR path IN " +
        "(SELECT path FROM source_routes WHERE route = 'routed')",
    )
    .all();

  const rest = new Map<string, OfferRow>(
    db
      .query<OfferRow, SQLQueryBindings[]>("SELECT * FROM resurface_offers")
      .all()
      .map((r) => [r.path, r]),
  );

  const links = db
    .query<{ source: string; target: string }, SQLQueryBindings[]>(
      "SELECT source, target FROM links",
    )
    .all();

  const stemToPath = new Map<string, string>();

  for (const n of notes) stemToPath.set(stemOf(n.path).toLowerCase(), n.path);
  const activePaths = new Set<string>();
  const activeTitles = new Map<string, string>();

  for (const n of notes) {
    const d = noteDate(n);

    if (d && d >= activeCutoff) {
      activePaths.add(n.path);
      activeTitles.set(stemOf(n.path).toLowerCase(), n.title || stemOf(n.path));
    }
  }

  const backlinkDeg = new Map<string, number>();
  const wovenIntoActive = new Map<string, string[]>();

  for (const ln of links) {
    const tgt = ln.target.toLowerCase();
    backlinkDeg.set(tgt, (backlinkDeg.get(tgt) ?? 0) + 1);

    if (activePaths.has(ln.source) && stemToPath.has(tgt)) {
      const srcStem = stemOf(ln.source).toLowerCase();
      const key = stemToPath.get(tgt)!;

      if (!wovenIntoActive.has(key)) wovenIntoActive.set(key, []);
      wovenIntoActive.get(key)!.push(activeTitles.get(srcStem) ?? stemOf(ln.source));
    } else if (activeTitles.has(tgt)) {
      if (!wovenIntoActive.has(ln.source)) wovenIntoActive.set(ln.source, []);
      wovenIntoActive.get(ln.source)!.push(activeTitles.get(tgt)!);
    }
  }

  const out: Candidate[] = [];

  for (const n of notes) {
    const path = n.path;

    if (EXCLUDED_PREFIXES.some((p) => path.replaceAll("\\", "/").startsWith(p))) {
      continue;
    }

    const r = rest.get(path);

    if (r && r.rest_until && r.rest_until > todayIso) continue;
    const d = noteDate(n);

    if (d && d >= dormantCutoff) continue;

    const why: string[] = [];
    let score = 0.0;
    const stem = stemOf(path).toLowerCase();

    if (activeTitles.has(stem)) continue;
    const woven = wovenIntoActive.get(path) ?? [];

    if (woven.length > 0) {
      score += 3.0 + 0.5 * woven.length;
      why.push(`links into [[${woven[0]}]], where things are moving`);
    }

    const deg = backlinkDeg.get(stem) ?? 0;

    if (deg >= 2) {
      score += 1.0 + 0.25 * deg;
      why.push(`linked from ${deg} notes`);
    }

    if (d) {
      const age = daysBetween(today, d);
      score += Math.min(age / 60.0, 2.0);
      why.push(`quiet for a while (since ${d.slice(0, 10)})`);
    } else {
      why.push("undated — been around");
      score += 0.5;
    }

    if (score <= 0.5) continue;
    const count = r ? r.offer_count : 0;
    const title = n.title || stemOf(path);
    out.push({
      path,
      title,
      question: TEMPLATES[count % TEMPLATES.length]!.replaceAll("{title}", title),
      why: why.slice(0, 2).join(" · "),
      score: Math.round(score * 100) / 100,
    });
  }

  out.sort((a, b) => b.score - a.score);

  return out.slice(0, k);
}

export function filterNever(vault: string, cands: Candidate[]): Candidate[] {
  const kept: Candidate[] = [];

  for (const c of cands) {
    const p = join(vault, ...c.path.split("/"));
    let text: string;

    try {
      text = readText(p);
    } catch (e) {
      if (FilesystemErrorSchema.safeParse(e).success) {
        continue;
      }

      throw e;
    }

    const { data } = loadPost(text);

    if (String(data.resurface ?? "").toLowerCase() === "never") continue;
    kept.push(c);
  }

  return kept;
}

export function markOffered(db: DB, paths: string[], opts: { today?: Date } = {}): void {
  const today = opts.today ?? new Date();
  const until = isoLocalDate(shiftDays(today, OFFER_REST_DAYS));

  for (const p of paths) {
    db.query<unknown, SQLQueryBindings[]>(
      `INSERT INTO resurface_offers (path, offer_count, rest_until) VALUES (?,1,?)
       ON CONFLICT(path) DO UPDATE SET
         offer_count = offer_count + 1, rest_until = excluded.rest_until`,
    ).run(p, until);
  }
}

export function dismiss(db: DB, path: string, opts: { today?: Date } = {}): void {
  const today = opts.today ?? new Date();
  const until = isoLocalDate(shiftDays(today, DISMISS_REST_DAYS));
  db.query<unknown, SQLQueryBindings[]>(
    `INSERT INTO resurface_offers (path, offer_count, rest_until) VALUES (?,0,?)
     ON CONFLICT(path) DO UPDATE SET rest_until = excluded.rest_until`,
  ).run(path, until);
}

const YAML_NONSTR_WORDS = new Set([
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "true",
  "True",
  "TRUE",
  "false",
  "False",
  "FALSE",
  "on",
  "On",
  "ON",
  "off",
  "Off",
  "OFF",
  "~",
  "null",
  "Null",
  "NULL",
]);

const YAML_NUMBER_RE =
  /^[-+]?(0x[0-9a-fA-F]+|0o[0-7]+|\d+(\.\d*)?([eE][-+]?\d+)?|\.\d+([eE][-+]?\d+)?|\.inf|\.Inf|\.INF|\.nan|\.NaN|\.NAN)$/;

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);

    if (code < 0x20 || code === 0x7f) return true;
  }

  return false;
}

function needsQuote(s: string): boolean {
  if (s !== s.trim()) return true;

  if (hasControlCharacter(s)) return true;
  const c0 = s[0]!;

  if ("-?:,[]{}#&*!|>'\"%@`".includes(c0)) return true;

  if (s.includes(": ") || s.includes(" #") || s.endsWith(":")) return true;

  return false;
}

function quoteYaml(s: string): string {
  if (hasControlCharacter(s)) {
    return JSON.stringify(s);
  }

  return `'${s.replaceAll("'", "''")}'`;
}

function yamlScalar(v: FrontmatterValue): string {
  if (v === null) return "null";

  const boolean = YamlBooleanSchema.safeParse(v);

  if (boolean.success) return boolean.data ? "true" : "false";

  const number = YamlNumberSchema.safeParse(v);

  if (number.success) return String(number.data);

  const string = YamlStringSchema.safeParse(v);

  if (string.success) {
    if (string.data === "") return "''";

    if (/^\d{4}-\d{2}-\d{2}$/.test(string.data)) return string.data;

    if (
      YAML_NONSTR_WORDS.has(string.data) ||
      YAML_NUMBER_RE.test(string.data) ||
      needsQuote(string.data)
    ) {
      return quoteYaml(string.data);
    }

    return string.data;
  }

  const encoded = JSON.stringify(v);

  if (encoded === undefined) throw new TypeError("frontmatter value is not serializable");

  return encoded;
}

function sortedEntries(v: Frontmatter) {
  return Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function dumpEntry(key: string, val: FrontmatterValue, indent: string): string[] {
  if (Array.isArray(val)) {
    if (val.length === 0) return [`${indent}${key}: []`];

    const lines = [`${indent}${key}:`];

    for (const item of val) lines.push(`${indent}- ${yamlScalar(item)}`);

    return lines;
  }

  const mapping = FrontmatterSchema.safeParse(val);

  if (mapping.success) {
    const entries = sortedEntries(mapping.data);

    if (entries.length === 0) return [`${indent}${key}: {}`];

    const lines = [`${indent}${key}:`];

    for (const [nestedKey, nestedValue] of entries) {
      lines.push(...dumpEntry(nestedKey, nestedValue, `${indent}  `));
    }

    return lines;
  }

  return [`${indent}${key}: ${yamlScalar(val)}`];
}

function dumpsPost(meta: Frontmatter, content: string): string {
  const lines = sortedEntries(meta).flatMap(([k, v]) => dumpEntry(k, v, ""));
  const body = lines.length > 0 ? `${lines.join("\n")}\n` : "{}\n";

  return `---\n${body}---\n\n${content}`;
}

export function letGo(vault: string, relPath: string): string {
  const p = join(vault, ...relPath.split("/"));
  const { data, content } = loadPost(readText(p));
  data.resurface = "never";
  atomicWrite(p, dumpsPost(data, content));

  return p;
}
