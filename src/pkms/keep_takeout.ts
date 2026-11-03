import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { unzipSync } from "fflate";
import { writeCapture } from "./capture.ts";
import { attachmentLink, completedKeepIds, recordCompleted } from "./keep_ingest.ts";
import { append, load } from "./ledger.ts";

export const TAKEOUT_LEDGER = "keep-takeout-ledger.txt";

export function mediaDirFromEnv(root: string): string {
  const env = process.env.PKMS_KEEP_MEDIA_DIR;

  if (env && env.trim()) return env;

  return join(root, "keep-media");
}

const TakeoutJsonSchema = z.json();

const TakeoutObjectSchema = z.record(z.string(), TakeoutJsonSchema);

const TakeoutPayloadSchema = z
  .object({
    title: TakeoutJsonSchema.optional(),
    textContent: TakeoutJsonSchema.optional(),
    listContent: TakeoutJsonSchema.optional(),
    annotations: TakeoutJsonSchema.optional(),
    attachments: TakeoutJsonSchema.optional(),
    timestamps: TakeoutJsonSchema.optional(),
    labels: TakeoutJsonSchema.optional(),
    isTrashed: TakeoutJsonSchema.optional(),
    isPinned: TakeoutJsonSchema.optional(),
    isArchived: TakeoutJsonSchema.optional(),
    color: TakeoutJsonSchema.optional(),
    createdAt: TakeoutJsonSchema.optional(),
    updatedAt: TakeoutJsonSchema.optional(),
    createdTimestampUsec: TakeoutJsonSchema.optional(),
    userEditedTimestampUsec: TakeoutJsonSchema.optional(),
  })
  .catchall(TakeoutJsonSchema);

const TakeoutStringSchema = z.string().optional();

const TakeoutStringValueSchema = z.string();

const TakeoutNumberSchema = z.number();

type TakeoutJsonValue = z.infer<typeof TakeoutJsonSchema>;

type TakeoutJsonObject = z.infer<typeof TakeoutObjectSchema>;

type TakeoutPayload = z.infer<typeof TakeoutPayloadSchema>;

function takeoutObject(value: TakeoutJsonValue | undefined): TakeoutJsonObject | null {
  const result = TakeoutObjectSchema.safeParse(value);

  return result.success ? result.data : null;
}

function takeoutString(value: TakeoutJsonValue | undefined): string | undefined {
  const result = TakeoutStringSchema.safeParse(value);

  return result.success ? result.data : undefined;
}

export function parseKeepTimestamp(raw: TakeoutJsonValue | undefined): string | null {
  if (raw === null || raw === undefined) return null;

  const string = TakeoutStringValueSchema.safeParse(raw);

  if (string.success) return string.data;

  const number = TakeoutNumberSchema.safeParse(raw);

  if (number.success) {
    const ms = number.data / 1_000;

    if (!Number.isFinite(ms)) return null;
    const d = new Date(ms);

    if (Number.isNaN(d.getTime())) return null;

    return localIso(d);
  }

  return null;
}

