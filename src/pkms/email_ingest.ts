import { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";
import { emit } from "./events.ts";
import {
  connectImap,
  GmailSession,
  ImapCommandError,
  INBOX,
  type FetchedMessage,
  type ImapEndpoint,
  type MessageMeta,
} from "./imap.ts";
import { indexVault } from "./indexer.ts";
import { runRouter, type LabelFn, type RouteItemResult } from "./route.ts";
import type { RouteDecision, Tuning } from "./route_rules.ts";
import { listSources, writeSource } from "./sources.ts";
import { pyStrip } from "./textio.ts";

type TextDecoderLabel = NonNullable<ConstructorParameters<typeof TextDecoder>[0]>;

export interface MimePart {
  headers: Map<string, string>;
  contentType: string;
  isMultipart: boolean;
  boundary: string | null;
  charset: string | null;
  cte: string;
  bodyLatin1: string;
  parts: MimePart[];
}

function parseHeaders(headerText: string): Map<string, string> {
  const headers = new Map<string, string>();
  let lastKey: string | null = null;

  for (const line of headerText.split(/\r?\n/)) {
    if (line === "") continue;

    if (/^[ \t]/.test(line) && lastKey !== null) {
      headers.set(lastKey, `${headers.get(lastKey)} ${line.trim()}`);
      continue;
    }

    const idx = line.indexOf(":");

    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();

    if (!headers.has(key)) headers.set(key, val);
    lastKey = key;
  }

  return headers;
}

function paramValue(contentTypeHeader: string, name: string): string | null {
  for (const seg of contentTypeHeader.split(";").slice(1)) {
    const eq = seg.indexOf("=");

    if (eq === -1) continue;
    const k = seg.slice(0, eq).trim().toLowerCase();

    if (k !== name) continue;
    let v = seg.slice(eq + 1).trim();

    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);

    return v;
  }

  return null;
}

function splitMultipart(body: string, boundary: string): string[] {
  const delim = `--${boundary}`;
  const close = `${delim}--`;
  const parts: string[] = [];
  let current: string[] | null = null;

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trimEnd();

    if (trimmed === delim) {
      if (current !== null) parts.push(current.join("\n"));
      current = [];
    } else if (trimmed === close) {
      if (current !== null) parts.push(current.join("\n"));
      current = null;
      break;
    } else if (current !== null) {
      current.push(line);
    }
  }

  if (current !== null) parts.push(current.join("\n"));

  return parts;
}

function parsePartText(text: string): MimePart {
  let headerText = text;
  let body = "";
  let idx = text.indexOf("\r\n\r\n");

  if (idx !== -1) {
    headerText = text.slice(0, idx);
    body = text.slice(idx + 4);
  } else {
    idx = text.indexOf("\n\n");

    if (idx !== -1) {
      headerText = text.slice(0, idx);
      body = text.slice(idx + 2);
    }
  }

  const headers = parseHeaders(headerText);
  const ctHeader = headers.get("content-type");
  const contentType = ctHeader ? ctHeader.split(";")[0]!.trim().toLowerCase() : "text/plain";
  const isMultipart = contentType.startsWith("multipart/");
  const boundary = ctHeader ? paramValue(ctHeader, "boundary") : null;
  const charset = ctHeader ? (paramValue(ctHeader, "charset")?.toLowerCase() ?? null) : null;
  const cte = (headers.get("content-transfer-encoding") ?? "").trim().toLowerCase();

  const part: MimePart = {
    headers,
    contentType,
    isMultipart,
    boundary,
    charset,
    cte,
    bodyLatin1: "",
    parts: [],
  };

  if (isMultipart && boundary) {
    for (const chunk of splitMultipart(body, boundary)) {
      part.parts.push(parsePartText(chunk));
    }
  } else {
    part.bodyLatin1 = body;
  }

  return part;
}

