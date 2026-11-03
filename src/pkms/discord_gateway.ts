import { z } from "zod";
import { dirname } from "node:path";
import { captureMessage, makePoster, shouldCapture } from "./discord_capture.ts";
import { handleCommand, isCommand, type CommandResult } from "./discord_agent.ts";

const GATEWAY_URL = "wss://gateway.discord.gg/?encoding=json&v=10";

export const API_BASE = "https://discord.com/api/v10";

const INTENT_GUILD_MESSAGES = 1 << 9;

const INTENT_DIRECT_MESSAGES = 1 << 12;

const INTENT_MESSAGE_CONTENT = 1 << 15;

const INTENTS = INTENT_GUILD_MESSAGES | INTENT_DIRECT_MESSAGES | INTENT_MESSAGE_CONTENT;

const REACTION_EMOJI = "%E2%9C%85";

const FATAL_CLOSE_CODES = {
  4004: "authentication failed — check .secrets/discord-bot-token",
  4010: "invalid shard",
  4011: "sharding required",
  4012: "invalid API version",
  4013: "invalid intent",
  4014: "disallowed intent — enable message content in the dev portal",
} satisfies Record<number, string>;

const CLOSE_CODES = new Map<number, string>(
  Object.entries(FATAL_CLOSE_CODES).map(([code, text]) => [Number(code), text]),
);

const EXIT_FATAL_CLOSE = 78;

const INITIAL_BACKOFF_MS = 1000;

const MAX_BACKOFF_MS = 60_000;

const JsonSchema = z.json();

type JsonValue = z.infer<typeof JsonSchema>;

const HelloDataSchema = z
  .object({
    heartbeat_interval: z.number(),
  })
  .catchall(JsonSchema);

const DispatchFrameSchema = z
  .object({
    op: z.literal(0),
    t: z.string().optional(),
    s: z.number().nullable().optional(),
    d: JsonSchema,
  })
  .catchall(JsonSchema);

const HelloFrameSchema = z
  .object({
    op: z.literal(10),
    d: HelloDataSchema,
  })
  .catchall(JsonSchema);

const GatewayEnvelopeSchema = z.object({ op: z.number() }).catchall(JsonSchema);

type GatewayFrame =
  | { kind: "hello"; heartbeatInterval: number }
  | { kind: "dispatch"; t: string; sequence: number | null; d: JsonValue }
  | { kind: "other"; op: number };

const MessageCreateSchema = z
  .object({
    id: z.string(),
    channel_id: z.string(),
    guild_id: z.string().nullable().optional(),
    content: z.string(),
    author: z.object({ id: z.string(), bot: z.boolean().optional() }).catchall(JsonSchema),
  })
  .catchall(JsonSchema)
  .transform((message) => ({
    id: message.id,
    channelId: message.channel_id,
    isDm: message.guild_id === undefined || message.guild_id === null,
    content: message.content,
    authorId: message.author.id,
    authorIsBot: message.author.bot === true,
  }));

type MessageCreate = z.infer<typeof MessageCreateSchema>;

function decodeFrame(raw: string): GatewayFrame | null {
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  const envelopeResult = GatewayEnvelopeSchema.safeParse(payload);

  if (!envelopeResult.success) return null;
  const envelope = envelopeResult.data;

  if (envelope.op === 10) {
    const result = HelloFrameSchema.safeParse(envelope);

    if (!result.success) return null;

    return {
      kind: "hello",
      heartbeatInterval: result.data.d.heartbeat_interval,
    };
  }

  if (envelope.op === 0) {
    const result = DispatchFrameSchema.safeParse(envelope);

    if (!result.success) return null;

    return {
      kind: "dispatch",
      t: result.data.t ?? "",
      sequence: result.data.s ?? null,
      d: result.data.d,
    };
  }

  return { kind: "other", op: envelope.op };
}

function decodeMessageCreate(d: JsonValue): MessageCreate | null {
  const result = MessageCreateSchema.safeParse(d);

  return result.success ? result.data : null;
}

export interface RunBotOptions {
  botToken: string;
  indexDir: string;
  baseUrl: string;
  captureToken: string;
  allowedChannelId?: string | null;
  vault: string;
  agentUserIds?: readonly string[];
  gatewayUrl?: string;
  apiBaseUrl?: string;
  signal?: AbortSignal;
}

