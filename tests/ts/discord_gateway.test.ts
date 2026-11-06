import { z } from "zod";
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeCapture } from "../../src/pkms/capture.ts";
import { DISCORD_LEDGER } from "../../src/pkms/discord_capture.ts";
import { load } from "../../src/pkms/ledger.ts";
import { operationalDir } from "../../src/pkms/operational.ts";
import { runBot } from "../../src/pkms/discord_gateway.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

const TOKEN = "test-token";

const AGENT_USER = "alex-1";

const STRANGER = "someone-else";

const REACTION = "%E2%9C%85";

const JsonSchema = z.json();

type JsonValue = z.infer<typeof JsonSchema>;

const SentFrameSchema = z.object({ op: z.number() }).catchall(JsonSchema);

type SentFrame = z.infer<typeof SentFrameSchema>;

interface OutgoingFrame {
  op: number;
  t?: string;
  s?: number;
  d?: JsonValue;
}

const ReplyBodySchema = z.object({
  content: z.string(),
  allowed_mentions: z.object({ parse: z.array(z.string()) }),
});

interface LiveSocket {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
}

const tmpRoots: string[] = [];

const stopFns: Array<() => void> = [];

afterEach(() => {
  for (const stop of stopFns.splice(0)) stop();

  while (tmpRoots.length) rmTmp(tmpRoots.pop()!);
});

async function waitFor(ready: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!ready()) {
    if (Date.now() >= deadline) throw new Error("condition never became true");
    await Bun.sleep(2);
  }
}

function beatAfter(gateway: FakeGateway): Promise<void> {
  const seen = gateway.sent.length;

  return waitFor(() => gateway.sent.slice(seen).some((frame) => frame.op === 1));
}

function listMd(dir: string): string[] {
  const inbox = join(dir, "inbox");

  if (!existsSync(inbox)) return [];

  return readdirSync(inbox)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(inbox, f))
    .sort();
}

function messageCreate(message: {
  id: string;
  channelId: string;
  content: string;
  authorId: string;
  guildId?: string | null;
  bot?: boolean;
}): OutgoingFrame {
  return {
    op: 0,
    t: "MESSAGE_CREATE",
    s: Number(message.id),
    d: {
      id: message.id,
      channel_id: message.channelId,
      guild_id: message.guildId ?? null,
      content: message.content,
      author: { id: message.authorId, bot: message.bot === true },
    },
  };
}

function startCaptureStub(vault: string): string {
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);

      if (req.headers.get("X-Capture-Token") !== TOKEN) {
        return new Response("unauthorized", { status: 401 });
      }

      return req.text().then((text) => {
        writeCapture(text, vault, { source: url.searchParams.get("source") ?? "capture" });

        return new Response("ok", { status: 200 });
      });
    },
  });

  stopFns.push(() => server.stop(true));

  return `http://127.0.0.1:${server.port}`;
}

interface FakeApi {
  baseUrl: string;
  bodies: string[];
  reactions: string[];
}

function startFakeApi(): FakeApi {
  const api: FakeApi = { baseUrl: "", bodies: [], reactions: [] };

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "PUT") {
        api.reactions.push(url.pathname);

        return new Response(null, { status: 204 });
      }

      api.bodies.push(await req.text());

      return Response.json({ id: "sent-1" });
    },
  });

  api.baseUrl = `http://127.0.0.1:${server.port}/api/v10`;
  stopFns.push(() => server.stop(true));

  return api;
}

interface FakeGatewayOptions {
  heartbeatInterval?: number;
  ack?: boolean;
  closeAfterIdentify?: number;
  invalidSessionAfterIdentify?: boolean;
  closeAfterReady?: boolean;
}

interface FakeGateway {
  url: string;
  sent: SentFrame[];
  identified: Promise<void>;
  connected: (count: number, deadlineMs: number) => Promise<boolean>;
  openedAt: number[];
  send: (frame: OutgoingFrame) => void;
  close: (code?: number) => void;
}

