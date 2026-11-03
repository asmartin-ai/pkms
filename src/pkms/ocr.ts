import { existsSync } from "node:fs";
import { pyStrip } from "./textio.ts";

const CANDIDATES = [
  "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
  "C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
];

export function findTesseract(): string | null {
  const onPath = Bun.which("tesseract");

  if (onPath) return onPath;

  for (const c of CANDIDATES) {
    if (existsSync(c)) return c;
  }

  return null;
}

export const OCR_TIMEOUT_MS = 30_000;

export interface SpawnResult {
  exitCode: number;
  stdout: Uint8Array;
}

export type SpawnFn = (cmd: string[], timeoutMs: number) => Promise<SpawnResult>;

export class OcrTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`tesseract timed out after ${timeoutMs} ms`);
    this.name = "OcrTimeoutError";
  }
}

async function raceWithTimeout(
  spawn: SpawnFn,
  cmd: string[],
  timeoutMs: number,
): Promise<SpawnResult> {
  return await new Promise<SpawnResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new OcrTimeoutError(timeoutMs));
    }, timeoutMs);

    let runner: Promise<SpawnResult>;

    try {
      runner = spawn(cmd, timeoutMs);
    } catch (cause) {
      clearTimeout(timer);
      reject(cause);

      return;
    }

    runner.then(
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

function spawnRunner(): SpawnFn {
  return async (cmd, killAfter) => {
    const proc = Bun.spawn([...cmd], { stdout: "pipe", stderr: "ignore" });
    const chunks: Uint8Array[] = [];
    const exited = proc.exited;

    const killer = setTimeout(() => {
      proc.kill();
      const hard = setTimeout(() => proc.kill(9), 250);

      exited.then(() => clearTimeout(hard));
    }, killAfter);

    try {
      for await (const chunk of proc.stdout) {
        chunks.push(chunk);
      }
    } finally {
      clearTimeout(killer);
    }

    await exited;

    return { exitCode: proc.exitCode ?? -1, stdout: Buffer.concat(chunks) };
  };
}

export interface ExtractTextOptions {
  exe?: string | null;
  spawn?: SpawnFn;
  timeoutMs?: number;
}

export async function extractText(
  image: string,
  opts: ExtractTextOptions = {},
): Promise<string | null> {
  const exe = opts.exe || findTesseract();

  if (exe === null) return null;
  const timeoutMs = opts.timeoutMs ?? OCR_TIMEOUT_MS;
  const spawn = opts.spawn ?? spawnRunner();
  let out: SpawnResult;

  try {
    out = await raceWithTimeout(spawn, [exe, image, "stdout"], timeoutMs);
  } catch {
    return null;
  }

  if (out.exitCode !== 0) return "";

  return pyStrip(new TextDecoder("utf-8").decode(out.stdout));
}
