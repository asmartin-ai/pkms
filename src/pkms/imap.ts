export interface ImapEndpoint {
  host: string;
  port: number;
  tls: boolean;
}

export const GMAIL_IMAP: ImapEndpoint = { host: "imap.gmail.com", port: 993, tls: true };

export const COMMAND_TIMEOUT_MS = 120_000;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export function imapEndpoint(env: NodeJS.ProcessEnv): ImapEndpoint {
  const host = env.PKMS_IMAP_HOST?.trim() || GMAIL_IMAP.host;
  const port = env.PKMS_IMAP_PORT?.trim() ? Number(env.PKMS_IMAP_PORT) : GMAIL_IMAP.port;
  const tls = env.PKMS_IMAP_TLS?.trim() !== "0";

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new ImapError(`PKMS_IMAP_PORT must be a TCP port, got ${env.PKMS_IMAP_PORT}`);
  }

  if (!tls && !LOOPBACK_HOSTS.has(host)) {
    throw new ImapError("PKMS_IMAP_TLS=0 is allowed only for a loopback PKMS_IMAP_HOST");
  }

  return { host, port, tls };
}

export class ImapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImapError";
  }
}

export class ImapCommandError extends ImapError {
  constructor(message: string) {
    super(message);
    this.name = "ImapCommandError";
  }
}

export interface ImapResponse {
  text: string;
  literals: Uint8Array[];
}

export interface ImapReply {
  status: "OK" | "NO" | "BAD";
  text: string;
  untagged: ImapResponse[];
}

export type IdleOutcome = "exists" | "timeout" | "aborted";

export interface ImapConnection {
  command(cmd: string): Promise<ImapReply>;
  idle(waitMs: number, signal?: AbortSignal): Promise<IdleOutcome>;
  close(): void;
}

export const LITERAL = "\u0000";

export type ImapToken =
  | { kind: "atom"; value: string }
  | { kind: "literal"; bytes: Uint8Array }
  | { kind: "list"; items: ImapToken[] };

export function tokenize(text: string, literals: Uint8Array[]): ImapToken[] {
  const root: ImapToken[] = [];
  const stack: ImapToken[][] = [root];
  let literalIndex = 0;
  let i = 0;

  while (i < text.length) {
    const ch = text[i]!;
    const top = stack[stack.length - 1]!;

    if (ch === " ") {
      i += 1;
    } else if (ch === "(") {
      const items: ImapToken[] = [];
      top.push({ kind: "list", items });
      stack.push(items);
      i += 1;
    } else if (ch === ")") {
      if (stack.length > 1) stack.pop();
      i += 1;
    } else if (ch === LITERAL) {
      top.push({ kind: "literal", bytes: literals[literalIndex] ?? new Uint8Array(0) });
      literalIndex += 1;
      i += 1;
    } else if (ch === '"') {
      let value = "";

      i += 1;

      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && i + 1 < text.length) i += 1;
        value += text[i];
        i += 1;
      }

      top.push({ kind: "atom", value });
      i += 1;
    } else {
      let depth = 0;
      const start = i;

      while (i < text.length) {
        const c = text[i]!;

        if (c === "[") depth += 1;
        else if (c === "]") depth -= 1;
        else if (depth <= 0 && (c === " " || c === "(" || c === ")" || c === LITERAL)) break;
        i += 1;
      }

      top.push({ kind: "atom", value: text.slice(start, i) });
    }
  }

  return root;
}

function atomText(token: ImapToken | undefined): string | null {
  if (token?.kind === "atom") return token.value;

  if (token?.kind === "literal") return new TextDecoder().decode(token.bytes);

  return null;
}

