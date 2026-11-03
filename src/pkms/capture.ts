import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { FrontmatterValue } from "./indexer.ts";
import { z } from "zod";
import * as yaml from "js-yaml";
import { emit } from "./events.ts";
import { pyStrip, writeText } from "./textio.ts";

export interface WriteCaptureOptions {
  source: string;
  now?: Date;
  extra?: Record<string, string>;
}

function plainScalar(value: string): boolean {
  if (value === "" || value !== value.trim()) return false;

  if (/\p{Cc}/u.test(value)) return false;

  if ("-?:,[]{}#&*!|>'\"%@`".includes(value[0]!)) return false;

  if (value.includes(": ") || value.endsWith(":")) return false;

  try {
    const loaded = z.string().safeParse(yaml.load(value, { schema: yaml.CORE_SCHEMA }));

    if (!loaded.success || loaded.data !== value) return false;
  } catch {
    return false;
  }

  return !value.includes(" #");
}

export function frontmatterValue(value: FrontmatterValue): string {
  const asString = z.string().safeParse(value);

  if (asString.success) {
    return plainScalar(asString.data) ? asString.data : JSON.stringify(asString.data);
  }

  return JSON.stringify(value) ?? "null";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function stamp(now: Date): string {
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function frontmatterStamp(now: Date): string {
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

export function writeCapture(
  text: string,
  vault: string,
  { source, now, extra }: WriteCaptureOptions,
): string {
  text = pyStrip(text);

  if (!text) throw new Error("empty capture");
  const inbox = join(vault, "inbox");
  mkdirSync(inbox, { recursive: true });
  now = now ?? new Date();

  const slug =
    [...text]
      .slice(0, 32)
      .join("")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "capture";

  const base = `${stamp(now)}_${slug}`;
  let path = join(inbox, `${base}.md`);
  let n = 1;

  while (existsSync(path)) {
    n += 1;
    path = join(inbox, `${base}-${n}.md`);
  }

  const fm = [`captured: ${frontmatterStamp(now)}`, `source: ${source}`];

  for (const [k, v] of Object.entries(extra ?? {})) fm.push(`${k}: ${frontmatterValue(v)}`);
  writeText(path, `---\n${fm.join("\n")}\n---\n\n${text}\n`);

  const relPath = relative(resolve(vault), path).replace(/\\/g, "/");
  emit(dirname(resolve(vault)), "capture_written", {
    source,
    ref: relPath,
    payload: { path: relPath },
  });

  return path;
}

export function inboxCount(vault: string): number {
  const inbox = join(vault, "inbox");
  let isDir = false;

  try {
    isDir = statSync(inbox).isDirectory();
  } catch {}

  if (!isDir) return 0;

  return readdirSync(inbox).filter((f) => f.endsWith(".md")).length;
}
