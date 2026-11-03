import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";

export const PUBLIC_ALLOWLIST = [
  "AGENTS.md",
  "DESIGN.md",
  "LICENSE",
  "PRODUCT.md",
  "README.md",
  ".gitignore",
  ".gitleaks.toml",
  ".oxfmtrc.json",
  ".oxlintrc.json",
  "bun.lock",
  "package.json",
  "tsconfig.json",
  "bin/pkms",
  "bin/pkms.cmd",
  "scripts/build_public_mirror.ts",
  "scripts/check-no-comments.ts",
  "scripts/check_publication_safety.ts",
  "scripts/discord-bot-wizard.sh",
  "src/**",
  "tests/**",
  ".github/dependabot.yml",
  ".github/workflows/**",
  "deploy/systemd/**",
  "docs/email-discord-setup.md",
  "docs/firefox-newtab-setup.md",
  "docs/hermes-setup.md",
  "docs/keep-setup.md",
  "docs/phone-capture-setup.md",
  "docs/phone-pwa-setup.md",
  "docs/publication-safety.md",
  "docs/whatsapp-setup.md",
  "tools/oxlint/anti-slop/**",
  "tools/oxlint/khaos/**",
];

export const PRIVATE_DENYLIST = [
  ".secrets/**",
  ".index/**",
  "keep-media/**",
  ".venv/**",
  "**/.venv/**",
  ".pytest_cache/**",
  "dist/**",
  "build/**",
  "**/__pycache__/**",
  "*.db",
  "*.sqlite",
  "*.sqlite3",
  "*.db-shm",
  "*.db-wal",
  ".env",
  "**/.env",
  "*.env.local",
  "*.pem",
  "*.key",
  "*.p12",
  "vault/daily/**",
  "vault/inbox/**",
  "vault/media/**",
  "vault/areas/**",
  "vault/archive/**",
  "vault/**/*.zip",
  "vault/**/*.tar",
  "vault/**/*.tar.gz",
  "vault/**/*.7z",
  "exports/**",
  "spike/**",
  ".impeccable/live/sessions/**",
];

const HISTORY_RISK_PATTERNS = [
  ...PRIVATE_DENYLIST,
  "**/*secret*",
  "**/*token*",
  "**/*cookie*",
  "**/*credential*",
];

const BINARY_SUFFIXES = new Set([
  ".bmp",
  ".db",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".pyd",
  ".pyc",
  ".sqlite",
  ".sqlite3",
  ".tar",
  ".webp",
  ".zip",
]);

export const SCRUB_SUFFIXES = new Set([
  ".cmd",
  ".css",
  ".html",
  ".json",
  ".lock",
  ".md",
  ".toml",
  ".txt",
  ".yaml",
  ".yml",
]);

export const SELF_REFERENTIAL = new Set([
  "scripts/check_publication_safety.ts",
  "scripts/build_public_mirror.ts",
  "tests/ts/publication-safety.test.ts",
]);

