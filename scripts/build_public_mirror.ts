import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import {
  contentRisks,
  denylistedPaths,
  inside,
  isProbablyText,
  mirrorManifest,
  normalizePath,
  printFindings,
  readText,
  SCRUB_SUFFIXES,
  SELF_REFERENTIAL,
  type Finding,
  gitLsFiles,
} from "./check_publication_safety.ts";

const DEFAULT_OUTPUT = "exports/public-mirror";

const WINDOWS_PATH_RE =
  /(?<![A-Za-z])(?:[A-Za-z]:[\\/][^\s)`'"<>]+?)(?=[.,!?;:]?(?:\s|$|[)`'">]))/g;

const USER_PATH_RE =
  /(?:\/[Uu]sers\/(?!@)[^\s)`'"<>]+?|\/home\/[^\s)`'"<>]+?)(?=[.,!?;:]?(?:\s|$|[)`'">]))/g;

export function scrubText(text: string): string {
  return text
    .replace(WINDOWS_PATH_RE, "/path/to/local-resource")
    .replace(USER_PATH_RE, "/path/to/local-resource");
}

function outputPath(root: string, requested: string): string {
  const rootReal = realpathSync(root);
  const exportsDir = resolve(rootReal, "exports");
  const exportsExists = existsSync(exportsDir);

  if (exportsExists && lstatSync(exportsDir).isSymbolicLink()) {
    throw new Error("refusing exports symlink outside repository");
  }

  const exportsReal = exportsExists ? realpathSync(exportsDir) : exportsDir;

  if (!inside(rootReal, exportsReal))
    throw new Error("refusing exports symlink outside repository");

  const output = resolve(
    exportsReal,
    requested === DEFAULT_OUTPUT ? "public-mirror" : requested.replace(/^exports[\\/]/, ""),
  );

  if (output === exportsReal) throw new Error("refusing to replace exports/ itself");

  if (!inside(exportsReal, output))
    throw new Error(`refusing to write outside exports/: ${requested}`);
  let existing = output;

  while (!lstatSafe(existing) && existing !== rootReal) existing = dirname(existing);
  const existingReal = realpathSync(existing);

  if (!inside(rootReal, existingReal) || (exportsExists && !inside(exportsReal, existingReal))) {
    throw new Error(`refusing symlink output outside exports/: ${requested}`);
  }

  return output;
}

function lstatSafe(path: string): boolean {
  try {
    lstatSync(path);

    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

function copyTrackedFile(root: string, output: string, path: string): void {
  const source = resolve(root, path);

  if (!inside(root, source)) throw new Error(`refusing path outside repository: ${path}`);
  const realSource = realpathSync(source);

  if (!inside(root, realSource)) throw new Error(`refusing symlink outside repository: ${path}`);
  const target = resolve(output, path);

  if (!inside(output, target)) throw new Error(`refusing output path traversal: ${path}`);
  mkdirSync(dirname(target), { recursive: true });
  const info = lstatSync(source);

  if (info.isSymbolicLink()) throw new Error(`refusing tracked symlink: ${path}`);

  if (!info.isFile()) throw new Error(`refusing non-file tracked entry: ${path}`);

  if (SCRUB_SUFFIXES.has(extname(path).toLowerCase()) && isProbablyText(path)) {
    const text = readText(source);

    if (text === undefined) copyFileSync(source, target);
    else writeFileSync(target, scrubText(text), "utf8");
  } else {
    copyFileSync(source, target);
  }
}

function generatedFiles(output: string): string[] {
  const files: string[] = [];

  for (const entry of new Bun.Glob("**/*").scanSync({
    cwd: output,
    onlyFiles: false,
    followSymlinks: false,
  })) {
    const absolute = resolve(output, entry);

    if (!inside(output, absolute)) throw new Error(`generated path escapes output: ${entry}`);
    const info = lstatSync(absolute);

    if (info.isSymbolicLink()) throw new Error(`generated symlink is not permitted: ${entry}`);

    if (info.isFile()) files.push(normalizePath(relative(output, absolute)));
  }

  return files.sort();
}

export function validateGenerated(output: string): Finding[] {
  const findings: Finding[] = [];
  const paths = generatedFiles(output);

  for (const path of denylistedPaths(paths))
    findings.push({
      severity: "FAIL",
      category: "mirror private path",
      path,
      detail: "matches denylist",
    });

  for (const path of paths) {
    if (SELF_REFERENTIAL.has(path) || !isProbablyText(path)) continue;
    const text = readText(resolve(output, path));

    if (text === undefined) continue;

    for (const risk of contentRisks(path, text))
      findings.push({ severity: "FAIL", category: "mirror content", path, detail: risk });
  }

  return findings;
}

export function build(root: string, requestedOutput = DEFAULT_OUTPUT) {
  root = realpathSync(root);
  const output = outputPath(root, requestedOutput);
  const tracked = gitLsFiles(root).filter((path) => existsSync(resolve(root, path)));
  const manifest = mirrorManifest(tracked);

  for (const path of denylistedPaths(manifest))
    throw new Error(`allowlist includes private path: ${path}`);

  if (lstatSafe(output)) rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });

  for (const path of manifest) copyTrackedFile(root, output, path);

  return { manifest, findings: validateGenerated(output), output };
}

function parseArgs(args: string[]) {
  let root = resolve(import.meta.dir, "..");
  let output = DEFAULT_OUTPUT;
  let showManifest = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "--root" || arg === "--output") {
      const value = args[++i];

      if (!value) throw new Error(`${arg} requires a value`);

      if (arg === "--root") root = resolve(value);
      else output = value;
    } else if (arg === "--manifest") showManifest = true;
    else throw new Error(`unknown argument: ${arg}`);
  }

  return { root, output, manifest: showManifest };
}

export function main(args = Bun.argv.slice(2)): number {
  const options = parseArgs(args);
  const result = build(options.root, options.output);
  console.log(`public mirror: wrote ${result.manifest.length} files to ${result.output}`);

  if (options.manifest) for (const path of result.manifest) console.log(path);
  printFindings(result.findings);

  return result.findings.some((finding) => finding.severity === "FAIL") ? 1 : 0;
}

if (import.meta.main) process.exit(main());
