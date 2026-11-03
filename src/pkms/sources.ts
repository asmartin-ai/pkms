import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import * as yaml from "js-yaml";
import { z } from "zod";
import { emit } from "./events.ts";

export const SourceSchema = z
  .object({
    source: z.enum(["email", "keep", "whatsapp"]),
    source_id: z.string().min(1),
    received_at: z.iso.datetime({ offset: true }),
    route: z.enum(["pending", "routed", "noise", "hold"]),
    route_reason: z
      .string()
      .regex(/^[^\r\n]*$/)
      .optional(),
    routed_at: z.iso.datetime({ offset: true }).optional(),
    route_model: z.string().optional(),
    inbox_note: z
      .string()
      .refine(
        (value) =>
          value.startsWith("inbox/") &&
          !value.includes("\\") &&
          !value.split("/").some((part) => part === ".." || part === "." || part === ""),
        "inbox_note must be a vault-relative inbox path",
      )
      .optional(),
  })
  .catchall(z.string());

export type SourceMetadata = z.infer<typeof SourceSchema>;

export interface SourceRecord {
  path: string;
  relativePath: string;
  data: SourceMetadata;
  body: string;
}

export type RoutePatch = Pick<
  SourceMetadata,
  "route" | "route_reason" | "routed_at" | "route_model" | "inbox_note"
>;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function contained(root: string, path: string): boolean {
  const rel = relative(root, path);

  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function sourceRoot(vault: string): string {
  const root = resolve(vault);
  const sources = join(root, "sources");

  if (existsSync(sources) && !contained(realpathSync(root), realpathSync(sources))) {
    throw new Error("source directory escapes vault");
  }

  return sources;
}

function checkedPath(vault: string, path: string): string {
  const root = sourceRoot(vault);
  const target = isAbsolute(path) ? resolve(path) : resolve(vault, path);

  if (!contained(root, target) || target === root || !target.endsWith(".md")) {
    throw new Error("invalid source note path");
  }

  let ancestor = target;

  while (!existsSync(ancestor)) ancestor = dirname(ancestor);

  if (existsSync(root) && !contained(realpathSync(root), realpathSync(ancestor))) {
    throw new Error("source note escapes archive");
  }

  return target;
}

function parseSourceFile(vault: string, target: string): SourceRecord {
  const text = readFileSync(target, "utf8");
  const match = FRONTMATTER.exec(text);

  if (!match) throw new Error(`source note has no frontmatter: ${target}`);
  const data = SourceSchema.parse(yaml.load(match[1]!, { schema: yaml.CORE_SCHEMA }));

  return {
    path: target,
    relativePath: relative(vault, target).split(sep).join("/"),
    data,
    body: text.slice(match[0].length),
  };
}

export function readSource(vault: string, path: string): SourceRecord {
  return parseSourceFile(vault, checkedPath(vault, path));
}

export function listSources(
  vault: string,
  opts: { route?: SourceMetadata["route"]; source?: SourceMetadata["source"]; limit?: number } = {},
): SourceRecord[] {
  const root = sourceRoot(vault);

  if (!existsSync(root)) return [];
  const stack = [root];
  const records: SourceRecord[] = [];

  while (stack.length) {
    const dir = stack.pop()!;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        let record: SourceRecord;

        try {
          record = parseSourceFile(vault, path);
        } catch (error) {
          console.error(
            `[sources] skipping unreadable note ${path}: ${error instanceof Error ? error.message : String(error)}`,
          );

          continue;
        }

        if (opts.route && record.data.route !== opts.route) continue;

        if (opts.source && record.data.source !== opts.source) continue;
        records.push(record);
      }
    }
  }

  records.sort(
    (a, b) =>
      a.data.received_at.localeCompare(b.data.received_at) ||
      a.relativePath.localeCompare(b.relativePath),
  );

  return opts.limit === undefined ? records : records.slice(0, Math.max(0, opts.limit));
}

function serialize(data: SourceMetadata, body: string): string {
  return `---\n${yaml.dump(data, { schema: yaml.CORE_SCHEMA, lineWidth: -1, noRefs: true })}---\n${body}`;
}

function findExistingByHash(vault: string, source: string, hash: string): string | null {
  const root = sourceRoot(vault);
  const sourceDir = join(root, source);

  if (!existsSync(sourceDir)) return null;

  const stack = [sourceDir];

  while (stack.length) {
    const dir = stack.pop()!;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile() && entry.name === `${hash}.md`) return path;
    }
  }

  return null;
}

export function writeSource(vault: string, body: string, metadata: SourceMetadata): string {
  const data = SourceSchema.parse(metadata);
  const hash = createHash("sha256").update(data.source_id).digest("hex");

  const folder =
    data.source === "email" ? join(data.source, data.received_at.slice(0, 7)) : data.source;

  const candidate = join(sourceRoot(vault), folder, `${hash}.md`);

  let path: string;

  if (existsSync(candidate)) {
    path = checkedPath(vault, candidate);
  } else {
    const existing = data.source === "email" ? findExistingByHash(vault, data.source, hash) : null;

    if (existing) {
      return existing;
    }

    path = checkedPath(vault, candidate);
    mkdirSync(dirname(path), { recursive: true });
  }

  checkedPath(vault, path);

  try {
    writeFileSync(path, serialize(data, body), { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    if (!existsSync(path) || lstatSync(path).isSymbolicLink()) throw error;
    const prior = readSource(vault, path);

    if (prior.data.source !== data.source || prior.data.source_id !== data.source_id) throw error;

    return path;
  }

  emit(dirname(resolve(vault)), "source_archived", {
    source: data.source,
    ref: relative(vault, path).replace(/\\/g, "/"),
    payload: { source_id: data.source_id, route: data.route },
  });

  return path;
}

export function setRoute(vault: string, path: string, patch: RoutePatch): void {
  const prior = readSource(vault, path);
  const data = SourceSchema.parse({ ...prior.data, ...patch });
  const temporary = `${prior.path}.${randomUUID()}.tmp`;

  try {
    writeFileSync(temporary, serialize(data, prior.body), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporary, prior.path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
