import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SQLQueryBindings } from "bun:sqlite";
import { writeCapture } from "../../src/pkms/capture.ts";
import { connect } from "../../src/pkms/db.ts";
import { ensureDaily } from "../../src/pkms/daily.ts";
import { indexVault } from "../../src/pkms/indexer.ts";
import { todayView } from "../../src/pkms/today.ts";
import { isoLocalDate } from "../../src/pkms/tasks.ts";
import { makeVault, mkTmp, rmTmp, writeNote } from "./helpers.ts";

describe("today_view", () => {
  test("breadcrumb tails last daily note", () => {
    const { vault, indexDir } = makeVault();

    try {
      const view = todayView(vault, indexDir);
      const crumb = view.breadcrumb!;
      expect(crumb.name).toBe("2026-06-01");
      expect(crumb.lines).toContain("Plain daily note, no frontmatter at all.");
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("breadcrumb skips frontmatter and headings", () => {
    const { vault, indexDir } = makeVault();

    try {
      writeNote(
        join(vault, "daily", "2026-06-02.md"),
        "# 2026-06-02\n\nworked on the capture slice\nstopped at the token tests\n",
        { title: "2026-06-02" },
      );
      const crumb = todayView(vault, indexDir).breadcrumb!;
      expect(crumb.name).toBe("2026-06-02");
      expect(crumb.lines).toEqual(["worked on the capture slice", "stopped at the token tests"]);

      for (const ln of crumb.lines) {
        expect(ln).not.toContain("---");
        expect(ln.startsWith("#")).toBe(false);
      }
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("breadcrumb prefers section content including today", () => {
    const { vault, indexDir } = makeVault();

    try {
      const [path] = ensureDaily(vault);
      const text = readFileSync(path, "utf8");
      writeFileSync(
        path,
        text.replace(
          "<!-- where you left off — /resume keeps this current -->",
          "stopped at the fold skill\n▶ run /fold on the inbox",
        ),
        "utf8",
      );
      const crumb = todayView(vault, indexDir).breadcrumb!;
      expect(crumb.name).toBe(isoLocalDate(new Date()));
      expect(crumb.lines).toEqual(["stopped at the fold skill", "▶ run /fold on the inbox"]);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("breadcrumb empty section falls back to legacy tail", () => {
    const { vault, indexDir } = makeVault();

    try {
      ensureDaily(vault);
      const crumb = todayView(vault, indexDir).breadcrumb!;
      expect(crumb.name).toBe("2026-06-01");
      expect(crumb.lines).toContain("Plain daily note, no frontmatter at all.");
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("one next action per note, projects first", () => {
    const { vault, indexDir } = makeVault();

    try {
      indexVault(vault, indexDir);
      const actions = todayView(vault, indexDir).next_actions;
      const notes = actions.map((a) => a.note);
      expect(new Set(notes).size).toBe(notes.length);
      expect(notes[0]!.startsWith("projects")).toBe(true);
      const alpha = actions.find((a) => a.note === "projects/alpha.md")!;
      expect(alpha.text).toBe("open task one");
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("inbox tasks stay out of next actions", () => {
    const { vault, indexDir } = makeVault();

    try {
      writeCapture("- [ ] raw unfolded task", vault, { source: "cli" });
      indexVault(vault, indexDir);
      const actions = todayView(vault, indexDir).next_actions;

      for (const a of actions) expect(a.note.startsWith("inbox")).toBe(false);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("today view without index degrades gracefully", () => {
    const { vault, indexDir } = makeVault();

    try {
      const view = todayView(vault, indexDir);
      expect(view.next_actions).toEqual([]);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("next actions use titles and strip wikilinks", () => {
    const { vault, indexDir } = makeVault();

    try {
      writeNote(
        join(vault, "projects", "zeta.md"),
        "- [ ] read [[11-hn]] and [[12-reddit|the reddit note]] tonight\n",
        { title: "Zeta Project" },
      );
      indexVault(vault, indexDir);
      const actions = todayView(vault, indexDir).next_actions;
      const zeta = actions.find((a) => a.note === "projects/zeta.md")!;
      expect(zeta.title).toBe("Zeta Project");
      expect(zeta.text).toBe("read 11-hn and the reddit note tonight");
      expect(zeta.text).not.toContain("[[");
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  function snoozerVault(): { vault: string; indexDir: string } {
    const fx = makeVault();
    writeNote(join(fx.vault, "projects", "snoozer.md"), "- [~] parked for later, not now\n", {
      title: "Snoozer Project",
    });
    indexVault(fx.vault, fx.indexDir);

    return fx;
  }

  test("today view reports snoozed section by default", () => {
    const { vault, indexDir } = snoozerVault();

    try {
      const view = todayView(vault, indexDir);
      const snoozed = new Set(view.snoozed.map((s) => s.note));
      expect(snoozed).toEqual(new Set(["projects/snoozer.md"]));
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("today view hides snoozed section when flagged", () => {
    const { vault, indexDir } = snoozerVault();

    try {
      const view = todayView(vault, indexDir, { hideSnoozed: true });
      expect(view.snoozed).toEqual([]);
      expect(view.next_actions).toBeDefined();
      expect("breadcrumb" in view).toBe(true);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  function oneOldCandidate() {
    const root = mkTmp();
    const vault = join(root, "vault");
    writeNote(join(vault, "resources", "old-idea.md"), "An old idea worth revisiting one day.\n", {
      title: "Old Idea",
      created: "2026-01-01",
    });
    const indexDir = join(root, ".index");
    indexVault(vault, indexDir);

    return { vault, indexDir };
  }

  function offerRows(indexDir: string): { path: string; offer_count: number }[] {
    const db = connect(indexDir);

    try {
      return db
        .query<{ path: string; offer_count: number }, SQLQueryBindings[]>(
          "SELECT path, offer_count FROM resurface_offers",
        )
        .all();
    } finally {
      db.close();
    }
  }

  test("reading today view does not record an offer", () => {
    const { vault, indexDir } = oneOldCandidate();

    try {
      const card = todayView(vault, indexDir).resurface;
      expect(card).not.toBeNull();
      todayView(vault, indexDir);

      const rows = offerRows(indexDir);
      expect(rows.every((r) => r.offer_count === 0)).toBe(true);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("interactive open records exactly one offer", () => {
    const { vault, indexDir } = oneOldCandidate();

    try {
      todayView(vault, indexDir, { recordOffer: true });

      const rows = offerRows(indexDir);
      expect(rows.length).toBe(1);
      expect(rows[0]!.offer_count).toBe(1);
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("today view rations exactly one card", () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    writeNote(
      join(vault, "projects", "active.md"),
      "Working here, references [[old-gold]] often.\n",
      {
        title: "Active Project",
        created: "2026-06-10",
      },
    );
    writeNote(join(vault, "resources", "old-gold.md"), "An old idea worth revisiting one day.\n", {
      title: "Old Gold",
      created: "2026-01-15",
    });
    const indexDir = join(root, ".index");
    indexVault(vault, indexDir);

    try {
      const view = todayView(vault, indexDir);
      const card = view.resurface;
      expect(card).not.toBeNull();
      expect(card!.why).toBeTruthy();
    } finally {
      rmTmp(vault, indexDir);
    }
  });

  test("one unreadable reading note does not break the today view", () => {
    const { vault, indexDir } = makeVault();

    try {
      mkdirSync(join(vault, "resources", "reading"), { recursive: true });
      writeFileSync(
        join(vault, "resources", "reading", "bad.md"),
        "---\ntitle: [unclosed\n---\n\nbody\n",
        "utf8",
      );
      writeFileSync(
        join(vault, "resources", "reading", "queued.md"),
        "---\ntitle: Queued Thread\nreading: queued\npromoted: 2026-06-01\n---\n\nA queued thread\n",
        "utf8",
      );

      const view = todayView(vault, indexDir);

      expect(view.next_read).not.toBeNull();
      expect(view.next_read!.title).toBe("Queued Thread");
    } finally {
      rmTmp(vault, indexDir);
    }
  });
});
