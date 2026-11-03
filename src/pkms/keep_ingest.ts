import { z } from "zod";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { connect, type DB } from "./db.ts";
import { writeCapture } from "./capture.ts";
import { append, load } from "./ledger.ts";
import { extractText } from "./ocr.ts";
import { indexVault } from "./indexer.ts";
import { recordKeepPull } from "./keep_pull.ts";
import { runRouter } from "./route.ts";
import { resolveSecret } from "./secrets.ts";
import { listSources, writeSource } from "./sources.ts";
import {
  Keep,
  KeepStateSchema,
  KEEP_FETCH_TIMEOUT_MS,
  ResyncRequiredException,
  type KeepImage,
  type KeepState,
  type KeepTransportOptions,
} from "./keep_transport.ts";

export const LEDGER = "keep-ledger.txt";

export const STATE = "keep-state.json";

export const SWEEP_STATE = "keep-sweep.json";

export type KeepTimestampValue = Date | number | bigint | string | null | undefined;

export function attachmentLink(dest: string): string {
  let rel: string;

  try {
    rel = resolvePosix(dest);
  } catch {
    rel = dest.replace(/\\/g, "/");
  }

  if (!rel.startsWith("/")) rel = `/${rel}`;

  return `![keep attachment](file://${rel})`;
}

function resolvePosix(p: string): string {
  return resolve(p).replace(/\\/g, "/");
}

export function nowIso(): string {
  return new Date().toISOString().replace("Z", "000+00:00");
}

export interface RecordCompletedOptions {
  source?: string;
  keepCreatedAt?: string | null;
  pinned?: boolean;
}

export function toAwareMs(val: KeepTimestampValue): number | null {
  if (val === null || val === undefined) return null;

  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val.getTime();

  if (val === String(val)) {
    if (/^\d+(?:\.\d+)?$/u.test(val.trim())) {
      return epochMsToAware(Number(val) / 1_000);
    }

    return parseIsoToMs(val);
  }

  return epochMsToAware(Number(val) / 1_000);
}

function epochMsToAware(ms: number): number | null {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const y = d.getUTCFullYear();

  if (Number.isNaN(y) || y < 1 || y > 9999) return null;

  return d.getTime();
}

function parseIsoToMs(s: string): number | null {
  const t = Date.parse(s);
  const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s.trim());

  if (!Number.isNaN(t) && hasTz) return t;

  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/.exec(
    s.trim(),
  );

  if (!m) return null;
  const [, Y, Mo, D, H, Mi, S = "0", frac = ""] = m;
  const ms = Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S, +(frac.slice(0, 3).padEnd(3, "0") || "0"));

  return Number.isNaN(ms) ? null : ms;
}

export function pyUtcIso(ms: number): string {
  const d = new Date(ms);
  const p = (n: number, w = 2): string => String(n).padStart(w, "0");
  const micro = d.getUTCMilliseconds();
  const frac = micro === 0 ? "" : `.${p(micro, 3)}000`;

  return (
    `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}${frac}+00:00`
  );
}

export function isoOrNone(ts: { created?: KeepTimestampValue } | null | undefined): string | null {
  if (ts === null || ts === undefined) return null;
  const created = ts.created;

  if (created === null || created === undefined) return null;
  const ms = toAwareMs(created);

  return ms === null ? null : pyUtcIso(ms);
}

export function noteLatestModIso(note: {
  timestamps?: {
    updated?: KeepTimestampValue;
    edited?: KeepTimestampValue;
  } | null;
}): string | null {
  const ts = note.timestamps;

  if (ts === null || ts === undefined) return null;
  let latest: number | null = null;

  for (const attr of ["updated", "edited"] as const) {
    const ms = toAwareMs(ts[attr]);

    if (ms === null) continue;

    if (latest === null || ms > latest) latest = ms;
  }

  return latest === null ? null : pyUtcIso(latest);
}

