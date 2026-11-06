import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface LoadedAuthToken {
  resolve: (search: string, cachesApi: FakeCaches | null) => Promise<string>;
}

interface FakeCache {
  match: (request: Request | string) => Promise<Response | undefined>;
  put: (request: Request | string, response: Response) => Promise<void>;
}

interface FakeCaches {
  open: (name: string) => Promise<FakeCache>;
  keys?: () => Promise<string[]>;
  delete?: (key: string) => Promise<boolean>;
}

interface FakeCacheEntry {
  key: string;
  value: Response;
}

interface FakeCachesResult {
  caches: FakeCaches;
  deletedKeys: string[];
}

interface ActivateEvent {
  waitUntil: (p: Promise<unknown>) => void;
}

interface FetchEvent {
  request: Request;
  respondWith: (r: Response) => void;
}

type SwEvent = ActivateEvent | FetchEvent;

type SwEventHandler = (e: SwEvent) => void;

interface LoadedSw {
  self: { eventHandlers: Map<string, SwEventHandler> };
}

interface TokenWindow {
  pkmsToken?: LoadedAuthToken;
}

function loadAuthTokenScript(cachesApi: FakeCaches | null): LoadedAuthToken {
  const script = readFileSync(join(__dirname, "../../src/pkms/web/auth-token.js"), "utf8");
  const windowObj: TokenWindow = {};
  const fn = new Function("window", "caches", script + "\nreturn window.pkmsToken;");

  return fn(windowObj, cachesApi) as LoadedAuthToken;
}

function makeFakeCaches(storedToken: string | null): FakeCaches {
  const store = new Map<string, string>();

  if (storedToken !== null) store.set("/__token", storedToken);

  return {
    open: (_name: string) =>
      Promise.resolve({
        match: (request: Request | string) => {
          const url = request instanceof Request ? request.url : request;
          const val = store.get(url);

          return val !== undefined
            ? Promise.resolve(new Response(val))
            : Promise.resolve(undefined);
        },
        put: () => Promise.resolve(),
      }),
  };
}

describe("auth-token.js", () => {
  test("resolve returns the URL token when present", async () => {
    const token = loadAuthTokenScript(makeFakeCaches("stored-token"));
    const result = await token.resolve("?token=url-token", makeFakeCaches("stored-token"));

    expect(result).toBe("url-token");
  });

  test("resolve falls back to stored token when no URL token", async () => {
    const token = loadAuthTokenScript(makeFakeCaches("stored-token"));
    const result = await token.resolve("", makeFakeCaches("stored-token"));

    expect(result).toBe("stored-token");
  });

  test("resolve returns empty string when no token anywhere", async () => {
    const token = loadAuthTokenScript(makeFakeCaches(null));
    const result = await token.resolve("", makeFakeCaches(null));

    expect(result).toBe("");
  });

  test("resolve returns empty string when caches is unavailable", async () => {
    const token = loadAuthTokenScript(null);
    const result = await token.resolve("", null);

    expect(result).toBe("");
  });

  test("resolve returns empty string when caches.open throws", async () => {
    const token = loadAuthTokenScript({
      open: () => Promise.reject(new Error("Cache Storage unavailable")),
    });

    const result = await token.resolve("", {
      open: () => Promise.reject(new Error("Cache Storage unavailable")),
    });

    expect(result).toBe("");
  });
});

function makeFakeCachesWithEntries(entries: FakeCacheEntry[]): FakeCachesResult {
  const store = new Map<string, Response>();

  for (const e of entries) store.set(e.key, e.value);
  const deletedKeys: string[] = [];

  const caches: FakeCaches = {
    keys: () => Promise.resolve([...store.keys()]),
    delete: (key: string) => {
      deletedKeys.push(key);
      store.delete(key);

      return Promise.resolve(true);
    },
    open: (name: string) => {
      if (name === "pkms-shell-v10") {
        return Promise.resolve({
          match: (request: Request | string) => {
            const url = request instanceof Request ? request.url : request;
            const hit = store.get(url);

            return Promise.resolve(hit);
          },
          put: (request: Request | string, response: Response) => {
            const url = request instanceof Request ? request.url : request;
            store.set(url, response);

            return Promise.resolve();
          },
        });
      }

      if (name === "pkms-auth") {
        return Promise.resolve({
          match: (request: Request | string) => {
            const url = request instanceof Request ? request.url : request;
            const hit = store.get(url);

            return Promise.resolve(hit);
          },
          put: () => Promise.resolve(),
        });
      }

      return Promise.resolve({
        match: () => Promise.resolve(undefined),
        put: () => Promise.resolve(),
      });
    },
  };

  return { caches, deletedKeys };
}