const LOCAL_PATH_RE =
  /(?<![A-Za-z])(?:[A-Za-z]:[\\/][^\s)`'"]+|\/[Uu]sers\/(?!@)[^\s)`'"]+|\/home\/[^\s)`'"]+)/g;

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const PHONE_JID_RE = /\b(\d+)(?::\d+)?@s\.whatsapp\.net\b/g;

const FICTIONAL_PHONE_RE = /^1555\d{7}$/;

const ROUTE_MODEL_LABEL_RE = /\brules@(?:email|keep|whatsapp)\.[a-z]+(?:-[a-z]+)*\b/g;

const SECRET_ASSIGNMENT_RE =
  /\b([A-Za-z0-9_-]*(?:api[_-]?key|client[_-]?secret|secret|token|cookie|credential|password)[A-Za-z0-9_-]*)\b['"]?[ \t]*[:=][ \t]*(['"]?)([^'"\s#<>;,)}]{12,})/gi;

const CREDENTIAL_PATTERNS = [
  /\b[\w-]{23,28}\.[\w-]{6}\.[\w-]{27,}/g,
  /\bghp_[A-Za-z0-9]{20,}/g,
  /\bsk-or-[A-Za-z0-9-]{16,}/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
];

const BEARER_RE = /\bAuthorization\s*[:=]\s*['"]?Bearer\s+([^\s'"]{20,})/gi;

const PATH_KEY_SUFFIX_RE = /[_-](?:file|path|dir)$/i;

const EXAMPLE_EMAIL_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "users.noreply.github.com",
];

const RESERVED_EMAIL_TLDS = ["test", "example"];

const EXAMPLE_SECRET_PREFIXES = ["test-", "example-", "dummy-", "fake-", "fixture-", "YOUR_", "<"];

const EXAMPLE_LOCAL_PATH_PREFIXES = ["C:/Program", "C:/fake/", "O:/Temp/"];

export type Finding = { severity: "FAIL" | "WARN"; category: string; path: string; detail: string };

export function normalizePath(path: string): string {
  const value = path.replaceAll("\\", "/");

  return value.startsWith("./") ? value.slice(2) : value;
}

function globRegex(pattern: string): RegExp {
  let out = "^";

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;

    if (c === "*") {
      out += ".*";
      continue;
    }

    out += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  return new RegExp(`${out}$`);
}

export function matchesAny(path: string, patterns: readonly string[]): boolean {
  const normalized = normalizePath(path);

  return patterns.some((pattern) => globRegex(pattern).test(normalized));
}

export function isAllowlisted(path: string): boolean {
  return matchesAny(path, PUBLIC_ALLOWLIST);
}

export function isDenylisted(path: string): boolean {
  return matchesAny(path, PRIVATE_DENYLIST);
}

function uniqueMatchingPaths(
  paths: Iterable<string>,
  matches: (path: string) => boolean,
): string[] {
  const matching = new Set<string>();

  for (const path of paths) {
    const normalized = normalizePath(path);

    if (matches(normalized)) matching.add(normalized);
  }

  return [...matching].sort();
}

export function mirrorManifest(paths: Iterable<string>): string[] {
  return uniqueMatchingPaths(paths, isAllowlisted);
}

export function denylistedPaths(paths: Iterable<string>): string[] {
  return uniqueMatchingPaths(paths, isDenylisted);
}

export function historyRiskPaths(paths: Iterable<string>): string[] {
  return uniqueMatchingPaths(paths, (path) => matchesAny(path, HISTORY_RISK_PATTERNS));
}

export function isProbablyText(path: string): boolean {
  return !BINARY_SUFFIXES.has(extname(path).toLowerCase());
}

function runGit(root: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) throw result.error;

  if (result.status !== 0)
    throw new Error(`git ${args.join(" ")} failed:\n${result.stderr.trim()}`);

  return result.stdout;
}

export function gitLsFiles(root: string): string[] {
  return runGit(root, ["ls-files", "-z"]).split("\0").filter(Boolean).map(normalizePath);
}

function gitUntrackedUnignored(root: string): string[] {
  return runGit(root, ["status", "--porcelain", "-uall", "-z"])
    .split("\0")
    .filter((s) => s.startsWith("?? "))
    .map((s) => normalizePath(s.slice(3)));
}

export function gitHistoryAddedPaths(root: string): string[] {
  return [
    ...new Set(
      runGit(root, ["log", "--all", "--diff-filter=A", "--name-only", "--pretty=format:", "-z"])
        .split("\0")
        .filter(Boolean)
        .map(normalizePath),
    ),
  ].sort();
}

function isExampleEmail(email: string): boolean {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  const tld = domain.slice(domain.lastIndexOf(".") + 1);

  return (
    RESERVED_EMAIL_TLDS.includes(tld) ||
    EXAMPLE_EMAIL_DOMAINS.some((example) => domain === example || domain.endsWith(`.${example}`))
  );
}

function isExampleSecretValue(value: string): boolean {
  return (
    EXAMPLE_SECRET_PREFIXES.some((prefix) => value.startsWith(prefix)) ||
    value.toUpperCase().startsWith("YOUR")
  );
}

function isExampleLocalPath(value: string): boolean {
  const normalized = value.replaceAll("\\", "/").replaceAll(/\/{2,}/g, "/");

  return EXAMPLE_LOCAL_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isMemberAccessChain(value: string): boolean {
  const dot = value.indexOf(".");

  if (dot < 1) return false;

  return /^[a-z][a-z_]*$/u.test(value.slice(0, dot));
}

export function contentRisks(path: string, text: string): string[] {
  const risks: string[] = [];

  if (!SCRUB_SUFFIXES.has(extname(path))) {
    for (const localPath of new Set(text.match(LOCAL_PATH_RE) ?? []))
      if (!isExampleLocalPath(localPath)) risks.push(`local path: ${localPath}`);
  }

  for (const jid of new Set(Array.from(text.matchAll(PHONE_JID_RE), (match) => match[0])))
    if (!FICTIONAL_PHONE_RE.test(jid.replace(/[:@].*$/, "")))
      risks.push(`WhatsApp phone JID: ${jid}`);

  const mailText = text.replace(PHONE_JID_RE, " ").replace(ROUTE_MODEL_LABEL_RE, " ");

  for (const email of new Set(mailText.match(EMAIL_RE) ?? []))
    if (!isExampleEmail(email)) risks.push(`raw email address: ${email}`);

  for (const match of text.matchAll(SECRET_ASSIGNMENT_RE)) {
    const key = match[1]!;
    const quote = match[2]!;
    const value = match[3]!;

    const envLike =
      key.toUpperCase() === key ||
      ["secret", "password", "api_key", "apikey"].some((word) => key.toLowerCase().includes(word));

    const quotedLiteral = quote !== "";

    const literalLike = !["(", "${", "}"].some((part) => value.includes(part));

    const pathLikeKey = PATH_KEY_SUFFIX_RE.test(key);
    const memberAccess = quote === "" && isMemberAccessChain(value);

    if (
      (envLike || quotedLiteral) &&
      literalLike &&
      !pathLikeKey &&
      !memberAccess &&
      !isExampleSecretValue(value)
    )
      risks.push(`credential-shaped assignment near: ${match[0].slice(0, 80)}`);
  }

  const credentialTokens = new Set<string>();

  for (const pattern of CREDENTIAL_PATTERNS)
    for (const token of new Set(text.match(pattern) ?? [])) credentialTokens.add(token);

  for (const match of text.matchAll(BEARER_RE)) {
    const token = match[1]!;

    if (credentialTokens.has(token) || isExampleSecretValue(token)) continue;
    risks.push(`token-shaped literal: ${token.slice(0, 80)}`);
  }

  for (const token of credentialTokens) risks.push(`token-shaped literal: ${token.slice(0, 80)}`);

  return risks;
}

export function inside(root: string, path: string): boolean {
  const rel = relative(root, path);

  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`));
}

export function readText(file: string): string | undefined {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(file));
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}

export function scanTrackedContent(root: string, paths: Iterable<string>): Finding[] {
  const findings: Finding[] = [];
  root = realpathSync(root);

  for (const path of paths) {
    if (SELF_REFERENTIAL.has(normalizePath(path))) continue;
    const absolute = resolve(root, path);

    if (!inside(root, absolute) || !existsSync(absolute)) continue;

    if (lstatSync(absolute).isSymbolicLink()) {
      findings.push({
        severity: "FAIL",
        category: "mirror symlink",
        path,
        detail: "tracked symlinks are not allowed in the public mirror",
      });
      continue;
    }

    if (!isProbablyText(path)) continue;
    const realFile = realpathSync(absolute);

    if (!inside(root, realFile)) {
      findings.push({
        severity: "FAIL",
        category: "symlink containment",
        path,
        detail: "resolves outside repository",
      });
      continue;
    }

    if (!lstatSync(realFile).isFile()) continue;
    const text = readText(realFile);

    if (text === undefined) continue;

    for (const risk of contentRisks(path, text))
      findings.push({ severity: "FAIL", category: "content", path, detail: risk });
  }

  return findings;
}

export function collectFindings(root: string, includeHistory = false) {
  const tracked = gitLsFiles(root);
  const findings: Finding[] = [];

  for (const path of denylistedPaths(tracked))
    findings.push({
      severity: "FAIL",
      category: "tracked private path",
      path,
      detail: "matches private denylist",
    });

  for (const path of denylistedPaths(gitUntrackedUnignored(root)))
    findings.push({
      severity: "FAIL",
      category: "untracked private path",
      path,
      detail: "untracked and not ignored",
    });
  const manifest = mirrorManifest(tracked);

  for (const path of denylistedPaths(manifest))
    findings.push({
      severity: "FAIL",
      category: "mirror manifest",
      path,
      detail: "allowlist overlaps denylist",
    });
  findings.push(...scanTrackedContent(root, manifest));

  if (includeHistory)
    for (const path of historyRiskPaths(gitHistoryAddedPaths(root)))
      findings.push({
        severity: "WARN",
        category: "history risk",
        path,
        detail: "private/generated path added in history",
      });

  return { findings, manifest };
}

export function printFindings(findings: Finding[]): void {
  if (!findings.length) {
    console.log("publication safety: OK");

    return;
  }

  console.log(`publication safety: ${findings.length} finding(s)`);

  for (const finding of findings)
    console.log(`[${finding.severity}] ${finding.category}: ${finding.path} — ${finding.detail}`);
}

function rootArg(args: string[]) {
  const rest = [...args];
  const index = rest.indexOf("--root");

  if (index < 0) return { root: resolve(import.meta.dir, ".."), rest };
  const value = rest[index + 1];

  if (!value) throw new Error("--root requires a directory");
  rest.splice(index, 2);

  return { root: resolve(value), rest };
}

export function main(args = Bun.argv.slice(2)): number {
  const { root, rest } = rootArg(args);
  const includeHistory = rest.includes("--history");
  const showManifest = rest.includes("--mirror-manifest");

  for (const arg of rest)
    if (arg !== "--history" && arg !== "--mirror-manifest")
      throw new Error(`unknown argument: ${arg}`);
  const { findings, manifest } = collectFindings(root, includeHistory);
  printFindings(findings);

  if (showManifest) {
    console.log("\nmirror manifest:");

    for (const path of manifest) console.log(path);
  }

  return findings.some((finding) => finding.severity === "FAIL") ? 1 : 0;
}

if (import.meta.main) process.exit(main());
