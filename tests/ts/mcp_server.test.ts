import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { SQLQueryBindings } from "bun:sqlite";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { connect } from "../../src/pkms/db.ts";
import { emit, ledgerPath, readEvents } from "../../src/pkms/events.ts";
import { indexVault } from "../../src/pkms/indexer.ts";
import { buildServer, MCP_CAPTURE_MAX_CHARS, MCP_TOOL_NAMES } from "../../src/pkms/mcp_server.ts";
import type { WacliRunner } from "../../src/pkms/wacli.ts";
import { mkTmp, rmTmp, writeNote } from "./helpers.ts";

const roots: string[] = [];

const harnesses: Harness[] = [];

afterEach(async () => {
  for (const harness of harnesses.splice(0)) {
    await harness.close();
  }

  for (const root of roots.splice(0)) rmTmp(root);
});

interface Fixture {
  root: string;
  vault: string;
  indexDir: string;
}

interface ToolResult {
  ok: boolean;
  text: string;
}

interface ToolOutcome {
  isError?: unknown;
  content?: readonly { type: string; text?: string }[];
}

type ToolArgs =
  | { query: string; limit?: number }
  | { text: string }
  | { since: string }
  | { days: number }
  | Record<string, never>;

interface Harness {
  client: Client;
  call: (name: string, args?: ToolArgs) => Promise<ToolResult>;
  close: () => Promise<void>;
}

interface ServerOverrides {
  runner?: WacliRunner;
  readSecret?: (name: string) => string | null;
}

function outcomeOf(result: ToolOutcome): ToolResult {
  const content = result.content ?? [];
  const first = content[0];

  if (first === undefined || first.type !== "text" || first.text === undefined) {
    throw new Error(`tool call returned no text content: ${JSON.stringify(content)}`);
  }

  return { ok: result.isError !== true, text: first.text };
}

async function attach(fx: Fixture, overrides: ServerOverrides = {}): Promise<Harness> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const server = buildServer({
    root: fx.root,
    vault: fx.vault,
    indexDir: fx.indexDir,
    readSecret: overrides.readSecret ?? (() => null),
    runner: overrides.runner,
  });

  const client = new Client({ name: "khaos-test", version: "0.0.0" });

  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  const harness: Harness = {
    client,
    call: async (name, args) => {
      const result = CallToolResultSchema.parse(await client.callTool({ name, arguments: args }));

      return outcomeOf(result);
    },
    close: async () => {
      await Promise.all([client.close(), server.close()]);
    },
  };

  harnesses.push(harness);

  return harness;
}

function fixture(): Fixture {
  const root = mkTmp();

  roots.push(root);

  const vault = join(root, "vault");
  const indexDir = join(root, ".index");

  writeNote(
    join(vault, "projects", "alpha.md"),
    "alpha quantum dragonfruit\n\n- [ ] open task one\n",
    { title: "Alpha Project", tags: ["project", "active"] },
  );
  writeNote(
    join(vault, "resources", "beta.md"),
    "beta covers the FTS5 external-content table pattern.\n\n- [ ] open task two\n",
    { title: "Beta Note" },
  );
  writeNote(join(vault, "resources", "old-idea.md"), "An old idea worth revisiting one day.\n", {
    title: "Old Idea",
    created: "2026-01-01",
  });
  indexVault(vault, indexDir);

  return { root, vault, indexDir };
}

const DOCTOR_PAIRED_JSON = JSON.stringify({
  success: true,
  data: {
    store_dir: "/var/lib/wacli",
    lock_held: false,
    authenticated: true,
    session_revoked: false,
    linked_jid: "15550001111@s.whatsapp.net",
    connected: true,
    connection_state: "connected",
    fts_enabled: true,
    store: { messages: 128, chats: 4, contacts: 33, groups: 2 },
  },
  error: null,
});

const DOCTOR_UNPAIRED_JSON =
  '{"success":true,"data":{"store_dir":"/var/lib/wacli","lock_held":false,' +
  '"authenticated":false,"session_revoked":false,"connected":false,' +
  '"connection_state":"disconnected","fts_enabled":true,' +
  '"store":{"messages":0,"chats":0,"contacts":0,"groups":0}},"error":null}';

