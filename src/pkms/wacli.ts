import { z } from "zod";

export const WACLI_TIMEOUT_MS = 30_000;

export const WACLI_MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

export interface WacliSpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type WacliRunner = (argv: readonly string[]) => Promise<WacliSpawnResult>;

export interface WacliOptions {
  runner?: WacliRunner;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface WacliDoctor {
  storeDir: string;
  lockHeld: boolean;
  authenticated: boolean;
  sessionRevoked: boolean;
  linkedJid?: string;
  connected: boolean;
  connectionState: string;
  ftsEnabled: boolean;
  storeMessages: number;
  storeChats: number;
}

export interface WacliMessage {
  chatJid: string;
  chatName: string;
  msgId: string;
  senderJid: string;
  senderName: string;
  timestamp: string;
  fromMe: boolean;
  text: string;
  displayText: string;
  reactionToId: string;
  mediaType: string;
  mediaCaption: string;
  filename: string;
  revoked: boolean;
  deletedForMe: boolean;
}

export interface WacliChat {
  jid: string;
  kind: string;
  name: string;
  lastMessageTs: string;
  unread: boolean;
  unreadCount: number;
}

export interface WacliListParams {
  chat?: string;
  after?: string;
  limit?: number;
  asc?: boolean;
}

const WacliEnvelopeSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().nullable(),
});

type WacliEnvelope = z.infer<typeof WacliEnvelopeSchema>;

export const WacliDoctorSchema = z
  .object({
    store_dir: z.string(),
    lock_held: z.boolean(),
    authenticated: z.boolean(),
    session_revoked: z.boolean(),
    linked_jid: z.string().optional(),
    connected: z.boolean(),
    connection_state: z.string(),
    fts_enabled: z.boolean(),
    store: z
      .object({
        messages: z.number(),
        chats: z.number(),
        contacts: z.number(),
        groups: z.number(),
      })
      .optional(),
  })
  .transform((report): WacliDoctor => ({
    storeDir: report.store_dir,
    lockHeld: report.lock_held,
    authenticated: report.authenticated,
    sessionRevoked: report.session_revoked,
    linkedJid: report.linked_jid,
    connected: report.connected,
    connectionState: report.connection_state,
    ftsEnabled: report.fts_enabled,
    storeMessages: report.store?.messages ?? 0,
    storeChats: report.store?.chats ?? 0,
  }));

export const WacliMessageSchema = z
  .object({
    ChatJID: z.string(),
    ChatName: z.string(),
    MsgID: z.string(),
    SenderJID: z.string(),
    SenderName: z.string(),
    Timestamp: z.iso.datetime({ offset: true }),
    FromMe: z.boolean(),
    Text: z.string(),
    DisplayText: z.string(),
    ReactionToID: z.string(),
    MediaType: z.string(),
    MediaCaption: z.string(),
    Filename: z.string(),
    Revoked: z.boolean(),
    DeletedForMe: z.boolean(),
  })
  .transform((row): WacliMessage => ({
    chatJid: row.ChatJID,
    chatName: row.ChatName,
    msgId: row.MsgID,
    senderJid: row.SenderJID,
    senderName: row.SenderName,
    timestamp: row.Timestamp,
    fromMe: row.FromMe,
    text: row.Text,
    displayText: row.DisplayText,
    reactionToId: row.ReactionToID,
    mediaType: row.MediaType,
    mediaCaption: row.MediaCaption,
    filename: row.Filename,
    revoked: row.Revoked,
    deletedForMe: row.DeletedForMe,
  }));

export const WacliChatSchema = z
  .object({
    jid: z.string(),
    kind: z.string(),
    name: z.string(),
    last_message_ts: z.iso.datetime({ offset: true }),
    unread: z.boolean(),
    unread_count: z.number(),
  })
  .transform((row): WacliChat => ({
    jid: row.jid,
    kind: row.kind,
    name: row.name,
    lastMessageTs: row.last_message_ts,
    unread: row.unread,
    unreadCount: row.unread_count,
  }));

