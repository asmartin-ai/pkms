import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { z } from "zod";
import { stamp, writeCapture } from "../capture.ts";
import { emit } from "../events.ts";
import { append, load } from "../ledger.ts";
import { appendText, pyStrip, readText, writeText } from "../textio.ts";
import {
  assertAuthenticated,
  doctor,
  listMessages,
  messageBody,
  WacliNotAuthenticatedError,
  WacliNotInstalledError,
  type WacliMessage,
  type WacliOptions,
} from "../wacli.ts";
import type { InputRamp, RampContext, RampReport } from "../ramp.ts";
import { NotConnectedError } from "./email.ts";

export const WHATSAPP_RAMP_NAME = "whatsapp";

export const INSTINCT_NOTES_LEDGER = "whatsapp-instinct-notes.txt";

export const WHATSAPP_LEDGER = "whatsapp-ledger.txt";

export const WHATSAPP_CURSOR = "whatsapp-cursor.txt";

const PAGE_LIMIT = 100;

export const WHATSAPP_FIRST_RUN_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export const WHATSAPP_CURSOR_OVERLAP_MS = 60 * 60 * 1000;

const BusyErrorSchema = z.object({ code: z.literal("SQLITE_BUSY") });

interface DrainCounts {
  self: number;
  instinct: number;
  skipped: number;
}

export const whatsappRamp: InputRamp = {
  name: WHATSAPP_RAMP_NAME,
  description: "Read the wacli store: self-chat notes and the daily Instinct note",
  setupDoc: "docs/whatsapp-setup.md",
  secrets: ["whatsapp-instinct-jid"],
  pull: drainWhatsApp,
};

export async function drainWhatsApp(
  ctx: RampContext,
  opts: WacliOptions = {},
): Promise<RampReport> {
  mkdirSync(join(ctx.root, ".ledger"), { recursive: true });
  const lock = new Database(join(ctx.root, ".ledger", "whatsapp-lock.db"));

  try {
    try {
      lock.exec("PRAGMA busy_timeout = 10000; BEGIN IMMEDIATE");
    } catch (error) {
      if (!BusyErrorSchema.safeParse(error).success) throw error;

      return { captured: 0, skipped: 0, line: "whatsapp: another drain is running" };
    }

    const counts: DrainCounts = { self: 0, instinct: 0, skipped: 0 };

    try {
      return await captureFromStore(ctx, counts, opts);
    } catch (error) {
      if (error instanceof WacliNotInstalledError || error instanceof WacliNotAuthenticatedError) {
        throw new NotConnectedError(
          "wacli is not connected — install wacli, pair the phone once " +
            "with wacli auth, then let wacli sync mirror it; " +
            "docs/whatsapp-setup.md has the setup",
        );
      }

      throw error;
    }
  } finally {
    lock.close();
  }
}

async function captureFromStore(
  ctx: RampContext,
  counts: DrainCounts,
  opts: WacliOptions,
): Promise<RampReport> {
  const status = await doctor(opts);

  assertAuthenticated(status);

  const selfJids = selfCandidates(ctx, status.linkedJid);
  const instinctSecret = ctx.readSecret("whatsapp-instinct-jid");
  const instinctJid = instinctSecret === null ? null : normalizeJid(instinctSecret);
  const after = windowStart(ctx.indexDir);
  const seen = load(ctx.indexDir, WHATSAPP_LEDGER);
  const instinct: WacliMessage[] = [];
  let newest: number | null = null;

  for (const chat of instinctJid === null ? selfJids : [...selfJids, instinctJid]) {
    let pageAfter = after.getTime();
    let previousLast: number | null = null;

    for (;;) {
      const rows = await listMessages(
        { chat, after: new Date(pageAfter).toISOString(), limit: PAGE_LIMIT, asc: true },
        opts,
      );

      let last: WacliMessage | undefined;

      for (const row of rows) {
        last = row;
        const at = Date.parse(row.timestamp);

        if (newest === null || at > newest) newest = at;

        if (seen.has(row.msgId)) {
          counts.skipped += 1;
          continue;
        }

        const body = pyStrip(messageBody(row));

        if (row.revoked || row.deletedForMe || !body) {
          counts.skipped += 1;
        } else {
          const jid = normalizeJid(row.chatJid);

          if (selfJids.includes(jid)) {
            writeCapture(body, ctx.vault, {
              source: "whatsapp",
              now: new Date(at),
              extra: { whatsapp_id: row.msgId },
            });
            append(ctx.indexDir, WHATSAPP_LEDGER, [row.msgId]);
            counts.self += 1;
          } else if (jid === instinctJid) {
            instinct.push(row);
          } else {
            counts.skipped += 1;
          }
        }

        seen.add(row.msgId);
      }

      if (last === undefined) break;

      if (rows.length < PAGE_LIMIT) break;

      const lastAt = Date.parse(last.timestamp);

      if (lastAt <= pageAfter || (previousLast !== null && lastAt <= previousLast)) break;

      previousLast = lastAt;
      pageAfter = Math.max(lastAt - 1, pageAfter);
    }
  }

  instinct.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  for (const row of instinct) {
    appendInstinctLine(ctx, row);
    append(ctx.indexDir, WHATSAPP_LEDGER, [row.msgId]);
    counts.instinct += 1;
  }

  if (newest !== null) advanceCursor(ctx.indexDir, newest);

  const captured = counts.self + counts.instinct;

  return {
    captured,
    skipped: counts.skipped,
    line:
      `whatsapp: captured ${captured} (self ${counts.self}, instinct ${counts.instinct}), ` +
      `skipped ${counts.skipped}`,
  };
}

