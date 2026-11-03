import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  connectHoarder,
  extractPostId,
  fetchThread,
  promote,
  renderNote,
  searchThreads,
  writeNote,
  type JsonValue,
  type Thread,
} from "../../src/pkms/promote.ts";
import { todayView } from "../../src/pkms/today.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

function comment(
  author: string,
  body: string,
  score: number,
  replies?: JsonValue[],
  kind = "t1",
): JsonValue {
  const data = new Map<string, JsonValue>([
    ["author", author],
    ["body", body],
    ["score", score],
  ]);

  if (replies && replies.length > 0) {
    data.set("replies", { kind: "Listing", data: { children: replies } });
  }

  return {
    kind,
    data: Object.fromEntries(data),
  };
}

const THREAD_JSON = [
  {
    kind: "Listing",
    data: {
      children: [
        {
          kind: "t3",
          data: {
            title: "How do you actually retain what you read?",
            selftext: "I save everything and read nothing. ".repeat(10),
            score: 412,
          },
        },
      ],
    },
  },
  {
    kind: "Listing",
    data: {
      children: [
        comment("lowvoter", "early but mediocre take", 3),
        comment(
          "topvoter",
          "Spaced repetition changed everything for me.\n\nSecond paragraph.",
          250,
          [
            comment("replier", "Agreed — and write summaries.", 90, [
              comment("[deleted]", "[deleted]", 5),
              comment("deep1", "level 3", 4, [
                comment("deep2", "level 4", 3, [
                  comment("deep3", "level 5 at MAX_DEPTH", 2, [
                    comment("deep4", "abyss level — collapsed", 1),
                  ]),
                ]),
              ]),
            ]),
          ],
        ),
        { kind: "more", data: { count: 17 } },
      ],
    },
  },
] satisfies JsonValue[];

function makeHoarderDb(tmp: string): string {
  const db = join(tmp, "app.db");
  const conn = new Database(db);
  conn.exec(`
    CREATE TABLE items (fullname TEXT, source TEXT, kind TEXT, title TEXT,
      url TEXT, author TEXT, created_utc INTEGER, saved_utc INTEGER,
      search_text TEXT, metadata TEXT);
    CREATE TABLE reddit_threads (fullname TEXT, thread_json TEXT, hydrated_at INTEGER);
  `);

  const meta = JSON.stringify({
    subreddit: "PKMS",
    permalink: "https://www.reddit.com/r/PKMS/comments/abc123/how/",
  });

  conn
    .query("INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(
      "reddit:t3_abc123",
      "reddit",
      "post",
      "How do you actually retain what you read?",
      "https://www.reddit.com/r/PKMS/comments/abc123/how/",
      "asker",
      1686300000,
      1686400000,
      "retain read spaced repetition",
      meta,
    );
  conn
    .query("INSERT INTO reddit_threads VALUES (?,?,?)")
    .run("reddit:t3_abc123", JSON.stringify(THREAD_JSON), 1780000000);
  conn
    .query("INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(
      "reddit:t3_zzz999",
      "reddit",
      "post",
      "Unhydrated post about reading",
      "u",
      "a",
      1,
      2,
      "reading",
      "{}",
    );
  conn.close();

  return db;
}

