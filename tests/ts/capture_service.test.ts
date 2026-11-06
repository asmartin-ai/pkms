import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import type {
  AreaTile,
  InboxItem,
  NextAction,
  RecentNote,
  RecognitionCard,
  ReadingItem,
  TodayView,
} from "../../src/pkms/today.ts";
import type { SearchRow } from "../../src/pkms/search.ts";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { writeCapture } from "../../src/pkms/capture.ts";
import type { SQLQueryBindings } from "bun:sqlite";
import { connect } from "../../src/pkms/db.ts";
import {
  MAX_SHARE_FILES,
  MAX_SHARE_FILE_BYTES,
  makeServer,
  resolveToken,
  run,
  safeVaultFile,
} from "../../src/pkms/capture_service.ts";
import { indexVault, loadPost } from "../../src/pkms/indexer.ts";
import { isoLocalDate } from "../../src/pkms/tasks.ts";
import { readText } from "../../src/pkms/textio.ts";
import { makeVault, mkTmp, rmTmp, writeNote } from "./helpers.ts";
import { readEvents } from "../../src/pkms/events.ts";

const NextActionSchema = z.object({
  note: z.string(),
  title: z.string(),
  text: z.string(),
  size: z.string().nullable(),
  first_action: z.string().nullable(),
}) satisfies z.ZodType<NextAction>;

const TodayViewSchema = z.object({
  date: z.string(),
  breadcrumb: z.object({ name: z.string(), lines: z.array(z.string()) }).nullable(),
  inbox_new: z.number(),
  done_today: z.number(),
  next_read: z
    .object({ title: z.string(), minutes: z.number().nullable(), promoted: z.string() })
    .nullable(),
  resurface: z
    .object({
      path: z.string(),
      title: z.string(),
      question: z.string(),
      why: z.string(),
      score: z.number(),
    })
    .nullable(),
  next_actions: z.array(NextActionSchema),
  more_notes: z.number(),
  snoozed: z.array(z.object({ note: z.string(), title: z.string() })),
}) satisfies z.ZodType<TodayView>;

const ReadingItemsSchema = z.array(
  z.object({
    title: z.string(),
    minutes: z.number().nullable(),
    promoted: z.string(),
    why: z.string(),
    path: z.string(),
  }),
) satisfies z.ZodType<ReadingItem[]>;

const RecognitionCardsSchema = z.array(
  z.object({
    kind: z.enum(["reading", "resurface"]),
    title: z.string(),
    why: z.string(),
    minutes: z.number().nullable().optional(),
    promoted: z.string().optional(),
    path: z.string(),
  }),
) satisfies z.ZodType<RecognitionCard[]>;

const RecentNotesSchema = z.array(
  z.object({
    title: z.string().nullable(),
    path: z.string(),
    last_touched: z.string(),
  }),
) satisfies z.ZodType<RecentNote[]>;

const SearchRowsSchema = z.array(
  z.object({
    path: z.string(),
    title: z.string(),
    excerpt: z.string(),
  }),
) satisfies z.ZodType<SearchRow[]>;

const InboxItemsSchema = z.array(
  z.object({
    preview: z.string(),
    source: z.string(),
    captured: z.string(),
    path: z.string(),
  }),
) satisfies z.ZodType<InboxItem[]>;

const AreaTilesSchema = z.array(
  z.object({
    title: z.string(),
    path: z.string(),
    next_action: z.string().nullable(),
    last_touched: z.string(),
  }),
) satisfies z.ZodType<AreaTile[]>;

const JsonResponseSchema = z.json();

type JsonResponse = z.infer<typeof JsonResponseSchema>;

function parseJson<T>(body: JsonResponse, schema: z.ZodType<T>): T {
  return schema.parse(body);
}

const CapturePayloadSchema = z
  .object({
    text: z.json().optional(),
    source_account_id: z.string().optional(),
    raw_ref: z.string().optional(),
    context: z
      .object({
        device: z.string().optional(),
        app: z.string().optional(),
      })
      .catchall(z.json())
      .optional(),
    ch_item_id: z.string().optional(),
    ch_origin_ref: z.string().optional(),
    ch_captured_at: z.string().optional(),
  })
  .catchall(z.json());

type CapturePayload = z.infer<typeof CapturePayloadSchema>;

const TODAY = isoLocalDate(new Date());

const LEAD = `---
title: Lead note
---
Lead body.
- [ ] the lead thing
`;

const DAILY = `---
---
## breadcrumb
- the lead thing
`;

const INBOX_CAPTURE = `---
tags: [inbox]
---
an inbox capture
`;

const TOKEN = "test-token-123";

let stopFns: Array<() => void> = [];

function startService(
  vault: string,
  indexDir: string,
  opts: {
    token?: string;
    openNoteFile?: (path: string) => void;
    shareOcr?: (path: string) => string | null | Promise<string | null>;
  } = {},
): string {
  const server = makeServer({
    vault,
    indexDir,
    host: "127.0.0.1",
    port: 0,
    token: opts.token ?? TOKEN,
    openNoteFile: opts.openNoteFile,
    shareOcr: opts.shareOcr,
  });

  stopFns.push(() => server.stop(true));

  return `http://127.0.0.1:${server.port}`;
}

afterEach(() => {
  for (const stop of stopFns.splice(0)) stop();
});

