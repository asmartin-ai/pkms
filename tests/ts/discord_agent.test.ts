import { afterEach, describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { handleCommand, isCommand, sendDm } from "../../src/pkms/discord_agent.ts";
import { readEvents } from "../../src/pkms/events.ts";
import { appendDid } from "../../src/pkms/daily.ts";
import { loadPost } from "../../src/pkms/indexer.ts";

const roots: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pkms-discordagent-"));
  roots.push(root);
  const vault = join(root, "vault");
  mkdirSync(vault, { recursive: true });
  mkdirSync(join(vault, "inbox"), { recursive: true });
  mkdirSync(join(vault, "daily"), { recursive: true });
  writeFileSync(join(vault, "daily", "2026-10-07.md"), "---\n---\n\n## did\n");
  writeFileSync(join(vault, "daily", "2026-10-01.md"), "---\n---\n\n## did\n");

  return { root, vault };
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

const NOW = new Date("2026-10-07T20:00:00Z");

describe("command grammar", () => {
  test("isCommand accepts !word and rejects plain capture text", () => {
    expect(isCommand("!today")).toBe(true);
    expect(isCommand("!search encoder")).toBe(true);
    expect(isCommand("!1")).toBe(false);
    expect(isCommand("a plain capture")).toBe(false);
    expect(isCommand("")).toBe(false);
  });

  test("unknown !word is not a command, so the gateway falls through to capture", () => {
    const { root, vault } = fixture();
    const text = "!important call the bank";

    expect(isCommand(text)).toBe(true);
    expect(handleCommand(root, vault, join(root, ".index"), text)).toEqual({
      reply: "",
      command: null,
    });
  });
});

describe("commands", () => {
  test("!help lists the grammar", () => {
    const { root, vault } = fixture();
    const r = handleCommand(root, vault, join(root, ".index"), "!help");
    expect(r.command).toBe("help");
    expect(r.reply).toContain("!search <q>");
    expect(r.reply).toContain("!plan <thing>");
  });

  test("!did counts and emits agent_tool_called", () => {
    const { root, vault } = fixture();
    const r = handleCommand(root, vault, join(root, ".index"), "!did shipped the encoder", NOW);
    expect(r.reply).toContain("counted");
    const kinds = readEvents(root).map((e) => e.kind);
    expect(kinds).toContain("did");
    expect(kinds).toContain("agent_tool_called");
  });

  test("!plan saves then asks when (prompt after save)", () => {
    const { root, vault } = fixture();
    const r = handleCommand(root, vault, join(root, ".index"), "!plan prototype it", NOW);
    expect(r.command).toBe("plan");
    expect(r.reply).toContain("saved");
    expect(r.reply).toContain("when?");
    const note = readdirSync(join(vault, "inbox")).find((f) => f.endsWith(".md"))!;
    expect(loadPost(readFileSync(join(vault, "inbox", note), "utf8")).data.plan).toBe("true");
    const kinds = readEvents(root).map((e) => e.kind);
    expect(kinds).toContain("plan_set");
    expect(kinds).toContain("prompt_shown");
    expect(kinds.indexOf("prompt_shown")).toBeLessThan(kinds.indexOf("plan_set"));
  });

  test("!streak reports a counted day", () => {
    const { root, vault } = fixture();
    appendDid(vault, "thing", NOW);
    const r = handleCommand(root, vault, join(root, ".index"), "!streak", NOW);
    expect(r.command).toBe("streak");
    expect(r.reply).toContain("1 day");
    expect(r.reply).toContain("freeze");
  });

  test("!today states the streak and is quiet when nothing waits", () => {
    const { root, vault } = fixture();
    const empty = handleCommand(root, vault, join(root, ".index"), "!today", NOW);

    expect(empty.reply).toContain("nothing waiting");

    appendDid(vault, "shipped", NOW);

    const r = handleCommand(root, vault, join(root, ".index"), "!today", NOW);

    expect(r.reply).toContain("streak");
  });
});

describe("sendDm transport seam", () => {
  test("delivers a DM and returns the message id; API failure returns null", async () => {
    const root = mkdtempSync(join(tmpdir(), "pkms-senddm-"));
    roots.push(root);
    const seen: { method: string; path: string; body: unknown }[] = [];

    const api = Bun.serve({
      port: 0,
      async fetch(req) {
        const path = new URL(req.url).pathname;
        seen.push({ method: req.method, path, body: await req.json() });

        if (path === "/users/@me/channels") {
          return Response.json({ id: "dm-77", recipient_id: "u" }, { headers: { "X-T": "1" } });
        }

        return Response.json({ id: "m-42", content: "x" });
      },
    });

    try {
      const id = await sendDm(
        `http://127.0.0.1:${api.port}`,
        "bot-secret",
        "alex",
        "streak: 1 day",
      );

      expect(id).toBe("m-42");
      expect(seen.map((s) => s.path)).toEqual(["/users/@me/channels", "/channels/dm-77/messages"]);

      const down = Bun.serve({
        port: 0,
        fetch() {
          return new Response(null, { status: 500 });
        },
      });

      expect(await sendDm(`http://127.0.0.1:${down.port}`, "bot-secret", "alex", "x")).toBeNull();
      down.stop(true);
    } finally {
      api.stop(true);
    }
  });
});