function startFakeGateway(options: FakeGatewayOptions = {}): FakeGateway {
  const sent: SentFrame[] = [];
  const identified = Promise.withResolvers<void>();
  let connections = 0;
  let live: LiveSocket | null = null;
  const openedAt: number[] = [];
  const t0 = Date.now();

  const server = Bun.serve({
    port: 0,
    fetch(req, srv) {
      if (!srv.upgrade(req)) return new Response("expected websocket", { status: 400 });

      return undefined;
    },
    websocket: {
      open(ws) {
        live = ws;
        connections += 1;
        openedAt.push(Date.now() - t0);
        ws.send(
          JSON.stringify({
            op: 10,
            d: { heartbeat_interval: options.heartbeatInterval ?? 60_000 },
          }),
        );
      },
      message(ws, raw) {
        const frame = SentFrameSchema.parse(JSON.parse(String(raw)));

        sent.push(frame);

        if (frame.op !== 2) {
          if (frame.op === 1 && options.ack !== false) ws.send(JSON.stringify({ op: 11 }));

          return;
        }

        identified.resolve();

        if (options.closeAfterIdentify !== undefined) {
          ws.close(options.closeAfterIdentify, "refused");

          return;
        }

        if (options.invalidSessionAfterIdentify) {
          ws.send(JSON.stringify({ op: 9, d: false }));

          return;
        }

        ws.send(JSON.stringify({ op: 0, t: "READY", s: 1, d: { session_id: "s-1" } }));

        if (options.closeAfterReady) ws.close(1000, "session over");
      },
      close(ws) {
        if (live === ws) live = null;
      },
    },
  });

  const connected = async (count: number, deadlineMs: number): Promise<boolean> => {
    const deadline = Date.now() + deadlineMs;

    while (connections < count) {
      if (Date.now() >= deadline) return false;
      await Bun.sleep(5);
    }

    return true;
  };

  stopFns.push(() => server.stop(true));

  return {
    url: `ws://127.0.0.1:${server.port}`,
    sent,
    identified: identified.promise,
    openedAt,
    connected,
    send: (frame) => {
      live?.send(JSON.stringify(frame));
    },
    close: (code) => {
      live?.close(code, "test");
    },
  };
}

interface BootOptions {
  agentUserIds?: readonly string[];
  gateway?: FakeGatewayOptions;
  apiBaseUrl?: string;
  vaultIsFile?: boolean;
}

interface Bot {
  root: string;
  vault: string;
  indexDir: string;
  gateway: FakeGateway;
  api: FakeApi;
  bot: Promise<number>;
  stop: () => void;
}

function boot(options: BootOptions = {}): Bot {
  const root = mkTmp();

  tmpRoots.push(root);
  const vault = join(root, "vault");
  const captureVault = options.vaultIsFile ? join(root, "captures") : vault;

  if (options.vaultIsFile) writeFileSync(vault, "not a directory", "utf8");

  const gateway = startFakeGateway(options.gateway);
  const api = startFakeApi();
  const baseUrl = startCaptureStub(captureVault);
  const indexDir = join(root, ".index");
  const controller = new AbortController();

  return {
    root,
    vault: captureVault,
    indexDir,
    gateway,
    api,
    bot: runBot({
      botToken: "bot-secret",
      indexDir,
      baseUrl,
      captureToken: TOKEN,
      vault,
      agentUserIds: options.agentUserIds ?? [AGENT_USER],
      gatewayUrl: gateway.url,
      apiBaseUrl: options.apiBaseUrl ?? api.baseUrl,
      signal: controller.signal,
    }),
    stop: () => controller.abort(),
  };
}