const MESSAGES_JSON = JSON.stringify({
  success: true,
  data: {
    messages: [
      {
        ChatJID: "15550001111@s.whatsapp.net",
        ChatName: "Alex ↔ Alex",
        MsgID: "3EB0C431D26B7F4B0E9F",
        SenderJID: "15550001111@s.whatsapp.net",
        SenderName: "Alex",
        Timestamp: "2026-10-07T09:05:00Z",
        FromMe: true,
        Text: "buy oat milk",
        DisplayText: "buy oat milk",
        ReactionToID: "",
        MediaType: "",
        MediaCaption: "",
        Filename: "",
        Revoked: false,
        DeletedForMe: false,
      },
      {
        ChatJID: "15550009999@s.whatsapp.net",
        ChatName: "Instinct",
        MsgID: "3EB0C431D26B7F4B0EA0",
        SenderJID: "15550009999@s.whatsapp.net",
        SenderName: "Instinct",
        Timestamp: "2026-10-07T08:00:00Z",
        FromMe: false,
        Text: "shelf photo",
        DisplayText: "shelf photo",
        ReactionToID: "",
        MediaType: "",
        MediaCaption: "",
        Filename: "",
        Revoked: false,
        DeletedForMe: false,
      },
      {
        ChatJID: "15550009999@s.whatsapp.net",
        ChatName: "Instinct",
        MsgID: "3EB0C431D26B7F4B0EA1",
        SenderJID: "15550001111@s.whatsapp.net",
        SenderName: "Alex",
        Timestamp: "2026-10-07T08:30:00Z",
        FromMe: true,
        Text: "",
        DisplayText: "Sent image",
        ReactionToID: "",
        MediaType: "image",
        MediaCaption: "",
        Filename: "",
        Revoked: false,
        DeletedForMe: false,
      },
      {
        ChatJID: "15550009999@s.whatsapp.net",
        ChatName: "Instinct",
        MsgID: "3EB0C431D26B7F4B0EA2",
        SenderJID: "15550009999@s.whatsapp.net",
        SenderName: "Instinct",
        Timestamp: "2026-10-07T08:45:00Z",
        FromMe: false,
        Text: "the signed copy",
        DisplayText: "the signed copy",
        ReactionToID: "",
        MediaType: "document",
        MediaCaption: "the signed copy",
        Filename: "lease 2026.pdf",
        Revoked: false,
        DeletedForMe: false,
      },
    ],
    fts: true,
  },
  error: null,
});

interface WacliFake {
  runner: WacliRunner;
  calls: string[][];
}

function wacliFake(doctorJson: string): WacliFake {
  const calls: string[][] = [];

  const runner: WacliRunner = async (argv) => {
    calls.push([...argv]);

    if (argv[3] === "doctor") {
      return { exitCode: 0, stdout: doctorJson, stderr: "" };
    }

    return { exitCode: 0, stdout: MESSAGES_JSON, stderr: "" };
  };

  return { runner, calls };
}

const unusedRunner: WacliRunner = async () => {
  throw new Error("wacli must not run before the instinct secret is checked");
};

function offerCounts(indexDir: string): number[] {
  const db = connect(indexDir);

  try {
    const tables = db
      .query<{ name: string }, SQLQueryBindings[]>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'resurface_offers'",
      )
      .all();

    if (tables.length === 0) return [];

    return db
      .query<{ offer_count: number }, SQLQueryBindings[]>(
        "SELECT offer_count FROM resurface_offers",
      )
      .all()
      .map((row) => row.offer_count);
  } finally {
    db.close();
  }
}

function backdate(root: string, ref: string, ts: string): void {
  const db = new Database(ledgerPath(root));

  try {
    db.query("UPDATE events SET ts = ? WHERE ref = ?").run(ts, ref);
  } finally {
    db.close();
  }
}

const SearchRowSchema = z.object({
  path: z.string(),
  title: z.string(),
  excerpt: z.string(),
});

const RoutedRowSchema = z.object({
  path: z.string(),
  source: z.string(),
  reason: z.string(),
  model: z.string(),
  at: z.string(),
});

const WhatsappRowSchema = z.object({
  id: z.string(),
  chat: z.string(),
  sender: z.string(),
  at: z.string(),
  fromMe: z.boolean(),
  text: z.string(),
});

const InstinctRowSchema = z.object({
  at: z.string(),
  speaker: z.string(),
  text: z.string(),
});

const TodayPayloadSchema = z.object({
  resurface: z.nullable(z.object({ title: z.string(), question: z.string(), why: z.string() })),
  next_actions: z.array(z.object({ note: z.string(), title: z.string(), text: z.string() })),
});

