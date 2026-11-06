import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { makeKeep } from "../../src/pkms/keep_ingest.ts";
import { APIException, Keep, KeepStateSchema } from "../../src/pkms/keep_transport.ts";

const temporaryRoots: string[] = [];

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const path = temporaryRoots.pop();

    if (path !== undefined) rmSync(path, { recursive: true, force: true });
  }
});

const changeRequestSchema = z
  .object({
    nodes: z.array(z.json()),
    targetVersion: z.string().optional(),
  })
  .passthrough();

const noteNode = {
  type: "NOTE",
  id: "note-id",
  serverId: "note-server-id",
  parentId: "root",
  sortValue: 1,
  baseVersion: 3,
  title: "Local transport note",
  timestamps: {
    kind: "notes#timestamps",
    created: "2026-01-01T00:00:00.000000Z",
    updated: "2026-01-02T00:00:00.000000Z",
    providerTimestampField: { revision: 7 },
  },
  providerMetadata: { retention: "preserve", flags: ["opaque", 4] },
};

const bodyNode = {
  type: "LIST_ITEM",
  id: "body-id",
  serverId: "body-server-id",
  parentId: "note-id",
  sortValue: 2,
  baseVersion: 3,
  text: "Note body",
  timestamps: {
    kind: "notes#timestamps",
    created: "2026-01-01T00:00:00.000000Z",
    updated: "2026-01-02T00:00:00.000000Z",
  },
};

const imageNode = {
  type: "BLOB",
  id: "image-id",
  serverId: "image-server-id",
  parentId: "note-id",
  sortValue: 3,
  baseVersion: 3,
  blob: { type: "IMAGE", providerBlobField: "kept" },
  timestamps: {
    kind: "notes#timestamps",
    created: "2026-01-01T00:00:00.000000Z",
    updated: "2026-01-02T00:00:00.000000Z",
  },
};

const listNode = {
  type: "LIST",
  id: "list-id",
  serverId: "list-server-id",
  parentId: "root",
  sortValue: 4,
  baseVersion: 3,
  title: "Checklist",
  timestamps: {
    kind: "notes#timestamps",
    created: "2026-01-01T00:00:00.000000Z",
    updated: "2026-01-02T00:00:00.000000Z",
  },
};

const lowerListItem = {
  type: "LIST_ITEM",
  id: "list-item-lower",
  serverId: "list-item-lower-server-id",
  parentId: "list-id",
  sortValue: 1,
  baseVersion: 3,
  text: "later item",
  checked: false,
  timestamps: {
    kind: "notes#timestamps",
    created: "2026-01-01T00:00:00.000000Z",
    updated: "2026-01-02T00:00:00.000000Z",
  },
};

const higherListItem = {
  type: "LIST_ITEM",
  id: "list-item-higher",
  serverId: "list-item-higher-server-id",
  parentId: "list-id",
  sortValue: 2,
  baseVersion: 3,
  text: "first item",
  checked: false,
  timestamps: {
    kind: "notes#timestamps",
    created: "2026-01-01T00:00:00.000000Z",
    updated: "2026-01-02T00:00:00.000000Z",
  },
};

