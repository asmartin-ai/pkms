import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { appendText, pyStrip, readText } from "./textio.ts";

export function load(indexDir: string, name: string): Set<string> {
  const p = join(indexDir, name);

  if (!existsSync(p)) return new Set();
  const ids = new Set<string>();

  for (const ln of readText(p).split("\n")) {
    const s = pyStrip(ln);

    if (s) ids.add(s);
  }

  return ids;
}

export function append(indexDir: string, name: string, ids: Iterable<string>): void {
  mkdirSync(indexDir, { recursive: true });
  const p = join(indexDir, name);
  let chunk = "";

  for (const nid of ids) chunk += `${nid}\n`;
  appendText(p, chunk);
}