function selfCandidates(ctx: RampContext, linkedJid: string | undefined): string[] {
  const raw: string[] = [];

  if (linkedJid) raw.push(linkedJid);

  const override = ctx.readSecret("whatsapp-self-jid");

  if (override !== null) raw.push(override);

  const candidates: string[] = [];

  for (const jid of raw) {
    const normalized = normalizeJid(jid);

    if (normalized !== "" && !candidates.includes(normalized)) candidates.push(normalized);
  }

  return candidates;
}

function normalizeJid(jid: string): string {
  return jid.toLowerCase().replace(/:\d+(?=@)/, "");
}

function windowStart(indexDir: string): Date {
  const cursor = readCursor(indexDir);

  if (cursor === null) return new Date(Date.now() - WHATSAPP_FIRST_RUN_WINDOW_MS);

  return new Date(cursor - WHATSAPP_CURSOR_OVERLAP_MS);
}

function readCursor(indexDir: string): number | null {
  const path = join(indexDir, WHATSAPP_CURSOR);

  if (!existsSync(path)) return null;

  let at = Number.NaN;

  for (const line of readText(path).split("\n")) {
    const trimmed = pyStrip(line);

    if (trimmed) at = Date.parse(trimmed);
  }

  return Number.isNaN(at) ? null : at;
}

function advanceCursor(indexDir: string, newestMs: number): void {
  const cursor = readCursor(indexDir);

  if (cursor !== null && newestMs <= cursor) return;

  mkdirSync(indexDir, { recursive: true });
  writeText(join(indexDir, WHATSAPP_CURSOR), `${new Date(newestMs).toISOString()}\n`);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function appendInstinctLine(ctx: RampContext, msg: WacliMessage): void {
  const at = new Date(msg.timestamp);
  const path = rollingNote(ctx, stamp(at).slice(0, 10), at);
  const speaker = msg.fromMe ? "me" : "instinct";
  const text = pyStrip(messageBody(msg)).replace(/\n/g, "\n  ");

  appendText(path, `- ${pad(at.getHours())}:${pad(at.getMinutes())} ${speaker}: ${text}\n`);
}

function rollingNote(ctx: RampContext, day: string, at: Date): string {
  const ledgerDir = join(ctx.root, ".ledger");
  const inbox = join(ctx.vault, "inbox");
  const created: string[] = [];

  for (const entry of load(ledgerDir, INSTINCT_NOTES_LEDGER)) {
    if (entry.startsWith(`${day} `)) created.push(entry.slice(day.length + 1));
  }

  const latest = created.at(-1);

  if (latest !== undefined && existsSync(join(inbox, latest))) return join(inbox, latest);
  let n = created.length + 1;
  let name = n === 1 ? `whatsapp-instinct-${day}.md` : `whatsapp-instinct-${day}-${n}.md`;

  if (latest === undefined && existsSync(join(inbox, name))) {
    append(ledgerDir, INSTINCT_NOTES_LEDGER, [`${day} ${name}`]);

    return join(inbox, name);
  }

  while (existsSync(join(inbox, name))) {
    n += 1;
    name = `whatsapp-instinct-${day}-${n}.md`;
  }

  mkdirSync(inbox, { recursive: true });
  const path = join(inbox, name);

  writeText(
    path,
    `---\ncaptured: ${day} ${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}\n` +
      `source: whatsapp\nwhatsapp_chat: instinct\n---\n\n# Instinct — ${day}\n\n`,
  );
  append(ledgerDir, INSTINCT_NOTES_LEDGER, [`${day} ${name}`]);
  emit(ctx.root, "capture_written", {
    source: "whatsapp",
    ref: `inbox/${name}`,
    payload: { path: `inbox/${name}`, chat: "instinct" },
  });

  return path;
}