describe("author allowlist (S1)", () => {
  test("a stranger's command and DM are ignored", async () => {
    const bot = boot({ gateway: { heartbeatInterval: 50 } });

    try {
      await bot.gateway.identified;
      bot.gateway.send(
        messageCreate({ id: "1", channelId: "dm", content: "!help", authorId: STRANGER }),
      );
      bot.gateway.send(
        messageCreate({
          id: "2",
          channelId: "dm",
          content: "a private thought",
          authorId: STRANGER,
        }),
      );
      await beatAfter(bot.gateway);

      expect(bot.api.bodies).toEqual([]);
      expect(bot.api.reactions).toEqual([]);
      expect(listMd(bot.vault)).toEqual([]);
      expect(load(operationalDir(bot.indexDir), DISCORD_LEDGER)).toEqual(new Set());
    } finally {
      bot.stop();
      await bot.bot;
    }
  });

  test("the configured user's command still replies, with allowed_mentions parse: []", async () => {
    const bot = boot();

    try {
      await bot.gateway.identified;
      bot.gateway.send(
        messageCreate({ id: "3", channelId: "dm", content: "!help", authorId: AGENT_USER }),
      );
      await waitFor(() => bot.api.bodies.length === 1);

      const body = ReplyBodySchema.parse(JSON.parse(bot.api.bodies[0]!));

      expect(body.content).toContain("!search <q>");
      expect(body.allowed_mentions).toEqual({ parse: [] });
    } finally {
      bot.stop();
      await bot.bot;
    }
  });

  test("the configured user's DM capture still lands", async () => {
    const bot = boot();

    try {
      await bot.gateway.identified;
      bot.gateway.send(
        messageCreate({
          id: "4",
          channelId: "dm",
          content: "the good capture",
          authorId: AGENT_USER,
        }),
      );
      await waitFor(() => listMd(bot.vault).length === 1 && bot.api.reactions.length === 1);

      expect(readFileSync(listMd(bot.vault)[0]!, "utf8")).toContain("the good capture");
      expect(bot.api.reactions).toEqual([
        `/api/v10/channels/dm/messages/4/reactions/${REACTION}/@me`,
      ]);
    } finally {
      bot.stop();
      await bot.bot;
    }
  });

  test("commands are disabled when no agent user ids are configured", async () => {
    const bot = boot({ agentUserIds: [], gateway: { heartbeatInterval: 50 } });

    try {
      await bot.gateway.identified;
      bot.gateway.send(
        messageCreate({ id: "5", channelId: "dm", content: "!help", authorId: "whoever" }),
      );
      bot.gateway.send(
        messageCreate({ id: "6", channelId: "dm", content: "!did shipped", authorId: "whoever" }),
      );
      await beatAfter(bot.gateway);

      expect(bot.api.bodies).toEqual([]);
      expect(listMd(bot.vault)).toEqual([]);
      expect(load(operationalDir(bot.indexDir), DISCORD_LEDGER)).toEqual(new Set());
    } finally {
      bot.stop();
      await bot.bot;
    }
  });

  test("both allowlisted accounts can reply and capture while strangers remain blocked", async () => {
    const users = [AGENT_USER, "alex-2"];
    const bot = boot({ agentUserIds: users, gateway: { heartbeatInterval: 50 } });

    try {
      await bot.gateway.identified;
      bot.gateway.send(
        messageCreate({ id: "10", channelId: "dm", content: "!help", authorId: STRANGER }),
      );
      bot.gateway.send(
        messageCreate({
          id: "11",
          channelId: "dm",
          content: "stranger capture",
          authorId: STRANGER,
        }),
      );

      for (const [i, authorId] of users.entries()) {
        bot.gateway.send(
          messageCreate({ id: String(12 + i * 2), channelId: "dm", content: "!help", authorId }),
        );
        bot.gateway.send(
          messageCreate({
            id: String(13 + i * 2),
            channelId: "dm",
            content: `capture from ${authorId}`,
            authorId,
          }),
        );
      }

      await waitFor(() => bot.api.bodies.length === 2 && bot.api.reactions.length === 2);
      await beatAfter(bot.gateway);
      expect(bot.api.bodies.map((raw) => ReplyBodySchema.parse(JSON.parse(raw)).content)).toEqual([
        expect.stringContaining("!search <q>"),
        expect.stringContaining("!search <q>"),
      ]);
      expect(
        listMd(bot.vault)
          .map((path) => readFileSync(path, "utf8"))
          .sort(),
      ).toEqual(
        expect.arrayContaining(users.map((id) => expect.stringContaining(`capture from ${id}`))),
      );
      expect(listMd(bot.vault)).toHaveLength(2);
      expect(load(operationalDir(bot.indexDir), DISCORD_LEDGER)).toEqual(new Set(["13", "15"]));
    } finally {
      bot.stop();
      await bot.bot;
    }
  });
});