describe("promote (ports src/pkms/promote.py)", () => {
  const ID_VARIANTS = [
    "https://www.reddit.com/r/PKMS/comments/abc123/how_do_you/",
    "https://reddit.com/comments/abc123",
    "https://redd.it/abc123",
    "t3_abc123",
    "abc123",
  ];

  for (const q of ID_VARIANTS) {
    test(`extract_post_id: ${q}`, () => {
      expect(extractPostId(q)).toBe("abc123");
    });
  }

  test("search terms are not ids", () => {
    expect(extractPostId("spaced repetition notes")).toBeNull();
  });

  test("hoarder connection is read only", () => {
    const tmp = mkTmp();

    try {
      const db = makeHoarderDb(tmp);
      const conn = connectHoarder(db);

      try {
        expect(() => conn.run("INSERT INTO reddit_threads VALUES ('x','[]',0)")).toThrow();
      } finally {
        conn.close();
      }
    } finally {
      rmTmp(tmp);
    }
  });

  test.skipIf(process.platform !== "win32")("read-only open handles windows extended paths", () => {
    const tmp = mkTmp();

    try {
      const db = makeHoarderDb(tmp);
      const conn = connectHoarder(`\\\\?\\${db}`);

      try {
        expect(fetchThread(conn, "abc123")).not.toBeNull();
      } finally {
        conn.close();
      }
    } finally {
      rmTmp(tmp);
    }
  });

  test("search only returns hydrated", () => {
    const tmp = mkTmp();

    try {
      const db = makeHoarderDb(tmp);
      const conn = connectHoarder(db);
      const hits = searchThreads(conn, "read");
      conn.close();
      const ids = hits.map((h) => h.id);
      expect(ids).toContain("abc123");
      expect(ids).not.toContain("zzz999");
    } finally {
      rmTmp(tmp);
    }
  });

  function withThread(fn: (thread: Thread) => void): void {
    const tmp = mkTmp();

    try {
      const db = makeHoarderDb(tmp);
      const conn = connectHoarder(db);
      const t = fetchThread(conn, "abc123");
      conn.close();
      expect(t).not.toBeNull();
      fn(t!);
    } finally {
      rmTmp(tmp);
    }
  }

  test("render frontmatter and provenance", () => {
    withThread((thread) => {
      const { note, minutes } = renderNote(thread);
      expect(note).toContain('title: "How do you actually retain what you read?"');
      expect(note).toContain("reading: queued");
      expect(note).toContain(`reading_minutes: ${minutes}`);
      expect(note).toContain("source: https://www.reddit.com/r/PKMS/comments/abc123/how/");
      expect(note).toContain("subreddit: PKMS");
      expect(minutes).toBeGreaterThanOrEqual(1);
    });
  });

  test("render orders comments by score", () => {
    withThread((thread) => {
      const { note } = renderNote(thread);
      expect(note.indexOf("topvoter")).toBeLessThan(note.indexOf("lowvoter"));
    });
  });

  test("render keeps pts on integer scores", () => {
    withThread((thread) => {
      const { note } = renderNote(thread);
      expect(note).toContain("250 pts");
      expect(note).toContain("3 pts");
    });
  });

  test("render nests replies and collapses deep ones", () => {
    withThread((thread) => {
      const { note } = renderNote(thread);
      expect(note).toContain("> **u/replier**");
      expect(note).toContain("level 5 at MAX_DEPTH");
      expect(note).not.toContain("abyss level");
      expect(note).toContain("full thread");
      expect(extractPostId("retain")).toBeNull();
    });
  });

  test("render skips deleted but keeps descendants", () => {
    withThread((thread) => {
      const { note } = renderNote(thread);
      expect(note).not.toContain("[deleted]");
      expect(note).toContain("level 3");
    });
  });

  test("promote url writes queued note", () => {
    const tmp = mkTmp();

    try {
      const db = makeHoarderDb(tmp);
      const vault = join(tmp, "vault");
      const result = promote("https://redd.it/abc123", vault, db);
      const path = result.note!;
      expect(dirname(path)).toBe(join(vault, "resources", "reading"));
      const text = readFileSync(path, "utf8");
      expect(text).toContain("Spaced repetition changed everything");
      const again = promote("abc123", vault, db);
      expect(again.note).not.toBe(path);
    } finally {
      rmTmp(tmp);
    }
  });

  test("promote search returns candidates", () => {
    const tmp = mkTmp();

    try {
      const db = makeHoarderDb(tmp);
      const result = promote("retain", join(tmp, "vault"), db);
      expect(result.candidates?.[0]?.id).toBe("abc123");
    } finally {
      rmTmp(tmp);
    }
  });

  test("promote unhoarded id reports missing", () => {
    const tmp = mkTmp();

    try {
      const db = makeHoarderDb(tmp);
      const result = promote("https://redd.it/nope777", join(tmp, "vault"), db);
      expect(result).toEqual({ missing: "nope777" });
    } finally {
      rmTmp(tmp);
    }
  });

  test("today shows oldest queued read", () => {
    const tmp = mkTmp();
    const indexDir = mkTmp();

    try {
      const db = makeHoarderDb(tmp);
      const vault = join(tmp, "vault");
      promote("abc123", vault, db);
      const view = todayView(vault, indexDir);
      expect(view.next_read?.title).toBe("How do you actually retain what you read?");
      expect(Number(view.next_read?.minutes)).toBeGreaterThanOrEqual(1);
    } finally {
      rmTmp(tmp, indexDir);
    }
  });

  test("today queue empties when marked read", () => {
    const tmp = mkTmp();
    const indexDir = mkTmp();

    try {
      const db = makeHoarderDb(tmp);
      const vault = join(tmp, "vault");
      const path = promote("abc123", vault, db).note!;
      writeFileSync(
        path,
        readFileSync(path, "utf8").replace("reading: queued", "reading: done"),
        "utf8",
      );
      expect(todayView(vault, indexDir).next_read).toBeNull();
    } finally {
      rmTmp(tmp, indexDir);
    }
  });
});

describe("write_note collision safety (C4)", () => {
  const READING = join("resources", "reading");

  test("a pre-existing note at the winning path is never overwritten", () => {
    const vault = mkTmp();

    try {
      mkdirSync(join(vault, READING), { recursive: true });
      const first = join(vault, READING, "same-title.md");

      writeFileSync(first, "first writer", "utf8");

      const second = writeNote("second writer", "Same Title", vault);

      expect(second).toBe(join(vault, READING, "same-title-2.md"));
      expect(readFileSync(first, "utf8")).toBe("first writer");
      expect(readFileSync(second, "utf8")).toBe("second writer");
    } finally {
      rmTmp(vault);
    }
  });

  test("a dangling symlink cannot squat the promoted note's path", () => {
    const outside = mkTmp();
    const vault = mkTmp();

    try {
      mkdirSync(join(vault, READING), { recursive: true });
      symlinkSync(join(outside, "victim.md"), join(vault, READING, "same-title.md"));

      const path = writeNote("body", "Same Title", vault);

      expect(path).toBe(join(vault, READING, "same-title-2.md"));
      expect(existsSync(join(outside, "victim.md"))).toBe(false);
    } finally {
      rmTmp(vault, outside);
    }
  });
});
