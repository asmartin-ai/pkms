import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { connect } from "../../src/pkms/db.ts";
import { indexVault } from "../../src/pkms/indexer.ts";
import { migrateOperational } from "../../src/pkms/migrate_operational.ts";
import { operationalDir } from "../../src/pkms/operational.ts";
import { candidates, dismiss } from "../../src/pkms/resurface.ts";
import { extractTasks, staleTasks } from "../../src/pkms/tasks.ts";
import { completedKeepIds } from "../../src/pkms/keep_ingest.ts";
import { mkTmp, rmTmp, writeNote } from "./helpers.ts";

const legacySchema = `
CREATE TABLE task_seen (note_path TEXT NOT NULL, hash TEXT NOT NULL, first_seen TEXT NOT NULL, PRIMARY KEY(note_path, hash));
CREATE TABLE resurface_offers (path TEXT PRIMARY KEY, offer_count INTEGER NOT NULL DEFAULT 0, rest_until TEXT NOT NULL DEFAULT '');
CREATE TABLE keep_completed (id TEXT PRIMARY KEY, completed_at TEXT NOT NULL);
`;

const legacyFiles = {
  "ch-promote-ledger.txt": "ext_ch_123\n",
  "discord-ledger.txt": "discord-1\n",
  "whatsapp-ledger.txt": "message-1\n",
  "whatsapp-cursor.txt": "2026-01-01T00:00:00Z\n",
  "whatsapp-instinct-notes.txt": "2026-01-01 note.md\n",
  "keep-ledger.txt": "keep-1\n",
  "keep-takeout-ledger.txt": "takeout-1\n",
  "keep-state.json": '{"keep_version":"cursor-1"}',
  "keep-sweep.json": '{"swept":{"keep-1":"2026-01-01"}}',
};

function fixture() {
  const root = mkTmp();
  const indexDir = join(root, ".index");
  const vault = join(root, "vault");
  mkdirSync(indexDir);
  const body = "An old idea.\n\n- [ ] Preserve the original task clock\n";
  writeNote(join(vault, "resources", "old.md"), body, { title: "Old idea", created: "2025-01-01" });
  const old = new Database(join(indexDir, "pkms.db"));
  old.exec(legacySchema);
  old
    .query("INSERT INTO task_seen VALUES (?,?,?)")
    .run("resources/old.md", extractTasks(body)[0]!.hash, "2025-01-02");
  old.query("INSERT INTO keep_completed VALUES (?,?)").run("keep-1", "2025-01-03");
  old.query("INSERT INTO resurface_offers VALUES (?,?,?)").run("resources/old.md", 2, "2027-01-01");
  old.close();

  for (const [name, text] of Object.entries(legacyFiles)) writeFileSync(join(indexDir, name), text);

  return { root, indexDir, vault };
}

function snapshot(root: string) {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .sort()
    .map((name) => {
      const path = join(root, name);

      return [name, statSync(path).isFile() ? readFileSync(path).toString("hex") : "directory"];
    });
}

test("inspection never changes files or database bytes, and normal startup refuses legacy state", () => {
  const { root, indexDir } = fixture();

  try {
    const before = snapshot(root);
    const report = migrateOperational(indexDir);
    expect(report.applied).toBe(false);
    expect(report.rows).toEqual({ task_seen: 1, resurface_offers: 1, keep_completed: 1 });
    expect(snapshot(root)).toEqual(before);
    expect(() => connect(indexDir)).toThrow("migrate-durable-state");
    expect(() => operationalDir(indexDir)).toThrow("migrate-durable-state");
  } finally {
    rmTmp(root);
  }
});

