import { z } from "zod";
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Server, ServerWebSocket } from "bun";
import { writeCapture } from "../../src/pkms/capture.ts";
import {
  DISCORD_LEDGER,
  captureMessage,
  HTTPError,
  makePoster,
  shouldCapture,
} from "../../src/pkms/discord_capture.ts";
import { load } from "../../src/pkms/ledger.ts";
import { operationalDir } from "../../src/pkms/operational.ts";
import { runBot } from "../../src/pkms/discord_gateway.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

const TOKEN = "test-token";

const AGENT_USER = "alex-1";

let server: Server<ServerWebSocket<undefined>> | null = null;

afterAll(() => {
  server?.stop(true);
});

function startCaptureStub(vault: string): string {
  server?.stop(true);
  server = Bun.serve({
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

  return `http://127.0.0.1:${server.port}`;
}

describe("Discord capture", () => {
  test("should_capture matrix", () => {
    const dm = { isDm: true, channelId: null, allowedChannelId: null };
    expect(shouldCapture({ authorIsBot: false, ...dm })).toBe(true);
    expect(shouldCapture({ authorIsBot: true, ...dm })).toBe(false);
    expect(
      shouldCapture({ authorIsBot: false, isDm: false, channelId: "42", allowedChannelId: "42" }),
    ).toBe(true);
    expect(
      shouldCapture({ authorIsBot: false, isDm: false, channelId: "99", allowedChannelId: "42" }),
    ).toBe(false);
    expect(
      shouldCapture({ authorIsBot: false, isDm: false, channelId: "42", allowedChannelId: null }),
    ).toBe(false);
  });

  test("capture_message posts once and dedupes", async () => {
    const root = mkTmp();
    const indexDir = join(root, ".index");

    try {
      const posted: string[] = [];
      expect(
        await captureMessage("a thought", "msg-1", indexDir, {
          post: (t) => {
            posted.push(t);
          },
        }),
      ).toBe(true);
      expect(posted).toEqual(["a thought"]);
      expect(load(operationalDir(indexDir), DISCORD_LEDGER)).toEqual(new Set(["msg-1"]));
      expect(
        await captureMessage("a thought", "msg-1", indexDir, {
          post: (t) => {
            posted.push(t);
          },
        }),
      ).toBe(false);
      expect(posted).toEqual(["a thought"]);
    } finally {
      rmTmp(root);
    }
  });

  test("failed post is not ledgered", async () => {
    const root = mkTmp();
    const indexDir = join(root, ".index");

    try {
      async function boom(_text: string): Promise<void> {
        throw new Error("service down");
      }

      await expect(captureMessage("lost?", "msg-2", indexDir, { post: boom })).rejects.toThrow(
        "service down",
      );
      expect(load(operationalDir(indexDir), DISCORD_LEDGER).has("msg-2")).toBe(false);
    } finally {
      rmTmp(root);
    }
  });

  test("make_poster lands a capture file", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");

    try {
      const baseUrl = startCaptureStub(vault);
      const post = makePoster(baseUrl, TOKEN);
      await post("from discord with love");
      const files = listMd(vault);
      expect(files.length).toBe(1);
      const body = readFileSync(files[0]!, "utf8");
      expect(body).toContain("source: discord");
      expect(body).toContain("from discord with love");
    } finally {
      rmTmp(root);
    }
  });

  test("make_poster with a bad token raises", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");

    try {
      const baseUrl = startCaptureStub(vault);
      const post = makePoster(baseUrl, "wrong-token");
      await expect(post("should not land")).rejects.toBeInstanceOf(HTTPError);
      expect(listMd(vault)).toEqual([]);
    } finally {
      rmTmp(root);
    }
  });
});

