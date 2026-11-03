import { afterEach, describe, expect, test } from "bun:test";
import type { Socket } from "bun";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  EMAIL_CURSOR,
  EMAIL_LABEL_RETRY,
  archiveEmail,
  decodeHeader,
  ingestEmailOnce,
  loadCursor,
  messageFromBytes,
  queueEmailLabels,
  textBody,
  watchEmail,
  type EmailAccount,
  type EmailPaths,
  type EmailRunResult,
  type EmailSyncReport,
} from "../../src/pkms/email_ingest.ts";
import { runRouter } from "../../src/pkms/route.ts";
import { listSources, readSource } from "../../src/pkms/sources.ts";
import { connectImap, GmailSession } from "../../src/pkms/imap.ts";
import { FakeGmail, type FakeMessage, type SessionState } from "./fake_imap.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

function mail(opts: {
  from?: string;
  subject?: string;
  body?: string;
  headers?: string[];
  contentType?: string;
}): string {
  return [
    `From: ${opts.from ?? "Ada Lovelace <ada@example.org>"}`,
    "To: alex@example.com",
    `Subject: ${opts.subject ?? "Lunch on Friday?"}`,
    "Date: Wed, 07 Oct 2026 09:00:00 +0000",
    `Message-ID: <${Math.random().toString(36).slice(2)}@example.org>`,
    ...(opts.headers ?? []),
    "MIME-Version: 1.0",
    `Content-Type: ${opts.contentType ?? 'text/plain; charset="utf-8"'}`,
    "",
    opts.body ?? "Shall we meet at noon?",
    "",
  ].join("\r\n");
}

const NEWSLETTER = {
  from: "Weekly Digest <digest@news.example.com>",
  subject: "This week in widgets",
  headers: ["List-Unsubscribe: <https://news.example.com/u>", "List-Id: <widgets.example.com>"],
};

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

interface Harness {
  gmail: FakeGmail;
  paths: EmailPaths;
  account: EmailAccount;
}

function setup(): Harness {
  const gmail = new FakeGmail().start();
  const root = mkTmp();
  const paths = { root, vault: join(root, "vault"), indexDir: join(root, ".index") };

  mkdirSync(paths.vault, { recursive: true });
  cleanups.push(() => {
    gmail.stop();
    rmTmp(root);
  });

  return {
    gmail,
    paths,
    account: {
      address: gmail.address,
      password: gmail.password,
      endpoint: { host: "127.0.0.1", port: gmail.port, tls: false },
    },
  };
}

function report(result: EmailRunResult): EmailSyncReport {
  if (result.busy) throw new Error("unexpected busy ingester");

  return result;
}

function emailSources(paths: EmailPaths) {
  return listSources(paths.vault, { source: "email" });
}

