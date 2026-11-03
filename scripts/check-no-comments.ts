import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

type Span = readonly [number, number];

type Syntax = {
  readonly quotes: readonly string[];
  readonly blocks: readonly (readonly [string, string])[];
  readonly line: readonly string[];
  readonly lineNeedsWordStart: boolean;
};

const CSS: Syntax = {
  quotes: ['"', "'"],
  blocks: [["/*", "*/"]],
  line: [],
  lineNeedsWordStart: false,
};

const HASH: Syntax = { quotes: ['"', "'"], blocks: [], line: ["#"], lineNeedsWordStart: true };

const PYTHON: Syntax = {
  quotes: ['"""', "'''", '"', "'"],
  blocks: [],
  line: ["#"],
  lineNeedsWordStart: false,
};

const POWERSHELL: Syntax = {
  quotes: ['"', "'"],
  blocks: [["<#", "#>"]],
  line: ["#"],
  lineNeedsWordStart: true,
};

const MARKUP: Syntax = {
  quotes: [],
  blocks: [
    ["<!--", "-->"],
    ["{#", "#}"],
  ],
  line: [],
  lineNeedsWordStart: false,
};

const SCRIPT: Syntax = {
  quotes: ['"', "'", "`"],
  blocks: [["/*", "*/"]],
  line: ["//"],
  lineNeedsWordStart: false,
};

function syntaxFor(extension: string): Syntax | null {
  switch (extension) {
    case ".css":
      return CSS;
    case ".sh":
      return HASH;
    case ".py":
      return PYTHON;
    case ".ps1":
      return POWERSHELL;
    case ".html":
    case ".njk":
      return MARKUP;
    default:
      return null;
  }
}

const EXCLUDED = [
  /^\.agents\//,
  /^tools\/oxlint\/anti-slop\//,
  /\/vendor\//,
  /\.min\.(js|css)$/,
  /\/ext\/json-enc\.js$/,
];

function scan(text: string, syntax: Syntax, from: number, to: number): Span[] {
  const spans: Span[] = [];
  let i = from;

  while (i < to) {
    const quote = syntax.quotes.find((q) => text.startsWith(q, i));

    if (quote) {
      let j = i + quote.length;

      while (j < to && !text.startsWith(quote, j))
        j += text[j] === "\\" && quote.length === 1 ? 2 : 1;
      i = j + quote.length;
      continue;
    }

    const block = syntax.blocks.find(([open]) => text.startsWith(open, i));

    if (block) {
      const close = text.indexOf(block[1], i + block[0].length);
      const end = close === -1 ? to : close + block[1].length;

      spans.push([i, end]);
      i = end;
      continue;
    }

    const lineToken = syntax.line.find((token) => text.startsWith(token, i));
    const atWordStart = i === 0 || /\s/.test(text[i - 1] ?? "");

    if (lineToken && (!syntax.lineNeedsWordStart || atWordStart) && !text.startsWith("#!", i)) {
      const newline = text.indexOf("\n", i);
      const end = newline === -1 ? to : Math.min(newline, to);

      spans.push([i, end]);
      i = end;
      continue;
    }

    i += 1;
  }

  return spans;
}

function markupSpans(text: string): Span[] {
  const spans = scan(text, MARKUP, 0, text.length);

  for (const match of text.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const bodyStart = (match.index ?? 0) + match[0].indexOf(">") + 1;
    const bodyEnd = bodyStart + (match[2] ?? "").length;

    spans.push(...scan(text, match[1] === "style" ? CSS : SCRIPT, bodyStart, bodyEnd));
  }

  return spans.toSorted((a, b) => a[0] - b[0]);
}

function batchSpans(text: string): Span[] {
  return [...text.matchAll(/^[ \t]*@?(rem\b|::).*$/gim)].map((m): Span => [
    m.index ?? 0,
    (m.index ?? 0) + m[0].length,
  ]);
}

function commentSpans(path: string, text: string): Span[] {
  const extension = extname(path).toLowerCase();

  if (extension === ".bat" || extension === ".cmd") return batchSpans(text);

  if (extension === ".html" || extension === ".njk") return markupSpans(text);
  const syntax = syntaxFor(extension);

  return syntax ? scan(text, syntax, 0, text.length) : [];
}

function strip(text: string, spans: readonly Span[]): string {
  let out = text;

  for (const [start, end] of spans.toReversed()) {
    const lineStart = out.lastIndexOf("\n", start - 1) + 1;
    const newline = out.indexOf("\n", end);
    const lineEnd = newline === -1 ? out.length : newline;
    const before = out.slice(lineStart, start);
    const after = out.slice(end, lineEnd);

    if (before.trim() === "" && after.trim() === "")
      out = out.slice(0, lineStart) + out.slice(newline === -1 ? lineEnd : newline + 1);
    else out = out.slice(0, start).trimEnd() + out.slice(end);
  }

  return out.replace(/\n{3,}/g, "\n\n");
}

function trackedFiles(): string[] {
  const listed = Bun.spawnSync(["git", "ls-files", "-co", "--exclude-standard"]).stdout.toString();

  return listed
    .split("\n")
    .filter((path) => path && !EXCLUDED.some((pattern) => pattern.test(path)))
    .filter(
      (path) => syntaxFor(extname(path).toLowerCase()) !== null || /\.(bat|cmd)$/i.test(path),
    );
}

function main(args: readonly string[]): number {
  const fix = args.includes("--fix");
  const named = args.filter((arg) => arg !== "--fix");
  const files = named.length ? named : trackedFiles();
  let found = 0;

  for (const path of files) {
    const text = readFileSync(path, "utf8");
    const spans = commentSpans(path, text);

    if (!spans.length) continue;
    found += spans.length;

    if (fix) writeFileSync(path, strip(text, spans));
    else
      for (const [start] of spans)
        console.log(`${path}:${text.slice(0, start).split("\n").length}: comment`);
  }

  if (fix || !found) return 0;

  console.error(`${found} comment(s) found. Code carries no comments; see AGENTS.md.`);

  return 1;
}

process.exit(main(process.argv.slice(2)));