function localIso(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const ms = d.getMilliseconds();
  const micro = ms === 0 ? "" : `.${p(ms, 3)}000`;

  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${micro}`
  );
}

export function renderChecklist(listContent: TakeoutJsonValue | undefined): string | null {
  if (!Array.isArray(listContent)) return null;
  const rows: string[] = [];

  for (const item of listContent) {
    const obj = takeoutObject(item);

    if (!obj) continue;
    const text = takeoutString(obj.text)?.trim() ?? "";

    if (!text) continue;
    const checked = Boolean(obj.checked);
    rows.push(`- [${checked ? "x" : " "}] ${text}`);
  }

  return rows.length > 0 ? rows.join("\n") : null;
}

export function extractNoteText(payload: TakeoutPayload): [string, string | null] {
  const title = takeoutString(payload.title)?.trim() ?? "";
  const text = takeoutString(payload.textContent)?.trim() ?? "";
  const checklist = renderChecklist(payload.listContent);
  let body: string;

  if (checklist && text) body = `${text}\n\n${checklist}`;
  else if (checklist) body = checklist;
  else body = text;

  return [body, title || null];
}

export function extractAttachments(
  payload: TakeoutPayload,
): Array<{ name: string; zip_path?: string; mime_type: string }> {
  const out: Array<{ name: string; zip_path?: string; mime_type: string }> = [];
  const annotations = payload.annotations;

  if (Array.isArray(annotations)) {
    for (const ann of annotations) {
      const obj = takeoutObject(ann);

      if (!obj) continue;
      const name = takeoutString(obj.filename) || takeoutString(obj.name) || "";

      if (!name) continue;
      out.push({
        name,
        mime_type: takeoutString(obj.mimeType) || takeoutString(obj.mimetype) || "",
      });
    }
  }

  const attachments = payload.attachments;

  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      const obj = takeoutObject(att);

      if (!obj) continue;

      const path =
        takeoutString(obj.filePath) || takeoutString(obj.filename) || takeoutString(obj.name) || "";

      if (!path) continue;
      out.push({
        name: basename(path),
        zip_path: path,
        mime_type: takeoutString(obj.mimetype) || takeoutString(obj.mimeType) || "",
      });
    }
  }

  return out;
}

export function syntheticId(jsonBytes: Uint8Array): string {
  return `takeout:${createHash("sha256").update(jsonBytes).digest("hex").slice(0, 32)}`;
}

type Zip = Record<string, Uint8Array>;

async function openZip(zipPath: string): Promise<Zip> {
  const buf = await Bun.file(zipPath).arrayBuffer();

  return unzipSync(new Uint8Array(buf));
}

export function findZipMember(zf: Zip, name: string): string | null {
  if (name in zf) return name;
  const target = basename(name);

  for (const member of Object.keys(zf)) {
    if (basename(member) === target && member.toLowerCase().includes("attachment")) return member;
  }

  const keepMember = `Takeout/Keep/${target}`;

  if (keepMember in zf) return keepMember;

  for (const member of Object.keys(zf)) {
    if (basename(member) === target && /(^|\/)Keep\//.test(member)) return member;
  }

  return null;
}

export function discoverNoteMembers(zf: Zip): string[] {
  const out: string[] = [];

  for (const n of Object.keys(zf)) {
    if (!n.endsWith(".json")) continue;

    if (n.includes("/attachments/") || n.startsWith("attachments/")) continue;

    if (n.startsWith("Takeout/Keep/")) out.push(n);
    else if (/\/Keep\/[^/]+\.json$/.test(n)) out.push(n);
    else if (n.split("/").length <= 2 && !n.endsWith("/")) out.push(n);
  }

  return out;
}

export function mirrorAttachment(zf: Zip, member: string, mediaDir: string): string | null {
  const data = zf[member];

  if (!data) return null;
  const sha = createHash("sha256").update(data).digest("hex");
  const ext = (extname(member) || "").toLowerCase();
  const dest = join(mediaDir, `${sha}${ext}`);
  const temporary = `${dest}.${randomUUID()}.tmp`;

  try {
    mkdirSync(mediaDir, { recursive: true });
    writeFileSync(temporary, data);
    renameSync(temporary, dest);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }

  return dest;
}

function extname(p: string): string {
  const base = basename(p);
  const idx = base.lastIndexOf(".");

  return idx > 0 ? base.slice(idx) : "";
}

export interface ImportTakeoutOptions {
  root?: string;
  mediaDir?: string;
}

export interface TakeoutReport {
  notes: number;
  skipped_already_imported: number;
  skipped_trashed: number;
  skipped_empty: number;
  attachments_mirrored: number;
  attachments_skipped: number;
  errors: string[];
  media_dir: string;
}

function emptyReport(): TakeoutReport {
  return {
    notes: 0,
    skipped_already_imported: 0,
    skipped_trashed: 0,
    skipped_empty: 0,
    attachments_mirrored: 0,
    attachments_skipped: 0,
    errors: [],
    media_dir: "",
  };
}

export async function importTakeout(
  zipPath: string,
  vault: string,
  indexDir: string,
  { root, mediaDir }: ImportTakeoutOptions = {},
): Promise<TakeoutReport> {
  if (!existsSync(zipPath)) {
    throw new Error(`takeout zip not found: ${zipPath}`);
  }

  let media: string;

  if (mediaDir === undefined) {
    const here = fileURLToPath(import.meta.url);
    const pkgRoot = root ?? resolve(dirname(here), "..", "..");
    media = mediaDirFromEnv(pkgRoot);
  } else {
    media = mediaDir;
  }

  const ledger = load(indexDir, TAKEOUT_LEDGER);
  const report = emptyReport();
  report.media_dir = media;

  const completed = completedKeepIds(indexDir);
  const zf = await openZip(zipPath);

  for (const member of discoverNoteMembers(zf)) {
    let raw: Uint8Array;
    let payload: TakeoutPayload;

    try {
      raw = zf[member]!;
      const parsed: unknown = JSON.parse(Buffer.from(raw).toString("utf8"));
      const result = TakeoutPayloadSchema.safeParse(parsed);

      if (!result.success) throw new TypeError("expected a JSON object");
      payload = result.data;
    } catch (e) {
      report.errors.push(`${member}: not JSON (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }

    try {
      const noteId = syntheticId(raw);

      if (ledger.has(noteId) || completed.has(noteId)) {
        report.skipped_already_imported += 1;
        continue;
      }

      const timestamps = takeoutObject(payload.timestamps);

      const isTrashed = Boolean(payload.isTrashed) || Boolean(timestamps?.trashTime);

      if (isTrashed) {
        report.skipped_trashed += 1;
        continue;
      }

      const [body, title] = extractNoteText(payload);
      const attachments = extractAttachments(payload);

      if (!body.trim() && !title && attachments.length === 0) {
        report.skipped_empty += 1;
        continue;
      }

      let fullBody: string;

      if (title && body) fullBody = `${title}\n\n${body}`.trim();
      else if (title) fullBody = title;
      else if (attachments.length > 0 && !body.trim())
        fullBody = "(note with no text; see attachments)";
      else fullBody = body;

      for (const att of attachments) {
        const lookup = att.zip_path ?? att.name;
        const actual = findZipMember(zf, lookup);

        if (!actual) {
          report.attachments_skipped += 1;
          continue;
        }

        const dest = mirrorAttachment(zf, actual, media);

        if (!dest) {
          report.attachments_skipped += 1;
          continue;
        }

        fullBody += `\n\n${attachmentLink(dest)}`;
        report.attachments_mirrored += 1;
      }

      const labels = (Array.isArray(payload.labels) ? payload.labels : [])
        .map(takeoutObject)
        .filter((label): label is TakeoutJsonObject => label !== null && Boolean(label.name))
        .map((label) => String(label.name));

      const color = payload.color;
      const isPinned = Boolean(payload.isPinned);
      const isArchived = Boolean(payload.isArchived);

      const keepCreated =
        parseKeepTimestamp(payload.createdTimestampUsec) ??
        parseKeepTimestamp(timestamps?.createTime) ??
        parseKeepTimestamp(payload.createdAt);

      const keepUpdated =
        parseKeepTimestamp(payload.userEditedTimestampUsec) ??
        parseKeepTimestamp(timestamps?.updateTime) ??
        parseKeepTimestamp(payload.updatedAt);

      const extra = new Map<string, string>([
        ["keep_id", noteId],
        ["source_kind", "takeout"],
      ]);

      if (keepCreated) extra.set("keep_created_at", keepCreated);

      if (keepUpdated) extra.set("keep_updated_at", keepUpdated);

      if (isPinned) extra.set("pinned", "true");

      if (isArchived) extra.set("archived", "true");

      if (color !== undefined && color !== null) extra.set("color", String(color));

      if (labels.length > 0) extra.set("labels", labels.join(","));

      writeCapture(fullBody, vault, { source: "keep-takeout", extra: Object.fromEntries(extra) });
      recordCompleted(indexDir, noteId, {
        source: "takeout",
        keepCreatedAt: keepCreated,
        pinned: isPinned,
      });
      append(indexDir, TAKEOUT_LEDGER, [noteId]);
      ledger.add(noteId);
      completed.add(noteId);
      report.notes += 1;
    } catch (e) {
      report.errors.push(`${member}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return report;
}

export function renderTakeoutReport(report: TakeoutReport): string {
  const bits: string[] = [];

  if (report.notes) {
    bits.push(`${report.notes} keep note${report.notes !== 1 ? "s" : ""} imported from takeout`);
  }

  if (report.attachments_mirrored) {
    bits.push(
      `${report.attachments_mirrored} attachment${report.attachments_mirrored !== 1 ? "s" : ""}` +
        ` mirrored to ${report.media_dir}`,
    );
  }

  if (report.skipped_already_imported) {
    bits.push(`${report.skipped_already_imported} already imported`);
  }

  if (report.skipped_trashed) bits.push(`${report.skipped_trashed} in trash`);

  if (report.skipped_empty) bits.push(`${report.skipped_empty} empty`);

  if (report.attachments_skipped) {
    bits.push(
      `${report.attachments_skipped} attachment${report.attachments_skipped !== 1 ? "s" : ""} missing from zip`,
    );
  }

  if (report.errors.length) {
    bits.push(`${report.errors.length} error${report.errors.length !== 1 ? "s" : ""} (see logs)`);
  }

  return bits.join(" · ") || "takeout: nothing new";
}
