import type { Socket, TCPSocketListener } from "bun";
import { tokenize } from "../../src/pkms/imap.ts";

export interface FakeMessage {
  gmMsgId: string;
  uid: number;
  allUid: number;
  labels: Set<string>;
  flags: Set<string>;
  raw: Uint8Array;
  internalDate: Date;
}

export interface SessionState {
  pending: string;
  authed: boolean;
  selected: "INBOX" | "ALL" | null;
  idleTag: string | null;
}

const ALL_MAIL = "[Gmail]/All Mail";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function internalDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");

  return `${pad(date.getUTCDate())}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`;
}

function labelList(labels: Set<string>): string {
  return [...labels].map((label) => (label.startsWith("\\") ? label : `"${label}"`)).join(" ");
}

export class FakeGmail {
  readonly commands: string[] = [];
  readonly messages: FakeMessage[] = [];
  readonly mailboxes = new Set(["INBOX", ALL_MAIL]);
  uidValidity = 7;
  idleCount = 0;
  private nextUid = 1;
  private nextAllUid = 1;
  private nextMsgId = 1_790_000_000_000_000_001n;
  private readonly sockets = new Set<Socket<SessionState>>();
  private listener: TCPSocketListener<SessionState> | null = null;
  private waiters: (() => void)[] = [];

  constructor(
    readonly address = "alex@example.com",
    readonly password = "fake app password",
  ) {}

  get port(): number {
    return this.listener!.port;
  }

  start(): this {
    this.listener = Bun.listen<SessionState>({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        open: (socket) => {
          socket.data = { pending: "", authed: false, selected: null, idleTag: null };
          this.sockets.add(socket);
          socket.write("* OK Gimap ready for requests\r\n");
        },
        data: (socket, chunk) => {
          socket.data.pending += new TextDecoder().decode(chunk);
          let nl = socket.data.pending.indexOf("\r\n");

          while (nl !== -1) {
            const line = socket.data.pending.slice(0, nl);
            socket.data.pending = socket.data.pending.slice(nl + 2);
            this.handle(socket, line);
            this.notify();
            nl = socket.data.pending.indexOf("\r\n");
          }
        },
        close: (socket) => {
          this.sockets.delete(socket);
          this.notify();
        },
      },
    });