export function parseKeepCreated(iso: string | null | undefined): number | null {
  if (!iso) return null;

  return toAwareMs(iso);
}

export function guessExt(url: string, data: Uint8Array): string {
  let path = url;

  try {
    path = new URL(url).pathname;
  } catch {}

  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");

  if (dot !== -1 && dot > slash) {
    const ext = "." + path.slice(dot + 1).toLowerCase();

    if (ext.length <= 6 && /^[.a-z0-9]+$/u.test(ext)) return ext;
  }

  const b = data;

  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return ".png";
  }

  if (b[0] === 0xff && b[1] === 0xd8) return ".jpg";

  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return ".gif";

  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return ".webp";
  }

  return ".bin";
}

export async function downloadBytes(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const resp = await fetchImpl(url, { signal: AbortSignal.timeout(KEEP_FETCH_TIMEOUT_MS) });

  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);

  return new Uint8Array(await resp.arrayBuffer());
}

export function recordCompleted(
  indexDir: string,
  noteId: string,
  opts: RecordCompletedOptions = {},
): void {
  const conn = connect(indexDir);

  try {
    completionWriter(conn)(noteId, opts);
  } finally {
    conn.close();
  }
}

function completionWriter(conn: DB) {
  const statement = conn.query<Record<string, never>, SQLQueryBindings[]>(
    "INSERT OR REPLACE INTO keep_completed" +
      "(id, completed_at, source, keep_created_at, pinned) " +
      "VALUES (?, ?, ?, ?, ?)",
  );

  return (
    noteId: string,
    { source = "live", keepCreatedAt = null, pinned = false }: RecordCompletedOptions = {},
  ): void => {
    statement.run(noteId, nowIso(), source, keepCreatedAt, pinned ? 1 : 0);
  };
}

export function completedKeepIds(indexDir: string): Set<string> {
  const conn = connect(indexDir);

  try {
    const rows = conn
      .query<{ id: string }, SQLQueryBindings[]>("SELECT id FROM keep_completed")
      .all();

    return new Set(rows.map((r) => r.id));
  } finally {
    conn.close();
  }
}

export type { DB } from "./db.ts";

export interface IngestKeepOptions {
  keep?: KeepClient | null;
  mediaDir?: string | null;
  now?: Date;
  fetchBytes?: (url: string) => Uint8Array | Promise<Uint8Array>;
  ocr?: (imagePath: string) => string | null | Promise<string | null>;
  writeCaptureFn?: typeof writeCapture;
}

export interface KeepReport {
  setup_needed?: true;
  busy?: true;
  archived: number;
  new: number;
  images: number;
  ocr_missing: number;
  media_failed: number;
}

export function mediaDirFor(root: string): string {
  const env = process.env.PKMS_KEEP_MEDIA_DIR;

  if (env && env.trim()) return env;

  return join(root, "keep-media");
}

export async function makeKeep(
  email: string,
  masterToken: string,
  indexDir: string,
  transport: KeepTransportOptions = {},
): Promise<Keep> {
  const build = (): Keep => new Keep(email, masterToken, undefined, transport);
  const statePath = join(indexDir, STATE);
  let state: KeepState | null = null;

  if (existsSync(statePath)) {
    try {
      state = KeepStateSchema.parse(JSON.parse(readFileSync(statePath, "utf8")));
    } catch {
      state = null;
    }
  }

  const keep = build();

  try {
    await keep.authenticate(state);
  } catch (error) {
    if (!(error instanceof ResyncRequiredException)) throw error;
    const fresh = build();

    await fresh.authenticate(null);

    return cacheKeepState(indexDir, statePath, fresh);
  }

  return cacheKeepState(indexDir, statePath, keep);
}

function cacheKeepState(indexDir: string, statePath: string, keep: Keep): Keep {
  try {
    mkdirSync(indexDir, { recursive: true });
    writeFileSync(statePath, JSON.stringify(keep.dump()), "utf8");
  } catch {}

  return keep;
}