describe("email MIME helpers", () => {
  test("decodeHeader joins RFC 2047 B and Q words and raw UTF-8", () => {
    expect(decodeHeader("=?UTF-8?B?Q2Fmw6k=?= =?UTF-8?Q?_ce_soir?=")).toBe("Café ce soir");
    expect(decodeHeader(Buffer.from("Grüße", "utf8").toString("latin1"))).toBe("Grüße");
    expect(decodeHeader("Plain  subject\r\n continued")).toBe("Plain subject continued");
  });

  test("textBody prefers text/plain, falls back to stripped html, skips attachments", () => {
    const boundary = "b1";

    const multipart = (parts: string[]): Uint8Array =>
      Buffer.from(
        [
          "Subject: x",
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          "",
          ...parts.flatMap((part) => [`--${boundary}`, part]),
          `--${boundary}--`,
          "",
        ].join("\r\n"),
      );

    const attachment =
      'Content-Type: text/plain\r\nContent-Disposition: attachment; filename="a.txt"\r\n\r\nattached';

    const html =
      "Content-Type: text/html\r\n\r\n<p>Hello&nbsp;<b>there</b> &amp; welcome</p><style>p{}</style>";

    const plain = "Content-Type: text/plain\r\n\r\nplain wins";

    expect(textBody(messageFromBytes(multipart([attachment, html, plain])))).toBe("plain wins");
    expect(textBody(messageFromBytes(multipart([attachment, html])))).toBe("Hello there & welcome");
  });

  test("textBody tidies bulk plain text without decoding typed named entities", () => {
    const plain = [
      "Content-Type: text/plain",
      "",
      "Statement period ending:",
      " Sep&#8203; 30&#8203; 2026\u200b",
      " ",
      "  \t",
      " ",
      "",
      "Use &amp; for and",
    ].join("\r\n");

    expect(textBody(messageFromBytes(Buffer.from(plain)))).toBe(
      "Statement period ending:\n Sep 30 2026\n\nUse &amp; for and",
    );
  });

  test("splitMultipart keeps boundary lines that carry trailing whitespace", () => {
    const msg = messageFromBytes(
      Buffer.from(
        [
          "Subject: x",
          'Content-Type: multipart/alternative; boundary="b1"',
          "",
          "--b1 ",
          "Content-Type: text/plain",
          "",
          "hello there",
          "--b1--  ",
          "",
        ].join("\r\n"),
      ),
    );

    expect(textBody(msg)).toBe("hello there");
  });

  test("textBody falls back to the HTML leaf when the text/plain part is blank", () => {
    const msg = messageFromBytes(
      Buffer.from(
        [
          "Subject: x",
          'Content-Type: multipart/alternative; boundary="b1"',
          "",
          "--b1",
          "Content-Type: text/plain",
          "",
          "   ",
          "--b1",
          "Content-Type: text/html",
          "",
          "<p>Hello <b>there</b></p>",
          "--b1--",
          "",
        ].join("\r\n"),
      ),
    );

    expect(textBody(msg)).toBe("Hello there");
  });

  test("decodeHeader concatenates adjacent same-charset words before decoding", () => {
    expect(decodeHeader("=?UTF-8?B?ww==?= =?UTF-8?B?qQ==?=")).toBe("é");
    expect(decodeHeader("=?UTF-8?B?4g==?= =?UTF-8?B?mIM=?=")).toBe("☃");
  });

  test("decodeHeader runs span mixed charsets and mixed case", () => {
    expect(decodeHeader("=?utf-8?B?ww==?= =?UTF-8?B?qQ==?=")).toBe("é");
    expect(decodeHeader("=?UTF-8?B?Q2Fmw6k=?= =?ISO-8859-1?Q?=A9?=")).toBe("Café©");
    expect(decodeHeader("=?UTF-8?B?Q2Fm?= =?ISO-8859-1?Q?=E9?= =?UTF-8?B?IHNvaXI=?=")).toBe(
      "Café soir",
    );
  });
});