    return this;
  }

  stop(): void {
    this.dropConnections();
    this.listener?.stop(true);
  }

  changed(): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();

    this.waiters.push(resolve);

    return promise;
  }

  notify(): void {
    const waiters = this.waiters;

    this.waiters = [];

    for (const resolve of waiters) resolve();
  }

  async until(check: () => boolean): Promise<void> {
    while (!check()) await this.changed();
  }

  dropConnections(): void {
    for (const socket of this.sockets) socket.end();
    this.sockets.clear();
  }

  inbox(): FakeMessage[] {
    return this.messages.filter((m) => m.labels.has("\\Inbox")).sort((a, b) => a.uid - b.uid);
  }

  deliver(raw: string, date: Date = new Date()): FakeMessage {
    const message: FakeMessage = {
      gmMsgId: String(this.nextMsgId++),
      uid: this.nextUid++,
      allUid: this.nextAllUid++,
      labels: new Set(["\\Inbox"]),
      flags: new Set(),
      raw: new TextEncoder().encode(raw),
      internalDate: new Date(Math.floor(date.getTime() / 1000) * 1000),
    };

    this.messages.push(message);
    const count = this.inbox().length;

    for (const socket of this.sockets) {
      if (socket.data.idleTag && socket.data.selected === "INBOX") {
        socket.write(`* ${count} EXISTS\r\n`);
      }
    }

    this.notify();

    return message;
  }

  changeUidValidity(): void {
    this.uidValidity += 1;
    this.nextUid = 1;

    for (const message of this.inbox()) message.uid = this.nextUid++;
  }

  private view(state: SessionState): { message: FakeMessage; uid: number }[] {
    if (state.selected === "INBOX")
      return this.inbox().map((message) => ({ message, uid: message.uid }));

    if (state.selected === "ALL") {
      return [...this.messages]
        .sort((a, b) => a.allUid - b.allUid)
        .map((message) => ({ message, uid: message.allUid }));
    }

    return [];
  }

  protected handle(socket: Socket<SessionState>, line: string): void {
    const state = socket.data;

    const reply = (text: string): void => {
      socket.write(`${text}\r\n`);
    };

    if (state.idleTag) {
      if (line === "DONE") {
        reply(`${state.idleTag} OK IDLE terminated (Success)`);
        state.idleTag = null;
      }

      return;
    }

    const space = line.indexOf(" ");
    const tag = line.slice(0, space);
    const command = line.slice(space + 1);

    this.commands.push(/^LOGIN /i.test(command) ? "LOGIN ***" : command);
    const login = /^LOGIN "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)"$/i.exec(command);

    if (login) {
      if (login[1] === this.address && login[2] === this.password) {
        state.authed = true;
        reply(`${tag} OK ${this.address} authenticated (Success)`);
      } else {
        reply(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)`);
      }

      return;
    }

    if (/^LOGOUT$/i.test(command)) {
      reply("* BYE LOGOUT Requested");
      reply(`${tag} OK 73 good day (Success)`);
      socket.end();

      return;
    }

    if (!state.authed) {
      reply(`${tag} BAD not authenticated`);

      return;
    }

    const create = /^CREATE "(.*)"$/i.exec(command);

    if (create) {
      if (this.mailboxes.has(create[1]!)) reply(`${tag} NO [ALREADYEXISTS] Duplicate folder name`);
      else {
        this.mailboxes.add(create[1]!);
        reply(`${tag} OK Success`);
      }

      return;
    }

    if (/^LIST "" "\*"$/i.test(command)) {
      reply('* LIST (\\HasNoChildren) "/" "INBOX"');
      reply('* LIST (\\HasChildren \\Noselect) "/" "[Gmail]"');
      reply(`* LIST (\\All \\HasNoChildren) "/" "${ALL_MAIL}"`);
      reply(`${tag} OK Success`);

      return;
    }

    const select = /^SELECT "(.*)"$/i.exec(command);

    if (select) {
      state.selected = select[1] === "INBOX" ? "INBOX" : select[1] === ALL_MAIL ? "ALL" : null;

      if (!state.selected) {
        reply(`${tag} NO no such mailbox`);

        return;
      }

      const view = this.view(state);
      reply(`* ${view.length} EXISTS`);
      reply("* 0 RECENT");
      reply(`* OK [UIDVALIDITY ${state.selected === "INBOX" ? this.uidValidity : 1}] UIDs valid.`);
      reply(
        `* OK [UIDNEXT ${state.selected === "INBOX" ? this.nextUid : this.nextAllUid}] Predicted next UID.`,
      );
      reply(`${tag} OK [READ-WRITE] ${select[1]} selected. (Success)`);

      return;
    }

    if (/^IDLE$/i.test(command)) {
      this.idleCount += 1;
      state.idleTag = tag;
      reply("+ idling");

      return;
    }

    const search = /^UID SEARCH (.*)$/i.exec(command);

    if (search) {
      const view = this.view(state);
      const criteria = search[1]!;
      let uids: number[] = [];
      const range = /^UID (\d+):\*$/i.exec(criteria);
      const since = /^SINCE (\S+)$/i.exec(criteria);
      const msgId = /^X-GM-MSGID (\d+)$/i.exec(criteria);

      if (range) {
        uids = view.filter((v) => v.uid >= Number(range[1])).map((v) => v.uid);

        if (!uids.length && view.length) uids = [view[view.length - 1]!.uid];
      } else if (since) {
        const [day, month, year] = since[1]!.split("-");
        const start = Date.UTC(Number(year), MONTHS.indexOf(month!), Number(day));

        uids = view.filter((v) => v.message.internalDate.getTime() >= start).map((v) => v.uid);
      } else if (msgId) {
        uids = view.filter((v) => v.message.gmMsgId === msgId[1]).map((v) => v.uid);
      }

      reply(`* SEARCH${uids.map((uid) => ` ${uid}`).join("")}`);
      reply(`${tag} OK SEARCH completed (Success)`);

      return;
    }

    const fetch = /^UID FETCH (\S+) \((.*)\)$/i.exec(command);

    if (fetch) {
      const wanted = new Set(fetch[1]!.split(",").map(Number));
      const items = fetch[2]!.toUpperCase();
      const view = this.view(state);

      view.forEach((v, index) => {
        if (!wanted.has(v.uid)) return;
        const peek = items.includes("BODY.PEEK[]");
        const body = peek || items.includes("BODY[]") || items.includes("RFC822");

        if (body && !peek) v.message.flags.add("\\Seen");

        const parts = [
          `X-GM-MSGID ${v.message.gmMsgId}`,
          `X-GM-LABELS (${labelList(v.message.labels)})`,
          `UID ${v.uid}`,
          `INTERNALDATE "${internalDate(v.message.internalDate)}"`,
        ];

        if (body) {
          socket.write(
            `* ${index + 1} FETCH (${parts.join(" ")} BODY[] {${v.message.raw.byteLength}}\r\n`,
          );
          socket.write(v.message.raw);
          reply(")");
        } else {
          reply(`* ${index + 1} FETCH (${parts.join(" ")})`);
        }
      });

      reply(`${tag} OK Success`);

      return;
    }

    const store = /^UID STORE (\d+) ([+-])X-GM-LABELS \((.*)\)$/i.exec(command);

    if (store) {
      const view = this.view(state);
      const index = view.findIndex((v) => v.uid === Number(store[1]));

      if (index !== -1) {
        const message = view[index]!.message;

        for (const token of tokenize(store[3]!, [])) {
          if (token.kind !== "atom") continue;

          if (store[2] === "+") message.labels.add(token.value);
          else message.labels.delete(token.value);
        }

        reply(
          `* ${index + 1} FETCH (X-GM-LABELS (${labelList(message.labels)}) UID ${view[index]!.uid})`,
        );
      }

      reply(`${tag} OK Success`);

      return;
    }

    reply(`${tag} BAD unsupported in fake: ${command}`);
  }
}
