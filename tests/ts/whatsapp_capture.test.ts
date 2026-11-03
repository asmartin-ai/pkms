import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { stamp } from "../../src/pkms/capture.ts";
import { append, load } from "../../src/pkms/ledger.ts";
import { NotConnectedError } from "../../src/pkms/ramps/email.ts";
import {
  WHATSAPP_CURSOR,
  WHATSAPP_FIRST_RUN_WINDOW_MS,
  WHATSAPP_LEDGER,
  drainWhatsApp,
  whatsappRamp,
} from "../../src/pkms/ramps/whatsapp.ts";

import type { RampContext } from "../../src/pkms/ramp.ts";
import {
  WacliNotInstalledError,
  type WacliMessage,
  type WacliRunner,
} from "../../src/pkms/wacli.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

const dirs: string[] = [];

afterEach(() => {
  rmTmp(...dirs);
  dirs.length = 0;
});

const SELF_PN = "15550001111@s.whatsapp.net";

const SELF_LID = "998877@lid";

const INSTINCT_JID = "15550009999@s.whatsapp.net";

const OTHER_CHAT = "15550007777@s.whatsapp.net";

function at(day: number, hour: number, minute: number, second = 0): string {
  return new Date(Date.UTC(2026, 9, day, hour, minute, second)).toISOString();
}