export function messageFromBytes(raw: Uint8Array): MimePart {
  return parsePartText(Buffer.from(raw).toString("latin1"));
}

function decodeQuotedPrintable(s: string): Uint8Array {
  const out: number[] = [];
  const cleaned = s.replace(/=\r?\n/g, "");

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!;

    if (ch === "=" && i + 2 < cleaned.length) {
      const hex = cleaned.slice(i + 1, i + 3);

      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        out.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }

    out.push(ch.charCodeAt(0) & 0xff);
  }

  return Uint8Array.from(out);
}

export function getPayloadBytes(part: MimePart): Uint8Array | null {
  if (part.isMultipart) return null;
  const body = part.bodyLatin1;

  if (part.cte === "base64") {
    const cleaned = body.replace(/[^A-Za-z0-9+/=]/g, "");

    return Uint8Array.from(Buffer.from(cleaned, "base64"));
  }

  if (part.cte === "quoted-printable") {
    return decodeQuotedPrintable(body);
  }

  return Uint8Array.from(Buffer.from(body, "latin1"));
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  try {
    const decoder = new TextDecoder(charset as TextDecoderLabel, { fatal: false, ignoreBOM: true });

    return decoder.decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false, ignoreBOM: true }).decode(bytes);
  }
}

export function decodePart(part: MimePart): string {
  const payload = getPayloadBytes(part);

  if (payload === null) return "";
  const charset = part.charset ?? "utf-8";

  return decodeBytes(payload, charset);
}

export function walk(part: MimePart): MimePart[] {
  const out: MimePart[] = [part];

  for (const child of part.parts) out.push(...walk(child));

  return out;
}

const ENCODED_WORD_RE = /=\?([^?\s]+)\?([bBqQ])\?([^?\s]*)\?=/g;

const ADJACENT_WORDS_RE = /(=\?[^?\s]+\?[bBqQ]\?[^?\s]*\?=(?:\s+=\?[^?\s]+\?[bBqQ]\?[^?\s]*\?=)*)/g;

function decodeWordRun(run: string): string {
  const segments: Array<{ charset: string; parts: Uint8Array[] }> = [];

  for (const word of run.matchAll(ENCODED_WORD_RE)) {
    const charset = word[1]!.split("*")[0]!.toLowerCase();
    const encoding = word[2]!.toUpperCase();

    const decoded =
      encoding === "B"
        ? Uint8Array.from(Buffer.from(word[3]!, "base64"))
        : decodeQuotedPrintable(word[3]!.replaceAll("_", " "));

    const last = segments[segments.length - 1];

    if (last !== undefined && last.charset === charset) last.parts.push(decoded);
    else segments.push({ charset, parts: [decoded] });
  }

  const out: string[] = [];

  for (const segment of segments) {
    const size = segment.parts.reduce((total, part) => total + part.length, 0);
    const bytes = new Uint8Array(size);
    let offset = 0;

    for (const part of segment.parts) {
      bytes.set(part, offset);
      offset += part.length;
    }

    out.push(decodeBytes(bytes, segment.charset));
  }

  return out.join("");
}

export function decodeHeader(value: string): string {
  const text = /[\u0080-\u00ff]/.test(value)
    ? Buffer.from(value, "latin1").toString("utf8")
    : value;

  return text
    .replace(ADJACENT_WORDS_RE, (run) => decodeWordRun(run))
    .replace(/\s+/g, " ")
    .trim();
}

const HTML_ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", " "],
]);

function decodeEntities(text: string, named: boolean): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (!name.startsWith("#"))
      return named ? (HTML_ENTITIES.get(name.toLowerCase()) ?? entity) : entity;
    const code = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1));

    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function tidyText(text: string): string {
  return text
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]|\u034f/g, "")
    .replace(/[ \t\u00a0\r]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|table|blockquote)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
    true,
  );
}

