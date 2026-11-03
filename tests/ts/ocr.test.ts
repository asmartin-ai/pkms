import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkTmp, rmTmp } from "./helpers.ts";
import { OCR_TIMEOUT_MS, extractText } from "../../src/pkms/ocr.ts";
import type { SpawnFn } from "../../src/pkms/ocr.ts";

const FAKE_EXE = "C:\\fake\\tesseract.exe";

const IMAGE = "nonexistent.png";

const enc = new TextEncoder();

describe("extractText", () => {
  test("returns null when the OCR executable cannot launch", async () => {
    const boom: SpawnFn = () => {
      throw new Error("ENOENT: executable not found");
    };

    expect(await extractText(IMAGE, { exe: FAKE_EXE, spawn: boom })).toBeNull();
  });

  test("returns an empty string when OCR runs without readable text", async () => {
    const ran: SpawnFn = () => Promise.resolve({ exitCode: 1, stdout: enc.encode("garbage") });

    expect(await extractText(IMAGE, { exe: FAKE_EXE, spawn: ran })).toBe("");
  });

  test("trims successful OCR output", async () => {
    const ok: SpawnFn = () =>
      Promise.resolve({ exitCode: 0, stdout: enc.encode("  hello world \n") });

    expect(await extractText(IMAGE, { exe: FAKE_EXE, spawn: ok })).toBe("hello world");
  });

  test("the kill timeout reaches the runner and defaults to OCR_TIMEOUT_MS", async () => {
    let seen: number | undefined;

    const runner: SpawnFn = (_cmd, timeoutMs) => {
      seen = timeoutMs;

      return Promise.resolve({ exitCode: 0, stdout: enc.encode("ok") });
    };

    await extractText(IMAGE, { exe: FAKE_EXE, spawn: runner });
    expect(seen).toBe(OCR_TIMEOUT_MS);
    await extractText(IMAGE, { exe: FAKE_EXE, spawn: runner, timeoutMs: 5 });
    expect(seen).toBe(5);
  });

  test("a hung engine resolves to null at the timeout", async () => {
    const start = Date.now();
    const gate = Promise.withResolvers<{ exitCode: number; stdout: Uint8Array }>();
    let killAfter: number | undefined;

    const hang: SpawnFn = (_cmd, timeoutMs) => {
      killAfter = timeoutMs;

      return gate.promise;
    };

    const call = extractText(IMAGE, { exe: FAKE_EXE, spawn: hang, timeoutMs: 50 });

    expect(await call).toBeNull();
    expect(killAfter).toBe(50);
    expect(Date.now() - start).toBeLessThan(3000);

    gate.resolve({ exitCode: 0, stdout: enc.encode("late") });

    expect(await call).toBeNull();
  });

  test("a runner failure at the timeout resolves to null", async () => {
    const start = Date.now();
    const gate = Promise.withResolvers<{ exitCode: number; stdout: Uint8Array }>();

    const rejectAt: SpawnFn = (_cmd, timeoutMs) => {
      setTimeout(() => gate.reject(new Error("signal: killed")), timeoutMs);

      return gate.promise;
    };

    const call = extractText(IMAGE, { exe: FAKE_EXE, spawn: rejectAt, timeoutMs: 50 });

    expect(await call).toBeNull();
    expect(Date.now() - start).toBeLessThan(3000);
  });

  test("the real runner kills a hung child and resolves to null", async () => {
    const dir = mkTmp();
    const image = join(dir, "hang.js");

    writeFileSync(image, "setTimeout(() => {}, 60000);", "utf8");

    const start = Date.now();

    expect(await extractText(image, { exe: process.execPath, timeoutMs: 150 })).toBeNull();

    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(3000);

    rmTmp(dir);
  });
});
