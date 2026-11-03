import { describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { makeServer } from "../../src/pkms/capture_service.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const TOKEN = "test-token-123";

function boot() {
  const root = mkdtempSync(join(tmpdir(), "pkms-share-origin-"));
  const vault = join(root, "vault");
  const indexDir = join(root, ".index");
  mkdirSync(join(vault, "inbox"), { recursive: true });

  const app = makeServer({
    vault,
    indexDir,
    host: "127.0.0.1",
    port: 0,
    token: TOKEN,
    pullKeep: async () => {},
    openNoteFile: () => {},
  });

  return {
    base: `http://127.0.0.1:${app.port}`,
    inbox: join(vault, "inbox"),
    stop: () => app.stop(true),
  };
}

function shareForm(): FormData {
  const form = new FormData();
  form.set("text", "regression share");

  return form;
}

describe("share target origin gating", () => {
  test("a cross-origin form post with a valid token is rejected and writes nothing", async () => {
    const { base, inbox, stop } = boot();

    try {
      const r = await fetch(`${base}/web/share?token=${TOKEN}`, {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
        body: shareForm(),
        redirect: "manual",
      });

      expect(r.status).toBe(403);
      expect(readdirSync(inbox).filter((f) => f.endsWith(".md"))).toHaveLength(0);
    } finally {
      stop();
    }
  });

  test("a same-origin form post with a valid token still saves", async () => {
    const { base, inbox, stop } = boot();

    try {
      const r = await fetch(`${base}/web/share?token=${TOKEN}`, {
        method: "POST",
        headers: { Origin: base },
        body: shareForm(),
        redirect: "manual",
      });

      expect(r.status).toBe(303);
      expect(readdirSync(inbox).filter((f) => f.endsWith(".md"))).toHaveLength(1);
    } finally {
      stop();
    }
  });

  test("an OS share (no Origin header) with a valid token still saves", async () => {
    const { base, inbox, stop } = boot();

    try {
      const r = await fetch(`${base}/web/share?token=${TOKEN}`, {
        method: "POST",
        body: shareForm(),
        redirect: "manual",
      });

      expect(r.status).toBe(303);
      expect(readdirSync(inbox).filter((f) => f.endsWith(".md"))).toHaveLength(1);
    } finally {
      stop();
    }
  });
});