export function textBody(msg: MimePart): string {
  const leaves = walk(msg).filter(
    (part) =>
      !part.isMultipart && !/^\s*attachment\b/i.test(part.headers.get("content-disposition") ?? ""),
  );

  const plain = leaves.find((part) => part.contentType === "text/plain");

  const plainText = plain ? tidyText(decodeEntities(pyStrip(decodePart(plain)), false)) : "";

  if (plainText) return plainText;
  const html = leaves.find((part) => part.contentType === "text/html");

  return html ? tidyText(htmlToText(decodePart(html))) : "";
}

export const KHAOS_LABEL = "khaos";

export const NOISE_LABEL = "khaos/noise";

export const GMAIL_INBOX_LABEL = "\\Inbox";

const BULK_HEADERS = [
  ["list-unsubscribe", "list_unsubscribe"],
  ["list-id", "list_id"],
  ["precedence", "precedence"],
  ["auto-submitted", "auto_submitted"],
  ["feedback-id", "feedback_id"],
] as const;

function archiveFolder(vault: string, received: Date): string {
  return join(vault, "sources", "email", received.toISOString().slice(0, 7));
}

function msgIdHash(gmMsgId: string): string {
  return createHash("sha256").update(gmMsgId).digest("hex");
}

export function archiveEmail(vault: string, message: FetchedMessage): string {
  const msg = messageFromBytes(message.raw);
  const folder = archiveFolder(vault, message.internalDate);
  const hash = msgIdHash(message.gmMsgId);
  const eml = join(folder, `${hash}.eml`);

  mkdirSync(folder, { recursive: true });

  try {
    writeFileSync(eml, message.raw, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (!existsSync(eml)) throw error;
  }

  const header = (name: string): string => decodeHeader(msg.headers.get(name) ?? "");
  const subject = header("subject");
  const bulk = new Map<string, string>();

  for (const [name, field] of BULK_HEADERS) {
    if (msg.headers.has(name)) bulk.set(field, header(name));
  }

  const from = header("from");
  const to = header("to");
  const date = header("date");
  const messageId = header("message-id").replace(/^<|>$/g, "");
  const text = textBody(msg) || "(no text body)";

  const body = [
    text,
    "",
    "## Message",
    "",
    `- From: ${from}`,
    `- To: ${to}`,
    `- Subject: ${subject}`,
    `- Date: ${date}`,
    `- Original: [${hash}.eml](${hash}.eml)`,
    "",
  ].join("\n");

  return writeSource(vault, body, {
    source: "email",
    source_id: message.gmMsgId,
    received_at: message.internalDate.toISOString(),
    route: "pending",
    title: subject || "(no subject)",
    from,
    to,
    subject,
    date,
    message_id: messageId,
    eml: relative(vault, eml).replaceAll("\\", "/"),
    has_calendar: String(walk(msg).some((part) => part.contentType === "text/calendar")),
    ...Object.fromEntries(bulk),
  });
}

export const EMAIL_CURSOR = "gmail-cursor.json";

export const EMAIL_LABEL_RETRY = "gmail-label-retry.json";

const CursorSchema = z
  .object({
    account: z.string().min(1),
    uidvalidity: z.number().int().positive(),
    next_uid: z.number().int().positive(),
    synced_at: z.iso.datetime({ offset: true }),
  })
  .strict();

export type EmailCursor = z.infer<typeof CursorSchema>;

const LabelChangeSchema = z
  .object({
    gm_msgid: z.string().regex(/^\d+$/),
    source_note: z.string(),
    add: z.array(z.string()),
    remove: z.array(z.string()),
  })
  .strict();

export type LabelChange = z.infer<typeof LabelChangeSchema>;

function writeLedgerFile(root: string, name: string, text: string): void {
  const directory = join(root, ".ledger");

  mkdirSync(directory, { recursive: true });
  const path = join(directory, name);
  const temporary = `${path}.${randomUUID()}.tmp`;

  try {
    writeFileSync(temporary, text, { flag: "wx", mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function loadCursor(root: string): EmailCursor | null {
  const path = join(root, ".ledger", EMAIL_CURSOR);

  return existsSync(path) ? CursorSchema.parse(JSON.parse(readFileSync(path, "utf8"))) : null;
}

function saveCursor(root: string, cursor: EmailCursor): void {
  writeLedgerFile(root, EMAIL_CURSOR, `${JSON.stringify(cursor)}\n`);
}

function loadLabelRetries(root: string): LabelChange[] {
  const path = join(root, ".ledger", EMAIL_LABEL_RETRY);

  return existsSync(path)
    ? z.array(LabelChangeSchema).parse(JSON.parse(readFileSync(path, "utf8")))
    : [];
}

function saveLabelRetries(root: string, changes: LabelChange[]): void {
  writeLedgerFile(root, EMAIL_LABEL_RETRY, `${JSON.stringify(changes)}\n`);
}

export function labelChangeFor(
  gmMsgId: string,
  sourceNote: string,
  decision: RouteDecision,
  tuning: Tuning,
): LabelChange | null {
  if (decision.decision !== "noise") return null;

  return {
    gm_msgid: gmMsgId,
    source_note: sourceNote,
    add: [NOISE_LABEL],
    remove: tuning.gmail_auto_archive ? [GMAIL_INBOX_LABEL] : [],
  };
}

export const queueEmailLabels: LabelFn = async ({ root, item, decision, tuning }) => {
  const change = labelChangeFor(item.data.source_id, item.relativePath, decision, tuning);

  if (change) saveLabelRetries(root, [...loadLabelRetries(root), change]);
};

async function applyLabelChange(
  session: GmailSession,
  change: LabelChange,
  actions: string[],
): Promise<void> {
  let found: boolean;

  try {
    found = await session.labelMessage(change.gm_msgid, change.add, change.remove);
  } catch (error) {
    if (!(error instanceof ImapCommandError)) throw error;
    actions.push(`label change refused (${error.message})  ${change.source_note}`);

    return;
  }

  if (!found) {
    actions.push(`no longer in Gmail, labels skipped  ${change.source_note}`);

    return;
  }

  for (const label of change.add) actions.push(`labeled ${label}  ${change.source_note}`);

  if (change.remove.includes(GMAIL_INBOX_LABEL)) {
    actions.push(`archived out of the Gmail inbox  ${change.source_note}`);
  }
}

async function drainLabelRetries(
  session: GmailSession,
  root: string,
  actions: string[],
): Promise<void> {
  for (let next = loadLabelRetries(root)[0]; next; next = loadLabelRetries(root)[0]) {
    await applyLabelChange(session, next, actions);
    saveLabelRetries(root, loadLabelRetries(root).slice(1));
  }
}

export interface EmailPaths {
  root: string;
  vault: string;
  indexDir: string;
}

export interface EmailAccount {
  address: string;
  password: string;
  endpoint: ImapEndpoint;
}

export interface EmailSyncReport {
  busy: false;
  baseline: EmailCursor | null;
  uidValidityReset: { previous: number; current: number } | null;
  archived: number;
  alreadyArchived: number;
  actions: string[];
  routed: RouteItemResult[];
  routerBusy: boolean;
}

export type EmailRunResult = EmailSyncReport | { busy: true };

const RECOVERY_SKEW_MS = 5 * 60_000;

export async function syncInbox(
  session: GmailSession,
  paths: EmailPaths,
  account: string,
  now: Date,
): Promise<EmailSyncReport> {
  const { root, vault, indexDir } = paths;

  const report: EmailSyncReport = {
    busy: false,
    baseline: null,
    uidValidityReset: null,
    archived: 0,
    alreadyArchived: 0,
    actions: [],
    routed: [],
    routerBusy: false,
  };

  let status = await session.selectInbox();
  const cursor = loadCursor(root);
  const syncedAt = now.toISOString();

  if (cursor === null || cursor.account !== account) {
    report.baseline = {
      account,
      uidvalidity: status.uidValidity,
      next_uid: status.uidNext,
      synced_at: syncedAt,
    };

    saveCursor(root, report.baseline);
    emit(root, "gmail_baseline", {
      source: "email",
      ref: INBOX,
      payload: { uidvalidity: status.uidValidity, next_uid: status.uidNext },
    });

    return report;
  }

  await drainLabelRetries(session, root, report.actions);

  status = await session.selectInbox();

  let candidates: MessageMeta[] = [];
  let nextUid = cursor.next_uid;

  if (cursor.uidvalidity !== status.uidValidity) {
    const since = Date.parse(cursor.synced_at) - RECOVERY_SKEW_MS;
    const uids = await session.uidsSince(new Date(since - 86_400_000));

    candidates = (await session.fetchMeta(uids)).filter(
      (meta) => meta.internalDate.getTime() >= since,
    );

    nextUid = 1;
    report.uidValidityReset = { previous: cursor.uidvalidity, current: status.uidValidity };
    emit(root, "gmail_uidvalidity_reset", {
      source: "email",
      ref: INBOX,
      payload: { ...report.uidValidityReset, candidates: candidates.length },
    });
  } else if (status.uidNext > cursor.next_uid) {
    candidates = await session.fetchMeta(await session.uidsFrom(cursor.next_uid));
  }

  for (const meta of candidates) {
    const note = join(archiveFolder(vault, meta.internalDate), `${msgIdHash(meta.gmMsgId)}.md`);
    let archived: string | null = existsSync(note) ? note : null;

    if (archived) {
      report.alreadyArchived += 1;
    } else {
      const message = await session.fetchMessage(meta.uid);

      if (message) {
        archived = archiveEmail(vault, message);
        report.archived += 1;
      }
    }

    if (archived && !meta.labels.includes(KHAOS_LABEL)) {
      await session.storeLabels(meta.uid, [KHAOS_LABEL], []);
      report.actions.push(
        `labeled ${KHAOS_LABEL}  ${relative(vault, archived).replaceAll("\\", "/")}`,
      );
    }

    nextUid = Math.max(nextUid, meta.uid + 1);
    saveCursor(root, {
      account,
      uidvalidity: status.uidValidity,
      next_uid: nextUid,
      synced_at: syncedAt,
    });
  }

  saveCursor(root, {
    account,
    uidvalidity: status.uidValidity,
    next_uid: Math.max(nextUid, status.uidNext),
    synced_at: syncedAt,
  });

  if (listSources(vault, { source: "email", route: "pending", limit: 1 }).length > 0) {
    const label: LabelFn = async ({ item, decision, tuning }) => {
      const change = labelChangeFor(item.data.source_id, item.relativePath, decision, tuning);

      if (!change) return;

      try {
        await applyLabelChange(session, change, report.actions);
      } catch (error) {
        saveLabelRetries(root, [...loadLabelRetries(root), change]);
        throw error;
      }
    };

    const result = await runRouter(root, vault, { source: "email", now, label });

    report.routed = result.items;
    report.routerBusy = result.busy;

    if (report.archived > 0 && result.items.every((item) => item.decision === null)) {
      indexVault(vault, indexDir);
    }
  } else if (report.archived > 0) {
    indexVault(vault, indexDir);
  }

  return report;
}

const EmailBusyErrorSchema = z.object({ code: z.literal("SQLITE_BUSY") });

async function withEmailLock<T>(root: string, work: () => Promise<T>): Promise<T | null> {
  mkdirSync(join(root, ".ledger"), { recursive: true });
  const lock = new Database(join(root, ".ledger", "gmail-lock.db"));

  try {
    try {
      lock.exec("PRAGMA busy_timeout = 0; BEGIN IMMEDIATE");
    } catch (error) {
      if (!EmailBusyErrorSchema.safeParse(error).success) throw error;

      return null;
    }

    return await work();
  } finally {
    lock.close();
  }
}

async function openSession(account: EmailAccount): Promise<GmailSession> {
  return await GmailSession.open(
    await connectImap(account.endpoint),
    account.address,
    account.password,
    [KHAOS_LABEL, NOISE_LABEL],
  );
}

export async function ingestEmailOnce(
  paths: EmailPaths,
  account: EmailAccount,
  now: Date = new Date(),
): Promise<EmailRunResult> {
  const report = await withEmailLock(paths.root, async () => {
    const session = await openSession(account);

    try {
      const result = await syncInbox(session, paths, account.address, now);

      await session.logout();

      return result;
    } finally {
      session.close();
    }
  });

  return report ?? { busy: true };
}

export const REIDLE_MS = 28 * 60_000;

export interface WatchEmailOptions {
  signal: AbortSignal;
  onReport: (report: EmailSyncReport) => void;
  onError: (message: string, retryInMs: number) => void;
  reidleMs?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
}

async function pause(ms: number, signal: AbortSignal): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  const timer = setTimeout(resolve, ms);

  signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
      resolve();
    },
    { once: true },
  );

  await promise;
}

export async function watchEmail(
  paths: EmailPaths,
  account: EmailAccount,
  options: WatchEmailOptions,
): Promise<boolean> {
  const { signal } = options;
  const firstDelay = options.backoffMs ?? 5_000;
  const maxDelay = options.maxBackoffMs ?? 5 * 60_000;

  const ran = await withEmailLock(paths.root, async () => {
    let delay = firstDelay;

    while (!signal.aborted) {
      let session: GmailSession | null = null;

      try {
        session = await openSession(account);

        while (!signal.aborted) {
          options.onReport(await syncInbox(session, paths, account.address, new Date()));

          if ((await session.idle(options.reidleMs ?? REIDLE_MS, signal)) === "aborted") break;

          delay = firstDelay;
        }

        await session.logout();
      } catch (error) {
        if (signal.aborted) break;
        options.onError(error instanceof Error ? error.message : String(error), delay);
        await pause(delay, signal);
        delay = Math.min(delay * 2, maxDelay);
      } finally {
        session?.close();
      }
    }

    return true;
  });

  return ran !== null;
}

export function renderEmailReport(result: EmailRunResult): string[] {
  if (result.busy) return ["email: another Gmail ingester is running; nothing to do"];
  const lines: string[] = [];

  if (result.baseline) {
    lines.push(
      `email: first contact — cursor set at UID ${result.baseline.next_uid} ` +
        `(UIDVALIDITY ${result.baseline.uidvalidity}); mail arriving from now on is archived`,
    );
  }

  if (result.uidValidityReset) {
    lines.push(
      `email: UIDVALIDITY changed ${result.uidValidityReset.previous} → ` +
        `${result.uidValidityReset.current}; rechecked mail since the last sync`,
    );
  }

  if (!result.baseline) {
    lines.push(`email: archived ${result.archived}, already archived ${result.alreadyArchived}`);
  }

  for (const action of result.actions) lines.push(`  ${action}`);

  if (result.routerBusy) lines.push("  router already running; new mail stays pending");

  for (const item of result.routed) {
    const target = item.capture ? `  → ${item.capture}` : "";

    lines.push(
      `  ${item.decision?.decision ?? "pending"}  ${item.sourceNote}  ${item.decision?.reason ?? item.error}${target}`,
    );
  }

  return lines;
}

export function quietReport(report: EmailSyncReport): boolean {
  return (
    !report.baseline &&
    !report.uidValidityReset &&
    report.archived === 0 &&
    report.alreadyArchived === 0 &&
    report.actions.length === 0 &&
    report.routed.length === 0 &&
    !report.routerBusy
  );
}