describe("mcp server", () => {
  test("listTools answers exactly the six allowlisted tools, each described", async () => {
    const harness = await attach(fixture());
    const listed = await harness.client.listTools();

    expect(listed.tools.map((tool) => tool.name)).toEqual([...MCP_TOOL_NAMES]);

    for (const tool of listed.tools) {
      expect(tool.description).toBeTruthy();
    }
  });

  test("today returns the fixture briefing and records no resurface offer", async () => {
    const fx = fixture();
    const harness = await attach(fx);
    const outcome = await harness.call("today");

    expect(outcome.ok).toBe(true);

    const view = TodayPayloadSchema.parse(JSON.parse(outcome.text));

    expect(view.next_actions).toContainEqual({
      note: "projects/alpha.md",
      title: "Alpha Project",
      text: "open task one",
    });
    expect(view.resurface).not.toBeNull();

    expect(offerCounts(fx.indexDir).every((count) => count === 0)).toBe(true);
    const kinds = readEvents(fx.root, { limit: -1 }).map((event) => event.kind);

    expect(kinds.some((kind) => kind.includes("resurface") || kind.includes("offer"))).toBe(false);
  });

  test("search returns the indexed note for a distinctive fixture word", async () => {
    const harness = await attach(fixture());
    const outcome = await harness.call("search", { query: "dragonfruit" });

    expect(outcome.ok).toBe(true);

    const rows = SearchRowSchema.array().parse(JSON.parse(outcome.text));

    expect(rows.length).toBe(1);
    expect(rows[0]!.path).toBe("projects/alpha.md");
    expect(rows[0]!.title).toBe("Alpha Project");
    expect(rows[0]!.excerpt).toContain("dragonfruit");
  });

  test("search rejects out-of-range limits at the boundary", async () => {
    const harness = await attach(fixture());
    const over = await harness.call("search", { query: "dragonfruit", limit: 21 });
    const under = await harness.call("search", { query: "dragonfruit", limit: 0 });

    expect(over.ok).toBe(false);
    expect(under.ok).toBe(false);
  });

  test("capture writes one hermes note per call into the inbox", async () => {
    const fx = fixture();
    const harness = await attach(fx);
    const inbox = join(fx.vault, "inbox");
    const first = await harness.call("capture", { text: "buy oat milk and dragonfruit" });

    expect(first.ok).toBe(true);
    expect(readdirSync(inbox).length).toBe(1);
    expect(JSON.parse(first.text)).toEqual({ path: `inbox/${readdirSync(inbox)[0]}` });

    const note = readFileSync(join(inbox, readdirSync(inbox)[0]!), "utf8");

    expect(note.startsWith("---\n")).toBe(true);
    expect(note).toContain("\nsource: hermes\n");
    expect(note.endsWith("\nbuy oat milk and dragonfruit\n")).toBe(true);

    const second = await harness.call("capture", { text: "second thought" });

    expect(second.ok).toBe(true);
    expect(readdirSync(inbox).length).toBe(2);
  });

  test("capture rejects empty and over-long text without creating the inbox", async () => {
    const fx = fixture();
    const harness = await attach(fx);
    const empty = await harness.call("capture", { text: "" });
    const huge = await harness.call("capture", { text: "x".repeat(MCP_CAPTURE_MAX_CHARS + 1) });

    expect(empty.ok).toBe(false);
    expect(huge.ok).toBe(false);

    expect(existsSync(join(fx.vault, "inbox"))).toBe(false);
  });

  test("routed_since maps routed events newer than the instant, newest first", async () => {
    const fx = fixture();

    emit(fx.root, "routed", {
      source: "email",
      ref: "inbox/old-route.md",
      payload: { source_note: "inbox/old-route.md", reason: "older reason", route_model: "rule" },
    });
    emit(fx.root, "routed", {
      source: "whatsapp",
      ref: "inbox/new-route.md",
      payload: {
        source_note: "inbox/new-route.md",
        reason: "instinct chatter",
        route_model: "llm",
      },
    });
    backdate(fx.root, "inbox/old-route.md", "2026-10-01T00:00:00Z");

    const harness = await attach(fx);
    const outcome = await harness.call("routed_since", { since: "2026-10-05T00:00:00Z" });

    expect(outcome.ok).toBe(true);

    const rows = RoutedRowSchema.array().parse(JSON.parse(outcome.text));

    expect(rows.length).toBe(1);
    expect(rows[0]!.path).toBe("inbox/new-route.md");
    expect(rows[0]!.source).toBe("whatsapp");
    expect(rows[0]!.reason).toBe("instinct chatter");
    expect(rows[0]!.model).toBe("llm");
    expect(Date.parse(rows[0]!.at)).toBeGreaterThan(Date.parse("2026-10-05T00:00:00Z"));
  });

  test("whatsapp_search maps mirror rows, media as placeholders, and fences the query after --", async () => {
    const fx = fixture();
    const wacli = wacliFake(DOCTOR_PAIRED_JSON);
    const harness = await attach(fx, { runner: wacli.runner });
    const outcome = await harness.call("whatsapp_search", { query: "oat milk" });

    expect(outcome.ok).toBe(true);

    const rows = WhatsappRowSchema.array().parse(JSON.parse(outcome.text));

    expect(rows).toEqual([
      {
        id: "3EB0C431D26B7F4B0E9F",
        chat: "Alex ↔ Alex",
        sender: "Alex",
        at: "2026-10-07T09:05:00Z",
        fromMe: true,
        text: "buy oat milk",
      },
      {
        id: "3EB0C431D26B7F4B0EA0",
        chat: "Instinct",
        sender: "Instinct",
        at: "2026-10-07T08:00:00Z",
        fromMe: false,
        text: "shelf photo",
      },
      {
        id: "3EB0C431D26B7F4B0EA1",
        chat: "Instinct",
        sender: "Alex",
        at: "2026-10-07T08:30:00Z",
        fromMe: true,
        text: "[image]",
      },
      {
        id: "3EB0C431D26B7F4B0EA2",
        chat: "Instinct",
        sender: "Instinct",
        at: "2026-10-07T08:45:00Z",
        fromMe: false,
        text: "[document: lease 2026.pdf] the signed copy",
      },
    ]);

    const argv = wacli.calls.find((call) => call[3] === "messages" && call[4] === "search")!;

    expect(argv.slice(0, 5)).toEqual(["wacli", "--read-only", "--json", "messages", "search"]);
    expect(argv.at(-2)).toBe("--");
    expect(argv.at(-1)).toBe("oat milk");
  });

  test("whatsapp_search fails naming wacli auth when the store is unpaired", async () => {
    const fx = fixture();
    const wacli = wacliFake(DOCTOR_UNPAIRED_JSON);
    const harness = await attach(fx, { runner: wacli.runner });
    const outcome = await harness.call("whatsapp_search", { query: "oat milk" });

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("wacli auth");
  });

  test("instinct_thread maps both sides, media as placeholders, from the secret-named chat", async () => {
    const fx = fixture();
    const wacli = wacliFake(DOCTOR_PAIRED_JSON);
    const secrets = { "whatsapp-instinct-jid": "15550009999@s.whatsapp.net" };

    const harness = await attach(fx, {
      runner: wacli.runner,
      readSecret: (name: string) => secrets[name as keyof typeof secrets] ?? null,
    });

    const outcome = await harness.call("instinct_thread", { days: 7 });

    expect(outcome.ok).toBe(true);

    const rows = InstinctRowSchema.array().parse(JSON.parse(outcome.text));

    expect(rows).toEqual([
      { at: "2026-10-07T08:00:00Z", speaker: "them", text: "shelf photo" },
      { at: "2026-10-07T08:30:00Z", speaker: "me", text: "[image]" },
      {
        at: "2026-10-07T08:45:00Z",
        speaker: "them",
        text: "[document: lease 2026.pdf] the signed copy",
      },
      { at: "2026-10-07T09:05:00Z", speaker: "me", text: "buy oat milk" },
    ]);

    const argv = wacli.calls.find((call) => call[3] === "messages" && call[4] === "list")!;

    expect(argv).toContain("--chat=15550009999@s.whatsapp.net");
  });

  test("instinct_thread fails naming the missing secret file, before wacli runs", async () => {
    const fx = fixture();
    const harness = await attach(fx, { runner: unusedRunner });
    const outcome = await harness.call("instinct_thread", { days: 1 });

    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain(".secrets/whatsapp-instinct-jid");
  });

  test("instinct_thread rejects out-of-range day windows", async () => {
    const harness = await attach(fixture());
    const over = await harness.call("instinct_thread", { days: 8 });
    const under = await harness.call("instinct_thread", { days: 0 });

    expect(over.ok).toBe(false);
    expect(under.ok).toBe(false);
  });

  test("every call emits one agent_tool_called event carrying no arguments", async () => {
    const fx = fixture();
    const wacli = wacliFake(DOCTOR_UNPAIRED_JSON);
    const harness = await attach(fx, { runner: wacli.runner });

    const captureText = "a note whose text must stay out of the ledger";
    const captured = await harness.call("capture", { text: captureText });

    expect(captured.ok).toBe(true);

    const failed = await harness.call("whatsapp_search", { query: "oat milk" });

    expect(failed.ok).toBe(false);

    const events = readEvents(fx.root, { kind: "agent_tool_called", limit: -1 });

    expect(events.length).toBe(2);
    expect(events.map((event) => event.payload.tool)).toEqual(["whatsapp_search", "capture"]);
    expect(events[0]!.payload).toEqual({
      tool: "whatsapp_search",
      ok: false,
      latency_ms: expect.any(Number),
    });
    expect(events[1]!.payload).toEqual({
      tool: "capture",
      ok: true,
      latency_ms: expect.any(Number),
    });

    for (const event of events) {
      expect(Object.keys(event.payload).sort()).toEqual(["latency_ms", "ok", "tool"]);
      expect(JSON.stringify(event.payload)).not.toContain(captureText);
      expect(JSON.stringify(event.payload)).not.toContain("oat milk");
    }
  });
});