test("migrated operational state survives deleting and rebuilding the index", () => {
  const { root, indexDir, vault } = fixture();

  try {
    expect(migrateOperational(indexDir, { apply: true }).conflicts).toEqual([]);
    rmSync(indexDir, { recursive: true });
    indexVault(vault, indexDir);
    const database = connect(indexDir);

    try {
      const today = new Date(2026, 0, 10);
      expect(candidates(database, { today })).toEqual([]);
      expect(staleTasks(database, { today })[0]?.first_seen).toBe("2025-01-02");
    } finally {
      database.close();
    }

    expect(completedKeepIds(indexDir)).toEqual(new Set(["keep-1"]));

    for (const [name, text] of Object.entries(legacyFiles)) {
      expect(readFileSync(join(operationalDir(indexDir), name), "utf8")).toBe(text);
    }

    expect(migrateOperational(indexDir, { apply: true }).rows).toEqual({
      task_seen: 0,
      resurface_offers: 0,
      keep_completed: 0,
    });
  } finally {
    rmTmp(root);
  }
});

test("a newly dismissed note stays hidden after rebuilding a fresh index", () => {
  const root = mkTmp();
  const vault = join(root, "vault");
  const indexDir = join(root, ".index");
  const today = new Date(2026, 0, 10);

  try {
    writeNote(join(vault, "resources", "idea.md"), "An old idea", {
      title: "Idea",
      created: "2025-01-01",
    });
    indexVault(vault, indexDir);
    const first = connect(indexDir);

    try {
      expect(candidates(first, { today }).map((note) => note.path)).toEqual(["resources/idea.md"]);
      dismiss(first, "resources/idea.md", { today });
    } finally {
      first.close();
    }

    rmSync(indexDir, { recursive: true });
    indexVault(vault, indexDir);
    const rebuilt = connect(indexDir);

    try {
      expect(candidates(rebuilt, { today })).toEqual([]);
    } finally {
      rebuilt.close();
    }
  } finally {
    rmTmp(root);
  }
});

test("matching copies from an interrupted migration resume without duplication", () => {
  const { root, indexDir } = fixture();

  try {
    const directory = join(root, ".ledger");
    mkdirSync(directory);
    copyFileSync(join(indexDir, "ch-promote-ledger.txt"), join(directory, "ch-promote-ledger.txt"));
    expect(migrateOperational(indexDir, { apply: true }).applied).toBe(true);
    expect(migrateOperational(indexDir, { apply: true }).conflicts).toEqual([]);
    const database = connect(indexDir);

    try {
      expect(
        database.query("SELECT id, completed_at, source, pinned FROM keep_completed").all(),
      ).toEqual([{ id: "keep-1", completed_at: "2025-01-03", source: "live", pinned: 0 }]);
    } finally {
      database.close();
    }
  } finally {
    rmTmp(root);
  }
});

test("file conflicts abort before any record is moved or overwritten", () => {
  const { root, indexDir } = fixture();

  try {
    mkdirSync(join(root, ".ledger"));
    writeFileSync(join(root, ".ledger", "whatsapp-cursor.txt"), "different cursor\n");
    const before = snapshot(root);
    expect(migrateOperational(indexDir, { apply: true }).conflicts).toEqual([
      "whatsapp-cursor.txt",
    ]);
    expect(snapshot(root)).toEqual(before);
  } finally {
    rmTmp(root);
  }
});

test("conflicting database rows are never silently ignored", () => {
  const { root, indexDir } = fixture();

  try {
    mkdirSync(join(root, ".ledger"));
    const destination = new Database(join(root, ".ledger", "state.db"));
    destination.exec(
      "CREATE TABLE resurface_offers(path TEXT PRIMARY KEY, offer_count INTEGER NOT NULL, rest_until TEXT NOT NULL)",
    );
    destination
      .query("INSERT INTO resurface_offers VALUES (?,?,?)")
      .run("resources/old.md", 9, "2099-01-01");
    destination.close();
    const before = snapshot(root);
    expect(migrateOperational(indexDir, { apply: true }).conflicts).toEqual(["resurface_offers"]);
    expect(snapshot(root)).toEqual(before);
  } finally {
    rmTmp(root);
  }
});