describe("Discord Gateway integration", () => {
  test("authenticates, routes real events, captures once, and reacts after capture", async () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const baseUrl = startCaptureStub(vault);
    const reactions: string[] = [];

    const identifyDataSchema = z
      .object({
        token: z.string(),
        intents: z.number(),
        properties: z
          .object({
            $os: z.string(),
            $browser: z.string(),
            $device: z.string(),
          })
          .catchall(z.json()),
      })
      .catchall(z.json());

    const identifyFrameSchema = z
      .object({
        op: z.number(),
        d: z.json(),
      })
      .catchall(z.json());

    const identified = Promise.withResolvers<z.infer<typeof identifyDataSchema>>();
    const reacted = Promise.withResolvers<void>();

    const apiServer = Bun.serve({
      port: 0,
      fetch(req) {
        expect(req.method).toBe("PUT");
        expect(req.headers.get("Authorization")).toBe("Bot bot-secret");
        reactions.push(new URL(req.url).pathname);

        if (reactions.length === 2) reacted.resolve();

        return new Response(null, { status: 204 });
      },
    });

    const gatewayServer = Bun.serve({
      port: 0,
      fetch(req, server) {
        if (!server.upgrade(req)) return new Response("expected websocket", { status: 400 });

        return undefined;
      },
      websocket: {
        open(ws) {
          ws.send(JSON.stringify({ op: 10, d: { heartbeat_interval: 60_000 } }));
        },
        message(ws, raw) {
          let payload: unknown;

          try {
            payload = JSON.parse(String(raw));
          } catch {
            throw new Error("gateway sent invalid JSON");
          }

          const frame = identifyFrameSchema.parse(payload);

          if (frame.op !== 2) return;
          identified.resolve(identifyDataSchema.parse(frame.d));

          const dispatch = (
            id: string,
            channelId: string,
            guildId: string | null,
            bot = false,
            authorId = AGENT_USER,
          ) =>
            ws.send(
              JSON.stringify({
                op: 0,
                t: "MESSAGE_CREATE",
                s: Number(id),
                d: {
                  id,
                  channel_id: channelId,
                  guild_id: guildId,
                  content: `message ${id}`,
                  author: { id: bot ? "bot-user" : authorId, bot },
                },
              }),
            );

          dispatch("1", "dm-channel", null, true);
          dispatch("2", "other-channel", "guild");
          dispatch("3", "allowed-channel", "guild");
          dispatch("4", "dm-channel", null);
          dispatch("5", "allowed-channel", "guild", false, "a-stranger");
        },
      },
    });

    const controller = new AbortController();

    try {
      const bot = runBot({
        botToken: "bot-secret",
        indexDir: join(root, ".index"),
        baseUrl,
        captureToken: TOKEN,
        vault,
        allowedChannelId: "allowed-channel",
        agentUserIds: [AGENT_USER],
        gatewayUrl: `ws://127.0.0.1:${gatewayServer.port}`,
        apiBaseUrl: `http://127.0.0.1:${apiServer.port}/api/v10`,
        signal: controller.signal,
      });

      const identify = await identified.promise;
      expect(identify.token).toBe("bot-secret");
      expect(identify.intents).toBe((1 << 9) | (1 << 12) | (1 << 15));
      await reacted.promise;
      controller.abort();
      expect(await bot).toBe(0);

      expect(reactions).toHaveLength(2);
      expect(reactions).toContain(
        "/api/v10/channels/allowed-channel/messages/3/reactions/%E2%9C%85/@me",
      );
      expect(reactions).toContain(
        "/api/v10/channels/dm-channel/messages/4/reactions/%E2%9C%85/@me",
      );
      const files = listMd(vault);
      expect(files).toHaveLength(2);
      const bodies = files.map((file) => readFileSync(file, "utf8"));
      expect(bodies.every((body) => body.includes("source: discord"))).toBe(true);
      expect(bodies.some((body) => body.includes("message 3"))).toBe(true);
      expect(bodies.some((body) => body.includes("message 4"))).toBe(true);
      expect(load(join(root, ".ledger"), DISCORD_LEDGER)).toEqual(new Set(["3", "4"]));
    } finally {
      controller.abort();
      gatewayServer.stop(true);
      apiServer.stop(true);
      rmTmp(root);
    }
  });
});

function listMd(dir: string): string[] {
  const inbox = join(dir, "inbox");

  if (!existsSync(inbox)) return [];

  return readdirSync(inbox)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(dir, "inbox", f))
    .sort();
}
