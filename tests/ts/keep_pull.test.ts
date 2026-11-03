import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeServer } from "../../src/pkms/capture_service.ts";
import { indexVault } from "../../src/pkms/indexer.ts";
import { ingestKeep } from "../../src/pkms/keep_ingest.ts";
import { recordKeepFailure, recordKeepPull } from "../../src/pkms/keep_pull.ts";
import { listSources } from "../../src/pkms/sources.ts";

const roots: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pkms-keep-pull-"));
  roots.push(root);
  const vault = join(root, "vault");
  const indexDir = join(root, ".index");
  mkdirSync(vault);
  indexVault(vault, indexDir);

  return { root, vault, indexDir };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Keep pull-on-open", () => {
  test("authenticated today responses do not await ingestion, coalesce opens, and respect fresh versus stale timestamps", async () => {
    const { root, vault, indexDir } = fixture();
    const release = Promise.withResolvers<void>();
    const pulls: Promise<void>[] = [];

    const server = makeServer({
      vault,
      indexDir,
      host: "127.0.0.1",
      port: 0,
      token: "fixture-token",
      pullKeep() {
        const work = release.promise.then(async () => {
          await ingestKeep(vault, indexDir, root, {
            keep: { all: () => [{ id: "existing", text: "Archived original" }] },
          });
        });

        pulls.push(work);

        return work;
      },
    });

    const url = `http://127.0.0.1:${server.port}/partial/today`;

    const request = () =>
      fetch(url, {
        headers: { "x-capture-token": "fixture-token" },
        signal: AbortSignal.timeout(2_000),
      });

    try {
      expect((await fetch(url)).status).toBe(403);
      expect(pulls).toHaveLength(0);
      const responses = await Promise.all([request(), request()]);
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(pulls).toHaveLength(1);
      expect(listSources(vault)).toEqual([]);
      release.resolve();
      await Promise.all(pulls);
      expect(listSources(vault).map((source) => source.data.source_id)).toEqual(["existing"]);
      expect(
        Number.isFinite(
          Date.parse(readFileSync(join(root, ".ledger", "last_pull_at"), "utf8").trim()),
        ),
      ).toBe(true);
      expect((await request()).status).toBe(200);
      expect(pulls).toHaveLength(1);
      recordKeepPull(root, new Date(Date.now() - 121_000));
      expect((await request()).status).toBe(200);
      expect(pulls).toHaveLength(2);
      await Promise.all(pulls);
    } finally {
      release.resolve();
      await Promise.allSettled(pulls);
      server.stop(true);
    }
  });

  test("a failed pull writes the cooldown marker and a second refresh stays inside it", async () => {
    const { root, vault, indexDir } = fixture();
    let attempts = 0;
    const log = spyOn(console, "error").mockImplementation(() => {});

    const server = makeServer({
      vault,
      indexDir,
      host: "127.0.0.1",
      port: 0,
      token: "fixture-token",
      async pullKeep() {
        attempts += 1;

        if (attempts === 1) throw new Error("offline upstream failure");
        recordKeepPull(root);
      },
    });

    const request = () =>
      fetch(`http://127.0.0.1:${server.port}/api/today`, {
        headers: { "x-capture-token": "fixture-token" },
      });

    try {
      expect((await request()).status).toBe(200);
      expect(existsSync(join(root, ".ledger", "last_pull_at"))).toBe(false);
      expect(existsSync(join(root, ".ledger", "keep-pull-failure"))).toBe(true);

      expect((await request()).status).toBe(200);
      expect(attempts).toBe(1);

      recordKeepFailure(root, new Date(Date.now() - 6 * 60_000));
      expect((await request()).status).toBe(200);
      expect(attempts).toBe(2);
      expect(existsSync(join(root, ".ledger", "last_pull_at"))).toBe(true);
      expect(existsSync(join(root, ".ledger", "keep-pull-failure"))).toBe(false);
    } finally {
      server.stop(true);
      log.mockRestore();
    }
  });

  test("an overlapping ingest cannot take over a partially archived initial snapshot", async () => {
    const { root, vault, indexDir } = fixture();
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<Uint8Array>();

    const keep = {
      all: () => [{ id: "image", text: "Image note", images: [{ id: "blob" }] }],
      getMediaLink: () => "https://offline.example.test/image.png",
    };

    const first = ingestKeep(vault, indexDir, root, {
      keep,
      fetchBytes: () => {
        started.resolve();

        return release.promise;
      },
      ocr: () => null,
    });

    try {
      await started.promise;
      const overlapping = await ingestKeep(vault, indexDir, root, { keep });
      expect(overlapping.busy).toBe(true);
      expect(listSources(vault)).toEqual([]);
      release.resolve(new Uint8Array([0xff, 0xd8]));
      expect((await first).archived).toBe(1);
      expect(listSources(vault).map((source) => source.data.source_id)).toEqual(["image"]);
    } finally {
      release.resolve(new Uint8Array([0xff, 0xd8]));
      await first;
    }
  });
});