const MessageRowsSchema = z
  .object({
    messages: z.array(WacliMessageSchema).nullable(),
    fts: z.boolean().optional(),
  })
  .transform((data): WacliMessage[] => data.messages ?? []);

const ChatRowsSchema = z
  .array(WacliChatSchema)
  .nullable()
  .transform((rows) => rows ?? []);

export class WacliError extends Error {}

export class WacliNotInstalledError extends WacliError {
  constructor(message = "wacli is not installed: install it and put `wacli` on PATH") {
    super(message);
    this.name = "WacliNotInstalledError";
  }
}

export class WacliNotAuthenticatedError extends WacliError {
  constructor(
    message = "the wacli store is not paired with a WhatsApp account; run `wacli auth` to link the phone",
  ) {
    super(message);
    this.name = "WacliNotAuthenticatedError";
  }
}

export class WacliCommandError extends WacliError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WacliCommandError";
  }
}

interface ErrnoLike {
  code?: string;
}

function parseEnvelope(stdout: string): WacliEnvelope | null {
  const text = stdout.trim();

  if (!text.startsWith("{")) return null;

  let doc: unknown;

  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }

  const parsed = WacliEnvelopeSchema.safeParse(doc);

  return parsed.success ? parsed.data : null;
}

async function raceWithTimeout(
  run: WacliRunner,
  argv: readonly string[],
  timeoutMs: number,
): Promise<WacliSpawnResult> {
  return await new Promise<WacliSpawnResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new WacliCommandError(`wacli timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    run(argv).then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (cause: unknown) => {
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

function spawnRunner(maxOutputBytes: number, timeoutMs: number): WacliRunner {
  return async (argv) => {
    const command: string[] = [...argv];
    const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });

    const stderrDecoder = new TextDecoder();

    const stderrText = (async () => {
      let text = "";

      for await (const chunk of proc.stderr) {
        text += stderrDecoder.decode(chunk, { stream: true });
      }

      return text + stderrDecoder.decode();
    })();

    const chunks: Uint8Array[] = [];
    let total = 0;

    const killer = setTimeout(() => {
      proc.kill();
    }, timeoutMs);

    try {
      for await (const chunk of proc.stdout) {
        total += chunk.byteLength;

        if (total > maxOutputBytes) {
          proc.kill();
          throw new WacliCommandError(
            `wacli printed over ${maxOutputBytes} bytes on stdout; killed the process`,
          );
        }

        chunks.push(chunk);
      }
    } finally {
      clearTimeout(killer);
    }

    const exitCode = await proc.exited;

    return { exitCode, stdout: Buffer.concat(chunks).toString("utf-8"), stderr: await stderrText };
  };
}

export async function runWacli<T>(
  args: readonly string[],
  schema: z.ZodType<T>,
  opts: WacliOptions = {},
): Promise<T> {
  const argv: string[] = ["wacli", "--read-only", "--json", ...args];
  const timeoutMs = opts.timeoutMs ?? WACLI_TIMEOUT_MS;
  const maxOutputBytes = opts.maxOutputBytes ?? WACLI_MAX_OUTPUT_BYTES;
  const run = opts.runner ?? spawnRunner(maxOutputBytes, timeoutMs);
  let result: WacliSpawnResult;

  try {
    result = await raceWithTimeout(run, argv, timeoutMs);
  } catch (cause) {
    if (cause instanceof WacliError) throw cause;

    if (cause instanceof Error) {
      const code = (cause as ErrnoLike).code;

      if (code === "ENOENT") {
        throw new WacliNotInstalledError(
          "wacli is not installed: spawning it failed with ENOENT — install wacli and put it on PATH",
        );
      }

      throw new WacliCommandError(`wacli could not be run: ${cause.message}`, { cause });
    }

    throw new WacliCommandError(`wacli could not be run: ${String(cause)}`, { cause });
  }

  if (result.exitCode === 127) {
    throw new WacliNotInstalledError(
      "wacli is not installed: it exited 127 — install wacli and put it on PATH",
    );
  }

  const stdoutBytes = Buffer.byteLength(result.stdout, "utf-8");

  if (stdoutBytes > maxOutputBytes) {
    throw new WacliCommandError(
      `wacli printed ${stdoutBytes} bytes of stdout, over the ${maxOutputBytes}-byte cap`,
    );
  }

  const envelope = parseEnvelope(result.stdout);

  if (result.exitCode !== 0) {
    if (envelope !== null && !envelope.success) {
      throw new WacliCommandError(
        `wacli failed: ${envelope.error ?? "no error text"} (exit code ${result.exitCode})`,
      );
    }

    const tail = result.stderr.trim();

    throw new WacliCommandError(
      tail === ""
        ? `wacli exited with code ${result.exitCode}`
        : `wacli exited with code ${result.exitCode}; stderr: ${tail.slice(-400)}`,
    );
  }

  if (envelope === null) {
    throw new WacliCommandError("wacli printed no {success, data, error} envelope on stdout");
  }

  if (!envelope.success) {
    throw new WacliCommandError(`wacli failed: ${envelope.error ?? "no error text"}`);
  }

  const data = schema.safeParse(envelope.data);

  if (!data.success) {
    throw new WacliCommandError(
      `wacli data did not match the documented payload: ${data.error.message}`,
    );
  }

  return data.data;
}

type WacliValueFlag = "chat" | "after" | "query";

function flagValue(name: WacliValueFlag, value: string): string {
  if (value.startsWith("-")) {
    throw new WacliCommandError(
      `wacli --${name} value must not start with "-": ${JSON.stringify(value)}`,
    );
  }

  return `--${name}=${value}`;
}

export async function doctor(opts: WacliOptions = {}): Promise<WacliDoctor> {
  return runWacli(["doctor"], WacliDoctorSchema, opts);
}

export async function listMessages(
  params: WacliListParams,
  opts: WacliOptions = {},
): Promise<WacliMessage[]> {
  const args: string[] = ["messages", "list"];

  if (params.chat !== undefined) args.push(flagValue("chat", params.chat));

  if (params.after !== undefined) args.push(flagValue("after", params.after));

  if (params.limit !== undefined) args.push(`--limit=${String(params.limit)}`);

  if (params.asc === true) args.push("--asc");

  return runWacli(args, MessageRowsSchema, opts);
}

export async function searchMessages(
  query: string,
  limit: number,
  opts: WacliOptions = {},
): Promise<WacliMessage[]> {
  return runWacli(
    ["messages", "search", `--limit=${String(limit)}`, "--", query],
    MessageRowsSchema,
    opts,
  );
}

export async function listChats(
  query: string,
  limit: number,
  opts: WacliOptions = {},
): Promise<WacliChat[]> {
  return runWacli(
    ["chats", "list", flagValue("query", query), `--limit=${String(limit)}`],
    ChatRowsSchema,
    opts,
  );
}

export function assertAuthenticated(report: WacliDoctor): void {
  if (report.authenticated && !report.sessionRevoked) return;

  const problem = report.sessionRevoked
    ? "the WhatsApp session was revoked"
    : "the wacli store is not paired with a WhatsApp account";

  throw new WacliNotAuthenticatedError(
    `wacli is not ready: ${problem}; run \`wacli auth\` to link the phone`,
  );
}

export function messageBody(msg: WacliMessage): string {
  if (msg.reactionToId !== "") return "";

  const kind = msg.mediaType.trim().toLowerCase();

  if (kind === "") return msg.text === "" ? msg.mediaCaption : msg.text;

  const filename = msg.filename.replace(/\s+/g, " ").trim();
  const tag = kind === "document" && filename !== "" ? `[document: ${filename}]` : `[${kind}]`;
  const caption = msg.mediaCaption.trim();

  return caption === "" ? tag : `${tag} ${caption}`;
}