describe("unknown !word falls through to capture (S2)", () => {
  test("!important call the bank is captured, ledgered and reacted to", async () => {
    const bot = boot();

    try {
      await bot.gateway.identified;
      bot.gateway.send(
        messageCreate({
          id: "7",
          channelId: "dm",
          content: "!important call the bank",
          authorId: AGENT_USER,
        }),
      );
      await waitFor(
        () =>
          listMd(bot.vault).length === 1 &&
          bot.api.reactions.length === 1 &&
          load(operationalDir(bot.indexDir), DISCORD_LEDGER).has("7"),
      );

      const note = readFileSync(listMd(bot.vault)[0]!, "utf8");

      expect(note).toContain("!important call the bank");
      expect(load(operationalDir(bot.indexDir), DISCORD_LEDGER)).toEqual(new Set(["7"]));
      expect(bot.api.reactions).toEqual([
        `/api/v10/channels/dm/messages/7/reactions/${REACTION}/@me`,
      ]);
      expect(bot.api.bodies).toEqual([]);
    } finally {
      bot.stop();
      await bot.bot;
    }
  });

  test("a known command is answered and not captured as a note", async () => {
    const bot = boot();

    try {
      await bot.gateway.identified;
      bot.gateway.send(
        messageCreate({ id: "8", channelId: "dm", content: "!streak", authorId: AGENT_USER }),
      );
      await waitFor(() => bot.api.bodies.length === 1);

      expect(ReplyBodySchema.parse(JSON.parse(bot.api.bodies[0]!)).content.length).toBeGreaterThan(
        0,
      );
      expect(listMd(bot.vault)).toEqual([]);
      expect(load(operationalDir(bot.indexDir), DISCORD_LEDGER)).toEqual(new Set());
    } finally {
      bot.stop();
      await bot.bot;
    }
  });
});

describe("heartbeat, backoff and fatal closes (S7)", () => {
  test("a missing heartbeat ACK reconnects", async () => {
    const bot = boot({ gateway: { heartbeatInterval: 40, ack: false } });

    try {
      expect(await bot.gateway.connected(2, 2_000)).toBe(true);
    } finally {
      bot.stop();
      await bot.bot;
    }
  });

  test("a READY keeps the backoff at the initial delay across reconnects", async () => {
    const bot = boot({ gateway: { closeAfterReady: true } });

    try {
      expect(await bot.gateway.connected(4, 4_000)).toBe(true);
    } finally {
      bot.stop();
      await bot.bot;
    }
  });

  test(
    "a HELLO without READY keeps the backoff growing",
    async () => {
      const bot = boot({ gateway: { invalidSessionAfterIdentify: true } });

      try {
        expect(await bot.gateway.connected(4, 9_000)).toBe(true);

        const [first, second, third, fourth] = bot.gateway.openedAt;

        expect(second - first).toBeGreaterThanOrEqual(900);
        expect(second - first).toBeLessThan(3_000);

        expect(third - second).toBeGreaterThanOrEqual(1_800);
        expect(third - second).toBeLessThan(4_000);
        expect(fourth - third).toBeGreaterThanOrEqual(3_600);
        expect(fourth - third).toBeLessThan(6_000);
      } finally {
        bot.stop();

        await Promise.race([bot.bot, Bun.sleep(500)]);
      }
    },
    { timeout: 12_000 },
  );

  test("a 4004 close exits 78 so systemd does not restart it", async () => {
    const bot = boot({ gateway: { closeAfterIdentify: 4004 } });

    try {
      const code = await Promise.race([bot.bot, Bun.sleep(500).then(() => null)]);

      expect(code).toBe(78);
      expect(await bot.gateway.connected(2, 400)).toBe(false);
    } finally {
      bot.stop();
      await bot.bot;
    }
  });

  test("a heartbeat carries the sequence of a non-MESSAGE_CREATE dispatch", async () => {
    const bot = boot({ gateway: { heartbeatInterval: 50 } });

    try {
      await bot.gateway.identified;
      bot.gateway.send({ op: 0, t: "PRESENCE_UPDATE", s: 42, d: { user: { id: "u-1" } } });

      let carried = false;
      const deadline = Date.now() + 2_000;

      while (!carried && Date.now() < deadline) {
        carried = bot.gateway.sent.some((frame) => frame.op === 1 && frame.d === 42);

        if (!carried) await Bun.sleep(5);
      }

      expect(carried).toBe(true);
    } finally {
      bot.stop();
      await bot.bot;
    }
  });

  test("a heartbeat after a reconnect carries no stale sequence", async () => {
    const bot = boot({ gateway: { heartbeatInterval: 50 } });

    try {
      await bot.gateway.identified;
      bot.gateway.send({ op: 0, t: "PRESENCE_UPDATE", s: 42, d: { user: { id: "u-1" } } });
      await waitFor(() => bot.gateway.sent.some((frame) => frame.op === 1 && frame.d === 42));

      bot.gateway.close(1000);
      await bot.gateway.connected(2, 2_000);
      await bot.gateway.identified;
      await waitFor(() => bot.gateway.sent.filter((frame) => frame.op === 1).length > 1);

      const beats = bot.gateway.sent.filter((frame) => frame.op === 1);
      const onSecond = beats.filter((frame) => frame.d === 1);
      const stale = beats.filter((frame) => frame.d === 42);

      expect(onSecond.length).toBeGreaterThan(0);
      expect(stale).toHaveLength(1);
    } finally {
      bot.stop();
      await bot.bot;
    }
  });
});

