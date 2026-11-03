import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Database } from "bun:sqlite";
import { writeCapture } from "../../src/pkms/capture.ts";
import { makeServer } from "../../src/pkms/capture_service.ts";
import { emit, ledgerPath, readEvents } from "../../src/pkms/events.ts";
import { indexVault } from "../../src/pkms/indexer.ts";
import { readSource, setRoute, writeSource } from "../../src/pkms/sources.ts";

const roots: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pkms-events-"));
  roots.push(root);
  const vault = join(root, "vault");
  mkdirSync(vault);

  return { root, vault, indexDir: join(root, ".index") };
}

function routed(vault: string, id: string) {
  const source = writeSource(vault, `Original ${id}`, {
    source: "email",
    source_id: id,
    received_at: "2026-01-01T00:00:00Z",
    route: "pending",
    from: "sender@example.test",
  });

  const sourceNote = readSource(vault, source).relativePath;

  const capture = writeCapture(`Summary ${id}`, vault, {
    source: "email",
    extra: { source_note: sourceNote },
  });

  setRoute(vault, source, { route: "routed", inbox_note: relative(vault, capture) });

  return { sourceNote, capture };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("operational event ledger", () => {
  test("read-only inspection does not create state; timestamps and kind filters preserve payload", () => {
    const { root } = fixture();
    expect(readEvents(root)).toEqual([]);
    expect(existsSync(join(root, ".ledger"))).toBe(false);
    emit(root, "noise", {
      source: "email",
      ref: "one",
      payload: { reason: "bulk", nested: { value: 3 } },
    });
    emit(root, "hold", { source: "keep", ref: "two" });
    const db = new Database(ledgerPath(root));
    db.query("UPDATE events SET ts = ? WHERE ref = ?").run("2026-01-01T00:00:00.000Z", "one");
    db.query("UPDATE events SET ts = ? WHERE ref = ?").run("2026-01-02T00:00:00.000Z", "two");
    db.close();
    expect(
      readEvents(root, { since: "2026-01-01T19:00:00-05:00" }).map((event) => event.ref),
    ).toEqual(["two"]);
    expect(readEvents(root, { kind: "noise" })[0]?.payload).toEqual({
      reason: "bulk",
      nested: { value: 3 },
    });
    expect(readEvents(root, { limit: 1 }).map((event) => event.ref)).toEqual(["two"]);
  });

  test("a kinds filter keeps archive feedback inside a busy routing window", () => {
    const { root } = fixture();

    emit(root, "routed", {
      source: "email",
      ref: "feedback-routed",
      payload: { reason: "from a person", route_model: "rules@email.person" },
    });
    emit(root, "noise", { source: "email", ref: "feedback-noise", payload: { reason: "bulk" } });

    for (let index = 0; index < 210; index++) {
      emit(root, "source_archived", { source: "pkms", ref: `archived-${index}` });
    }

    const feedback = ["routed", "noise", "hold", "folded", "dismissed", "dug_out"];

    expect(readEvents(root, { limit: 200 }).map((event) => event.kind)).not.toContain("routed");
    expect(readEvents(root, { limit: 200 }).map((event) => event.kind)).not.toContain("noise");
    expect(readEvents(root, { kinds: feedback, limit: -1 }).map((event) => event.ref)).toEqual([
      "feedback-noise",
      "feedback-routed",
    ]);
    expect(readEvents(root, { kinds: ["routed"], limit: -1 }).map((event) => event.ref)).toEqual([
      "feedback-routed",
    ]);
  }, 30_000);

  test("capture remains durable when event storage is unavailable", () => {
    const { root, vault } = fixture();
    writeFileSync(join(root, ".ledger"), "blocked");
    const log = spyOn(console, "error").mockImplementation(() => {});

    try {
      const capture = writeCapture("A thought survives ledger failure", vault, {
        source: "manual",
      });

      expect(readFileSync(capture, "utf8")).toContain("A thought survives ledger failure");
      expect(readFileSync(join(root, ".ledger"), "utf8")).toBe("blocked");
    } finally {
      log.mockRestore();
    }
  });

  test("feedback follows source identity across inbox renames, filing and deletion, beyond the default event window", () => {
    const { root, vault, indexDir } = fixture();
    const first = routed(vault, "filed");
    const second = routed(vault, "deleted");
    const renamed = join(vault, "inbox", "renamed.md");
    renameSync(first.capture, renamed);
    indexVault(vault, indexDir);
    expect(readEvents(root, { kind: "dismissed" })).toEqual([]);
    expect(readEvents(root, { kind: "folded" })).toEqual([]);
    mkdirSync(join(vault, "projects"));
    renameSync(renamed, join(vault, "projects", "different-name.md"));
    unlinkSync(second.capture);
    indexVault(vault, indexDir);
    expect(
      readEvents(root, { kind: "folded" }).map((event) => [
        event.source,
        event.ref,
        event.payload.path,
      ]),
    ).toEqual([["email", first.sourceNote, "projects/different-name.md"]]);
    expect(
      readEvents(root, { kind: "dismissed" }).map((event) => event.payload.source_note),
    ).toEqual([second.sourceNote]);

    for (let i = 0; i < 510; i++) emit(root, "today_opened", { source: "pkms", ref: "today" });
    rmSync(indexDir, { recursive: true, force: true });
    indexVault(vault, indexDir);
    expect(readEvents(root, { kind: "folded", limit: -1 }).map((event) => event.ref)).toEqual([
      first.sourceNote,
    ]);
    expect(readEvents(root, { kind: "dismissed", limit: -1 }).map((event) => event.ref)).toEqual([
      second.sourceNote,
    ]);
  });

  test("unreadable filing evidence does not train a false dismissal", () => {
    const { root, vault, indexDir } = fixture();
    const item = routed(vault, "uncertain");
    unlinkSync(item.capture);
    mkdirSync(join(vault, "projects"));
    writeFileSync(join(vault, "projects", "unreadable.md"), "---\nsource_note: [\n---\n");
    const log = spyOn(console, "error").mockImplementation(() => {});

    try {
      indexVault(vault, indexDir);
      expect(readEvents(root, { kind: "dismissed" })).toEqual([]);
    } finally {
      log.mockRestore();
    }
  });

  test("only an authenticated search-result open records archive-dig learning provenance", async () => {
    const { root, vault, indexDir } = fixture();

    const source = writeSource(vault, "copperfinch message", {
      source: "email",
      source_id: "search-hit",
      received_at: "2026-01-01T00:00:00Z",
      route: "noise",
      from: "reader@example.test",
    });

    const sourceNote = readSource(vault, source).relativePath;
    indexVault(vault, indexDir);
    const opened: string[] = [];

    const server = makeServer({
      vault,
      indexDir,
      host: "127.0.0.1",
      port: 0,
      token: "fixture-token",
      openNoteFile: (path) => opened.push(path),
    });

    const base = `http://127.0.0.1:${server.port}`;

    try {
      const search = await fetch(`${base}/partial/search?token=fixture-token&q=copperfinch`);
      expect(search.status).toBe(200);
      await search.text();
      expect(
        readEvents(root, { kind: "search_executed" }).map((event) => event.payload.has_source_hits),
      ).toEqual([true]);

      for (const [query, origin] of [
        ["", "search"],
        ["?token=fixture-token", undefined],
        ["?token=fixture-token", "search"],
      ]) {
        const response = await fetch(`${base}/api/open-note${query}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: sourceNote, origin }),
        });

        expect(response.status).toBe(query ? 200 : 403);
        await response.text();
      }

      expect(opened).toEqual([source, source]);
      expect(
        readEvents(root, { kind: "dug_out" }).map((event) => ({
          source: event.source,
          ref: event.ref,
          payload: event.payload,
        })),
      ).toEqual([
        { source: "email", ref: sourceNote, payload: { source_note: sourceNote, route: "noise" } },
      ]);
    } finally {
      server.stop(true);
    }
  });
});
