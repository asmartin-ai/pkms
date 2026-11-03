import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { indexVault } from "../../src/pkms/indexer.ts";
import { isoLocalDate } from "../../src/pkms/tasks.ts";
import { connect } from "../../src/pkms/db.ts";
import { main, projectRoot, setRoot } from "../../src/pkms/cli.ts";
import { zipSync, strToU8 } from "fflate";

let captured: string[] = [];

let origLog: typeof console.log;

beforeEach(() => {
  origLog = console.log;
  captured = [];
  console.log = (...args: unknown[]): void => {
    captured.push(args.map(String).join(" "));
  };
});

afterEach(() => {
  console.log = origLog;
});

function output(): string {
  return captured.join("\n");
}

function makeProject(): string {
  const root = mkdtempSync(join(tmpdir(), "pkms-cli-"));
  const vault = join(root, "vault");

  const writeNote = (rel: string, body: string, title?: string): void => {
    const p = join(vault, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    const fm = title ? `title: ${title}\ncreated: 2026-06-01\n` : "created: 2026-06-01\n";
    writeFileSync(p, `---\n${fm}---\n\n${body}`, "utf8");
  };

  writeNote(
    join("projects", "alpha.md"),
    "Alpha references [[beta]] and [[gamma|the gamma note]].\n\n- [ ] open task one\n- [x] finished task\n",
    "Alpha Project",
  );
  writeNote(
    join("resources", "beta.md"),
    "Beta covers the FTS5 external-content table pattern.\n\n- [ ] open task two\n",
    "Beta Note",
  );
  writeNote(join("daily", "2026-06-01.md"), "Plain daily note, no frontmatter at all.");
  mkdirSync(join(root, ".index"));

  return root;
}

describe("cli", () => {
  let project: string;
  let oldHome: string | undefined;

  beforeEach(() => {
    project = makeProject();
    oldHome = process.env.PKMS_HOME;
    process.env.PKMS_HOME = project;
    setRoot(null);
  });

  afterEach(() => {
    if (oldHome === undefined) delete process.env.PKMS_HOME;
    else process.env.PKMS_HOME = oldHome;
    setRoot(null);
    rmSync(project, { recursive: true, force: true });
  });

  function run(...argv: string[]): number | Promise<number> {
    return main(argv);
  }

  function index(): void {
    indexVault(join(project, "vault"), join(project, ".index"));
  }

  test("projectRoot honors PKMS_HOME", () => {
    expect(projectRoot()).toBe(project);
  });

  test("projectRoot walks up to vault", () => {
    delete process.env.PKMS_HOME;
    setRoot(null);
    const nested = join(project, "deep", "subdir");
    mkdirSync(nested, { recursive: true });
    expect(projectRoot(nested)).toBe(project);
    process.env.PKMS_HOME = project;
  });

  test("projectRoot exits when no vault", () => {
    delete process.env.PKMS_HOME;
    setRoot(null);
    const bare = mkdtempSync(join(tmpdir(), "pkms-bare-"));

    try {
      expect(() => projectRoot(bare)).toThrow(/No vault\/ found/);
    } finally {
      rmSync(bare, { recursive: true, force: true });
      process.env.PKMS_HOME = project;
    }
  });

  test("index then search", async () => {
    expect(await run("index")).toBe(0);
    expect(output()).toContain("3 notes, 2 links, 3 tasks");

    captured.length = 0;
    await run("search", "gamma");
    expect(output()).toContain("alpha.md");
  });

  test("search no results message", async () => {
    index();
    await run("search", "zzzznothing");
    expect(output()).toContain("No results");
  });

  test("tasks open and done", async () => {
    index();
    await run("tasks");
    expect(output()).toContain("open task one");
    expect(output()).not.toContain("finished task");

    captured.length = 0;
    await run("tasks", "--done");
    expect(output()).toContain("finished task");
    expect(output()).not.toContain("open task one");
  });

  test("tasks default is one per note with flag hints", async () => {
    const p = join(project, "vault", "projects", "two.md");
    writeFileSync(
      p,
      "---\ntitle: Two Tasks\ncreated: 2026-06-01\n---\n\n" +
        "- [ ] first of two ▶ tiny step\n- [ ] second of two\n- [i] iced away\n",
      "utf8",
    );
    index();
    await run("tasks");
    const out = output();
    expect(out).toContain("first of two");
    expect(out).not.toContain("second of two");
    expect(out).toContain("pkms tasks --all");
    expect(out).toContain("pkms tasks --stash");
    expect(out).toContain("could use a first step");
  });

  test("tasks --all shows backlog grouped with states", async () => {
    const p = join(project, "vault", "projects", "mix.md");
    writeFileSync(
      p,
      "---\ntitle: Mix\ncreated: 2026-06-01\n---\n\n" +
        "- [ ] plain open\n- [?] blocked thing\n- [~] later thing\n",
      "utf8",
    );
    index();
    await run("tasks", "--all");
    const out = output();
    expect(out).toContain("blocked thing");
    expect(out).toContain("stuck");
    expect(out).toContain("later thing");
    expect(out).toContain("not-now");
  });

  test("tasks --stash recovery path is visible", async () => {
    const p = join(project, "vault", "projects", "ice.md");
    writeFileSync(
      p,
      "---\ntitle: Icebox\ncreated: 2026-06-01\n---\n\n" +
        "- [p] paused thing (wake: after slice 6)\n- [i] iced thing\n",
      "utf8",
    );
    index();
    await run("tasks", "--stash");
    const out = output();
    expect(out).toContain("paused thing");
    expect(out).toContain("iced thing");
    expect(out).toContain("nothing here is gone");
    expect(out).toContain("wake one");
  });

  test("tasks --stale lists reshape candidates", async () => {
    index();
    const db = connect(join(project, ".index"));
    db.query("UPDATE task_seen SET first_seen='2026-05-01'").run();
    db.close();
    await run("tasks", "--stale");
    const out = output();
    expect(out).toContain("open task one");
    expect(out).toContain("untouched since 2026-05-01");
    expect(out).toContain("at most one");
  });

  test("did logs to daily note and pebbles render", async () => {
    expect(await run("did", "shipped the thing")).toBe(0);
    expect(output()).toContain("counted");
    const today = isoLocalDate(new Date());
    const note = readFileSync(join(project, "vault", "daily", `${today}.md`), "utf8");
    expect(note).toContain("## did");
    expect(note).toContain("- [x] shipped the thing");

    captured.length = 0;
    await run("did", "another one");
    captured.length = 0;
    await run("today");
    const out = output();
    expect(out).toContain("2 done today");
    expect(out.toLowerCase()).not.toContain("streak");
  });

  test("backlinks command", async () => {
    index();
    await run("backlinks", "beta");
    expect(output()).toContain("alpha.md");
  });

  test("new creates note with frontmatter", async () => {
    process.env.EDITOR = "true";
    expect(await run("new", "Test Note", "--folder", "resources")).toBe(0);
    const created = join(project, "vault", "resources", "test-note.md");
    expect(existsSync(created)).toBe(true);
    const text = readFileSync(created, "utf8");
    expect(text.startsWith('---\ntitle: "Test Note"\n')).toBe(true);

    writeFileSync(created, `${text}user content`, "utf8");
    await run("new", "Test Note", "--folder", "resources");
    expect(readFileSync(created, "utf8")).toContain("user content");
  });

  test("new quotes the title so a colon-bearing note indexes", async () => {
    process.env.EDITOR = "true";
    expect(await run("new", "Plan: Q4")).toBe(0);
    const created = join(project, "vault", "plan-q4.md");
    expect(existsSync(created)).toBe(true);
    expect(readFileSync(created, "utf8").startsWith('---\ntitle: "Plan: Q4"\n')).toBe(true);

    index();
    const conn = connect(join(project, ".index"));

    try {
      expect(conn.query("SELECT title FROM notes WHERE path = ?").get("plan-q4.md")).toEqual({
        title: "Plan: Q4",
      });
    } finally {
      conn.close();
    }
  });

  test("new slugifies titles that are not path-safe", async () => {
    process.env.EDITOR = "true";
    expect(await run("new", "TCP/IP basics")).toBe(0);
    expect(existsSync(join(project, "vault", "tcp-ip-basics.md"))).toBe(true);
  });

  test("new keeps unicode letters in the slug and still confines --folder", async () => {
    process.env.EDITOR = "true";
    expect(await run("new", "Café résumé")).toBe(0);
    expect(await run("new", "日本語メモ")).toBe(0);
    expect(existsSync(join(project, "vault", "café-résumé.md"))).toBe(true);
    expect(existsSync(join(project, "vault", "日本語メモ.md"))).toBe(true);

    expect(await run("new", "日本語 / メモ")).toBe(0);
    expect(existsSync(join(project, "vault", "日本語-メモ.md"))).toBe(true);
    expect(existsSync(join(project, "vault", "日本語"))).toBe(false);

    expect(await run("new", "Escaped", "--folder", "../../x")).not.toBe(0);
    expect(existsSync(resolve(project, "..", "..", "x"))).toBe(false);
  });

  test("new refuses a --folder that escapes the vault", async () => {
    process.env.EDITOR = "true";
    expect(await run("new", "Escaped", "--folder", "../../x")).not.toBe(0);
    expect(existsSync(join(project, "vault", "escaped.md"))).toBe(false);
    expect(existsSync(resolve(project, "..", "..", "x"))).toBe(false);
  });

  test("daily creates today note", async () => {
    process.env.EDITOR = "true";
    expect(await run("daily", "--no-open")).toBe(0);
    const dailyDir = join(project, "vault", "daily");
    const files = listMd(dailyDir);
    expect(files.length).toBe(2);
  });

  test("ingest keep-takeout imports a zip via the CLI", async () => {
    const payload = {
      title: "CLI takeout note",
      textContent: "hello from takeout",
      timestamps: { created: { epochTimestamp: "1748736000000000" } },
    };

    const zip = zipSync(
      { "Takeout/Keep/cli-note.json": strToU8(JSON.stringify(payload)) },
      { level: 0 },
    );

    const zpath = join(project, "takeout.zip");
    writeFileSync(zpath, zip);
    const media = join(project, "keep-media");
    expect(await run("ingest", "keep-takeout", zpath, "--media-dir", media)).toBe(0);
    const out = output();
    expect(out).toContain("1 keep note imported from takeout");
  });

  test("ingest keep-takeout missing zip fails cleanly", async () => {
    const code = await run("ingest", "keep-takeout", join(project, "nope.zip"));
    expect(code).not.toBe(0);
  });

  test("ingest email without secrets shows setup pointer and exits 1", async () => {
    expect(await run("ingest", "email")).toBe(1);
    expect(output()).toContain("email isn't connected yet");
    expect(output()).toContain(".secrets/email-app-password");
  });

  test("ingest keep without secrets reports setup_needed", async () => {
    expect(await run("ingest", "keep")).toBe(0);
    expect(output()).toContain("keep isn't connected yet");
  });

  test("ingest keep-sweep without secrets exits 1 with setup pointer", async () => {
    expect(await run("ingest", "keep-sweep")).toBe(1);
    expect(output()).toContain("keep isn't connected yet");
  });

  test("ingest keep-sweep --apply without secrets exits 1 with setup pointer", async () => {
    expect(await run("ingest", "keep-sweep", "--apply")).toBe(1);
    expect(output()).toContain("keep isn't connected yet");
  });

  test("discord-bot without token shows setup pointer and exits 1", async () => {
    expect(await run("discord-bot")).toBe(1);
    expect(output()).toContain("discord bot token not found");
  });
});

function listMd(dir: string): string[] {
  const out: string[] = [];

  for (const entry of Array.from(new Bun.Glob("*.md").scanSync({ cwd: dir }))) {
    out.push(join(dir, entry));
  }

  return out.sort();
}
