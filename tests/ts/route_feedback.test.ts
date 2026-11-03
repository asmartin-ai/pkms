import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { emit } from "../../src/pkms/events.ts";
import { runRouter } from "../../src/pkms/route.ts";
import { loadTuning, TuningSchema } from "../../src/pkms/route_rules.ts";
import { readSource, writeSource } from "../../src/pkms/sources.ts";

const roots: string[] = [];

const now = new Date("2026-10-07T12:00:00Z");

const AuditSchema = z.object({
  ts: z.string(),
  key: z.string(),
  value: z.array(z.string()),
  because: z.string(),
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pkms-learning-"));
  roots.push(root);
  const vault = join(root, "vault");
  mkdirSync(vault);
  const tuning = TuningSchema.parse({ email: { route_senders: ["alex@example.test"] } });
  writeFileSync(join(root, "tuning.json"), JSON.stringify(tuning));

  return { root, vault };
}

function source(vault: string, id: string, route: "routed" | "noise" | "hold") {
  return readSource(
    vault,
    writeSource(vault, `Source ${id}`, {
      source: "email",
      source_id: id,
      received_at: now.toISOString(),
      route,
      from: "alex@example.test",
    }),
  );
}

function dismissal(root: string, vault: string, id: string) {
  const note = source(vault, id, "routed");
  emit(root, "dismissed", { source: "email", ref: note.relativePath });
}

function audit(root: string) {
  return readFileSync(join(root, ".ledger", "tuning-changes.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => AuditSchema.parse(JSON.parse(line)));
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("reversible sender learning", () => {
  test("threshold counts distinct dismissed messages and audits both sides of the sender transition", async () => {
    const { root, vault } = fixture();
    dismissal(root, vault, "one");
    dismissal(root, vault, "one");
    dismissal(root, vault, "two");
    await runRouter(root, vault, { now });
    expect(loadTuning(root).email.route_senders).toEqual(["alex@example.test"]);
    expect(loadTuning(root).email.noise_senders).toEqual([]);
    expect(existsSync(join(root, ".ledger", "tuning-changes.jsonl"))).toBe(false);
    dismissal(root, vault, "three");
    await runRouter(root, vault, { now });
    expect(loadTuning(root).email.route_senders).toEqual([]);
    expect(loadTuning(root).email.noise_senders).toEqual(["alex@example.test"]);
    expect(audit(root).map(({ ts, key, value }) => ({ ts, key, value }))).toEqual([
      { ts: now.toISOString(), key: "email.route_senders", value: [] },
      { ts: now.toISOString(), key: "email.noise_senders", value: ["alex@example.test"] },
    ]);
    expect(audit(root)[1]!.because).toContain("3 distinct emails");
    const before = readFileSync(join(root, ".ledger", "tuning-changes.jsonl"), "utf8");
    await runRouter(root, vault, { now });
    expect(readFileSync(join(root, ".ledger", "tuning-changes.jsonl"), "utf8")).toBe(before);
  });

  test("newer noise retrieval beats old dismissals; later manual reversal is not overwritten by replay", async () => {
    const { root, vault } = fixture();

    for (const id of ["one", "two", "three"]) dismissal(root, vault, id);
    await runRouter(root, vault, { now });
    const recovered = source(vault, "retrieved", "noise");
    emit(root, "dug_out", {
      source: "email",
      ref: recovered.relativePath,
      payload: { route: "noise" },
    });
    await runRouter(root, vault, { now });
    expect(loadTuning(root).email.route_senders).toEqual(["alex@example.test"]);
    expect(loadTuning(root).email.noise_senders).toEqual([]);
    expect(
      audit(root)
        .slice(2)
        .map(({ key, value }) => ({ key, value })),
    ).toEqual([
      { key: "email.noise_senders", value: [] },
      { key: "email.route_senders", value: ["alex@example.test"] },
    ]);
    await runRouter(root, vault, { now });
    expect(loadTuning(root).email.route_senders).toEqual(["alex@example.test"]);
    const tuning = loadTuning(root);
    tuning.email.route_senders = [];
    tuning.email.noise_senders = ["alex@example.test"];
    writeFileSync(join(root, "tuning.json"), JSON.stringify(tuning));
    const before = readFileSync(join(root, ".ledger", "tuning-changes.jsonl"), "utf8");
    await runRouter(root, vault, { now });
    expect(loadTuning(root).email.noise_senders).toEqual(["alex@example.test"]);
    expect(loadTuning(root).email.route_senders).toEqual([]);
    expect(readFileSync(join(root, ".ledger", "tuning-changes.jsonl"), "utf8")).toBe(before);
  });

  test("a noise retrieval resets the dismissal threshold; browsing held sources does not train routing", async () => {
    const { root, vault } = fixture();

    for (const id of ["one", "two", "three"]) dismissal(root, vault, id);
    await runRouter(root, vault, { now });
    const held = source(vault, "held", "hold");
    emit(root, "dug_out", { source: "email", ref: held.relativePath, payload: { route: "hold" } });
    await runRouter(root, vault, { now });
    expect(loadTuning(root).email.noise_senders).toEqual(["alex@example.test"]);
    const recovered = source(vault, "recovered", "noise");
    emit(root, "dug_out", {
      source: "email",
      ref: recovered.relativePath,
      payload: { route: "noise" },
    });
    await runRouter(root, vault, { now });
    dismissal(root, vault, "four");
    dismissal(root, vault, "five");
    await runRouter(root, vault, { now });
    expect(loadTuning(root).email.route_senders).toEqual(["alex@example.test"]);
    dismissal(root, vault, "six");
    await runRouter(root, vault, { now });
    expect(loadTuning(root).email.route_senders).toEqual([]);
    expect(loadTuning(root).email.noise_senders).toEqual(["alex@example.test"]);
  });
});
