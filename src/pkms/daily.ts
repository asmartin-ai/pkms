import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { emit } from "./events.ts";
import { pyStrip, readText, splitLines, writeText } from "./textio.ts";

export const BREADCRUMB_HEADING = "## breadcrumb";

export const FOLDED_HEADING = "## folded today";

export const DID_HEADING = "## did";

const TEMPLATE = `---
title: {day}
created: {day}
tags: [daily]
---

# {day}

## breadcrumb
<!-- where you left off — /resume keeps this current -->

## folded today
<!-- what got filed where — /fold logs each one -->

## did
<!-- pkms did "thing" lands here — retroactive entries welcome -->

## notes

`;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renderTemplate(day: string): string {
  return TEMPLATE.replaceAll("{day}", day);
}

export function dailyPath(vault: string, day?: Date): string {
  return join(vault, "daily", `${isoDay(day ?? new Date())}.md`);
}

export function ensureDaily(vault: string, day?: Date): [string, boolean] {
  const path = dailyPath(vault, day);

  if (existsSync(path)) return [path, false];
  mkdirSync(join(path, ".."), { recursive: true });
  writeText(path, renderTemplate(isoDay(day ?? new Date())));

  return [path, true];
}

export function appendDid(vault: string, thing: string, day?: Date): string {
  const [path] = ensureDaily(vault, day);
  const lines = splitLines(readText(path));
  const entry = `- [x] ${pyStrip(thing)}`;
  const didIdx = lines.findIndex((ln) => pyStrip(ln).toLowerCase() === DID_HEADING);

  if (didIdx !== -1) {
    let end = didIdx + 1;

    for (let j = didIdx + 1; j < lines.length; j++) {
      const s = pyStrip(lines[j]!);

      if (s.startsWith("## ")) break;

      if (s) end = j + 1;
    }

    lines.splice(end, 0, entry);
  } else {
    const notesIdx = lines.findIndex((ln) => pyStrip(ln).toLowerCase() === "## notes");

    if (notesIdx !== -1) {
      lines.splice(notesIdx, 0, DID_HEADING, entry, "");
    } else {
      lines.push("", DID_HEADING, entry);
    }
  }

  writeText(path, `${lines.join("\n")}\n`);

  emit(dirname(vault), "did", {
    source: "pkms",
    ref: `daily/${path.split("/").pop()}`,
    payload: { mechanic: "streak", thing: pyStrip(thing) },
    at: day,
  });

  return path;
}

export function sectionLines(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((ln) => pyStrip(ln).toLowerCase() === heading);

  if (start === -1) return [];
  const out: string[] = [];

  for (const ln of lines.slice(start + 1)) {
    const s = pyStrip(ln!);

    if (s.startsWith("## ")) break;

    if (!s || s.startsWith("<!--")) continue;
    out.push(s);
  }

  return out;
}
