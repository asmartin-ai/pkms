import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function mkTmp() {
  return mkdtempSync(join(tmpdir(), "pkms-ts-"));
}

export function rmTmp(...paths: string[]) {
  for (const p of paths) rmSync(p, { recursive: true, force: true });
}

export function writeNote(
  path: string,
  body: string,
  opts: { title?: string; tags?: string[]; created?: string } = {},
) {
  const dir = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
  mkdirSync(dir, { recursive: true });
  const fmLines: string[] = [];

  if (opts.title !== undefined) fmLines.push(`title: ${opts.title}`);
  fmLines.push(`created: ${opts.created ?? "2026-06-01"}`);

  if (opts.tags !== undefined) fmLines.push(`tags: [${opts.tags.join(", ")}]`);
  const fm = fmLines.join("\n");
  writeFileSync(path, `---\n${fm}\n---\n\n${body}`, "utf8");

  return path;
}

export function makeVault() {
  const root = mkTmp();
  const vault = join(root, "vault");
  const indexDir = join(root, ".index");

  writeNote(
    join(vault, "projects", "alpha.md"),
    "Alpha references [[beta]] and [[gamma|the gamma note]].\n\n- [ ] open task one\n- [x] finished task\n",
    { title: "Alpha Project", tags: ["project", "active"] },
  );

  writeNote(
    join(vault, "resources", "beta.md"),
    "Beta covers the FTS5 external-content table pattern.\n\n- [ ] open task two\n",
    { title: "Beta Note" },
  );

  const daily = join(vault, "daily", "2026-06-01.md");
  mkdirSync(join(vault, "daily"), { recursive: true });
  writeFileSync(daily, "Plain daily note, no frontmatter at all.", "utf8");

  return { vault, indexDir };
}
