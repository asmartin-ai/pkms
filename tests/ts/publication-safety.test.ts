import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectFindings,
  contentRisks,
  gitLsFiles,
  historyRiskPaths,
  isAllowlisted,
  isDenylisted,
  mirrorManifest,
} from "../../scripts/check_publication_safety.ts";
import { build, scrubText } from "../../scripts/build_public_mirror.ts";

const temporary: string[] = [];

afterEach(() => {
  while (temporary.length) rmSync(temporary.pop()!, { recursive: true, force: true });
});

function repository(): string {
  const root = mkdtempSync(join(Bun.env.TMPDIR ?? "/tmp", "pkms-publication-"));
  temporary.push(root);
  execFileSync("git", ["init", "-q", root]);
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  execFileSync("git", ["-C", root, "config", "user.name", "Test User"]);

  return root;
}

function file(root: string, path: string, text: string): void {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, text);
}

function track(root: string): void {
  execFileSync("git", ["-C", root, "add", "-A"]);
  execFileSync("git", ["-C", root, "commit", "-qm", "fixture"]);
}

describe("native publication safety tools", () => {
  test("keeps an opt-in mirror manifest and private denylist", () => {
    expect(isAllowlisted("src/pkms/main.ts")).toBe(true);
    expect(isAllowlisted("docs/keep-setup.md")).toBe(true);
    expect(isAllowlisted("docs/whatsapp-setup.md")).toBe(true);
    expect(isAllowlisted("docs/hermes-setup.md")).toBe(true);
    expect(isAllowlisted("deploy/systemd/wacli-sync.service")).toBe(true);
    expect(isAllowlisted("scripts/check-no-comments.ts")).toBe(true);
    expect(isAllowlisted(".gitleaks.toml")).toBe(true);
    expect(isAllowlisted(".github/dependabot.yml")).toBe(true);
    expect(isAllowlisted("tools/oxlint/khaos/index.ts")).toBe(true);
    expect(isAllowlisted("docs/delegations/p2-search-endpoints.md")).toBe(false);
    expect(isAllowlisted("docs/agents/issue-tracker.md")).toBe(false);
    expect(isAllowlisted("docs/superpowers/plans/p2-search.md")).toBe(false);
    expect(isAllowlisted("docs/owner-gates.md")).toBe(false);
    expect(isAllowlisted("docs/PKMS-Price-Performance-Bakeoff-Plan-2026-07-03.md")).toBe(false);
    expect(isAllowlisted(".agents/skills/fold/SKILL.md")).toBe(false);
    expect(isAllowlisted(".agents/skills/resume/SKILL.md")).toBe(false);
    expect(isAllowlisted("vault/resources/reading/private.md")).toBe(false);
    expect(isAllowlisted("vault/resources/research/public.md")).toBe(false);
    expect(isAllowlisted("vault/resources/adhd-design-language-repo.md")).toBe(false);
    expect(isAllowlisted("vault/projects/pkms-design/build-plan.md")).toBe(false);
    expect(isAllowlisted("pyproject.toml")).toBe(false);
    expect(isAllowlisted("requirements.txt")).toBe(false);
    expect(isAllowlisted("package.json")).toBe(true);
    expect(isAllowlisted("bun.lock")).toBe(true);
    expect(mirrorManifest(["README.md", "vault/daily/note.md", "src/pkms/main.ts"])).toEqual([
      "README.md",
      "src/pkms/main.ts",
    ]);
    expect(historyRiskPaths(["docs/access-token.md", "src/pkms/main.ts"])).toEqual([
      "docs/access-token.md",
    ]);
  });

  test("findings scan the synthetic git root for private paths, source literals, and untracked private files", () => {
    const root = repository();
    file(root, "README.md", "public fixture\n");
    file(
      root,
      "src/public.ts",
      "const location = 'D:\\\\Projects\\\\fixture';\nconst email = 'person@private.invalid';\n",
    );
    file(root, "vault/daily/private.md", "private\n");
    track(root);
    file(root, ".secrets/untracked", "private\n");
    const { findings, manifest } = collectFindings(root);
    expect(manifest).toEqual(["README.md", "src/public.ts"]);
    expect(
      findings.some(
        (finding) =>
          finding.category === "tracked private path" && finding.path === "vault/daily/private.md",
      ),
    ).toBe(true);
    expect(
      findings.some(
        (finding) =>
          finding.category === "untracked private path" && finding.path === ".secrets/untracked",
      ),
    ).toBe(true);
    expect(
      findings.some(
        (finding) => finding.category === "content" && finding.detail.includes("local path"),
      ),
    ).toBe(true);
    expect(
      findings.some(
        (finding) => finding.category === "content" && finding.detail.includes("raw email address"),
      ),
    ).toBe(true);
    expect(gitLsFiles(root)).toContain("src/public.ts");
  });

  test("builder copies tracked allowlisted files and scrubs path literals", async () => {
    const root = repository();
    file(root, "README.md", "See D:\\Projects\\fixture and /home/synthetic/private/file.\n");
    file(root, "src/main.ts", "export const x = 1;\n");
    file(root, "vault/daily/private.md", "must not be copied\n");
    track(root);
    const result = build(root);
    expect(result.manifest).toEqual(["README.md", "src/main.ts"]);
    expect(result.findings).toEqual([]);
    expect(await Bun.file(join(result.output, "README.md")).text()).toBe(
      "See /path/to/local-resource and /path/to/local-resource.\n",
    );
    expect(await Bun.file(join(result.output, "vault/daily/private.md")).exists()).toBe(false);
    expect(scrubText("C:/Users/synthetic/file")).toBe("/path/to/local-resource");
  });
  test("builder ignores deleted tracked files in the current worktree", () => {
    const root = repository();
    file(root, "package.json", '{"name":"fixture"}\n');
    file(root, "bun.lock", "fixture\n");
    track(root);
    rmSync(join(root, "package.json"));
    const result = build(root);
    expect(result.manifest).toEqual(["bun.lock"]);
    expect(result.findings).toEqual([]);
  });

  test("builder refuses outputs outside exports and symlinks escaping the root", () => {
    const root = repository();
    file(root, "README.md", "fixture\n");
    track(root);
    expect(() => build(root, "../outside")).toThrow("outside exports");
    const outside = mkdtempSync(join(Bun.env.TMPDIR ?? "/tmp", "pkms-outside-"));
    temporary.push(outside);
    symlinkSync(outside, join(root, "exports"));
    expect(() => build(root)).toThrow("outside repository");
  });
  test("rejects tracked source symlinks that escape the synthetic root", () => {
    const root = repository();
    file(root, "README.md", "fixture\n");
    const outside = mkdtempSync(join(Bun.env.TMPDIR ?? "/tmp", "pkms-link-target-"));
    temporary.push(outside);
    file(outside, "private.ts", "const privateValue = 1;\n");
    mkdirSync(join(root, "src"), { recursive: true });
    symlinkSync(join(outside, "private.ts"), join(root, "src", "escape.ts"));
    track(root);
    expect(
      collectFindings(root).findings.some(
        (finding) => finding.category === "mirror symlink" && finding.path === "src/escape.ts",
      ),
    ).toBe(true);
    expect(() => build(root)).toThrow("symlink outside repository");
  });
  test("rejects tracked symlinks into private paths inside the repository", () => {
    const root = repository();
    file(root, "README.md", "fixture\n");
    file(root, "vault/daily/private.md", "private data\n");
    mkdirSync(join(root, "src"), { recursive: true });
    symlinkSync("../vault/daily/private.md", join(root, "src", "alias.ts"));
    track(root);
    expect(
      collectFindings(root).findings.some(
        (finding) => finding.category === "mirror symlink" && finding.path === "src/alias.ts",
      ),
    ).toBe(true);
    expect(() => build(root)).toThrow("refusing tracked symlink");
  });

  test("publication content checks distinguish scrubbed paths from credentials and emails", () => {
    expect(
      contentRisks("docs/example.md", "See C:/Users/synthetic/file and person@private.invalid"),
    ).toEqual(["raw email address: person@private.invalid"]);
    expect(
      contentRisks("src/example.ts", "TOKEN=abc123abc123abc123").some((risk) =>
        risk.includes("credential-shaped assignment"),
      ),
    ).toBe(true);
  });

  test("reserved example domains pass while routable addresses are caught", () => {
    for (const email of [
      "alex@example.test",
      "bob@info.example.com",
      "sam@alerts.example.net",
      "spam@evil.example",
    ])
      expect(contentRisks("tests/ts/x.test.ts", `from: "${email}"`)).toEqual([]);

    for (const email of ["alex@notexample.com", "sam.lee@gmail.com", "user@host.invalid"])
      expect(contentRisks("tests/ts/x.test.ts", `from: "${email}"`)).toEqual([
        `raw email address: ${email}`,
      ]);
  });

  test("WhatsApp phone JIDs are caught unless they use the fictional +1 555 range", () => {
    expect(contentRisks("src/x.ts", 'chat: "447700900123@s.whatsapp.net"')).toEqual([
      "WhatsApp phone JID: 447700900123@s.whatsapp.net",
    ]);
    expect(contentRisks("src/x.ts", "`447700900123:12@s.whatsapp.net`")).toEqual([
      "WhatsApp phone JID: 447700900123:12@s.whatsapp.net",
    ]);
    expect(contentRisks("src/x.ts", "`12345678@s.whatsapp.net`")).toEqual([
      "WhatsApp phone JID: 12345678@s.whatsapp.net",
    ]);
    expect(
      contentRisks("src/x.ts", "`15550001111@s.whatsapp.net` and `15550001111:12@s.whatsapp.net`"),
    ).toEqual([]);
  });

  test("route-model labels are not mailboxes, but a rules@ address on a real domain is", () => {
    expect(contentRisks("tests/ts/x.test.ts", 'route_model: "rules@email.person"')).toEqual([]);
    expect(contentRisks("tests/ts/x.test.ts", 'route_model: "rules@keep.open-checklist"')).toEqual(
      [],
    );
    expect(contentRisks("tests/ts/x.test.ts", 'to: "rules@gmail.com"')).toEqual([
      "raw email address: rules@gmail.com",
    ]);
  });

  test("a Discord @me route is not a home path, a real home still is", () => {
    expect(contentRisks("src/x.ts", 'fetch(apiBase + "/users/@me/channels")')).toEqual([]);
    expect(scrubText("GET /users/@me/channels")).toBe("GET /users/@me/channels");
    expect(contentRisks("src/x.ts", 'const p = "/Users/alex/notes";')).toEqual([
      "local path: /Users/alex/notes",
    ]);
    expect(contentRisks("src/x.ts", 'store_dir: "/home/alex/.local/state/wacli"')).toEqual([
      "local path: /home/alex/.local/state/wacli",
    ]);
  });

  test("content checks catch dotted tokens, quoted keys and bearer headers", () => {
    const discordToken = [
      "MTI3Nzc2NTc4MDk2ODU2NzY5MA",
      "GaBcDe",
      "abcdefghijklmnopqrstuvwxyz1234",
    ].join(".");
    const samples: Array<[string, string]> = [
      ["src/config.ts", `DISCORD_BOT_TOKEN=${discordToken}`],
      ["src/config.ts", "CAPTURE_TOKEN=abc123.def456.ghi789jkl"],
      ["src/config.json", '{\n  "token": "abcdefghijklmnop1234567890"\n}'],
      ["src/config.yml", 'token = "abcdefghijklmnop1234567890"'],
      ["docs/setup.md", "Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz0123456789"],
    ];

    for (const [path, text] of samples) {
      expect(contentRisks(path, text).length).toBeGreaterThan(0);
    }

    for (const token of [
      discordToken,
      "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
      "sk-or-v1-abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      "xoxb-123456789012-abcdefghijkl",
    ]) {
      expect(contentRisks("docs/setup.md", `send ${token} upstream`)).toEqual([
        `token-shaped literal: ${token}`,
      ]);
    }

    expect(contentRisks("src/discord_gateway.ts", "token: opts.botToken,")).toEqual([]);
    expect(contentRisks("src/keep_transport.ts", "const token = auth.getAuthToken();")).toEqual([]);
    expect(contentRisks("docs/x.md", "DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE")).toEqual([]);
  });

  test("content checks stay quiet on path keys, member chains and code values", () => {
    expect(contentRisks("src/x.ts", 'TOKEN_FILE=".secrets/capture-token"')).toEqual([]);
    expect(contentRisks("src/x.ts", "TOKEN = window.__X__")).toEqual([]);
    expect(contentRisks("tests/ts/email_ingest.test.ts", "password: gmail.password,")).toEqual([]);
    expect(
      contentRisks("tests/ts/mcp_server.test.ts", "readSecret: overrides.readSecret,"),
    ).toEqual([]);
    expect(contentRisks("src/x.ts", "CAPTURE_TOKEN=abc123.def456.ghi789jkl").length).toBe(1);
  });

  test("any opaque bearer token is flagged, prefixed or not", () => {
    expect(
      contentRisks("docs/setup.md", "Authorization: Bearer someLongOpaqueTokenValue1234567890"),
    ).toEqual(["token-shaped literal: someLongOpaqueTokenValue1234567890"]);
    expect(
      contentRisks(
        "docs/setup.md",
        "Authorization: Bearer sk-or-v1-abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      ),
    ).toEqual(["token-shaped literal: sk-or-v1-abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef"]);
  });

  test("isDenylisted covers keep-media and .env in any directory", () => {
    expect(isDenylisted("keep-media/a.png")).toBe(true);
    expect(isDenylisted("keep-media/sub/a.png")).toBe(true);
    expect(isDenylisted("src/.env")).toBe(true);
    expect(isDenylisted("tests/.env")).toBe(true);
    expect(isDenylisted(".env")).toBe(true);
    expect(isDenylisted("src/main.ts")).toBe(false);
  });
});