export function parseFetch(response: ImapResponse): Map<string, ImapToken> | null {
  const match = /^\* \d+ FETCH /i.exec(response.text);

  if (!match) return null;
  const list = tokenize(response.text.slice(match[0].length), response.literals)[0];

  if (list?.kind !== "list") return null;
  const items = new Map<string, ImapToken>();

  for (let i = 0; i + 1 < list.items.length; i += 2) {
    const name = atomText(list.items[i]);

    if (name !== null) items.set(name.toUpperCase(), list.items[i + 1]!);
  }

  return items;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseInternalDate(value: string): Date | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(
    value.trim(),
  );

  if (!m) return null;
  const month = MONTHS.indexOf(m[2]![0]!.toUpperCase() + m[2]!.slice(1).toLowerCase());

  if (month === -1) return null;
  const offset = (Number(m[8]) * 60 + Number(m[9])) * (m[7] === "-" ? -1 : 1);

  const utc = Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]));

  return new Date(utc - offset * 60_000);
}

export function imapDate(date: Date): string {
  return `${date.getUTCDate()}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

export function quote(s: string): string {
  return `"${s.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

class ByteQueue {
  private buf = new Uint8Array(64 * 1024);
  private start = 0;
  private end = 0;

  get length(): number {
    return this.end - this.start;
  }

  push(chunk: Uint8Array): void {
    if (this.end + chunk.byteLength > this.buf.length) {
      const live = this.end - this.start;
      const needed = live + chunk.byteLength;

      const target =
        needed <= this.buf.length
          ? this.buf
          : new Uint8Array(Math.max(needed, this.buf.length * 2));

      target.set(this.buf.subarray(this.start, this.end));
      this.buf = target;
      this.start = 0;
      this.end = live;
    }

    this.buf.set(chunk, this.end);
    this.end += chunk.byteLength;
  }

  indexOf(byte: number): number {
    return this.buf.subarray(this.start, this.end).indexOf(byte);
  }

  take(n: number): Uint8Array {
    const out = this.buf.slice(this.start, this.start + n);
    this.start += n;

    return out;
  }
}

const STATUS = /^\S+ (OK|NO|BAD)\b ?(.*)$/i;

export async function connectImap(endpoint: ImapEndpoint): Promise<ImapConnection> {
  const queue = new ByteQueue();
  const decoder = new TextDecoder();
  let closed = false;
  let wake: (() => void) | null = null;

  const wakeReader = (): void => {
    const resolve = wake;
    wake = null;
    resolve?.();
  };

  const socket = await Bun.connect({
    hostname: endpoint.host,
    port: endpoint.port,
    tls: endpoint.tls,
    socket: {
      data(_socket, chunk) {
        queue.push(chunk);
        wakeReader();
      },
      end() {
        closed = true;
        wakeReader();
      },
      close() {
        closed = true;
        wakeReader();
      },
      error() {
        closed = true;
        wakeReader();
      },
    },
  });

  const waitForData = (waitMs: number, signal?: AbortSignal): Promise<boolean> => {
    const { promise, resolve } = Promise.withResolvers<boolean>();

    const finish = (value: boolean): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);

      if (wake === onData) wake = null;
      resolve(value);
    };

    const onData = (): void => finish(true);
    const onAbort = (): void => finish(false);
    const timer = setTimeout(onAbort, Math.max(0, waitMs));

    wake = onData;
    signal?.addEventListener("abort", onAbort, { once: true });

    return promise;
  };

  async function readLine(waitMs: number, signal?: AbortSignal): Promise<string | null> {
    const deadline = Date.now() + waitMs;

    for (;;) {
      const nl = queue.indexOf(0x0a);

      if (nl !== -1) return decoder.decode(queue.take(nl + 1)).replace(/\r?\n$/, "");

      if (closed) throw new ImapError("IMAP connection closed");

      if (signal?.aborted) return null;
      const remaining = deadline - Date.now();

      if (remaining <= 0) return null;
      await waitForData(remaining, signal);
    }
  }

  async function readExact(n: number): Promise<Uint8Array> {
    while (queue.length < n) {
      if (closed) throw new ImapError("IMAP connection closed");

      if (!(await waitForData(COMMAND_TIMEOUT_MS)) && queue.length < n) {
        throw new ImapError("IMAP literal timed out");
      }
    }

    return queue.take(n);
  }

  async function readResponse(waitMs: number, signal?: AbortSignal): Promise<ImapResponse | null> {
    let line = await readLine(waitMs, signal);

    if (line === null) return null;
    let text = "";
    const literals: Uint8Array[] = [];

    for (;;) {
      const literal = /\{(\d+)\}$/.exec(line);

      if (!literal) return { text: text + line, literals };
      text += line.slice(0, literal.index) + LITERAL;
      literals.push(await readExact(Number(literal[1])));
      const next = await readLine(COMMAND_TIMEOUT_MS);

      if (next === null) throw new ImapError("IMAP response timed out");
      line = next;
    }
  }

  async function collect(tag: string): Promise<ImapReply> {
    const untagged: ImapResponse[] = [];

    for (;;) {
      const response = await readResponse(COMMAND_TIMEOUT_MS);

      if (response === null) throw new ImapError("IMAP command timed out");

      if (response.text.startsWith(`${tag} `)) {
        const status = STATUS.exec(response.text);

        if (!status) throw new ImapError(`malformed IMAP status: ${response.text}`);

        return {
          status:
            status[1]!.toUpperCase() === "OK"
              ? "OK"
              : status[1]!.toUpperCase() === "NO"
                ? "NO"
                : "BAD",
          text: status[2] ?? "",
          untagged,
        };
      }

      if (/^\* \d+ EXISTS\b/i.test(response.text)) existsOutsideIdle = true;

      untagged.push(response);
    }
  }

  const greeting = await readResponse(COMMAND_TIMEOUT_MS);

  if (!greeting || !/^\* (OK|PREAUTH)\b/i.test(greeting.text)) {
    socket.end();
    throw new ImapError(`unexpected IMAP greeting: ${greeting?.text ?? "(none)"}`);
  }

  let tagN = 0;

  let existsOutsideIdle = false;

  const send = (line: string): void => {
    if (closed) throw new ImapError("IMAP connection closed");
    socket.write(`${line}\r\n`);
  };

  return {
    async command(cmd) {
      tagN += 1;
      const tag = `a${tagN}`;

      send(`${tag} ${cmd}`);

      const reply = await collect(tag);

      if (/^(SELECT|EXAMINE)\b/i.test(cmd)) existsOutsideIdle = false;

      return reply;
    },
    async idle(waitMs, signal) {
      tagN += 1;
      const tag = `a${tagN}`;

      send(`${tag} IDLE`);

      for (;;) {
        const response = await readResponse(COMMAND_TIMEOUT_MS);

        if (response === null) throw new ImapError("IDLE was not acknowledged");

        if (response.text.startsWith("+")) break;

        if (response.text.startsWith(`${tag} `))
          throw new ImapError(`IDLE refused: ${response.text}`);
      }

      const deadline = Date.now() + waitMs;
      let outcome: IdleOutcome = "timeout";

      for (;;) {
        if (signal?.aborted) {
          outcome = "aborted";
          break;
        }

        if (existsOutsideIdle) {
          existsOutsideIdle = false;
          outcome = "exists";
          break;
        }

        const remaining = deadline - Date.now();

        if (remaining <= 0) break;
        const response = await readResponse(remaining, signal);

        if (response === null) {
          outcome = signal?.aborted ? "aborted" : "timeout";
          break;
        }

        if (/^\* \d+ EXISTS\b/i.test(response.text)) {
          outcome = "exists";
          break;
        }

        if (/^\* BYE\b/i.test(response.text)) throw new ImapError("IMAP server ended the session");
      }

      send("DONE");
      const done = await collect(tag);

      if (done.status !== "OK") throw new ImapError(`IDLE ended with ${done.status} ${done.text}`);

      return outcome;
    },
    close() {
      closed = true;
      socket.end();
    },
  };
}

