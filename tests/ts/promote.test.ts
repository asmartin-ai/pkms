import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, basename } from "node:path";
import {
  extractPostId,
  renderNote,
  receivePromotion,
  type PromotionHandoff,
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

  function withThread(fn: (thread: Thread) => void): void {
    fn(threadFixture());
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

  test("both destinations stay distinct and reading survives rebuilding the index", () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const indexDir = join(root, ".index");

    try {
      const inbox = receivePromotion(handoff("inbox"), vault, indexDir);
      const reading = receivePromotion(handoff("reading"), vault, indexDir);
      expect(inbox.state).toBe("confirmed");
      expect(reading.state).toBe("confirmed");
      expect(inbox.note_path).not.toBe(reading.note_path);
      expect(readFileSync(join(vault, reading.note_path!), "utf8")).toContain(
        "Spaced repetition changed everything",
      );
      expect(todayView(vault, indexDir).next_read?.title).toBe(threadFixture().title!);
      rmSync(indexDir, { recursive: true, force: true });
      expect(receivePromotion(handoff("reading"), vault, indexDir)).toEqual({
        ...reading,
        state: "duplicate",
      });
      expect(readdirSync(join(vault, "resources", "reading"))).toEqual([
        basename(reading.note_path!),
      ]);
      const path = join(vault, reading.note_path!);
      writeFileSync(path, readFileSync(path, "utf8").replace("reading: queued", "reading: done"));
      expect(todayView(vault, indexDir).next_read).toBeNull();
    } finally {
      rmTmp(root);
    }
  });

  test("legacy reading notes are recovered without duplication", () => {
    const root = mkTmp();
    const vault = join(root, "vault");

    try {
      const directory = join(vault, "resources", "reading");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "old-note.md"), renderNote(threadFixture()).note);
      const result = receivePromotion(handoff("reading"), vault, join(root, ".index"));
      expect(result.state).toBe("duplicate");
      expect(result.note_path).toBe("resources/reading/old-note.md");
      expect(readdirSync(directory)).toEqual(["old-note.md"]);
    } finally {
      rmTmp(root);
    }
  });

  test("an occupied deterministic path is never overwritten or followed for writing", () => {
    const root = mkTmp();
    const vault = join(root, "vault");
    const directory = join(vault, "resources", "reading");
    mkdirSync(directory, { recursive: true });
    const destination = join(directory, `ch-${"b".repeat(64)}.md`);
    const outside = join(root, "untouched.md");

    try {
      symlinkSync(outside, destination);
      expect(() => receivePromotion(handoff("reading"), vault, join(root, ".index"))).toThrow();
      expect(existsSync(outside)).toBe(false);
      rmSync(destination);
      writeFileSync(destination, "An unrelated existing note");
      expect(() => receivePromotion(handoff("reading"), vault, join(root, ".index"))).toThrow();
      expect(readFileSync(destination, "utf8")).toBe("An unrelated existing note");
    } finally {
      rmTmp(root);
    }
  });
});

function threadFixture(): Thread {
  return {
    id: "abc123",
    title: "How do you actually retain what you read?",
    author: "reader",
    url: "https://www.reddit.com/r/PKMS/comments/abc123/how/",
    permalink: "https://www.reddit.com/r/PKMS/comments/abc123/how/",
    subreddit: "PKMS",
    created_utc: 1700000000,
    saved_utc: 1700000001,
    thread_json: THREAD_JSON,
  };
}

function handoff(destination: "inbox" | "reading"): PromotionHandoff {
  return {
    version: 1,
    delivery_id: (destination === "inbox" ? "a" : "b").repeat(64),
    destination,
    ch_item_id: "ext_ch_fixture",
    ch_origin_ref: "content-hoarder:fullname:reddit:t3_abc123",
    ch_captured_at: "2026-01-01T00:00:00Z",
    text: "Synthetic reading capture",
    context: { device: "desktop", app: "content-hoarder" },
    thread: destination === "reading" ? threadFixture() : undefined,
  };
}
