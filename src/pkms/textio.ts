import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

const EOL = process.platform === "win32" ? "\r\n" : "\n";

export const PY_WS =
  "\\t\\n\\r\\v\\f \\x1c-\\x1f\\x85\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";

const PY_STRIP = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, "g");

export function pyStrip(text: string): string {
  return text.replace(PY_STRIP, "");
}

export function readText(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function toPlatformEol(text: string): string {
  return EOL === "\n" ? text : text.replace(/\n/g, EOL);
}

export function atomicWrite(path: string, text: string): void {
  const target = existsSync(path) ? realpathSync(path) : path;
  const directory = dirname(target);

  mkdirSync(directory, { recursive: true });
  const temporary = join(directory, `${basename(target)}.${randomUUID()}.tmp`);

  try {
    writeFileSync(temporary, text, { encoding: "utf8", flag: "wx" });

    if (existsSync(target)) chmodSync(temporary, statSync(target).mode);
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function writeText(path: string, text: string): void {
  atomicWrite(path, toPlatformEol(text));
}

export function appendText(path: string, text: string): void {
  appendFileSync(path, toPlatformEol(text), "utf8");
}

export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");

  if (text.endsWith("\n")) lines.pop();

  return lines;
}
