import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isoLocalDate } from "../../src/pkms/tasks.ts";
import { indexVault } from "../../src/pkms/indexer.ts";
import {
  renderToday,
  renderReadingQueue,
  renderActions,
  renderSearchResults,
  renderRecentNotes,
  renderResurfaceCellToday,
} from "../../src/pkms/web_shell.ts";
import type { TodayView } from "../../src/pkms/today.ts";

const TODAY = isoLocalDate(new Date());

const DAILY = `---
---
## breadcrumb
- the lead thing
`;

function mkVault(rows: Array<{ rel: string; body: string }>) {
  const root = mkdtempSync(join(tmpdir(), "webshell-"));
  const vault = join(root, "vault");
  const idx = join(root, ".index");

  for (const r of rows) {
    const p = join(vault, r.rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, r.body, "utf8");
  }

  indexVault(vault, idx);

  return { root, vault, idx };
}

const LEAD = `---
title: Lead note
---
Lead body.
- [ ] the lead thing
`;

const EMPTY = `---
title: Empty note
---
No actions here.
`;

const stubToday = {
  date: "2026-08-20",
  breadcrumb: { name: "x", lines: ["- line one", "- line two"] },
  inbox_new: 0,
  done_today: 0,
  next_read: null,
  resurface: {
    path: "a.md",
    title: "A",
    question: "still curious about A?",
    why: "linked from b",
    score: 1,
  },
  next_actions: [],
  more_notes: 0,
  snoozed: [],
} satisfies TodayView;

describe("renderToday", () => {
  test("renders the win state when no actions are owed", () => {
    const { vault, idx } = mkVault([{ rel: "areas/empty.md", body: EMPTY }]);
    const html = renderToday(vault, idx);
    expect(html).toContain("Nothing is asking for you right now.");
    expect(html).toContain("lead-continuation");
    expect(html).toContain('data-mode="capture"');
    expect(html).toContain("nothing queued");
  });

  test("renders the lead continuation with the next action", () => {
    const { vault, idx } = mkVault([
      { rel: "areas/lead.md", body: LEAD },
      { rel: `daily/${TODAY}.md`, body: DAILY },
    ]);

    const html = renderToday(vault, idx);
    expect(html).toContain("Yesterday you were in");
    expect(html).toContain("the lead thing");
    expect(html).toContain("/api/open-note");
    expect(html).toContain("hx-vals");
    expect(html).toContain("areas/lead.md");
    expect(html).toContain("continue");
    expect(html).not.toMatch(/mark done/i);
  });

  test("hides empty inbox / area / snoozed surfaces", () => {
    const { vault, idx } = mkVault([{ rel: "areas/empty.md", body: EMPTY }]);
    const html = renderToday(vault, idx);
    expect(html).toContain('id="inbox-surface" hidden');
    expect(html).toContain('id="snoozed-surface" hidden');
  });

  test("renders inbox captures as openable items", () => {
    const INBOX_CAPTURE = `---
tags: [inbox]
source: web
---
an inbox capture
`;

    const { vault, idx } = mkVault([
      { rel: "areas/lead.md", body: LEAD },
      { rel: "inbox/capture.md", body: INBOX_CAPTURE },
    ]);

    const html = renderToday(vault, idx);
    expect(html).toContain("an inbox capture");
    expect(html).not.toContain('id="inbox-surface" hidden');
    expect(html).toContain("safe here until folded");
  });
});

describe("renderToday snoozed", () => {
  test("renders snoozed notes as an openable resting block", () => {
    const SNOOZED = `---
title: Snoozed note
---
Body.
- [~] do later
`;

    const { vault, idx } = mkVault([{ rel: "areas/snoozed.md", body: SNOOZED }]);
    const html = renderToday(vault, idx);
    expect(html).toContain("snoozed");
    expect(html).toContain("Snoozed note");
    expect(html).toContain("resting");
    expect(html).not.toContain('id="snoozed-surface" hidden');
  });
});

describe("renderResurfaceCell", () => {
  test("renders the resurface card when an offer exists", () => {
    const html = renderResurfaceCellToday(stubToday);
    expect(html).toContain("still curious about A?");
    expect(html).toContain('hx-post="/api/resurface"');
    expect(html).toContain('"action": "not-now"');
    expect(html).toContain('"action": "let-go"');
  });

  test("renders the cell empty after a not-now dismiss", () => {
    const cell = renderResurfaceCellToday({ ...stubToday, resurface: null });
    expect(cell).not.toContain('hx-post="/api/resurface"');
    expect(cell).toContain('id="resurface-cell"');
    expect(cell).toContain("hidden");
  });
});

describe("renderActions", () => {
  test("renders every action (full list) for the actions surface", () => {
    const { vault, idx } = mkVault([{ rel: "areas/lead.md", body: LEAD }]);
    const html = renderActions(vault, idx);
    expect(html).toContain("the lead thing");
    expect(html).toContain("data-done-toggle");
  });
});

describe("renderReadingQueue", () => {
  test("renders queued reads with titles", () => {
    const LONG_READ = `---
title: A long read
reading: queued
---
- [ ] read this
`;

    const { vault } = mkVault([
      { rel: "resources/reading/long.md", body: LONG_READ },
      { rel: "areas/lead.md", body: LEAD },
    ]);

    const html = renderReadingQueue(vault);
    expect(html).toContain("A long read");
  });
});

describe("renderSearchResults", () => {
  test("finds matches and renders excerpts", () => {
    const { idx } = mkVault([{ rel: "areas/lead.md", body: LEAD }]);
    const html = renderSearchResults("lead thing", idx);
    expect(html).toContain("Lead note");
    expect(html).toContain("[lead]");
  });

  test("empty query renders nothing", () => {
    const { idx } = mkVault([{ rel: "areas/lead.md", body: LEAD }]);
    expect(renderSearchResults("", idx)).toBe("");
    expect(renderSearchResults("   ", idx)).toBe("");
  });
});

describe("renderRecentNotes", () => {
  test("renders recent candidate notes with open-note actions", () => {
    const { vault, idx } = mkVault([{ rel: "areas/lead.md", body: LEAD }]);
    const html = renderRecentNotes(vault, idx);
    expect(html).toContain("Lead note");
    expect(html).toContain('hx-post="/api/open-note"');
  });
});