export interface InboxStatus {
  uidValidity: number;
  uidNext: number;
}

export interface MessageMeta {
  uid: number;
  gmMsgId: string;
  labels: string[];
  internalDate: Date;
}

export interface FetchedMessage extends MessageMeta {
  raw: Uint8Array;
}

export const INBOX = "INBOX";

function labelArg(label: string): string {
  return /^\\[A-Za-z]+$/.test(label) ? label : quote(label);
}

function meta(items: Map<string, ImapToken>): MessageMeta | null {
  const uid = Number(atomText(items.get("UID")));
  const gmMsgId = atomText(items.get("X-GM-MSGID"));
  const internalDate = parseInternalDate(atomText(items.get("INTERNALDATE")) ?? "");
  const labels = items.get("X-GM-LABELS");

  if (!Number.isInteger(uid) || uid < 1 || !gmMsgId || !/^\d+$/.test(gmMsgId) || !internalDate) {
    return null;
  }

  const names: string[] = [];

  if (labels?.kind === "list") {
    for (const label of labels.items) {
      const name = atomText(label);

      if (name !== null) names.push(name);
    }
  }

  return { uid, gmMsgId, labels: names, internalDate };
}

export class GmailSession {
  private selected: string | null = null;
  private allMail: string | null | undefined = undefined;