function hhmm(iso: string): string {
  const when = new Date(iso);

  return `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
}

function msg(
  id: string,
  chatJid: string,
  timestamp: string,
  fields: {
    text?: string;
    caption?: string;
    mediaType?: string;
    filename?: string;
    reactionTo?: string;
    fromMe?: boolean;
    revoked?: boolean;
    deletedForMe?: boolean;
  } = {},
): WacliMessage {
  const text = fields.text ?? "";

  return {
    chatJid,
    chatName: chatJid,
    msgId: id,
    senderJid: chatJid,
    senderName: "",
    timestamp,
    fromMe: fields.fromMe ?? true,
    text,
    displayText: text,
    reactionToId: fields.reactionTo ?? "",
    mediaType: fields.mediaType ?? "",
    mediaCaption: fields.caption ?? "",
    filename: fields.filename ?? "",
    revoked: fields.revoked ?? false,
    deletedForMe: fields.deletedForMe ?? false,
  };
}

interface MessageWire {
  ChatJID: string;
  ChatName: string;
  MsgID: string;
  SenderJID: string;
  SenderName: string;
  Timestamp: string;
  FromMe: boolean;
  Text: string;
  DisplayText: string;
  ReactionToID: string;
  MediaType: string;
  MediaCaption: string;
  Filename: string;
  Revoked: boolean;
  DeletedForMe: boolean;
}

function wireRow(row: WacliMessage): MessageWire {
  return {
    ChatJID: row.chatJid,
    ChatName: row.chatName,
    MsgID: row.msgId,
    SenderJID: row.senderJid,
    SenderName: row.senderName,
    Timestamp: row.timestamp,
    FromMe: row.fromMe,
    Text: row.text,
    DisplayText: row.displayText,
    ReactionToID: row.reactionToId,
    MediaType: row.mediaType,
    MediaCaption: row.mediaCaption,
    Filename: row.filename,
    Revoked: row.revoked,
    DeletedForMe: row.deletedForMe,
  };
}

interface FakeOptions {
  linkedJid?: string;
  authenticated?: boolean;
  ignoreChat?: boolean;
}

interface DoctorWire {
  store_dir: string;
  lock_held: boolean;
  authenticated: boolean;
  session_revoked: boolean;
  linked_jid?: string;
  connected: boolean;
  connection_state: string;
  fts_enabled: boolean;
  store: { messages: number; chats: number; contacts: number; groups: number };
}

interface WacliFake {
  calls: string[][];
  run: WacliRunner;
}

function flagValue(argv: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;

  for (const item of argv) {
    if (item.startsWith(prefix)) return item.slice(prefix.length);
  }

  return null;
}

function pageFor(rows: readonly WacliMessage[], argv: readonly string[]): WacliMessage[] {
  const chat =
    flagValue(argv, "chat")
      ?.toLowerCase()
      .replace(/:\d+(?=@)/, "") ?? "";

  const after = flagValue(argv, "after");
  const afterMs = after === null ? Number.NEGATIVE_INFINITY : Date.parse(after);
  const limit = Number(flagValue(argv, "limit") ?? "100");

  return rows
    .filter(
      (row) =>
        row.chatJid.toLowerCase().replace(/:\d+(?=@)/, "") === chat &&
        Date.parse(row.timestamp) > afterMs,
    )
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(0, limit);
}

function makeFake(rows: readonly WacliMessage[], opts: FakeOptions = {}): WacliFake {
  const calls: string[][] = [];
  const linkedJid = "linkedJid" in opts ? opts.linkedJid : SELF_PN;
  const authenticated = opts.authenticated ?? true;
  const ignoreChat = opts.ignoreChat ?? false;

  const run: WacliRunner = async (argv) => {
    calls.push([...argv]);

    if (argv[3] === "doctor") {
      const wire: DoctorWire = {
        store_dir: "/tmp/wacli-fake-store",
        lock_held: false,
        authenticated,
        session_revoked: false,
        connected: false,
        connection_state: "disconnected",
        fts_enabled: true,
        store: { messages: rows.length, chats: 2, contacts: 0, groups: 0 },
      };

      if (linkedJid !== undefined) wire.linked_jid = linkedJid;

      return {
        exitCode: 0,
        stdout: JSON.stringify({ success: true, data: wire, error: null }),
        stderr: "",
      };
    }

    if (argv[3] === "messages" && argv[4] === "list") {
      const page = ignoreChat ? rows : pageFor(rows, argv);

      return {
        exitCode: 0,
        stdout: JSON.stringify({
          success: true,
          data: { fts: true, messages: page.map(wireRow) },
          error: null,
        }),
        stderr: "",
      };
    }

    return { exitCode: 1, stdout: "", stderr: `wacli: unknown command ${argv.slice(3).join(" ")}` };
  };

  return { calls, run };
}

function makeCtx(secrets: Record<string, string> = {}): RampContext {
  const root = mkTmp();

  dirs.push(root);
  mkdirSync(join(root, "vault"), { recursive: true });

  return {
    root,
    vault: join(root, "vault"),
    indexDir: join(root, ".index"),
    readSecret: (name) => secrets[name] ?? null,
  };
}

function seedCursor(ctx: RampContext, iso: string): void {
  mkdirSync(ctx.indexDir, { recursive: true });
  writeFileSync(join(ctx.indexDir, WHATSAPP_CURSOR), `${iso}\n`);
}

function cursorLines(ctx: RampContext): string[] {
  return readFileSync(join(ctx.indexDir, WHATSAPP_CURSOR), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

function inboxFiles(ctx: RampContext): string[] {
  const inbox = join(ctx.vault, "inbox");

  return existsSync(inbox) ? readdirSync(inbox).sort() : [];
}

function readInbox(ctx: RampContext, name: string): string {
  return readFileSync(join(ctx.vault, "inbox", name), "utf8");
}

function instinctNote(iso: string): string {
  return `whatsapp-instinct-${stamp(new Date(iso)).slice(0, 10)}.md`;
}

describe("whatsapp ramp", () => {
  test("registers with the expected name and metadata", () => {
    expect(whatsappRamp.name).toBe("whatsapp");
    expect(whatsappRamp.setupDoc).toBe("docs/whatsapp-setup.md");
    expect(whatsappRamp.secrets).toEqual(["whatsapp-instinct-jid"]);
  });

  test("a self-chat message becomes one inbox note", async () => {
    const ctx = makeCtx();

    seedCursor(ctx, at(6, 9, 0));

    const when = at(7, 9, 5);
    const fake = makeFake([msg("s1", SELF_PN, when, { text: "buy oat milk" })]);
    const report = await drainWhatsApp(ctx, { runner: fake.run });

    expect(fake.calls[0]).toEqual(["wacli", "--read-only", "--json", "doctor"]);
    expect(report.captured).toBe(1);
    expect(report.line).toBe("whatsapp: captured 1 (self 1, instinct 0), skipped 0");
    const note = `${stamp(new Date(when))}_buy-oat-milk.md`;

    expect(inboxFiles(ctx)).toEqual([note]);
    expect(readInbox(ctx, note)).toContain(
      "source: whatsapp\nwhatsapp_id: s1\n---\n\nbuy oat milk\n",
    );
    expect(load(ctx.indexDir, WHATSAPP_LEDGER).has("s1")).toBe(true);
  });

  test("a short page ends the chat and the walk moves to the next one", async () => {
    const ctx = makeCtx({ "whatsapp-instinct-jid": INSTINCT_JID });

    seedCursor(ctx, at(6, 12, 0));

    const fake = makeFake([
      msg("s1", SELF_PN, at(7, 9, 5), { text: "first" }),
      msg("s2", SELF_PN, at(7, 9, 6), { text: "second" }),
    ]);

    await drainWhatsApp(ctx, { runner: fake.run });

    expect(fake.calls).toHaveLength(3);
    expect(fake.calls[1]).toEqual([
      "wacli",
      "--read-only",
      "--json",
      "messages",
      "list",
      `--chat=${SELF_PN}`,
      `--after=${new Date(Date.parse(at(6, 12, 0)) - 60 * 60 * 1000).toISOString()}`,
      "--limit=100",
      "--asc",
    ]);
    expect(fake.calls[2]).toEqual([
      "wacli",
      "--read-only",
      "--json",
      "messages",
      "list",
      `--chat=${INSTINCT_JID}`,
      `--after=${new Date(Date.parse(at(6, 12, 0)) - 60 * 60 * 1000).toISOString()}`,
      "--limit=100",
      "--asc",
    ]);
  });

  test("a full page of already-seen rows does not end the walk", async () => {
    const ctx = makeCtx();

    seedCursor(ctx, at(6, 9, 0));

    const rows: WacliMessage[] = [];

    for (let n = 0; n < 150; n += 1) {
      rows.push(msg(`seen${n}`, SELF_PN, at(7, 7, 0, n), { text: `old ${n}` }));
    }

    rows.push(msg("n1", SELF_PN, at(7, 9, 10), { text: "new one" }));
    rows.push(msg("n2", SELF_PN, at(7, 9, 11), { text: "new two" }));
    rows.push(msg("n3", SELF_PN, at(7, 9, 12), { text: "new three" }));

    for (const row of rows.slice(0, 150)) append(ctx.indexDir, WHATSAPP_LEDGER, [row.msgId]);

    const fake = makeFake(rows);
    const report = await drainWhatsApp(ctx, { runner: fake.run });

    expect(report.line).toBe("whatsapp: captured 3 (self 3, instinct 0), skipped 151");
    expect(inboxFiles(ctx)).toHaveLength(3);
  });

  test("a run of messages sharing one timestamp terminates", async () => {
    const ctx = makeCtx();

    seedCursor(ctx, at(6, 9, 0));

    const rows: WacliMessage[] = [];

    for (let n = 0; n < 120; n += 1) {
      rows.push(msg(`same${n}`, SELF_PN, at(7, 9, 0), { text: `burst ${n}` }));
    }

    const fake = makeFake(rows);
    const report = await drainWhatsApp(ctx, { runner: fake.run });

    expect(report.captured).toBe(100);
    expect(fake.calls).toHaveLength(3);
  });

  test("a self message is one note and an Instinct message is a rolling line", async () => {
    const ctx = makeCtx({ "whatsapp-instinct-jid": INSTINCT_JID });

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([
      msg("s1", SELF_PN, at(7, 9, 5), { text: "buy oat milk" }),
      msg("s2", SELF_PN, at(7, 9, 6), { text: "then the dentist" }),
      msg("i1", INSTINCT_JID, at(7, 9, 12), { text: "remind me about rent" }),
      msg("i2", INSTINCT_JID, at(7, 9, 13), { text: "Noted.", fromMe: false }),
    ]);

    const report = await drainWhatsApp(ctx, { runner: fake.run });
    const note = instinctNote(at(7, 9, 12));

    expect(report.line).toBe("whatsapp: captured 4 (self 2, instinct 2), skipped 0");
    expect(inboxFiles(ctx)).toEqual([
      `${stamp(new Date(at(7, 9, 5)))}_buy-oat-milk.md`,
      `${stamp(new Date(at(7, 9, 6)))}_then-the-dentist.md`,
      note,
    ]);
    expect(readInbox(ctx, note)).toBe(
      `---\ncaptured: ${stamp(new Date(at(7, 9, 12))).slice(0, 10)} ${hhmm(at(7, 9, 12))}:00\n` +
        "source: whatsapp\nwhatsapp_chat: instinct\n---\n\n" +
        `# Instinct — ${stamp(new Date(at(7, 9, 12))).slice(0, 10)}\n\n` +
        `- ${hhmm(at(7, 9, 12))} me: remind me about rent\n` +
        `- ${hhmm(at(7, 9, 13))} instinct: Noted.\n`,
    );
    expect(cursorLines(ctx)).toEqual([at(7, 9, 13)]);
  });

  test("an out-of-order Instinct batch is sorted by time inside one run", async () => {
    const ctx = makeCtx({ "whatsapp-instinct-jid": INSTINCT_JID });

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([
      msg("i3", INSTINCT_JID, at(7, 9, 20), { text: "third" }),
      msg("i2", INSTINCT_JID, at(7, 9, 13), { text: "second", fromMe: false }),
      msg("i1", INSTINCT_JID, at(7, 9, 12), { text: "first" }),
    ]);

    const report = await drainWhatsApp(ctx, { runner: fake.run });
    const note = instinctNote(at(7, 9, 12));

    expect(report.line).toBe("whatsapp: captured 3 (self 0, instinct 3), skipped 0");
    expect(readInbox(ctx, note)).toContain(
      `- ${hhmm(at(7, 9, 12))} me: first\n` +
        `- ${hhmm(at(7, 9, 13))} instinct: second\n` +
        `- ${hhmm(at(7, 9, 20))} me: third\n`,
    );
  });

  test("deleted and empty-text messages are skipped and counted", async () => {
    const ctx = makeCtx();

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([
      msg("s1", SELF_PN, at(7, 9, 1), { text: "pick up milk" }),
      msg("s2", SELF_PN, at(7, 9, 2), { text: "never sent", revoked: true }),
      msg("s3", SELF_PN, at(7, 9, 3), { text: "gone for me", deletedForMe: true }),
      msg("s4", SELF_PN, at(7, 9, 4)),
      msg("s5", SELF_PN, at(7, 9, 5), { caption: "chart of rent" }),
    ]);

    const report = await drainWhatsApp(ctx, { runner: fake.run });

    expect(report.line).toBe("whatsapp: captured 2 (self 2, instinct 0), skipped 3");
    expect(inboxFiles(ctx)).toEqual([
      `${stamp(new Date(at(7, 9, 1)))}_pick-up-milk.md`,
      `${stamp(new Date(at(7, 9, 5)))}_chart-of-rent.md`,
    ]);
    expect(readInbox(ctx, `${stamp(new Date(at(7, 9, 5)))}_chart-of-rent.md`)).toContain(
      "chart of rent\n",
    );
    expect(load(ctx.indexDir, WHATSAPP_LEDGER).has("s2")).toBe(false);
  });

  test("Instinct media without text lands as a placeholder line; reactions stay skipped", async () => {
    const ctx = makeCtx({ "whatsapp-instinct-jid": INSTINCT_JID });

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([
      msg("i1", INSTINCT_JID, at(7, 9, 10), { text: "look at this" }),
      msg("i2", INSTINCT_JID, at(7, 9, 11), { mediaType: "image" }),
      msg("i3", INSTINCT_JID, at(7, 9, 12), {
        mediaType: "image",
        text: "shelf photo",
        caption: "shelf photo",
      }),
      msg("i4", INSTINCT_JID, at(7, 9, 13), {
        mediaType: "document",
        filename: "lease 2026.pdf",
        fromMe: false,
      }),
      msg("i5", INSTINCT_JID, at(7, 9, 14), { reactionTo: "i2", fromMe: false }),
      msg("i6", INSTINCT_JID, at(7, 9, 15), { mediaType: "image", revoked: true }),
      msg("i7", INSTINCT_JID, at(7, 9, 16), { text: "what is in the photo?", fromMe: false }),
    ]);

    const report = await drainWhatsApp(ctx, { runner: fake.run });
    const note = instinctNote(at(7, 9, 10));

    expect(report.line).toBe("whatsapp: captured 5 (self 0, instinct 5), skipped 2");
    expect(readInbox(ctx, note)).toContain(
      `- ${hhmm(at(7, 9, 10))} me: look at this\n` +
        `- ${hhmm(at(7, 9, 11))} me: [image]\n` +
        `- ${hhmm(at(7, 9, 12))} me: [image] shelf photo\n` +
        `- ${hhmm(at(7, 9, 13))} instinct: [document: lease 2026.pdf]\n` +
        `- ${hhmm(at(7, 9, 16))} instinct: what is in the photo?\n`,
    );
    expect(load(ctx.indexDir, WHATSAPP_LEDGER).has("i5")).toBe(false);

    const again = await drainWhatsApp(ctx, { runner: fake.run });

    expect(again.line).toBe("whatsapp: captured 0 (self 0, instinct 0), skipped 7");
  });

  test("a self-chat image becomes an inbox note with the placeholder body", async () => {
    const ctx = makeCtx();

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([
      msg("s1", SELF_PN, at(7, 9, 1), { mediaType: "image" }),
      msg("s2", SELF_PN, at(7, 9, 2), {
        mediaType: "document",
        filename: "rent\nreceipt.pdf",
        text: "for the tax folder",
        caption: "for the tax folder",
      }),
    ]);

    const report = await drainWhatsApp(ctx, { runner: fake.run });
    const image = `${stamp(new Date(at(7, 9, 1)))}_image.md`;
    const doc = `${stamp(new Date(at(7, 9, 2)))}_document-rent-receipt-pdf-for.md`;

    expect(report.line).toBe("whatsapp: captured 2 (self 2, instinct 0), skipped 0");
    expect(inboxFiles(ctx)).toEqual([image, doc]);
    expect(readInbox(ctx, image)).toEndWith("\n\n[image]\n");
    expect(readInbox(ctx, doc)).toEndWith("\n\n[document: rent receipt.pdf] for the tax folder\n");
  });

  test("a phone-number and an @lid self JID both count as the self-chat", async () => {
    const ctx = makeCtx({ "whatsapp-self-jid": SELF_LID, "whatsapp-instinct-jid": INSTINCT_JID });

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([
      msg("p1", "15550001111:12@s.whatsapp.net", at(7, 9, 5), { text: "as the phone number" }),
      msg("l1", SELF_LID, at(7, 9, 6), { text: "as the lid identity" }),
      msg("i1", INSTINCT_JID, at(7, 9, 7), { text: "instinct line", fromMe: false }),
    ]);

    const report = await drainWhatsApp(ctx, { runner: fake.run });

    expect(report.line).toBe("whatsapp: captured 3 (self 2, instinct 1), skipped 0");
    expect(inboxFiles(ctx)).toEqual([
      `${stamp(new Date(at(7, 9, 5)))}_as-the-phone-number.md`,
      `${stamp(new Date(at(7, 9, 6)))}_as-the-lid-identity.md`,
      instinctNote(at(7, 9, 7)),
    ]);
  });

  test("a secret self JID stands in when doctor reports none", async () => {
    const ctx = makeCtx({ "whatsapp-self-jid": SELF_PN });

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([msg("s1", SELF_PN, at(7, 9, 5), { text: "only me" })], {
      linkedJid: undefined,
    });

    const report = await drainWhatsApp(ctx, { runner: fake.run });

    expect(report.line).toBe("whatsapp: captured 1 (self 1, instinct 0), skipped 0");
    expect(inboxFiles(ctx)).toEqual([`${stamp(new Date(at(7, 9, 5)))}_only-me.md`]);
  });

  test("a row from another chat inside a page is skipped, not captured", async () => {
    const ctx = makeCtx({ "whatsapp-instinct-jid": INSTINCT_JID });

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake(
      [
        msg("s1", SELF_PN, at(7, 9, 5), { text: "mine" }),
        msg("o1", OTHER_CHAT, at(7, 9, 6), { text: "someone else", fromMe: false }),
      ],
      { ignoreChat: true },
    );

    const report = await drainWhatsApp(ctx, { runner: fake.run });

    expect(report.line).toBe("whatsapp: captured 1 (self 1, instinct 0), skipped 3");
    expect(inboxFiles(ctx)).toEqual([`${stamp(new Date(at(7, 9, 5)))}_mine.md`]);
  });

  test("a first run reads only the last two days", async () => {
    const ctx = makeCtx();

    const started = Date.now();
    const recent = new Date(started - 30 * 60_000).toISOString();
    const older = new Date(started - 5 * 86_400_000).toISOString();

    const fake = makeFake([
      msg("old", SELF_PN, older, { text: "from last week" }),
      msg("new", SELF_PN, recent, { text: "from today" }),
    ]);

    const report = await drainWhatsApp(ctx, { runner: fake.run });
    const asked = Date.parse(flagValue(fake.calls[1], "after") ?? "");
    const windowStart = started - WHATSAPP_FIRST_RUN_WINDOW_MS;

    expect(flagValue(fake.calls[1], "limit")).toBe("100");
    expect(fake.calls[1]).toContain("--asc");
    expect(asked).toBeGreaterThanOrEqual(windowStart);
    expect(asked).toBeLessThanOrEqual(windowStart + 5_000);
    expect(report.captured).toBe(1);
    expect(inboxFiles(ctx)).toEqual([`${stamp(new Date(recent))}_from-today.md`]);
  });

  test("pull rejects when the store is not paired, naming the setup doc", async () => {
    const ctx = makeCtx();

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([msg("s1", SELF_PN, at(7, 9, 5), { text: "hello" })], {
      authenticated: false,
    });

    await expect(drainWhatsApp(ctx, { runner: fake.run })).rejects.toThrow(
      /wacli[\s\S]*docs\/whatsapp-setup\.md/,
    );
    expect(fake.calls).toHaveLength(1);
  });

  test("pull rejects with NotConnectedError when wacli is not installed", async () => {
    const ctx = makeCtx();

    seedCursor(ctx, at(6, 9, 0));

    const run: WacliRunner = async () => {
      throw new WacliNotInstalledError();
    };

    await expect(drainWhatsApp(ctx, { runner: run })).rejects.toThrow(NotConnectedError);
    await expect(drainWhatsApp(ctx, { runner: run })).rejects.toThrow(
      /wacli[\s\S]*docs\/whatsapp-setup\.md/,
    );
  });

  test("without the Instinct JID only the self-chat is captured", async () => {
    const ctx = makeCtx();

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([
      msg("s1", SELF_PN, at(7, 9, 5), { text: "mine" }),
      msg("i1", INSTINCT_JID, at(7, 9, 6), { text: "instinct", fromMe: false }),
    ]);

    const report = await drainWhatsApp(ctx, { runner: fake.run });

    expect(report.line).toBe("whatsapp: captured 1 (self 1, instinct 0), skipped 0");
    expect(inboxFiles(ctx)).toEqual([`${stamp(new Date(at(7, 9, 5)))}_mine.md`]);
    expect(readInbox(ctx, `${stamp(new Date(at(7, 9, 5)))}_mine.md`)).not.toContain("instinct");
  });

  test("the cursor is written and drives the next drain's window", async () => {
    const ctx = makeCtx();

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([
      msg("s1", SELF_PN, at(7, 9, 5), { text: "one" }),
      msg("s2", SELF_PN, at(7, 9, 6), { text: "two" }),
    ]);

    const first = await drainWhatsApp(ctx, { runner: fake.run });
    const afterFirst = fake.calls.length;

    expect(first.line).toBe("whatsapp: captured 2 (self 2, instinct 0), skipped 0");
    expect(cursorLines(ctx)).toEqual([at(7, 9, 6)]);

    const second = await drainWhatsApp(ctx, { runner: fake.run });

    expect(second.line).toBe("whatsapp: captured 0 (self 0, instinct 0), skipped 2");
    expect(flagValue(fake.calls[afterFirst + 1], "after")).toBe(
      new Date(Date.parse(at(7, 9, 6)) - 60 * 60 * 1000).toISOString(),
    );
    expect(cursorLines(ctx)).toEqual([at(7, 9, 6)]);
    expect(inboxFiles(ctx)).toHaveLength(2);
  });

  test("the overlap window does not duplicate what a run already captured", async () => {
    const ctx = makeCtx({ "whatsapp-instinct-jid": INSTINCT_JID });

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([
      msg("s1", SELF_PN, at(7, 9, 5), { text: "one thought" }),
      msg("i1", INSTINCT_JID, at(7, 9, 6), { text: "only once" }),
    ]);

    const first = await drainWhatsApp(ctx, { runner: fake.run });
    const second = await drainWhatsApp(ctx, { runner: fake.run });
    const note = instinctNote(at(7, 9, 6));

    expect(first.captured).toBe(2);
    expect(second.captured).toBe(0);
    expect(inboxFiles(ctx)).toEqual([`${stamp(new Date(at(7, 9, 5)))}_one-thought.md`, note]);
    expect(readInbox(ctx, note).match(/instinct: |me: /g)).toHaveLength(1);
  });

  test("a normal drain takes the single-drain lock", async () => {
    const ctx = makeCtx();

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([msg("s1", SELF_PN, at(7, 9, 5), { text: "hello" })]);

    await drainWhatsApp(ctx, { runner: fake.run });

    expect(existsSync(join(ctx.root, ".ledger", "whatsapp-lock.db"))).toBe(true);
  });

  test("a note folded away the same day is not recreated; -2 opens instead", async () => {
    const ctx = makeCtx({ "whatsapp-instinct-jid": INSTINCT_JID });

    seedCursor(ctx, at(6, 9, 0));

    const store: WacliMessage[] = [msg("f1", INSTINCT_JID, at(7, 9, 0), { text: "one" })];
    const fake = makeFake(store);

    await drainWhatsApp(ctx, { runner: fake.run });
    mkdirSync(join(ctx.vault, "areas"), { recursive: true });
    renameSync(
      join(ctx.vault, "inbox", instinctNote(at(7, 9, 0))),
      join(ctx.vault, "areas", instinctNote(at(7, 9, 0))),
    );

    store.push(msg("f2", INSTINCT_JID, at(7, 9, 10), { text: "two", fromMe: false }));
    await drainWhatsApp(ctx, { runner: fake.run });
    store.push(msg("f3", INSTINCT_JID, at(7, 9, 11), { text: "three" }));
    await drainWhatsApp(ctx, { runner: fake.run });

    const reopened = instinctNote(at(7, 9, 0)).replace(".md", "-2.md");

    expect(inboxFiles(ctx)).toEqual([reopened]);
    expect(readInbox(ctx, reopened)).toContain(
      `- ${hhmm(at(7, 9, 10))} instinct: two\n- ${hhmm(at(7, 9, 11))} me: three\n`,
    );
    expect(readInbox(ctx, reopened)).not.toContain("one");
  });

  test("a new day opens a new rolling note", async () => {
    const ctx = makeCtx({ "whatsapp-instinct-jid": INSTINCT_JID });

    seedCursor(ctx, at(6, 9, 0));

    const fake = makeFake([
      msg("d1", INSTINCT_JID, at(7, 9, 0), { text: "late" }),
      msg("d2", INSTINCT_JID, at(8, 9, 1), { text: "early", fromMe: false }),
    ]);

    await drainWhatsApp(ctx, { runner: fake.run });

    expect(inboxFiles(ctx)).toEqual([instinctNote(at(7, 9, 0)), instinctNote(at(8, 9, 1))]);
    expect(readInbox(ctx, instinctNote(at(8, 9, 1)))).toContain(
      `- ${hhmm(at(8, 9, 1))} instinct: early\n`,
    );
  });
});