describe("failures never kill the bot (S8)", () => {
  test("a refused reply endpoint is logged, and the next message still captures", async () => {
    const bot = boot({ apiBaseUrl: "http://127.0.0.1:1/api/v10" });
    const logged: string[] = [];
    const realError = console.error;

    console.error = (...args: string[]) => {
      logged.push(args.join(" "));
    };

    try {
      await bot.gateway.identified;
      bot.gateway.send(
        messageCreate({ id: "9", channelId: "dm", content: "!help", authorId: AGENT_USER }),
      );
      await waitFor(() => logged.some((line) => line.includes("reply failed")));

      bot.gateway.send(
        messageCreate({
          id: "10",
          channelId: "dm",
          content: "after the failure",
          authorId: AGENT_USER,
        }),
      );
      await waitFor(
        () =>
          listMd(bot.vault).length === 1 &&
          load(operationalDir(bot.indexDir), DISCORD_LEDGER).has("10"),
      );

      expect(readFileSync(listMd(bot.vault)[0]!, "utf8")).toContain("after the failure");
      expect(load(operationalDir(bot.indexDir), DISCORD_LEDGER)).toEqual(new Set(["10"]));
    } finally {
      console.error = realError;
      bot.stop();
      await bot.bot;
    }
  });

  test("a non-OK reply is logged with its HTTP status and Discord's error text", async () => {
    const refusing = Bun.serve({
      port: 0,
      fetch: () => Response.json({ message: "Missing Access", code: 50001 }, { status: 403 }),
    });

    stopFns.push(() => refusing.stop(true));

    const bot = boot({ apiBaseUrl: `http://127.0.0.1:${refusing.port}/api/v10` });
    const logged: string[] = [];
    const realError = console.error;

    console.error = (...args: string[]) => {
      logged.push(args.join(" "));
    };

    try {
      await bot.gateway.identified;
      bot.gateway.send(
        messageCreate({ id: "12", channelId: "dm", content: "!help", authorId: AGENT_USER }),
      );
      await waitFor(() => logged.some((line) => line.includes("reply failed")));

      expect(logged.find((line) => line.includes("reply failed"))).toContain(
        'HTTP 403 {"message":"Missing Access"',
      );
    } finally {
      console.error = realError;
      bot.stop();
      await bot.bot;
    }
  });

  test("a throwing command handler is logged, and the next message still captures", async () => {
    const bot = boot({ vaultIsFile: true });
    const logged: string[] = [];
    const realError = console.error;

    console.error = (...args: string[]) => {
      logged.push(args.join(" "));
    };

    try {
      await bot.gateway.identified;
      bot.gateway.send(
        messageCreate({ id: "11", channelId: "dm", content: "!did shipped", authorId: AGENT_USER }),
      );
      await waitFor(() => logged.some((line) => line.includes("failed")));

      bot.gateway.send(
        messageCreate({
          id: "12",
          channelId: "dm",
          content: "after the failure",
          authorId: AGENT_USER,
        }),
      );
      await waitFor(
        () =>
          listMd(bot.vault).length === 1 &&
          load(operationalDir(bot.indexDir), DISCORD_LEDGER).has("12"),
      );

      expect(readFileSync(listMd(bot.vault)[0]!, "utf8")).toContain("after the failure");
      expect(load(operationalDir(bot.indexDir), DISCORD_LEDGER)).toEqual(new Set(["12"]));
    } finally {
      console.error = realError;
      bot.stop();
      await bot.bot;
    }
  });
});