export interface KeepNote {
  id: string;
  text?: string | null;
  title?: string | null;
  trashed?: boolean;
  archived?: boolean;
  pinned?: boolean;
  hasUnchecked?: boolean;
  images?: KeepImage[] | null;
  timestamps?: {
    created?: KeepTimestampValue;
    updated?: KeepTimestampValue;
    edited?: KeepTimestampValue;
  } | null;
  trash?(): void;
}

export interface KeepClient {
  all(): KeepNote[];
  getMediaLink?(blob: KeepImage): string | Promise<string>;
  sync?(): void | Promise<void>;
}

async function safeGetMediaLink(keep: KeepClient, blob: KeepImage): Promise<string | null> {
  try {
    const link = keep.getMediaLink?.(blob);

    return link === undefined ? null : await link;
  } catch {
    return null;
  }
}

function needsRecapture(meta: CompletionMeta | null | undefined, note: KeepNote): boolean {
  if (meta === null || meta === undefined) return false;

  if (!meta.completedAt) return false;
  const modIso = noteLatestModIso(note);

  if (!modIso) return false;
  const modMs = toAwareMs(modIso);
  const doneMs = toAwareMs(meta.completedAt);

  if (modMs === null || doneMs === null) return false;

  return modMs > doneMs;
}

interface CompletionMeta {
  keepCreatedAt: string | null;
  pinned: boolean;
  completedAt: string | null;
}

interface CompletionRow {
  id: string;
  keep_created_at: string | null;
  pinned: number;
  completed_at: string;
}

function completionMetaOf(row: CompletionRow): CompletionMeta {
  return {
    keepCreatedAt: row.keep_created_at,
    pinned: Boolean(row.pinned),
    completedAt: row.completed_at,
  };
}

function loadCompletionIndex(indexDir: string): Map<string, CompletionMeta> {
  const conn = connect(indexDir);

  try {
    return loadCompletions(conn);
  } finally {
    conn.close();
  }
}

function loadCompletions(conn: DB): Map<string, CompletionMeta> {
  const rows = conn
    .query<CompletionRow, SQLQueryBindings[]>(
      "SELECT id, keep_created_at, pinned, completed_at FROM keep_completed",
    )
    .all();

  return new Map(rows.map((row) => [row.id, completionMetaOf(row)]));
}

const BootstrapSchema = z.array(z.string().min(1));

const KeepBusyErrorSchema = z.object({ code: z.literal("SQLITE_BUSY") });

export interface KeepBusy {
  busy: true;
}

export async function withKeepLock<T>(root: string, work: () => Promise<T>): Promise<T | KeepBusy> {
  mkdirSync(join(root, ".ledger"), { recursive: true });
  const lock = new Database(join(root, ".ledger", "keep-lock.db"));

  try {
    try {
      lock.exec("PRAGMA busy_timeout = 0; BEGIN IMMEDIATE");
    } catch (error) {
      if (!KeepBusyErrorSchema.safeParse(error).success) throw error;

      return { busy: true };
    }

    return await work();
  } finally {
    lock.close();
  }
}