  private constructor(private readonly connection: ImapConnection) {}

  static async open(
    connection: ImapConnection,
    address: string,
    password: string,
    labels: readonly string[],
  ): Promise<GmailSession> {
    const session = new GmailSession(connection);

    try {
      const login = await connection.command(`LOGIN ${quote(address)} ${quote(password)}`);

      if (login.status !== "OK") throw new ImapError(`Gmail login failed: ${login.text}`);

      for (const label of labels) await connection.command(`CREATE ${quote(label)}`);
    } catch (error) {
      connection.close();
      throw error;
    }

    return session;
  }

  private async run(cmd: string): Promise<ImapReply> {
    const reply = await this.connection.command(cmd);

    if (reply.status !== "OK") {
      const verb = cmd
        .split(" ")
        .slice(0, cmd.startsWith("UID ") ? 2 : 1)
        .join(" ");

      throw new ImapCommandError(`${verb} failed: ${reply.status} ${reply.text}`);
    }

    return reply;
  }

  private async select(mailbox: string): Promise<ImapReply> {
    this.selected = null;
    const reply = await this.run(`SELECT ${quote(mailbox)}`);

    this.selected = mailbox;

    return reply;
  }

  async selectInbox(): Promise<InboxStatus> {
    const reply = await this.select(INBOX);
    let uidValidity: number | null = null;
    let uidNext: number | null = null;

    for (const response of reply.untagged) {
      const code = /\[(UIDVALIDITY|UIDNEXT) (\d+)\]/i.exec(response.text);

      if (code?.[1]!.toUpperCase() === "UIDVALIDITY") uidValidity = Number(code[2]);
      else if (code) uidNext = Number(code[2]);
    }

    if (uidValidity === null || uidNext === null) {
      throw new ImapError("SELECT INBOX did not report UIDVALIDITY and UIDNEXT");
    }

    return { uidValidity, uidNext };
  }

  private async search(criteria: string): Promise<number[]> {
    const reply = await this.run(`UID SEARCH ${criteria}`);
    const uids: number[] = [];

    for (const response of reply.untagged) {
      const m = /^\* SEARCH\b(.*)$/i.exec(response.text);

      if (!m) continue;

      for (const part of m[1]!.trim().split(/\s+/)) {
        const uid = Number(part);

        if (part && Number.isInteger(uid) && uid > 0) uids.push(uid);
      }
    }

    return uids.sort((a, b) => a - b);
  }

  async uidsFrom(uid: number): Promise<number[]> {
    return (await this.search(`UID ${uid}:*`)).filter((found) => found >= uid);
  }