export async function runBot(opts: RunBotOptions): Promise<number> {
  const gatewayUrl = opts.gatewayUrl ?? GATEWAY_URL;
  const apiBase = opts.apiBaseUrl ?? API_BASE;
  const allowedChannelId = opts.allowedChannelId ?? null;
  const agentUserIds = new Set(opts.agentUserIds ?? []);
  const post = makePoster(opts.baseUrl, opts.captureToken);

  let stopped = false;
  let heartbeat: Timer | undefined;
  let sequence: number | null = null;
  let socket: WebSocket | null = null;
  let identified = false;
  let backoffMs = INITIAL_BACKOFF_MS;
  let acked = true;
  let closeCode = 0;

  const stop = (): void => {
    stopped = true;
    clearInterval(heartbeat);
    heartbeat = undefined;
    socket?.close();
  };

  opts.signal?.addEventListener("abort", stop, { once: true });

  if (opts.signal?.aborted) stop();

  if (agentUserIds.size === 0) {
    console.error(
      "discord: no user ids configured — captures are dropped and commands are disabled (set --user-ids)",
    );
  }

  const react = async (channelId: string, messageId: string): Promise<void> => {
    const url = `${apiBase}/channels/${channelId}/messages/${messageId}/reactions/${REACTION_EMOJI}/@me`;

    const resp = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bot ${opts.botToken}` },
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  };

  const onMessageCreate = async (d: JsonValue): Promise<void> => {
    const msg = decodeMessageCreate(d);
    console.error(`discord: message from ${msg?.authorId ?? "unparseable"}`);

    if (msg === null || msg.authorIsBot) return;

    if (agentUserIds.size === 0) {
      if (isCommand(msg.content)) {
        console.error("discord: no user ids configured — commands are disabled (set --user-ids)");
      }

      return;
    }

    if (!agentUserIds.has(msg.authorId)) {
      if (isCommand(msg.content)) {
        console.error(`discord: command from unconfigured author ignored (${msg.authorId})`);
      }

      return;
    }

    if (isCommand(msg.content)) {
      let result: CommandResult;

      try {
        result = handleCommand(dirname(opts.vault), opts.vault, opts.indexDir, msg.content);
      } catch (error) {
        console.error(
          `discord: ${msg.content} failed: ${error instanceof Error ? error.message : String(error)}`,
        );

        return;
      }

      if (result.command !== null) {
        try {
          const reply = await fetch(`${apiBase}/channels/${msg.channelId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${opts.botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ content: result.reply, allowed_mentions: { parse: [] } }),
          });

          if (!reply.ok) {
            const detail = (await reply.text()).slice(0, 200);

            console.error(`discord: reply failed: HTTP ${reply.status} ${detail}`);
          }
        } catch (error) {
          console.error(
            `discord: reply failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        return;
      }
    }

    if (
      !shouldCapture({
        authorIsBot: false,
        isDm: msg.isDm,
        channelId: msg.channelId,
        allowedChannelId,
      })
    ) {
      return;
    }

    let ok = false;

    try {
      ok = await captureMessage(msg.content, msg.id, opts.indexDir, { post });
    } catch {
      return;
    }

    if (ok) {
      try {
        await react(msg.channelId, msg.id);
      } catch {}
    }
  };

  const handleFrame = (raw: string): void => {
    const frame = decodeFrame(raw);

    if (frame === null) return;

    if (frame.kind === "hello") {
      if (socket === null) return;
      const ws = socket;
      acked = true;
      heartbeat = setInterval(() => {
        if (!acked) {
          ws.close();

          return;
        }

        acked = false;
        ws.send(JSON.stringify({ op: 1, d: sequence }));
      }, frame.heartbeatInterval);

      if (!identified) {
        identified = true;
        ws.send(
          JSON.stringify({
            op: 2,
            d: {
              token: opts.botToken,
              intents: INTENTS,
              properties: {
                $os: process.platform,
                $browser: "pkms",
                $device: "pkms",
              },
            },
          }),
        );
      }

      return;
    }

    if (frame.kind === "dispatch") {
      if (frame.sequence !== null) sequence = frame.sequence;

      if (frame.t === "READY") {
        backoffMs = INITIAL_BACKOFF_MS;
        console.error("discord: session ready");
      }

      if (frame.t === "MESSAGE_CREATE") {
        void onMessageCreate(frame.d).catch((error) => {
          console.error(
            `discord: message handler failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }

      return;
    }

    if (frame.op === 11) {
      acked = true;

      return;
    }

    if (frame.op === 1) {
      if (socket === null) return;
      acked = false;
      socket.send(JSON.stringify({ op: 1, d: sequence }));

      return;
    }

    if (frame.op === 7 || frame.op === 9) {
      socket?.close();
    }
  };

  const connectOnce = (): Promise<void> => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const ws = new WebSocket(gatewayUrl);
    socket = ws;
    identified = false;
    acked = true;
    sequence = null;
    closeCode = 0;
    ws.onmessage = (ev: MessageEvent): void => {
      handleFrame(String(ev.data));
    };

    ws.onerror = (): void => {
      ws.close();
    };

    ws.onclose = (ev: CloseEvent): void => {
      clearInterval(heartbeat);
      heartbeat = undefined;
      closeCode = ev.code;
      resolve();
    };

    return promise;
  };

  while (!stopped) {
    await connectOnce();

    if (stopped) return 0;

    const fatal = CLOSE_CODES.get(closeCode) ?? null;

    if (fatal !== null) {
      console.error(`discord: gateway closed ${closeCode} (${fatal}) — not reconnecting`);

      return EXIT_FATAL_CLOSE;
    }

    await Bun.sleep(backoffMs);
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
  }

  return 0;
}
