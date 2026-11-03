import { append, load } from "./ledger.ts";

export const DISCORD_LEDGER = "discord-ledger.txt";

export interface ShouldCaptureOptions {
  authorIsBot: boolean;
  isDm: boolean;
  channelId: string | null;
  allowedChannelId: string | null;
}

export function shouldCapture(opts: ShouldCaptureOptions): boolean {
  if (opts.authorIsBot) return false;

  if (opts.isDm) return true;

  return opts.allowedChannelId !== null && opts.channelId === opts.allowedChannelId;
}

export class HTTPError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message ?? `HTTP Error ${status}`);
    this.name = "HTTPError";
    this.status = status;
  }
}

export type Poster = (text: string) => Promise<void>;

export function makePoster(baseUrl: string, token: string): Poster {
  return async (text: string): Promise<void> => {
    const url = `${baseUrl.replace(/\/+$/, "")}/capture?source=discord`;

    const resp = await fetch(url, {
      method: "POST",
      body: text,
      headers: {
        "X-Capture-Token": token,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });

    if (!resp.ok) throw new HTTPError(resp.status);
  };
}

export interface CaptureMessageOptions {
  post: (text: string) => void | Promise<void>;
}

export async function captureMessage(
  text: string,
  messageId: string,
  indexDir: string,
  { post }: CaptureMessageOptions,
): Promise<boolean> {
  if (load(indexDir, DISCORD_LEDGER).has(messageId)) return false;
  await post(text);
  append(indexDir, DISCORD_LEDGER, [messageId]);

  return true;
}