  async uidsSince(date: Date): Promise<number[]> {
    return await this.search(`SINCE ${imapDate(date)}`);
  }

  async fetchMeta(uids: number[]): Promise<MessageMeta[]> {
    const wanted = new Set(uids);
    const found = new Map<number, MessageMeta>();

    for (let i = 0; i < uids.length; i += 500) {
      const set = uids.slice(i, i + 500).join(",");
      const reply = await this.run(`UID FETCH ${set} (UID X-GM-MSGID X-GM-LABELS INTERNALDATE)`);

      for (const response of reply.untagged) {
        const items = parseFetch(response);
        const parsed = items ? meta(items) : null;

        if (parsed && wanted.has(parsed.uid)) found.set(parsed.uid, parsed);
      }
    }

    return [...found.values()].sort((a, b) => a.uid - b.uid);
  }

  async fetchMessage(uid: number): Promise<FetchedMessage | null> {
    const reply = await this.run(
      `UID FETCH ${uid} (UID X-GM-MSGID X-GM-LABELS INTERNALDATE BODY.PEEK[])`,
    );

    for (const response of reply.untagged) {
      const items = parseFetch(response);
      const parsed = items ? meta(items) : null;
      const body = items?.get("BODY[]");

      if (parsed?.uid === uid && body?.kind === "literal") return { ...parsed, raw: body.bytes };

      if (parsed?.uid === uid && body?.kind === "atom" && body.value !== "NIL") {
        return { ...parsed, raw: new TextEncoder().encode(body.value) };
      }
    }

    return null;
  }

  async storeLabels(uid: number, add: readonly string[], remove: readonly string[]): Promise<void> {
    if (add.length)
      await this.run(`UID STORE ${uid} +X-GM-LABELS (${add.map(labelArg).join(" ")})`);

    if (remove.length) {
      await this.run(`UID STORE ${uid} -X-GM-LABELS (${remove.map(labelArg).join(" ")})`);
    }
  }

  private async allMailbox(): Promise<string | null> {
    if (this.allMail !== undefined) return this.allMail;
    const reply = await this.run('LIST "" "*"');

    this.allMail = null;

    for (const response of reply.untagged) {
      const m = /^\* LIST /i.exec(response.text);

      if (!m) continue;
      const tokens = tokenize(response.text.slice(m[0].length), response.literals);
      const flags = tokens[0];

      if (flags?.kind !== "list") continue;

      if (flags.items.some((flag) => atomText(flag)?.toLowerCase() === "\\all")) {
        this.allMail = atomText(tokens[2]);
        break;
      }
    }

    return this.allMail;
  }

  async labelMessage(
    gmMsgId: string,
    add: readonly string[],
    remove: readonly string[],
  ): Promise<boolean> {
    if (!/^\d+$/.test(gmMsgId)) return false;

    if (this.selected !== INBOX) await this.select(INBOX);
    let uid = (await this.search(`X-GM-MSGID ${gmMsgId}`))[0] ?? null;

    try {
      if (uid === null) {
        const allMail = await this.allMailbox();

        if (allMail !== null) {
          await this.select(allMail);
          uid = (await this.search(`X-GM-MSGID ${gmMsgId}`))[0] ?? null;
        }
      }

      if (uid !== null) await this.storeLabels(uid, add, remove);
    } finally {
      if (this.selected !== INBOX) await this.select(INBOX);
    }

    return uid !== null;
  }

  async idle(waitMs: number, signal?: AbortSignal): Promise<IdleOutcome> {
    if (this.selected !== INBOX) await this.select(INBOX);

    return await this.connection.idle(waitMs, signal);
  }

  async logout(): Promise<void> {
    try {
      await this.connection.command("LOGOUT");
    } finally {
      this.connection.close();
    }
  }

  close(): void {
    this.connection.close();
  }
}