describe("Gmail whole-inbox ramp", () => {
  test("first contact records the cursor and archives nothing (no backfill)", async () => {
    const { gmail, paths, account } = setup();

    gmail.deliver(mail({}));
    gmail.deliver(mail(NEWSLETTER));
    const result = report(await ingestEmailOnce(paths, account));

    expect(result.baseline).toMatchObject({ uidvalidity: 7, next_uid: 3 });
    expect(result.archived).toBe(0);
    expect(loadCursor(paths.root)).toMatchObject({
      account: gmail.address,
      uidvalidity: 7,
      next_uid: 3,
    });
    expect(emailSources(paths)).toEqual([]);
    expect(gmail.commands.some((c) => /FETCH|STORE/.test(c))).toBe(false);
    expect(gmail.messages.every((m) => !m.labels.has("khaos"))).toBe(true);
  });

  test("new mail: raw .eml + source note, labeled khaos, routed, still unread in the inbox", async () => {
    const { gmail, paths, account } = setup();

    await ingestEmailOnce(paths, account);

    const raw = mail({
      subject: "=?UTF-8?B?Q2Fmw6k=?= tomorrow",
      headers: ["Cc: other@example.org"],
    });

    const message = gmail.deliver(raw);
    const result = report(await ingestEmailOnce(paths, account));

    expect(result.archived).toBe(1);
    const [source] = emailSources(paths);
    const data = source!.data;

    expect(data).toMatchObject({
      source: "email",
      source_id: message.gmMsgId,
      route: "routed",
      route_model: "rules@email.person",
      from: "Ada Lovelace <ada@example.org>",
      to: "alex@example.com",
      subject: "Café tomorrow",
      has_calendar: "false",
    });

    expect("list_unsubscribe" in data).toBe(false);
    expect(source!.relativePath).toMatch(/^sources\/email\/\d{4}-\d{2}\/[0-9a-f]{64}\.md$/);
    expect(source!.body).toContain("Shall we meet at noon?");
    expect(source!.body).toContain("- From: Ada Lovelace <ada@example.org>");
    const eml = join(paths.vault, data.eml!);

    expect(readFileSync(eml, "utf8")).toBe(raw);
    expect(source!.body).toContain(`](${data.eml!.split("/").pop()})`);

    expect([...message.labels].sort()).toEqual(["\\Inbox", "khaos"]);
    expect(message.flags.has("\\Seen")).toBe(false);
    expect(gmail.commands.some((c) => c.includes("BODY.PEEK[]"))).toBe(true);
    expect(gmail.commands.some((c) => /RFC822|\\Deleted|EXPUNGE/.test(c))).toBe(false);
    expect(result.routed[0]!.capture).toMatch(/^inbox\//);
    expect(existsSync(join(paths.vault, result.routed[0]!.capture!))).toBe(true);
    expect(loadCursor(paths.root)!.next_uid).toBe(message.uid + 1);
  });

  test("calendar invites route even from automated senders", async () => {
    const { gmail, paths, account } = setup();

    await ingestEmailOnce(paths, account);
    gmail.deliver(
      mail({
        from: "calendar-notification@example.com",
        contentType: 'multipart/alternative; boundary="c"',
        body: [
          "--c",
          "Content-Type: text/plain",
          "",
          "Invitation: standup",
          "--c",
          "Content-Type: text/calendar; method=REQUEST",
          "",
          "BEGIN:VCALENDAR",
          "--c--",
        ].join("\r\n"),
      }),
    );

    report(await ingestEmailOnce(paths, account));
    const [source] = emailSources(paths);

    expect(source!.data).toMatchObject({ has_calendar: "true", route: "routed" });
    expect(source!.data.route_reason).toBe("calendar invite");
  });

  test("noise gets khaos/noise and stays in the Gmail inbox while auto-archive is off", async () => {
    const { gmail, paths, account } = setup();

    await ingestEmailOnce(paths, account);
    const message = gmail.deliver(mail(NEWSLETTER));
    const result = report(await ingestEmailOnce(paths, account));
    const [source] = emailSources(paths);

    expect(source!.data).toMatchObject({
      route: "noise",
      list_unsubscribe: "<https://news.example.com/u>",
      list_id: "<widgets.example.com>",
    });

    expect([...message.labels].sort()).toEqual(["\\Inbox", "khaos", "khaos/noise"]);
    expect(result.actions).toContain(`labeled khaos/noise  ${source!.relativePath}`);
    expect(gmail.commands.some((c) => c.includes("-X-GM-LABELS"))).toBe(false);
  });

  test("gmail_auto_archive takes noise out of the Gmail inbox without deleting it", async () => {
    const { gmail, paths, account } = setup();

    writeFileSync(join(paths.root, "tuning.json"), JSON.stringify({ gmail_auto_archive: true }));
    await ingestEmailOnce(paths, account);
    const noise = gmail.deliver(mail(NEWSLETTER));
    const person = gmail.deliver(mail({}));

    report(await ingestEmailOnce(paths, account));

    expect([...noise.labels].sort()).toEqual(["khaos", "khaos/noise"]);
    expect([...person.labels].sort()).toEqual(["\\Inbox", "khaos"]);
    expect(gmail.messages).toContain(noise);
    expect(noise.flags.size).toBe(0);
  });

  test("a crash before the cursor moved re-archives nothing", async () => {
    const { gmail, paths, account } = setup();

    await ingestEmailOnce(paths, account);
    const baseline = readFileSync(join(paths.root, ".ledger", EMAIL_CURSOR), "utf8");

    gmail.deliver(mail({}));
    report(await ingestEmailOnce(paths, account));
    writeFileSync(join(paths.root, ".ledger", EMAIL_CURSOR), baseline);

    const again = report(await ingestEmailOnce(paths, account));

    expect(again).toMatchObject({ archived: 0, alreadyArchived: 1 });
    expect(emailSources(paths)).toHaveLength(1);
  });

  test("UIDVALIDITY change rechecks mail since the last sync without duplicates or backfill", async () => {
    const { gmail, paths, account } = setup();

    gmail.deliver(mail({ subject: "before go-live" }), new Date(Date.now() - 2 * 86_400_000));
    await ingestEmailOnce(paths, account);
    gmail.deliver(mail({ subject: "first after go-live" }));
    report(await ingestEmailOnce(paths, account));

    gmail.changeUidValidity();
    const late = gmail.deliver(mail({ subject: "after the renumbering" }));
    const result = report(await ingestEmailOnce(paths, account));

    expect(result.uidValidityReset).toEqual({ previous: 7, current: 8 });
    expect(result).toMatchObject({ archived: 1, alreadyArchived: 1 });
    expect(
      emailSources(paths)
        .map((s) => s.data.subject)
        .sort(),
    ).toEqual(["after the renumbering", "first after go-live"]);

    expect(late.labels.has("khaos")).toBe(true);
    expect(loadCursor(paths.root)).toMatchObject({ uidvalidity: 8, next_uid: late.uid + 1 });
  });

  test("decisions from `pkms route` are queued and applied on the next sync, via All Mail if needed", async () => {
    const { gmail, paths, account } = setup();
    const message: FakeMessage = gmail.deliver(mail(NEWSLETTER));

    await ingestEmailOnce(paths, account);
    archiveEmail(paths.vault, { ...message, labels: [...message.labels] });
    await runRouter(paths.root, paths.vault, { source: "email", label: queueEmailLabels });

    const queued = JSON.parse(readFileSync(join(paths.root, ".ledger", EMAIL_LABEL_RETRY), "utf8"));

    expect(queued).toEqual([
      expect.objectContaining({ gm_msgid: message.gmMsgId, add: ["khaos/noise"], remove: [] }),
    ]);

    message.labels.delete("\\Inbox");
    report(await ingestEmailOnce(paths, account));

    expect(message.labels.has("khaos/noise")).toBe(true);
    expect(
      JSON.parse(readFileSync(join(paths.root, ".ledger", EMAIL_LABEL_RETRY), "utf8")),
    ).toEqual([]);
    expect(gmail.commands).toContain('SELECT "[Gmail]/All Mail"');
  });

  test("watch: IDLE wakes on new mail, reconnects after a drop, resumes from the cursor", async () => {
    const { gmail, paths, account } = setup();
    const reports: EmailSyncReport[] = [];
    const errors: string[] = [];
    const controller = new AbortController();

    const running = watchEmail(paths, account, {
      signal: controller.signal,
      reidleMs: 60_000,
      backoffMs: 10,
      onReport: (r) => reports.push(r),
      onError: (message) => errors.push(message),
    });

    try {
      await gmail.until(() => reports.length === 1 && gmail.idleCount === 1);
      expect(reports[0]!.baseline).not.toBeNull();

      gmail.deliver(mail({ subject: "while idling" }));
      await gmail.until(() => reports.some((r) => r.archived === 1) && gmail.idleCount === 2);
      gmail.dropConnections();
      gmail.deliver(mail({ subject: "while disconnected" }));
      await gmail.until(
        () => reports.filter((r) => r.archived === 1).length === 2 && gmail.idleCount === 3,
      );
    } finally {
      controller.abort();
      expect(await running).toBe(true);
    }

    expect(errors.length).toBeGreaterThan(0);
    expect(
      emailSources(paths)
        .map((s) => s.data.subject)
        .sort(),
    ).toEqual(["while disconnected", "while idling"]);

    expect(gmail.commands.filter((c) => c.includes('+X-GM-LABELS ("khaos")'))).toHaveLength(2);
    expect(gmail.messages.every((m) => m.labels.has("khaos"))).toBe(true);
  });

  test("watch re-IDLEs (DONE, then IDLE again) before the limit", async () => {
    const { gmail, paths, account } = setup();
    const controller = new AbortController();

    const running = watchEmail(paths, account, {
      signal: controller.signal,
      reidleMs: 20,
      onReport: () => {},
      onError: (message) => {
        throw new Error(message);
      },
    });

    await gmail.until(() => gmail.idleCount >= 3);
    controller.abort();
    expect(await running).toBe(true);
    expect(gmail.commands.at(-1)).toBe("LOGOUT");
  });

  test("a second ingester reports busy instead of racing the cursor", async () => {
    const { gmail, paths, account } = setup();
    const controller = new AbortController();
    let synced = false;

    const running = watchEmail(paths, account, {
      signal: controller.signal,
      onReport: () => {
        synced = true;
      },
      onError: () => {},
    });

    await gmail.until(() => synced && gmail.idleCount === 1);
    expect(await ingestEmailOnce(paths, account)).toEqual({ busy: true });
    controller.abort();
    await running;
  });

  test("source notes stay readable through the sources store", async () => {
    const { gmail, paths, account } = setup();

    await ingestEmailOnce(paths, account);
    gmail.deliver(mail({ headers: ["Precedence: bulk", "Auto-Submitted: auto-generated"] }));
    report(await ingestEmailOnce(paths, account));
    const [source] = emailSources(paths);

    expect(readSource(paths.vault, source!.relativePath).data).toMatchObject({
      precedence: "bulk",
      auto_submitted: "auto-generated",
      route: "noise",
    });
  });
});

class StoreRefusingGmail extends FakeGmail {
  refused = false;

  protected handle(socket: Socket<SessionState>, line: string): void {
    const store = /^(a\d+) UID STORE \d+ \+X-GM-LABELS/.exec(line);

    if (store && socket.data.selected === "ALL" && !this.refused) {
      this.refused = true;
      this.commands.push(line.slice(line.indexOf(" ") + 1));
      socket.write(`${store[1]} NO [SERVERBUG] Temporary System Error (Failure)\r\n`);

      return;
    }

    super.handle(socket, line);
  }
}

class IdleRefusingGmail extends FakeGmail {
  protected handle(socket: Socket<SessionState>, line: string): void {
    if (/^a\d+ IDLE$/i.test(line)) {
      const tag = line.slice(0, line.indexOf(" "));

      this.commands.push("IDLE");
      socket.write(`${tag} NO IDLE is not supported (Failure)\r\n`);

      return;
    }

    super.handle(socket, line);
  }
}

class ExistsMidCommandGmail extends FakeGmail {
  protected handle(socket: Socket<SessionState>, line: string): void {
    if (/^a\d+ UID SEARCH /i.test(line)) socket.write("* 1 EXISTS\r\n");

    super.handle(socket, line);
  }
}

function harness(gmail: FakeGmail): Harness {
  const root = mkTmp();
  const paths = { root, vault: join(root, "vault"), indexDir: join(root, ".index") };

  mkdirSync(paths.vault, { recursive: true });
  cleanups.push(() => {
    gmail.stop();
    rmTmp(root);
  });

  return {
    gmail,
    paths,
    account: {
      address: gmail.address,
      password: gmail.password,
      endpoint: { host: "127.0.0.1", port: gmail.port, tls: false },
    },
  };
}

test("a refused STORE in All Mail still re-selects INBOX before the next UID command", async () => {
  const gmail = new StoreRefusingGmail().start();
  const { paths, account } = harness(gmail);

  await ingestEmailOnce(paths, account);
  const archived: FakeMessage = gmail.deliver(mail(NEWSLETTER));

  report(await ingestEmailOnce(paths, account));
  archived.labels.delete("\\Inbox");

  const session = await GmailSession.open(
    await connectImap(account.endpoint),
    account.address,
    account.password,
    [],
  );

  try {
    await expect(session.labelMessage(archived.gmMsgId, ["khaos/noise"], [])).rejects.toThrow(
      /UID STORE failed: NO/,
    );

    expect(await session.fetchMeta([archived.allUid])).toEqual([]);
  } finally {
    await session.logout();
    session.close();
  }
});

test("a refused label retry does not leave All Mail selected for the rest of the sync", async () => {
  const gmail = new StoreRefusingGmail().start();
  const { paths, account } = harness(gmail);

  await ingestEmailOnce(paths, account);
  const newsletter: FakeMessage = gmail.deliver(mail(NEWSLETTER));

  report(await ingestEmailOnce(paths, account));
  newsletter.labels.delete("\\Inbox");
  writeFileSync(
    join(paths.root, ".ledger", EMAIL_LABEL_RETRY),
    `${JSON.stringify([
      {
        gm_msgid: newsletter.gmMsgId,
        source_note: "sources/email/2026-10/queued.md",
        add: ["khaos/noise"],
        remove: [],
      },
    ])}\n`,
  );
  const late = gmail.deliver(mail({ subject: "arrived after the refused retry" }));

  const result = report(await ingestEmailOnce(paths, account));

  expect(result.actions.some((action) => action.includes("label change refused"))).toBe(true);

  const allMail = gmail.commands.indexOf('SELECT "[Gmail]/All Mail"');
  const reselect = gmail.commands.indexOf('SELECT "INBOX"', allMail);
  const search = gmail.commands.indexOf(`UID SEARCH UID ${late.uid}:*`);

  expect(allMail).toBeGreaterThan(-1);
  expect(reselect).toBeGreaterThan(allMail);
  expect(search).toBeGreaterThan(reselect);

  expect(result.archived).toBe(1);
  expect(loadCursor(paths.root)!.next_uid).toBe(late.uid + 1);

  const next = gmail.deliver(mail({ subject: "after the recovery" }));

  report(await ingestEmailOnce(paths, account));
  expect(loadCursor(paths.root)!.next_uid).toBe(next.uid + 1);
});

test("watch backoff grows across IDLE failures instead of resetting after each sync", async () => {
  const gmail = new IdleRefusingGmail().start();
  const { paths, account } = harness(gmail);
  const delays: number[] = [];
  const controller = new AbortController();

  const running = watchEmail(paths, account, {
    signal: controller.signal,
    backoffMs: 10,
    maxBackoffMs: 10_000,
    onReport: () => {},
    onError: (_message, retryInMs) => {
      delays.push(retryInMs);

      if (delays.length === 3) controller.abort();
    },
  });

  expect(await running).toBe(true);
  expect(delays).toEqual([10, 20, 40]);
  expect(gmail.commands.filter((command) => command === "LOGIN ***")).toHaveLength(3);
});

test("mail arriving during a sync-phase command wakes the next idle immediately", async () => {
  const gmail = new ExistsMidCommandGmail().start();
  const { account } = harness(gmail);

  const session = await GmailSession.open(
    await connectImap(account.endpoint),
    account.address,
    account.password,
    [],
  );

  try {
    const status = await session.selectInbox();

    await session.uidsFrom(status.uidNext);

    expect(await session.idle(60_000)).toBe("exists");
  } finally {
    await session.logout();
    session.close();
  }
});

test("idle stays quiet after a SELECT reply reports the mailbox count", async () => {
  const gmail = new FakeGmail().start();
  const { account } = harness(gmail);

  const session = await GmailSession.open(
    await connectImap(account.endpoint),
    account.address,
    account.password,
    [],
  );

  try {
    await session.selectInbox();
    expect(await session.idle(500)).toBe("timeout");
  } finally {
    await session.logout();
    session.close();
  }
});

test("watch on a quiet server serves each IDLE window instead of spinning", async () => {
  const gmail = new FakeGmail().start();
  const { paths, account } = harness(gmail);
  const controller = new AbortController();
  let cycles = 0;
  const started = Date.now();

  const running = watchEmail(paths, account, {
    signal: controller.signal,
    reidleMs: 40,
    onReport: () => {
      cycles += 1;

      if (cycles === 3) controller.abort();
    },
    onError: (message) => {
      throw new Error(message);
    },
  });

  expect(await running).toBe(true);
  expect(cycles).toBe(3);
  expect(gmail.idleCount).toBe(3);
  expect(Date.now() - started).toBeGreaterThanOrEqual(80);
});