describe("Keep mobile transport", () => {
  test("unchecked metadata distinguishes real list items from note text and ignores completed or deleted items", () => {
    const keep = new Keep("synthetic@example.test", "synthetic-token");
    const ordinary = { ...bodyNode, text: "☐ text in an ordinary note" };
    const checked = { ...lowerListItem, checked: true };
    keep.restore(
      KeepStateSchema.parse({
        keep_version: "offline",
        labels: [],
        nodes: [noteNode, ordinary, listNode, checked, higherListItem],
      }),
    );
    expect(keep.all().find((node) => node.id === "note-id")!.hasUnchecked).toBe(false);
    expect(keep.all().find((node) => node.id === "list-id")!.hasUnchecked).toBe(true);
    keep.restore(
      KeepStateSchema.parse({
        keep_version: "offline",
        labels: [],
        nodes: [listNode, checked, { ...higherListItem, checked: true }],
      }),
    );
    expect(keep.all()[0]!.hasUnchecked).toBe(false);
    keep.restore(
      KeepStateSchema.parse({
        keep_version: "offline",
        labels: [],
        nodes: [
          listNode,
          checked,
          {
            ...higherListItem,
            timestamps: { ...higherListItem.timestamps, deleted: "2026-01-03T00:00:00Z" },
          },
        ],
      }),
    );
    expect(keep.all()[0]!.hasUnchecked).toBe(false);
  });

  test("authenticates, follows truncated sync, resolves media, and preserves wire metadata on trash", async () => {
    const requests: Array<z.infer<typeof changeRequestSchema>> = [];

    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === "/auth") {
          const form = new URLSearchParams(await request.text());
          expect(form.get("Email")).toBe("keep@example.com");
          expect(form.get("EncryptedPasswd")).toBe("synthetic-master-token");

          return new Response("Auth=local-service-token\n");
        }

        if (url.pathname === "/notes/v1/changes") {
          expect(request.headers.get("authorization")).toBe("OAuth local-service-token");
          requests.push(changeRequestSchema.parse(await request.json()));

          if (requests.length === 1) {
            return Response.json({
              nodes: [noteNode, bodyNode, imageNode, listNode, lowerListItem, higherListItem],
              userInfo: { labels: [{ id: "label", providerLabelField: { keep: true } }] },
              toVersion: "v1",
              truncated: true,
            });
          }

          return Response.json({
            nodes: [],
            toVersion: `v${requests.length}`,
            truncated: false,
          });
        }

        if (url.pathname === "/media/v2/note-server-id/image-server-id") {
          expect(request.headers.get("authorization")).toBe("OAuth local-service-token");

          return new Response(null, {
            status: 302,
            headers: { location: "https://cdn.example.test/image" },
          });
        }

        return new Response("not found", { status: 404 });
      },
    });

    try {
      const base = server.url.origin;

      const keep = new Keep("keep@example.com", "synthetic-master-token", "device-test", {
        authUrl: `${base}/auth`,
        apiUrl: `${base}/notes/v1/`,
        mediaUrl: `${base}/media/v2/`,
      });

      await keep.authenticate();
      expect(requests).toHaveLength(2);
      expect(requests[0]?.targetVersion).toBeUndefined();
      expect(requests[1]?.targetVersion).toBe("v1");

      const note = keep.all()[0];
      expect(note?.title).toBe("Local transport note");
      expect(note?.text).toBe("Note body");
      const list = keep.all().find((node) => node.id === "list-id");
      expect(list?.text).toBe("☐ first item\n☐ later item");
      const image = note?.images[0];
      expect(image).toBeDefined();

      if (image === undefined) throw new Error("expected image attachment");
      await expect(keep.getMediaLink(image)).resolves.toBe("https://cdn.example.test/image");

      const state = KeepStateSchema.parse(keep.dump());
      const cached = state.nodes.find((node) => node.id === "note-id");
      expect(cached).toBeDefined();

      if (cached === undefined) throw new Error("expected cached note");

      const cachedNote = z
        .object({
          providerMetadata: z.json(),
          timestamps: z.object({ providerTimestampField: z.json() }).passthrough(),
        })
        .parse(cached);

      expect(cachedNote.providerMetadata).toEqual(noteNode.providerMetadata);
      expect(cachedNote.timestamps.providerTimestampField).toEqual({ revision: 7 });

      note?.trash();
      await keep.sync();
      const uploaded = requests[2]?.nodes[0];
      expect(uploaded).toBeDefined();

      if (uploaded === undefined) throw new Error("expected trashed note upload");

      const upload = z
        .object({
          providerMetadata: z.json(),
          timestamps: z
            .object({
              providerTimestampField: z.json(),
              trashed: z.string(),
            })
            .passthrough(),
        })
        .parse(uploaded);

      expect(upload.providerMetadata).toEqual(noteNode.providerMetadata);
      expect(upload.timestamps.providerTimestampField).toEqual({ revision: 7 });
    } finally {
      server.stop(true);
    }
  });

  test("accepts the live API's string-encoded int64 sortValue and baseVersion", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === "/auth") {
          return new Response("Auth=local-service-token\n");
        }

        return Response.json({
          nodes: [{ ...noteNode, sortValue: "5368709120", baseVersion: "12" }],
          toVersion: "v1",
          truncated: false,
        });
      },
    });

    try {
      const base = server.url.origin;

      const keep = new Keep("keep@example.com", "synthetic-master-token", "device-test", {
        authUrl: `${base}/auth`,
        apiUrl: `${base}/notes/v1/`,
        mediaUrl: `${base}/media/v2/`,
      });

      await keep.authenticate();
      const note = keep.all()[0];
      expect(note?.title).toBe("Local transport note");
      expect(note?.sort).toBe(5368709120);
      expect(note?.version).toBe(12);
    } finally {
      server.stop(true);
    }
  });

  test("rejects malformed sync response fields at the HTTP boundary", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === "/auth") {
          return new Response("Auth=local-service-token\n");
        }

        return Response.json({ nodes: "not-an-array", toVersion: 12 });
      },
    });

    try {
      const base = server.url.origin;

      const keep = new Keep("keep@example.com", "synthetic-master-token", "device-test", {
        authUrl: `${base}/auth`,
        apiUrl: `${base}/notes/v1/`,
      });

      await expect(keep.authenticate()).rejects.toThrow();
    } finally {
      server.stop(true);
    }
  });
  test("corrupt state cache falls back to a baseline sync and is replaced", async () => {
    const root = mkdtempSync(join(Bun.env.TMPDIR ?? "/tmp", "pkms-keep-cache-"));
    temporaryRoots.push(root);
    mkdirSync(join(root, ".ledger"), { recursive: true });
    writeFileSync(join(root, ".ledger", "keep-state.json"), "{", "utf8");
    let syncs = 0;

    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === "/auth")
          return new Response("Auth=local-service-token\n");
        syncs += 1;

        return Response.json({ nodes: [], toVersion: "baseline-v1", truncated: false });
      },
    });

    try {
      const base = server.url.origin;

      const keep = await makeKeep(
        "keep@example.com",
        "synthetic-master-token",
        join(root, ".index"),
        {
          authUrl: `${base}/auth`,
          apiUrl: `${base}/notes/v1/`,
        },
      );

      expect(syncs).toBe(1);
      expect(
        KeepStateSchema.parse(
          JSON.parse(readFileSync(join(root, ".ledger", "keep-state.json"), "utf8")),
        ).keep_version,
      ).toBe("baseline-v1");
      expect(keep.all()).toEqual([]);
    } finally {
      server.stop(true);
    }
  });

  test("a server-forced full resync recovers with a fresh client", async () => {
    const root = mkdtempSync(join(Bun.env.TMPDIR ?? "/tmp", "pkms-keep-resync-"));
    temporaryRoots.push(root);
    mkdirSync(join(root, ".ledger"), { recursive: true });
    writeFileSync(
      join(root, ".ledger", "keep-state.json"),
      JSON.stringify({ keep_version: "stale-v1", labels: [], nodes: [] }),
      "utf8",
    );
    let syncs = 0;

    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        if (new URL(request.url).pathname === "/auth")
          return new Response("Auth=local-service-token\n");

        if (new URL(request.url).pathname === "/notes/v1/changes") {
          syncs += 1;

          const body = z
            .object({ targetVersion: z.string().optional() })
            .parse(await request.json());

          if (body.targetVersion) return Response.json({ forceFullResync: true });

          return Response.json({
            nodes: [noteNode, bodyNode],
            toVersion: "fresh-v1",
            truncated: false,
          });
        }

        return new Response("not found", { status: 404 });
      },
    });

    try {
      const base = server.url.origin;

      const keep = await makeKeep(
        "keep@example.com",
        "synthetic-master-token",
        join(root, ".index"),
        {
          authUrl: `${base}/auth`,
          apiUrl: `${base}/notes/v1/`,
        },
      );

      expect(syncs).toBe(2);
      expect(keep.all().map((node) => node.title)).toContain("Local transport note");
      expect(
        KeepStateSchema.parse(
          JSON.parse(readFileSync(join(root, ".ledger", "keep-state.json"), "utf8")),
        ).keep_version,
      ).toBe("fresh-v1");
    } finally {
      server.stop(true);
    }
  });

  test("a persistent 429 raises after the retry cap", async () => {
    let changes = 0;

    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === "/auth")
          return new Response("Auth=local-service-token\n");
        changes += 1;

        return Response.json({ error: { code: 429 } });
      },
    });

    try {
      const keep = new Keep("keep@example.com", "synthetic-master-token", "device-test", {
        authUrl: `${server.url.origin}/auth`,
        apiUrl: `${server.url.origin}/notes/v1/`,
      });

      await expect(keep.authenticate()).rejects.toThrow(APIException);
      expect(changes).toBe(3);
    } finally {
      server.stop(true);
    }
  }, 30_000);

  test("a hanging Keep request aborts on the fetch timeout", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(_request) {
        return new Promise<Response>(() => {});
      },
    });

    try {
      const keep = new Keep("keep@example.com", "synthetic-master-token", "device-test", {
        authUrl: `${server.url.origin}/auth`,
        fetchTimeoutMs: 150,
      });

      await expect(keep.authenticate()).rejects.toThrow();
    } finally {
      server.stop(true);
    }
  });

  test("a transient auth 5xx is retried instead of failing the run", async () => {
    let authCalls = 0;

    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname !== "/auth") return Response.json({ nodes: [] });
        authCalls += 1;

        if (authCalls === 1) return new Response("upstream unavailable", { status: 503 });

        return new Response("Auth=local-service-token\n");
      },
    });

    try {
      const keep = new Keep("keep@example.com", "synthetic-master-token", "device-test", {
        authUrl: `${server.url.origin}/auth`,
        apiUrl: `${server.url.origin}/notes/v1/`,
      });

      await expect(keep.authenticate()).resolves.toBeUndefined();
      expect(authCalls).toBe(2);
    } finally {
      server.stop(true);
    }
  }, 10_000);

  test("an auth 4xx fails at once and names the status", async () => {
    let authCalls = 0;

    const server = Bun.serve({
      port: 0,
      fetch() {
        authCalls += 1;

        return new Response("bad request", { status: 400 });
      },
    });

    try {
      const keep = new Keep("keep@example.com", "synthetic-master-token", "device-test", {
        authUrl: `${server.url.origin}/auth`,
      });

      await expect(keep.authenticate()).rejects.toThrow("auth HTTP 400");
      expect(authCalls).toBe(1);
    } finally {
      server.stop(true);
    }
  });
});