function saveBootstrap(root: string, pending: Set<string>): void {
  const directory = join(root, ".ledger");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "keep-bootstrap.json");
  const temporary = `${path}.${randomUUID()}.tmp`;

  try {
    writeFileSync(temporary, `${JSON.stringify([...pending])}\n`, { flag: "wx", mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export async function ingestKeep(
  vault: string,
  indexDir: string,
  root: string,
  opts: IngestKeepOptions = {},
): Promise<KeepReport> {
  const outcome = await withKeepLock(root, async () =>
    ingestKeepUnlocked(vault, indexDir, root, opts),
  );

  if ("busy" in outcome) {
    return { busy: true, archived: 0, new: 0, images: 0, ocr_missing: 0, media_failed: 0 };
  }

  return outcome;
}

async function ingestKeepUnlocked(
  vault: string,
  indexDir: string,
  root: string,
  opts: IngestKeepOptions,
): Promise<KeepReport> {
  let keep = opts.keep ?? null;

  if (keep === null) {
    const email = resolveSecret(root, "keep-email");
    const token = resolveSecret(root, "keep-master-token");

    if (!email || !token) {
      return {
        setup_needed: true,
        archived: 0,
        new: 0,
        images: 0,
        ocr_missing: 0,
        media_failed: 0,
      };
    }

    keep = await makeKeep(email, token, indexDir);
  }

  const now = opts.now ?? new Date();
  const fetchBytes = opts.fetchBytes ?? downloadBytes;
  const ocr = opts.ocr ?? ((p: string) => extractText(p));
  const doWriteCapture = opts.writeCaptureFn ?? writeCapture;

  const mediaDir = opts.mediaDir ?? mediaDirFor(root);
  const ledger = load(indexDir, LEDGER);
  const completions = loadCompletionIndex(indexDir);
  const completed = new Set(completions.keys());
  const stored = listSources(vault, { source: "keep" });
  const seen = new Set([...ledger, ...completed, ...stored.map((item) => item.data.source_id)]);
  const notes = keep.all().filter((note) => !note.trashed);
  const bootstrapPath = join(root, ".ledger", "keep-bootstrap.json");

  const pendingArchive = new Set(
    existsSync(bootstrapPath)
      ? BootstrapSchema.parse(JSON.parse(readFileSync(bootstrapPath, "utf8")))
      : [],
  );

  if (!existsSync(join(indexDir, LEDGER))) {
    if (!existsSync(bootstrapPath)) {
      for (const note of notes) pendingArchive.add(note.id);
      saveBootstrap(root, pendingArchive);
    }

    append(indexDir, LEDGER, []);
  }

  const toProcess = notes.filter(
    (note) =>
      pendingArchive.has(note.id) ||
      (!note.archived && (!seen.has(note.id) || needsRecapture(completions.get(note.id), note))),
  );

  const report: KeepReport = { archived: 0, new: 0, images: 0, ocr_missing: 0, media_failed: 0 };

  const completionDb = connect(indexDir);
  const recordCompletion = completionWriter(completionDb);

  try {
    for (const note of toProcess) {
      let body = note.text || "";

      if (note.title) body = `${note.title}\n\n${body}`.trim();

      const blobs = note.images ?? [];
      let noteFailed = false;

      for (const blob of blobs) {
        const mediaUrl = await safeGetMediaLink(keep, blob);

        if (!mediaUrl) {
          report.media_failed += 1;
          noteFailed = true;
          break;
        }

        let data: Uint8Array;

        try {
          data = await fetchBytes(mediaUrl);
        } catch {
          report.media_failed += 1;
          noteFailed = true;
          break;
        }

        const sha = createHash("sha256").update(data).digest("hex");
        const ext = guessExt(mediaUrl, data);
        mkdirSync(mediaDir, { recursive: true });
        const dest = join(mediaDir, `${sha}${ext}`);
        const temporary = `${dest}.${randomUUID()}.tmp`;

        try {
          writeFileSync(temporary, data);
          renameSync(temporary, dest);
        } finally {
          if (existsSync(temporary)) unlinkSync(temporary);
        }

        body += `\n\n${attachmentLink(dest)}`;
        const text = await ocr(dest);

        if (text === null) {
          report.ocr_missing += 1;
        } else if (text) {
          body += `\n\n${text}`;
        }

        report.images += 1;
      }

      if (noteFailed) continue;

      if (!body.trim()) body = "(empty keep note)";

      const keepCreated = isoOrNone(note.timestamps ?? undefined);
      const pinned = Boolean(note.pinned);
      const archiving = pendingArchive.has(note.id);

      if (archiving) {
        const edited = toAwareMs(note.timestamps?.edited);
        writeSource(vault, body, {
          source: "keep",
          source_id: note.id,
          received_at: keepCreated ?? now.toISOString(),
          route: "pending",
          title: note.title ?? "",
          pinned: String(pinned),
          has_unchecked: String(note.hasUnchecked === true),
          keep_edited_at: edited === null ? "" : new Date(edited).toISOString(),
          keep_created_at: keepCreated ?? "",
          keep_archived: String(Boolean(note.archived)),
        });
      } else {
        const extra = new Map<string, string>([["keep_id", note.id]]);

        if (keepCreated) extra.set("keep_created_at", keepCreated);

        if (pinned) extra.set("pinned", "true");
        doWriteCapture(body, vault, { source: "keep", now, extra: Object.fromEntries(extra) });
      }

      recordCompletion(note.id, {
        source: "live",
        keepCreatedAt: keepCreated,
        pinned,
      });

      if (!ledger.has(note.id)) append(indexDir, LEDGER, [note.id]);

      if (archiving) {
        pendingArchive.delete(note.id);
        saveBootstrap(root, pendingArchive);
        report.archived += 1;
      } else {
        report.new += 1;
      }
    }
  } finally {
    completionDb.close();
  }

  if (listSources(vault, { source: "keep", route: "pending", limit: 1 }).length > 0) {
    const result = await runRouter(root, vault, { source: "keep", now });
    report.new += result.items.filter((item) => item.decision?.decision === "route").length;

    if (report.archived > 0 && result.items.every((item) => item.decision === null)) {
      indexVault(vault, indexDir);
    }
  } else if (report.archived > 0) {
    indexVault(vault, indexDir);
  }

  recordKeepPull(root, now);

  return report;
}

export function renderReport(report: KeepReport): string {
  if ("setup_needed" in report) {
    return "keep isn't connected yet — docs/keep-setup.md has the one-time setup (~5 min)";
  }

  if (report.busy) return "keep pull already running";

  const bits: string[] = [];

  if (report.archived) bits.push(`${report.archived} keep notes archived`);

  if (report.new) bits.push(`${report.new} keep note${report.new !== 1 ? "s" : ""} in`);

  if (report.images) bits.push(`${report.images} image${report.images !== 1 ? "s" : ""} read`);

  if (report.ocr_missing) {
    bits.push(
      `${report.ocr_missing} image${report.ocr_missing !== 1 ? "s" : ""} saved unread (tesseract missing)`,
    );
  }

  if (report.media_failed) {
    bits.push(
      `${report.media_failed} image download${report.media_failed !== 1 ? "s" : ""} failed — they stay in Keep`,
    );
  }

  return bits.length ? bits.join(" · ") : "keep: nothing new";
}

export const SweepStateSchema = z
  .object({
    swept: z.record(
      z.string(),
      z
        .object({
          deleted_at: z.string(),
          age_days_at_delete: z.number().int(),
        })
        .strict(),
    ),
  })
  .strict();

export type SweepState = z.infer<typeof SweepStateSchema>;

export interface SweepReport {
  scanned: number;
  eligible: number;
  deleted: number;
  skipped_pinned: number;
  skipped_recent: number;
  skipped_uncaptured: number;
  skipped_grandfathered: number;
  skipped_trashed: number;
  skipped_archived: number;
  skipped_edited: number;
  errors: string[];
  dry_run: boolean;
  age_days: number;
  eligible_ids: string[];
}

export interface SweepOptions {
  ageDays?: number;
  dryRun?: boolean;
}

function loadSweepState(indexDir: string): SweepState {
  const p = join(indexDir, SWEEP_STATE);

  if (!existsSync(p)) return { swept: {} };

  try {
    return SweepStateSchema.parse(JSON.parse(readFileSync(p, "utf8")));
  } catch {
    return { swept: {} };
  }
}

function saveSweepState(indexDir: string, state: SweepState): void {
  mkdirSync(indexDir, { recursive: true });
  writeFileSync(join(indexDir, SWEEP_STATE), JSON.stringify(state, null, 2), "utf8");
}

export async function sweepOldUnpinned(
  keep: KeepClient,
  indexDir: string,
  opts: SweepOptions = {},
): Promise<SweepReport> {
  const ageDays = opts.ageDays ?? 30;
  const dryRun = opts.dryRun ?? true;
  const state = loadSweepState(indexDir);
  const swept = (state.swept ??= {});

  const report: SweepReport = {
    scanned: 0,
    eligible: 0,
    deleted: 0,
    skipped_pinned: 0,
    skipped_recent: 0,
    skipped_uncaptured: 0,
    skipped_grandfathered: 0,
    skipped_trashed: 0,
    skipped_archived: 0,
    skipped_edited: 0,
    errors: [],
    dry_run: dryRun,
    age_days: ageDays,
    eligible_ids: [],
  };

  const notes = keep.all();
  report.scanned = notes.length;
  const completions = loadCompletionIndex(indexDir);
  const nowMs = Date.now();
  let trashed: Array<[string, number]> = [];

  for (const note of notes) {
    const noteId = note.id;

    if (!noteId) continue;

    if (note.trashed) {
      report.skipped_trashed += 1;
      continue;
    }

    if (note.archived) {
      report.skipped_archived += 1;
      continue;
    }

    if (note.pinned) {
      report.skipped_pinned += 1;
      continue;
    }

    const meta = completions.get(noteId);

    if (meta === undefined) {
      report.skipped_uncaptured += 1;
      continue;
    }

    const createdMs = parseKeepCreated(meta.keepCreatedAt);

    if (createdMs === null) {
      report.skipped_grandfathered += 1;
      continue;
    }

    if (needsRecapture(meta, note)) {
      report.skipped_edited += 1;
      continue;
    }

    const age = Math.floor((nowMs - createdMs) / 86_400_000);

    if (age < ageDays) {
      report.skipped_recent += 1;
      continue;
    }

    report.eligible += 1;
    report.eligible_ids.push(noteId);

    if (dryRun) continue;

    try {
      note.trash?.();
    } catch (e) {
      report.errors.push(`${noteId}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    trashed.push([noteId, age]);
  }

  if (!dryRun) {
    if (trashed.length > 0) {
      try {
        await keep.sync!();
      } catch (e) {
        report.errors.push(
          `sync failed — nothing recorded as deleted: ${e instanceof Error ? e.message : String(e)}`,
        );
        trashed = [];
      }

      for (const [sweptId, sweptAge] of trashed) {
        swept[sweptId] = {
          deleted_at: nowIso(),
          age_days_at_delete: sweptAge,
        };
        report.deleted += 1;
      }
    }

    saveSweepState(indexDir, state);
  }

  return report;
}

export function renderSweepReport(report: SweepReport): string {
  const bits: string[] = [];

  if (report.dry_run) bits.push("DRY RUN");
  bits.push(`scanned ${report.scanned}`);
  bits.push(`eligible ${report.eligible} (≥${report.age_days}d, unpinned, captured)`);

  if (!report.dry_run && report.deleted) bits.push(`deleted ${report.deleted}`);

  if (report.skipped_grandfathered)
    bits.push(`grandfathered (no age data) ${report.skipped_grandfathered}`);

  if (report.skipped_pinned) bits.push(`pinned ${report.skipped_pinned}`);

  if (report.skipped_recent) bits.push(`too recent ${report.skipped_recent}`);

  if (report.skipped_trashed) bits.push(`already trashed ${report.skipped_trashed}`);

  if (report.skipped_archived) bits.push(`archived ${report.skipped_archived}`);

  if (report.skipped_uncaptured) bits.push(`not in vault ${report.skipped_uncaptured}`);

  if (report.skipped_edited) bits.push(`edited since capture ${report.skipped_edited}`);

  if (report.errors.length) bits.push(`errors ${report.errors.length}`);

  return bits.join(" · ");
}