describe("capture_service helpers (ports src/pkms/capture_service.py)", () => {
  test("resolveToken: explicit token wins, no secrets dir created", () => {
    const root = mkTmp();

    try {
      expect(resolveToken(root, "abc")).toBe("abc");
      expect(existsSync(join(root, ".secrets"))).toBe(false);
    } finally {
      rmTmp(root);
    }
  });

  test("resolveToken: generates .secrets/capture-token then reuses it", () => {
    const root = mkTmp();

    try {
      const first = resolveToken(root);
      expect(first.length).toBeGreaterThanOrEqual(24);
      expect(existsSync(join(root, ".secrets", "capture-token"))).toBe(true);
      expect(resolveToken(root)).toBe(first);
    } finally {
      rmTmp(root);
    }
  });

  test("resolveToken: the token file is 0600 inside a 0700 .secrets dir", () => {
    const root = mkTmp();

    try {
      resolveToken(root);
      expect(statSync(join(root, ".secrets")).mode & 0o777).toBe(0o700);
      expect(statSync(join(root, ".secrets", "capture-token")).mode & 0o777).toBe(0o600);
    } finally {
      rmTmp(root);
    }
  });

  test("safeVaultFile: resolves an existing vault .md note", () => {
    const { vault, indexDir } = makeVault();

    try {
      const target = safeVaultFile(vault, "resources/beta.md");
      expect(target).not.toBeNull();
      expect(target!.endsWith("beta.md")).toBe(true);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("safeVaultFile: rejects traversal, absolute, non-md, missing", () => {
    const { vault, indexDir } = makeVault();

    try {
      expect(safeVaultFile(vault, "../README.md")).toBeNull();
      expect(safeVaultFile(vault, "a/../../b.md")).toBeNull();
      expect(safeVaultFile(vault, join(vault, "resources", "beta.md"))).toBeNull();
      expect(safeVaultFile(vault, "resources/beta.txt")).toBeNull();
      expect(safeVaultFile(vault, "nope/missing.md")).toBeNull();
      expect(safeVaultFile(vault, "")).toBeNull();
      expect(safeVaultFile(vault, null)).toBeNull();
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("safeVaultFile refuses a symlink escaping the vault", () => {
    const { vault, indexDir } = makeVault();
    const outside = mkTmp();

    try {
      const secret = join(outside, "secret.md");
      writeFileSync(secret, "outside the vault", "utf8");
      const link = join(vault, "daily", "sneaky.md");

      try {
        symlinkSync(secret, link);
      } catch {
        return;
      }

      expect(safeVaultFile(vault, "daily/sneaky.md")).toBeNull();
    } finally {
      rmTmp(vault, indexDir, outside);
    }
  });

  test("safeVaultFile refuses a .md symlink whose target lacks the suffix", () => {
    const { vault, indexDir } = makeVault();

    try {
      writeFileSync(join(vault, "note.txt"), "not markdown", "utf8");

      try {
        symlinkSync(join(vault, "note.txt"), join(vault, "note.md"));
      } catch {
        return;
      }

      expect(safeVaultFile(vault, "note.md")).toBeNull();
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("makeServer refuses to start without a token", () => {
    const { vault, indexDir } = makeVault();

    try {
      expect(() => makeServer({ vault, indexDir, host: "127.0.0.1", port: 0, token: "" })).toThrow(
        "requires a token",
      );
    } finally {
      rmTmp(vault, indexDir);
    }
  });
});

async function getText(url: string): Promise<{ status: number; body: string; ctype: string }> {
  const r = await fetch(url);

  return { status: r.status, body: await r.text(), ctype: r.headers.get("content-type") ?? "" };
}

async function getJson(
  url: string,
): Promise<{ status: number; body: JsonResponse; ctype: string }> {
  const r = await fetch(url);

  return {
    status: r.status,
    body: JsonResponseSchema.parse(await r.json()),
    ctype: r.headers.get("content-type") ?? "",
  };
}

describe("GET surfaces (ports tests/test_capture_service.py)", () => {
  let vault = "";
  let indexDir = "";
  let base = "";

  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    indexVault(vault, indexDir);
    base = startService(vault, indexDir);
  });
  afterEach(() => rmTmp(vault, indexDir));

  test("health needs no token", async () => {
    const { status, body } = await getText(`${base}/health`);
    expect(status).toBe(200);
    expect(body).toBe("ok");
  });

  test("root 302-redirects to /web/", async () => {
    const r = await fetch(`${base}/?token=${TOKEN}`, { redirect: "manual" });
    expect(r.status).toBe(302);
    expect(r.headers.get("location")!.startsWith("/web/")).toBe(true);
  });

  test("root redirect preserves the token query", async () => {
    const r = await fetch(`${base}/?token=${TOKEN}`, { redirect: "manual" });
    expect(r.headers.get("location")).toContain("token=");
  });

  test("the static shell is open without a token", async () => {
    const { status, ctype } = await getText(`${base}/web/`);
    expect(status).toBe(200);
    expect(ctype).toContain("text/html");
  });

  test("sub-resources load without a token", async () => {
    for (const sub of ["/web/styles.css", "/web/htmx.min.js", "/web/shell.js"]) {
      const { status } = await getText(base + sub);
      expect(status).toBe(200);
    }
  });

  test("index.html is served and loads htmx", async () => {
    const { status, body, ctype } = await getText(`${base}/web/?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("text/html");
    expect(body.toLowerCase()).toContain("pkms");
    expect(body).toContain("htmx.min.js");
  });

  test("the shell loads live data via partial endpoints", async () => {
    const { status, body } = await getText(`${base}/web/?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(body).toContain('hx-get="/partial/today"');
    expect(body).not.toContain("inbox_new: 3");
  });

  test("static assets serve with correct content types", async () => {
    const cases = [
      ["/web/styles.css", "text/css"],
      ["/web/htmx.min.js", "text/javascript"],
      ["/web/shell.js", "text/javascript"],
      ["/web/manifest.webmanifest", "application/manifest+json"],
      ["/web/icon.svg", "image/svg+xml"],
    ] as const;

    for (const [path, expected] of cases) {
      const { status, body, ctype } = await getText(`${base}${path}?token=${TOKEN}`);
      expect(status).toBe(200);
      expect(ctype.startsWith(expected)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    }
  });

  test("root rejects a missing token", async () => {
    const r = await fetch(`${base}/`);
    expect(r.status).toBe(403);
  });

  test("today view JSON has the CLI shape", async () => {
    const { status, body, ctype } = await getJson(`${base}/api/today?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("application/json");
    const view = parseJson(body, TodayViewSchema);
    expect(view.date).toBeDefined();
    expect(view.inbox_new).toBeDefined();
    expect(view.next_actions).toBeDefined();
    expect(view.done_today).toBeDefined();
    expect(view.next_actions[0]!.note.startsWith("projects")).toBe(true);
  });

  test("today view rejects a bad token", async () => {
    const r = await fetch(`${base}/api/today?token=wrong`);
    expect(r.status).toBe(403);
  });

  test("capture-page side door still served", async () => {
    const { status, body, ctype } = await getText(`${base}/capture-page?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("text/html");
    expect(body).toContain("dump a thought");
  });

  test("capture-page is token-gated (health is not)", async () => {
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect((await fetch(`${base}/`)).status).toBe(403);
    expect((await fetch(`${base}/capture-page`)).status).toBe(403);
    const { body } = await getText(`${base}/capture-page?token=${TOKEN}`);
    expect(body).toContain("textarea");
  });
});

describe("partial routes (T10)", () => {
  let vault = "";
  let indexDir = "";
  let base = "";

  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    mkdirSync(join(vault, "areas"), { recursive: true });
    mkdirSync(join(vault, "daily"), { recursive: true });
    mkdirSync(join(vault, "inbox"), { recursive: true });
    writeFileSync(join(vault, "areas", "lead.md"), LEAD, "utf8");
    writeFileSync(join(vault, "daily", `${TODAY}.md`), DAILY, "utf8");
    writeFileSync(join(vault, "inbox", "capture.md"), INBOX_CAPTURE, "utf8");
    indexVault(vault, indexDir);
    base = startService(vault, indexDir);
  });

  for (const p of [
    "/partial/today",
    "/partial/reading-queue",
    "/partial/actions",
    "/partial/recent-notes",
    "/partial/search?q=lead",
  ]) {
    test(`rejects a missing token: ${p}`, async () => {
      expect((await fetch(`${base}${p}`)).status).toBe(403);
    });
  }

  test("today partial returns HTML with the breadcrumb lede and lead", async () => {
    const { status, body, ctype } = await getText(`${base}/partial/today?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("text/html");
    expect(body).toContain("Yesterday you were in");
    expect(body).toContain("open task one");
  });

  test("today partial surfaces inbox captures", async () => {
    const { body } = await getText(`${base}/partial/today?token=${TOKEN}`);
    expect(body).toContain("an inbox capture");
  });

  test("today partial surfaces inbox captures", async () => {
    const { body } = await getText(`${base}/partial/today?token=${TOKEN}`);
    expect(body).toContain("an inbox capture");
  });

  test("reading-queue partial returns HTML", async () => {
    const { status, ctype } = await getText(`${base}/partial/reading-queue?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("text/html");
  });

  test("capture with hx-request returns empty 200 + HX-Trigger refresh", async () => {
    const r = await fetch(`${base}/capture?token=${TOKEN}`, {
      method: "POST",
      body: "htmx thought",
      headers: { "Content-Type": "text/plain", "hx-request": "true" },
    });

    expect(r.status).toBe(200);
    expect(r.headers.get("HX-Trigger")).toBe("pkms:refresh");
    expect(await r.text()).toBe("");
    expect(inboxFiles(vault).some((f) => f.includes("htmx-thought"))).toBe(true);
  });
  test("recent-notes partial returns HTML with open-note actions", async () => {
    const { status, body, ctype } = await getText(`${base}/partial/recent-notes?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("text/html");
    expect(body).toContain('hx-post="/api/open-note"');
  });

  test("search partial returns HTML with matches", async () => {
    const { status, body, ctype } = await getText(`${base}/partial/search?q=lead&token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("text/html");
    expect(body.toLowerCase()).toContain("lead");
  });

  test("search partial with empty query returns empty", async () => {
    const { body } = await getText(`${base}/partial/search?q=&token=${TOKEN}`);
    expect(body.length).toBe(0);
  });

  test("unknown partial path is 404", async () => {
    expect((await fetch(`${base}/partial/nope?token=${TOKEN}`)).status).toBe(404);
  });
});

describe("reading surfaces (ports tests/test_web_api_surfaces.py)", () => {
  let vault = "";
  let indexDir = "";
  let base = "";

  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    const reading = join(vault, "resources", "reading");
    mkdirSync(reading, { recursive: true });
    writeFileSync(
      join(reading, "queued-thread.md"),
      "---\ntitle: Queued Thread\ncreated: 2026-06-01\nreading: queued\n" +
        "reading_minutes: 12\npromoted: 2026-06-10\n---\n\nA promoted thread body.\n",
      "utf8",
    );
    writeFileSync(
      join(reading, "finished-thread.md"),
      "---\ntitle: Finished Thread\ncreated: 2026-06-01\nreading: done\n" +
        "reading_minutes: 99\npromoted: 2026-06-09\n---\n\nAlready read.\n",
      "utf8",
    );
    indexVault(vault, indexDir);
    base = startService(vault, indexDir);
  });
  afterEach(() => rmTmp(vault, indexDir));

  test("reading-queue is token-gated", async () => {
    expect((await fetch(`${base}/api/reading-queue`)).status).toBe(403);
  });

  test("reading-queue returns queued notes only", async () => {
    const { status, body, ctype } = await getJson(`${base}/api/reading-queue?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("application/json");
    expect(parseJson(body, ReadingItemsSchema)).toEqual([
      {
        title: "Queued Thread",
        minutes: 12,
        promoted: "2026-06-10",
        why: "next up in your reading queue",
        path: "resources/reading/queued-thread.md",
      },
    ]);
  });

  test("recognition-cards includes the real reading card", async () => {
    const { status, body, ctype } = await getJson(`${base}/api/recognition-cards?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("application/json");
    const cards = parseJson(body, RecognitionCardsSchema);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]!["kind"]).toBe("reading");
    expect(cards[0]!["title"]).toBe("Queued Thread");
    expect(cards[0]!["minutes"]).toBe(12);
    expect(cards[0]!["promoted"]).toBe("2026-06-10");
    expect(Object.hasOwn(cards[0]!, "why")).toBe(true);
  });
});

describe("search surfaces (ports tests/test_web_search_surfaces.py)", () => {
  let vault = "";
  let indexDir = "";
  let base = "";

  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    utimesSync(
      join(vault, "daily", "2026-06-01.md"),
      new Date(2026, 5, 1, 8),
      new Date(2026, 5, 1, 8),
    );
    utimesSync(
      join(vault, "projects", "alpha.md"),
      new Date(2026, 5, 1, 9),
      new Date(2026, 5, 1, 9),
    );
    utimesSync(
      join(vault, "resources", "beta.md"),
      new Date(2026, 5, 1, 10),
      new Date(2026, 5, 1, 10),
    );
    indexVault(vault, indexDir);
    base = startService(vault, indexDir);
  });
  afterEach(() => rmTmp(vault, indexDir));

  test("recent-notes is token-gated", async () => {
    expect((await fetch(`${base}/api/recent-notes`)).status).toBe(403);
  });

  test("recent-notes shape for the picker", async () => {
    const { status, body, ctype } = await getJson(`${base}/api/recent-notes?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("application/json");
    const entries = parseJson(body, RecentNotesSchema);
    expect(entries.length).toBeLessThanOrEqual(8);

    for (const entry of entries) {
      expect(entry.title).toBeDefined();
      expect(entry.path).toBeDefined();
      expect(entry.last_touched).toBeDefined();
      expect(entry.path).not.toContain("\\");
    }
  });

  test("recent-notes sorted most recent first", async () => {
    const { body } = await getJson(`${base}/api/recent-notes?token=${TOKEN}`);
    const titles = parseJson(body, RecentNotesSchema).map((entry) => entry.title);
    expect(titles.indexOf("Beta Note")).toBeLessThan(titles.indexOf("Alpha Project"));
  });

  test("recent-notes on an empty vault returns []", async () => {
    const emptyVault = mkTmp();
    const emptyIndex = mkTmp();
    const emptyBase = startService(emptyVault, emptyIndex);

    try {
      const { status, body } = await getJson(`${emptyBase}/api/recent-notes?token=${TOKEN}`);
      expect(status).toBe(200);
      expect(body).toEqual([]);
    } finally {
      rmTmp(emptyVault, emptyIndex);
    }
  });

  test("search is token-gated", async () => {
    expect((await fetch(`${base}/api/search?q=foo`)).status).toBe(403);
  });

  test("search is literal-by-default (B4 contract)", async () => {
    const { status, body, ctype } = await getJson(
      `${base}/api/search?q=Alpha%20references&token=${TOKEN}`,
    );

    expect(status).toBe(200);
    expect(ctype).toContain("application/json");
    const rows = parseJson(body, SearchRowsSchema);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.path === "projects/alpha.md")).toBe(true);

    const { body: body2 } = await getJson(`${base}/api/search?q=Alpha%20OR%20beta&token=${TOKEN}`);
    expect(body2).toEqual([]);
  });

  test("search result shape", async () => {
    const { status, body } = await getJson(`${base}/api/search?q=alpha&token=${TOKEN}`);
    expect(status).toBe(200);
    const rows = parseJson(body, SearchRowsSchema);

    for (const row of rows) {
      expect(row.path).toBeDefined();
      expect(row.title).toBeDefined();
      expect(row.excerpt).toBeDefined();
    }
  });

  test("empty query does not 500", async () => {
    const { status, body } = await getJson(`${base}/api/search?q=&token=${TOKEN}`);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test("missing q param does not 500", async () => {
    const { status, body } = await getJson(`${base}/api/search?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});

describe("inbox surface (ports tests/test_web_inbox_surface.py)", () => {
  let vault = "";
  let indexDir = "";
  let base = "";

  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    writeCapture(
      "older thought from the hotkey\n\nlonger body that should not appear in preview",
      vault,
      { source: "hotkey", now: new Date(2026, 5, 1, 10) },
    );
    writeCapture("middle capture from the phone", vault, {
      source: "phone",
      now: new Date(2026, 5, 2, 10),
    });
    writeCapture("newest capture from the web", vault, {
      source: "web",
      now: new Date(2026, 5, 3, 10),
    });
    indexVault(vault, indexDir);
    base = startService(vault, indexDir);
  });
  afterEach(() => rmTmp(vault, indexDir));

  test("inbox-items is token-gated", async () => {
    expect((await fetch(`${base}/api/inbox-items`)).status).toBe(403);
  });

  test("inbox-items returns recent captures newest first", async () => {
    const { status, body, ctype } = await getJson(`${base}/api/inbox-items?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype).toContain("application/json");
    const items = parseJson(body, InboxItemsSchema);
    expect(items.length).toBe(3);
    expect(items[0]!.source).toBe("web");
    expect(items[1]!.source).toBe("phone");
    expect(items[2]!.source).toBe("hotkey");
  });

  test("inbox-items entry shape", async () => {
    const { body } = await getJson(`${base}/api/inbox-items?token=${TOKEN}`);
    const items = parseJson(body, InboxItemsSchema);
    expect(items.length).toBeGreaterThan(0);

    for (const entry of items) {
      expect(entry.source).toBeDefined();
      expect(entry.preview).toBeDefined();
      expect(entry.captured).toBeDefined();
      expect(entry.path).toBeDefined();
      expect(entry.path).not.toContain("\\");
      expect(entry.path.startsWith("inbox/")).toBe(true);
    }
  });

  test("preview is the first line only", async () => {
    const { body } = await getJson(`${base}/api/inbox-items?token=${TOKEN}`);
    const items = parseJson(body, InboxItemsSchema);
    const hotkey = items.find((item) => item.source === "hotkey")!;
    expect(hotkey.preview.startsWith("older thought from the hotkey")).toBe(true);
    expect(hotkey.preview).not.toContain("longer body that should not appear in preview");
  });

  test("inbox-items capped at ~10", async () => {
    const { body } = await getJson(`${base}/api/inbox-items?token=${TOKEN}`);
    expect(parseJson(body, InboxItemsSchema).length).toBeLessThanOrEqual(10);
  });

  test("empty inbox returns []", async () => {
    const emptyVault = mkTmp();
    mkdirSync(join(emptyVault, "inbox"), { recursive: true });
    const emptyIndex = mkTmp();
    const emptyBase = startService(emptyVault, emptyIndex);

    try {
      const { status, body } = await getJson(`${emptyBase}/api/inbox-items?token=${TOKEN}`);
      expect(status).toBe(200);
      expect(body).toEqual([]);
    } finally {
      rmTmp(emptyVault, emptyIndex);
    }
  });

  test("missing inbox dir returns []", async () => {
    const emptyVault = mkTmp();
    const emptyIndex = mkTmp();
    const emptyBase = startService(emptyVault, emptyIndex);

    try {
      const { status, body } = await getJson(`${emptyBase}/api/inbox-items?token=${TOKEN}`);
      expect(status).toBe(200);
      expect(body).toEqual([]);
    } finally {
      rmTmp(emptyVault, emptyIndex);
    }
  });
});

describe("area-tiles endpoint (ports tests/test_area_tiles.py)", () => {
  let vault = "";
  let indexDir = "";
  let base = "";

  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    writeNote(
      join(vault, "areas", "career.md"),
      "Career area note.\n\n- [ ] update the resume header\n- [ ] second task that must not surface\n",
      { title: "Career" },
    );
    writeNote(
      join(vault, "areas", "health.md"),
      "Health area note.\n\n- [x] booked the checkup\n",
      {
        title: "Health",
      },
    );
    indexVault(vault, indexDir);
    base = startService(vault, indexDir);
  });
  afterEach(() => rmTmp(vault, indexDir));

  test("area-tiles is token-gated", async () => {
    expect((await fetch(`${base}/api/area-tiles`)).status).toBe(403);
  });

  test("area-tiles returns the tiles JSON", async () => {
    const { status, body, ctype } = await getJson(`${base}/api/area-tiles?token=${TOKEN}`);
    expect(status).toBe(200);
    expect(ctype.startsWith("application/json")).toBe(true);
    const tiles = parseJson(body, AreaTilesSchema);
    expect(tiles.map((tile) => tile.path)).toEqual(["areas/career.md", "areas/health.md"]);
  });

  test("empty vault returns []", async () => {
    const emptyVault = mkTmp();
    const emptyIndex = mkTmp();
    const emptyBase = startService(emptyVault, emptyIndex);

    try {
      const { status, body } = await getJson(`${emptyBase}/api/area-tiles?token=${TOKEN}`);
      expect(status).toBe(200);
      expect(body).toEqual([]);
    } finally {
      rmTmp(emptyVault, emptyIndex);
    }
  });
});

function inboxFiles(vault: string): string[] {
  try {
    return readdirSync(join(vault, "inbox"))
      .filter((n) => n.endsWith(".md"))
      .sort();
  } catch {
    return [];
  }
}

async function postRaw(
  url: string,
  body: string,
  headers: RequestInit["headers"] = {},
): Promise<{ status: number; body: string }> {
  const r = await fetch(url, { method: "POST", body, headers });

  return { status: r.status, body: await r.text() };
}

async function postJson(
  url: string,
  payload: CapturePayload,
  token: string,
): Promise<{ status: number; body: string }> {
  return postRaw(url, JSON.stringify(payload), {
    "Content-Type": "application/json",
    "X-Capture-Token": token,
  });
}

describe("POST /capture body shapes (ports tests/test_capture.py)", () => {
  let vault = "";
  let indexDir = "";
  let base = "";

  beforeEach(() => {
    vault = mkTmp();
    indexDir = join(vault, ".index");
    base = startService(vault, indexDir, { token: "sekrit" });
  });
  afterEach(() => rmTmp(vault));

  test("POST without token is 403 and writes nothing", async () => {
    const { status } = await postRaw(`${base}/capture`, "stolen thought");
    expect(status).toBe(403);
    expect(inboxFiles(vault)).toEqual([]);
  });

  test("a wrong token is refused on the header and the query path, at any length", async () => {
    const sameLength = "sekrut";
    const shorter = "sek";

    for (const wrong of [sameLength, shorter]) {
      const header = await postRaw(`${base}/capture`, "stolen thought", {
        "X-Capture-Token": wrong,
      });

      const query = await postRaw(`${base}/capture?token=${wrong}`, "stolen thought");

      expect(header.status).toBe(403);
      expect(query.status).toBe(403);
    }

    expect(inboxFiles(vault)).toEqual([]);
  });

  test("header token writes a capture", async () => {
    const { status, body } = await postRaw(`${base}/capture`, "phone thought", {
      "X-Capture-Token": "sekrit",
    });

    expect(status).toBe(200);
    expect(body).toContain("saved");
    expect(inboxFiles(vault).length).toBe(1);
  });

  test("query token + source land in frontmatter", async () => {
    await postRaw(`${base}/capture?token=sekrit&source=phone`, "from the couch");
    const note = readText(join(vault, "inbox", inboxFiles(vault)[0]!));
    expect(note).toContain("source: phone");
  });

  test("JSON body extracts text", async () => {
    await postRaw(`${base}/capture?token=sekrit`, '{"text": "json thought"}', {
      "Content-Type": "application/json",
    });
    const note = readText(join(vault, "inbox", inboxFiles(vault)[0]!));
    expect(note).toContain("json thought");
  });

  test("JSON text 1.0 captures as '1.0' not '1'", async () => {
    await postRaw(`${base}/capture?token=sekrit`, '{"text": 1.0}', {
      "Content-Type": "application/json",
    });
    const note = readText(join(vault, "inbox", inboxFiles(vault)[0]!));
    expect(note).toContain("1.0");
  });

  test("form body extracts text (+ decodes to space)", async () => {
    await postRaw(`${base}/capture?token=sekrit`, "text=form+thought", {
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const note = readText(join(vault, "inbox", inboxFiles(vault)[0]!));
    expect(note).toContain("form thought");
  });

  test("empty body is 400, nothing written", async () => {
    const { status } = await postRaw(`${base}/capture?token=sekrit`, "   ");
    expect(status).toBe(400);
    expect(inboxFiles(vault)).toEqual([]);
  });

  test("capture from the web lands in inbox with source: web", async () => {
    const { status } = await postRaw(`${base}/capture?token=sekrit`, "a thought from the web", {
      "Content-Type": "application/x-www-form-urlencoded",
    });

    expect(status).toBe(200);
    const files = inboxFiles(vault);
    expect(files.length).toBe(1);
    const text = readText(join(vault, "inbox", files[0]!));
    expect(text).toContain("a thought from the web");
    expect(text).toContain("source: web");
  });
});

const ENVELOPE = CapturePayloadSchema.parse({
  version: 1,
  delivery_id: "a".repeat(64),
  destination: "inbox",
  text:
    "Reliance on LLMs is killing people's mental models\n\n" +
    "A senior-dev discussion about mental-model erosion after heavy LLM use.\n\n" +
    "https://www.reddit.com/r/ExperiencedDevs/comments/fixture001/",
  context: { device: "desktop", app: "content-hoarder" },
  ch_item_id: "ext_ch_item_001",
  ch_origin_ref: "content-hoarder:fullname:reddit:t3_fixture001",
  ch_captured_at: "2026-07-12T05:51:25Z",
});

const OLD_IDEA = `---
title: Old Idea
created: 2026-01-01
---

An old idea worth maybe resurfacing.
`;

describe("versioned Content Hoarder delivery", () => {
  let vault = "";
  let indexDir = "";
  let base = "";

  const reply = (body: string) =>
    z
      .object({
        version: z.literal(1),
        state: z.enum(["confirmed", "duplicate", "failed"]),
        delivery_id: z.string(),
        note_path: z.string().optional(),
      })
      .parse(JSON.parse(body));

  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    base = startService(vault, indexDir);
  });
  afterEach(() => rmTmp(dirname(vault)));

  test("simultaneous deliveries create one note and return the same identity", async () => {
    const responses = await Promise.all([
      postJson(`${base}/capture`, ENVELOPE, TOKEN),
      postJson(`${base}/capture`, ENVELOPE, TOKEN),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const receipts = responses.map((response) => reply(response.body));
    expect(receipts.map((receipt) => receipt.state).sort()).toEqual(["confirmed", "duplicate"]);
    expect(receipts[0]!.note_path).toBe(receipts[1]!.note_path);
    expect(inboxFiles(vault)).toEqual([basename(receipts[0]!.note_path!)]);
    const note = loadPost(readText(join(vault, receipts[0]!.note_path!)));
    expect(note.data.ch_item_id).toBe("ext_ch_item_001");
    expect(note.data.promotion_delivery_id).toBe("a".repeat(64));
    expect(note.content).toContain("Reliance on LLMs");
  });

  test("retry locates a moved note without recreating the inbox capture", async () => {
    const first = reply((await postJson(`${base}/capture`, ENVELOPE, TOKEN)).body);
    const moved = join("projects", basename(first.note_path!));
    renameSync(join(vault, first.note_path!), join(vault, moved));
    const second = reply((await postJson(`${base}/capture`, ENVELOPE, TOKEN)).body);
    expect(second.state).toBe("duplicate");
    expect(second.note_path).toBe(moved);
    expect(inboxFiles(vault)).toEqual([]);
  });

  test("a recorded delivery whose note was removed is not falsely confirmed or recreated", async () => {
    const first = reply((await postJson(`${base}/capture`, ENVELOPE, TOKEN)).body);
    unlinkSync(join(vault, first.note_path!));
    const second = reply((await postJson(`${base}/capture`, ENVELOPE, TOKEN)).body);
    expect(second.state).toBe("failed");
    expect(inboxFiles(vault)).toEqual([]);
  });

  test("pre-versioned inbox captures are recovered without making a second note", async () => {
    const old = writeCapture("Original capture", vault, {
      source: "content-hoarder",
      extra: { ch_item_id: "ext_ch_item_001" },
    });

    const result = reply((await postJson(`${base}/capture`, ENVELOPE, TOKEN)).body);
    expect(result.state).toBe("duplicate");
    expect(join(vault, result.note_path!)).toBe(old);
    expect(inboxFiles(vault)).toEqual([basename(old)]);
  });

  test("legacy wire envelopes and unsupported versions are rejected without capture", async () => {
    for (const payload of [
      { text: "legacy", ch_item_id: "old" },
      { ...ENVELOPE, version: 2 },
      { ...ENVELOPE, text: " " },
    ]) {
      expect((await postJson(`${base}/capture`, payload, TOKEN)).status).toBe(400);
    }

    expect(inboxFiles(vault)).toEqual([]);
  });

  test("ordinary JSON captures keep their existing behavior", async () => {
    expect((await postJson(`${base}/capture`, { text: "Ordinary capture" }, TOKEN)).status).toBe(
      200,
    );
    const note = loadPost(readText(join(vault, "inbox", inboxFiles(vault)[0]!)));
    expect(note.content.trim()).toBe("Ordinary capture");
    expect(note.data.promotion_delivery_id).toBeUndefined();
  });
});

describe("resurface actions (ports tests/test_web_resurface_actions.py)", () => {
  let vault = "";
  let indexDir = "";
  let base = "";

  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    writeFileSync(
      join(vault, "resources", "old-idea.md"),
      "---\ntitle: Old Idea\ncreated: 2026-01-01\n---\n\nAn old idea worth maybe resurfacing.\n",
      "utf8",
    );
    indexVault(vault, indexDir);
    base = startService(vault, indexDir);
  });
  afterEach(() => rmTmp(vault, indexDir));

  test("resurface is token-gated", async () => {
    const r = await fetch(`${base}/api/resurface`, {
      method: "POST",
      body: JSON.stringify({ path: "resources/old-idea.md", action: "not-now" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(r.status).toBe(403);
  });

  test("not-now persists a rest window in the index", async () => {
    const r = await fetch(`${base}/api/resurface?token=${TOKEN}`, {
      method: "POST",
      body: JSON.stringify({ path: "resources/old-idea.md", action: "not-now" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(await r.json()).toEqual({
      ok: true,
      action: "not-now",
      path: "resources/old-idea.md",
    });
    const db = connect(indexDir);

    const row = db
      .query<{ rest_until: string }, SQLQueryBindings[]>(
        "SELECT rest_until FROM resurface_offers WHERE path = ?",
      )
      .get("resources/old-idea.md");

    db.close();
    expect(row).not.toBeNull();
    expect(row!.rest_until > "2026-01-01").toBe(true);
  });

  test("let-go writes resurface: never to frontmatter", async () => {
    const r = await fetch(`${base}/api/resurface?token=${TOKEN}`, {
      method: "POST",
      body: JSON.stringify({ path: "resources/old-idea.md", action: "let-go" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, action: "let-go", path: "resources/old-idea.md" });
    const meta = loadPost(readText(join(vault, "resources", "old-idea.md"))).data;
    expect(meta["resurface"]).toBe("never");
  });

  test("unknown action is 400 and leaves the file untouched", async () => {
    const before = readText(join(vault, "resources", "old-idea.md"));

    const r = await fetch(`${base}/api/resurface?token=${TOKEN}`, {
      method: "POST",
      body: JSON.stringify({ path: "resources/old-idea.md", action: "explode" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(r.status).toBe(400);
    expect(readText(join(vault, "resources", "old-idea.md"))).toBe(before);
  });

  test("malformed JSON body is 400", async () => {
    const r = await fetch(`${base}/api/resurface?token=${TOKEN}`, {
      method: "POST",
      body: "{not json",
      headers: { "Content-Type": "application/json" },
    });

    expect(r.status).toBe(400);
  });
});

describe("open-note (ports tests/test_capture_service.py)", () => {
  let vault = "";
  let indexDir = "";
  let base = "";
  let opened: string[] = [];

  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    indexVault(vault, indexDir);
    opened = [];
    base = startService(vault, indexDir, { openNoteFile: (p) => opened.push(p) });
  });
  afterEach(() => rmTmp(vault, indexDir));

  test("opens a vault markdown note via the injected seam", async () => {
    const r = await fetch(`${base}/api/open-note?token=${TOKEN}`, {
      method: "POST",
      body: JSON.stringify({ path: "resources/beta.md" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, path: "resources/beta.md" });
    expect(opened).toEqual([join(vault, "resources", "beta.md")]);
  });

  test("rejects traversal with 404", async () => {
    const r = await fetch(`${base}/api/open-note?token=${TOKEN}`, {
      method: "POST",
      body: JSON.stringify({ path: "../README.md" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(r.status).toBe(404);
    expect(opened).toEqual([]);
  });

  test("open-note is token-gated", async () => {
    const r = await fetch(`${base}/api/open-note`, {
      method: "POST",
      body: JSON.stringify({ path: "resources/beta.md" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(r.status).toBe(403);
  });

  test("unknown POST path is 404", async () => {
    const r = await fetch(`${base}/api/nope?token=${TOKEN}`, { method: "POST", body: "{}" });
    expect(r.status).toBe(404);
  });
});

describe("HX-Request POST negotiation (T10)", () => {
  let vault = "";
  let indexDir = "";
  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    mkdirSync(join(vault, "resources"), { recursive: true });
    writeFileSync(join(vault, "resources", "old-idea.md"), OLD_IDEA, "utf8");
    indexVault(vault, indexDir);
  });
  afterEach(() => rmTmp(vault, indexDir));

  function srv(opts: { openNoteFile?: (p: string) => void } = {}) {
    const s = makeServer({
      vault,
      indexDir,
      host: "127.0.0.1",
      port: 0,
      token: TOKEN,
      openNoteFile: opts.openNoteFile,
    });

    return { s, base: `http://127.0.0.1:${s.port}` };
  }

  test("capture without hx-request returns plain text (JSON contract)", async () => {
    const { s, base } = srv();

    try {
      const { status, body } = await postRaw(`${base}/capture?token=${TOKEN}`, "htmx-less thought");
      expect(status).toBe(200);
      expect(body).toContain("saved ✓");
    } finally {
      s.stop(true);
    }
  });
  test("capture with hx-request returns empty 200 + HX-Trigger refresh", async () => {
    const { s, base } = srv();

    try {
      const r = await fetch(`${base}/capture?token=${TOKEN}`, {
        method: "POST",
        body: "htmx thought",
        headers: { "Content-Type": "text/plain", "hx-request": "true" },
      });

      expect(r.status).toBe(200);
      expect(r.headers.get("HX-Trigger")).toBe("pkms:refresh");
      expect(await r.text()).toBe("");
      expect(inboxFiles(vault).some((f) => f.includes("htmx-thought"))).toBe(true);
    } finally {
      s.stop(true);
    }
  });

  test("resurface without hx-request returns JSON", async () => {
    const { s, base } = srv();

    try {
      const r = await fetch(`${base}/api/resurface?token=${TOKEN}`, {
        method: "POST",
        body: JSON.stringify({ path: "resources/old-idea.md", action: "not-now" }),
        headers: { "Content-Type": "application/json" },
      });

      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({
        ok: true,
        action: "not-now",
        path: "resources/old-idea.md",
      });
    } finally {
      s.stop(true);
    }
  });
  test("resurface with hx-request returns empty 200 + HX-Trigger refresh", async () => {
    const { s, base } = srv();

    try {
      const r = await fetch(`${base}/api/resurface?token=${TOKEN}`, {
        method: "POST",
        body: JSON.stringify({ path: "resources/old-idea.md", action: "let-go" }),
        headers: { "Content-Type": "application/json", "hx-request": "true" },
      });

      expect(r.status).toBe(200);
      expect(r.headers.get("HX-Trigger")).toBe("pkms:refresh");
      expect(await r.text()).toBe("");
      expect(loadPost(readText(join(vault, "resources", "old-idea.md"))).data["resurface"]).toBe(
        "never",
      );
    } finally {
      s.stop(true);
    }
  });

  test("open-note without hx-request returns JSON", async () => {
    const { s, base } = srv();

    try {
      const r = await fetch(`${base}/api/open-note?token=${TOKEN}`, {
        method: "POST",
        body: JSON.stringify({ path: "resources/beta.md" }),
        headers: { "Content-Type": "application/json" },
      });

      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true, path: "resources/beta.md" });
    } finally {
      s.stop(true);
    }
  });
  test("open-note with hx-request returns empty 200 + HX-Trigger refresh", async () => {
    const opened: string[] = [];
    const { s, base } = srv({ openNoteFile: (p) => opened.push(p) });

    try {
      const r = await fetch(`${base}/api/open-note?token=${TOKEN}`, {
        method: "POST",
        body: JSON.stringify({ path: "resources/beta.md" }),
        headers: { "Content-Type": "application/json", "hx-request": "true" },
      });

      expect(r.status).toBe(200);
      expect(r.headers.get("HX-Trigger")).toBe("pkms:refresh");
      expect(await r.text()).toBe("");
      expect(opened).toEqual([join(vault, "resources", "beta.md")]);
    } finally {
      s.stop(true);
    }
  });
});

describe("share target (POST /web/share)", () => {
  let vault = "";
  let indexDir = "";
  let inbox = "";

  beforeEach(() => {
    ({ vault, indexDir } = makeVault());
    inbox = join(vault, "inbox");
    mkdirSync(inbox, { recursive: true });
  });

  function post(base: string, form: FormData, token = TOKEN): Promise<Response> {
    return fetch(`${base}/web/share${token ? `?token=${token}` : ""}`, {
      method: "POST",
      body: form,
      redirect: "manual",
    });
  }

  function noteText(): string {
    const note = readdirSync(inbox).find((f) => f.endsWith(".md"))!;

    return readFileSync(join(inbox, note), "utf8");
  }

  test("text-only share: one capture, deduped, 303 to the saved today view", async () => {
    const base = startService(vault, indexDir);
    const form = new FormData();

    form.set("title", "A article title");
    form.set("text", "Some quoted text\nhttps://example.com/a");
    form.set("url", "https://example.com/a");

    const r = await post(base, form);

    expect(r.status).toBe(303);
    expect(r.headers.get("Location")).toContain("saved=share");
    expect(r.headers.get("Location")).toContain(`token=${TOKEN}`);
    const text = noteText();

    expect(text).toContain("source: share");
    expect(text).toContain("A article title");
    expect(text).toContain("Some quoted text\nhttps://example.com/a");
    expect((text.match(/example\.com/g) ?? []).length).toBe(1);
    expect(
      readEvents(join(vault, "..")).some(
        (e) => e.kind === "capture_written" && e.source === "share",
      ),
    ).toBe(true);
  });

  test("url-only share lands as a link note", async () => {
    const base = startService(vault, indexDir);
    const form = new FormData();

    form.set("url", "https://example.com/only");

    const r = await post(base, form);

    expect(r.status).toBe(303);
    expect(noteText()).toContain("https://example.com/only");
  });

  test("an image share is stored sha256-named with link + OCR text", async () => {
    const seen: string[] = [];

    const base = startService(vault, indexDir, {
      shareOcr: (p) => {
        seen.push(p);

        return "sign says WEEKLY SPECIAL";
      },
    });

    const form = new FormData();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

    form.set("files", new File([bytes], "shot.png", { type: "image/png" }));

    const r = await post(base, form);

    expect(r.status).toBe(303);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/keep-media\/[0-9a-f]{64}\.png$/);
    expect(existsSync(seen[0]!)).toBe(true);
    const text = noteText();

    expect(text).toContain("file://");
    expect(text).toContain("sign says WEEKLY SPECIAL");
  });

  test("missing auth is rejected and nothing is written", async () => {
    const base = startService(vault, indexDir);
    const form = new FormData();

    form.set("text", "should never land");

    const r = await post(base, form, "");

    expect(r.status).toBe(403);
    expect(readdirSync(inbox).filter((f) => f.endsWith(".md"))).toHaveLength(0);
  });

  test("a share over the file-count cap is rejected with 413", async () => {
    const base = startService(vault, indexDir);
    const form = new FormData();

    form.set("text", "too many photos");

    for (let i = 0; i <= MAX_SHARE_FILES; i++) {
      form.append("files", new File([new Uint8Array([i])], `shot${i}.png`, { type: "image/png" }));
    }

    const r = await post(base, form);

    expect(r.status).toBe(413);
    expect(await r.text()).toContain(String(MAX_SHARE_FILES));
    expect(readdirSync(inbox).filter((f) => f.endsWith(".md"))).toHaveLength(0);
  });

  test("a share over the per-image byte cap is rejected with 413", async () => {
    const base = startService(vault, indexDir);
    const form = new FormData();

    form.set("text", "one huge photo");
    form.append(
      "files",
      new File([new Uint8Array(MAX_SHARE_FILE_BYTES + 1)], "huge.png", { type: "image/png" }),
    );

    const r = await post(base, form);

    expect(r.status).toBe(413);
    expect(await r.text()).toContain(String(MAX_SHARE_FILE_BYTES));
    expect(readdirSync(inbox).filter((f) => f.endsWith(".md"))).toHaveLength(0);
  });

  test("an in-cap image share still stores and extracts text", async () => {
    const seen: string[] = [];

    const base = startService(vault, indexDir, {
      shareOcr: (p) => {
        seen.push(p);

        return "sign says WEEKLY SPECIAL";
      },
    });

    const form = new FormData();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

    form.set("files", new File([bytes], "ok.png", { type: "image/png" }));

    const r = await post(base, form);

    expect(r.status).toBe(303);
    expect(seen).toHaveLength(1);
    expect(noteText()).toContain("sign says WEEKLY SPECIAL");
  });

  test("share OCR is awaited — the service keeps serving while it runs", async () => {
    const seen: string[] = [];
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();

    const base = startService(vault, indexDir, {
      shareOcr: async (p) => {
        seen.push(p);
        started.resolve();

        await release.promise;

        return "late OCR text";
      },
    });

    const form = new FormData();

    form.set("text", "with an image");
    form.append(
      "files",
      new File([new Uint8Array([1, 2, 3, 4])], "shot.png", { type: "image/png" }),
    );

    const shared = post(base, form);

    await started.promise;

    const health = await fetch(`${base}/health`);

    expect(health.status).toBe(200);

    release.resolve();

    const r = await shared;

    expect(r.status).toBe(303);
    expect(seen).toHaveLength(1);
    expect(noteText()).toContain("late OCR text");
  });

  test("an image share never touches the token file or .secrets", async () => {
    const base = startService(vault, indexDir, { shareOcr: () => "receipt: 42" });
    const form = new FormData();

    form.append("files", new File([new Uint8Array([9, 9, 9])], "shot.png", { type: "image/png" }));

    const r = await post(base, form);

    expect(r.status).toBe(303);
    expect(noteText()).toContain("receipt: 42");
    expect(existsSync(join(vault, "..", ".secrets"))).toBe(false);
  });

  test("OCR timeout: capture is still written with (OCR unavailable)", async () => {
    const base = startService(vault, indexDir, {
      shareOcr: () => Promise.resolve(null),
    });

    const form = new FormData();
    form.set("text", "image with stalled OCR");
    form.append(
      "files",
      new File([new Uint8Array([1, 2, 3, 4])], "shot.png", { type: "image/png" }),
    );

    const r = await post(base, form);

    expect(r.status).toBe(303);
    const text = noteText();
    expect(text).toContain("image with stalled OCR");
    expect(text).toContain("(OCR unavailable)");
  });
});

describe("serve bind default (review S3: loopback unless overridden)", () => {
  test("no host → the server binds 127.0.0.1 and serves", async () => {
    const { vault } = makeVault();
    const root = dirname(vault);
    const server = run(vault, root, { port: 0, token: TOKEN });

    try {
      expect(server.hostname).toBe("127.0.0.1");
      expect(new URL(server.url).hostname).toBe("127.0.0.1");

      const health = await fetch(`http://127.0.0.1:${server.port ?? 0}/health`);

      expect(health.status).toBe(200);
    } finally {
      void server.stop(true);
      rmTmp(root);
    }
  });

  test("--host 0.0.0.0 still binds and serves", async () => {
    const { vault } = makeVault();
    const root = dirname(vault);
    const server = run(vault, root, { host: "0.0.0.0", port: 0, token: TOKEN });

    try {
      expect(server.hostname).toBe("0.0.0.0");

      const health = await fetch(`http://127.0.0.1:${server.port ?? 0}/health`);

      expect(health.status).toBe(200);
    } finally {
      void server.stop(true);
      rmTmp(root);
    }
  });
});