function loadSwScript(cachesApi: FakeCaches): LoadedSw {
  const script = readFileSync(join(__dirname, "../../src/pkms/web/sw.js"), "utf8");
  const eventHandlers = new Map<string, SwEventHandler>();

  const selfObj = {
    addEventListener: (event: string, handler: SwEventHandler) => {
      eventHandlers.set(event, handler);
    },
    clients: { claim: () => {} },
    skipWaiting: () => {},
  };

  const fn = new Function("self", "caches", script);
  fn(selfObj, cachesApi);

  return { self: { eventHandlers } };
}

describe("sw.js activate handler", () => {
  test("keeps pkms-auth cache and deletes old shell caches", async () => {
    const entries: FakeCacheEntry[] = [
      { key: "pkms-shell-v10", value: new Response("old") },
      { key: "pkms-shell-v12", value: new Response("current") },
      { key: "pkms-auth", value: new Response("token") },
      { key: "other-cache", value: new Response("other") },
    ];

    const { caches, deletedKeys } = makeFakeCachesWithEntries(entries);
    const { self } = loadSwScript(caches);

    const activateHandler = self.eventHandlers.get("activate")!;

    const waitUntilPromise = new Promise<void>((resolve) => {
      activateHandler({ waitUntil: (p: Promise<unknown>) => p.then(() => resolve()) });
    });

    await waitUntilPromise;

    expect(deletedKeys).toContain("pkms-shell-v10");
    expect(deletedKeys).toContain("other-cache");

    expect(deletedKeys).not.toContain("pkms-shell-v12");
    expect(deletedKeys).not.toContain("pkms-auth");
  });

  test("deletes all non-auth caches when no shell cache exists", async () => {
    const entries: FakeCacheEntry[] = [
      { key: "pkms-auth", value: new Response("token") },
      { key: "some-other", value: new Response("other") },
    ];

    const { caches, deletedKeys } = makeFakeCachesWithEntries(entries);
    const { self } = loadSwScript(caches);

    const activateHandler = self.eventHandlers.get("activate")!;

    const waitUntilPromise = new Promise<void>((resolve) => {
      activateHandler({ waitUntil: (p: Promise<unknown>) => p.then(() => resolve()) });
    });

    await waitUntilPromise;

    expect(deletedKeys).toContain("some-other");
    expect(deletedKeys).not.toContain("pkms-auth");
  });
});

describe("sw.js fetch handler", () => {
  test("POST /web/share without token is replayed with stored token", async () => {
    const entries: FakeCacheEntry[] = [{ key: "/__token", value: new Response("my-secret-token") }];

    const { caches } = makeFakeCachesWithEntries(entries);
    const { self } = loadSwScript(caches);

    const fetchHandler = self.eventHandlers.get("fetch")!;
    let respondedWith: Response | null = null;

    const request = new Request("https://example.com/web/share", {
      method: "POST",
      body: "text=hello",
    });

    const respondPromise = new Promise<void>((resolve) => {
      fetchHandler({
        request,
        respondWith: (r: Response) => {
          respondedWith = r;
          resolve();
        },
      });
    });

    await respondPromise;
    expect(respondedWith).not.toBeNull();
  });

  test("POST /web/share with existing token passes through", async () => {
    const entries: FakeCacheEntry[] = [{ key: "/__token", value: new Response("my-secret-token") }];

    const { caches } = makeFakeCachesWithEntries(entries);
    const { self } = loadSwScript(caches);

    const fetchHandler = self.eventHandlers.get("fetch")!;
    let respondedWith: Response | null = null;

    const request = new Request("https://example.com/web/share", {
      method: "POST",
      headers: { "X-Capture-Token": "test-existing-token" },
      body: "text=hello",
    });

    const respondPromise = new Promise<void>((resolve) => {
      fetchHandler({
        request,
        respondWith: (r: Response) => {
          respondedWith = r;
          resolve();
        },
      });
    });

    await respondPromise;
    expect(respondedWith).not.toBeNull();
  });
});
