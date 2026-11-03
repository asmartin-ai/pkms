import { afterEach, beforeAll, describe, expect, jest, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Database } from "bun:sqlite";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { emit, readEvents } from "../../src/pkms/events.ts";
import { loadPost } from "../../src/pkms/indexer.ts";
import { handleCommand } from "../../src/pkms/discord_agent.ts";
import { TuningSchema } from "../../src/pkms/route_rules.ts";
import {
  analyzeWeek,
  answerPlan,
  completePlan,
  engagementTick,
  freshStartState,
  listPlans,
  localDay,
  localMinutes,
  markFreshStartShown,
  projectProgress,
  quickPickToIso,
  readPlan,
  resolveWhen,
  setPlan,
  streakState,
  withinQuiet,
  type EngagementTuning,
} from "../../src/pkms/engagement.ts";
import { frontmatterValue } from "../../src/pkms/capture.ts";
import { readdirSync } from "node:fs";
import { main, setRoot } from "../../src/pkms/cli.ts";
import { makeServer } from "../../src/pkms/capture_service.ts";
import { renderToday } from "../../src/pkms/web_shell.ts";
import { appendDid } from "../../src/pkms/daily.ts";

const roots: string[] = [];

beforeAll(() => {
  process.env.TZ = "America/Chicago";
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pkms-engagement-"));
  roots.push(root);
  const vault = join(root, "vault");
  mkdirSync(vault);

  return { root, vault };
}

afterEach(() => {
  for (const stop of stopFns.splice(0)) stop();

  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

const TOKEN = "test-engagement-token";

let stopFns: Array<() => void> = [];

function startService(vault: string, indexDir: string): string {
  const server = makeServer({ vault, indexDir, host: "127.0.0.1", port: 0, token: TOKEN });
  stopFns.push(() => server.stop(true));

  return `http://127.0.0.1:${server.port}`;
}

const NOW = new Date("2026-10-07T20:00:00Z");

function tuning(): EngagementTuning {
  return structuredClone(TuningSchema.parse({}).engagement);
}

function tuned(mutate: (t: EngagementTuning) => void): EngagementTuning {
  const t = structuredClone(TuningSchema.parse({}).engagement);
  mutate(t);

  return t;
}

function dayEvent(root: string, kind: string, iso: string, ref = "x") {
  emit(root, kind, { source: "test", ref, payload: {} });
  const db = new Database(join(root, ".ledger", "events.db"));
  db.run("UPDATE events SET ts = ? WHERE id = (SELECT MAX(id) FROM events)", [iso]);
  db.close();
}

describe("engagement tuning", () => {
  test("defaults match WO-003", () => {
    const t = TuningSchema.parse({});
    expect(t.engagement.if_then).toEqual({
      enabled: true,
      ask_on_capture: false,
      ask_on_plan: true,
    });
    expect(t.engagement.streak).toEqual({
      enabled: true,
      freezes_per_month: 2,
      counts: ["did", "fold", "route_processed"],
    });
    expect(t.engagement.progress).toEqual({ enabled: true });
    expect(t.engagement.pings).toEqual({
      enabled: true,
      brief_at: "14:00",
      quiet_start: "22:00",
      quiet_end: "09:00",
      max_per_day: 3,
    });
    expect(t.engagement.fresh_start).toEqual({ enabled: true, weekly: true, monthly: true });
  });

  test("rejects a malformed time and a negative freeze quota", () => {
    expect(() => TuningSchema.parse({ engagement: { pings: { brief_at: "9am" } } })).toThrow();
    expect(() =>
      TuningSchema.parse({ engagement: { streak: { freezes_per_month: -1 } } }),
    ).toThrow();
  });
});

describe("local day + quiet window", () => {
  test("localDay lands on the Chicago calendar day", () => {
    expect(localDay(new Date("2026-10-07T02:00:00Z"))).toBe("2026-10-06");
    expect(localDay(new Date("2026-10-07T20:00:00Z"))).toBe("2026-10-07");
  });

  test("quiet windows wrap midnight", () => {
    expect(withinQuiet("23:00", "22:00", "09:00")).toBe(true);
    expect(withinQuiet("03:00", "22:00", "09:00")).toBe(true);
    expect(withinQuiet("12:00", "22:00", "09:00")).toBe(false);
    expect(withinQuiet("21:59", "22:00", "09:00")).toBe(false);
    expect(withinQuiet("10:00", "09:00", "09:00")).toBe(false);
  });

  test("localMinutes is HH:MM", () => {
    expect(localMinutes(new Date("2026-10-07T20:07:00Z"))).toBe("15:07");
  });
});

describe("quick picks + when resolution", () => {
  test("picks resolve in Chicago local time", () => {
    expect(quickPickToIso("this afternoon", NOW)).toBe("2026-10-08T19:00:00.000Z");
    expect(quickPickToIso("tonight", NOW)).toBe("2026-10-08T01:00:00.000Z");
    expect(quickPickToIso("tomorrow morning", NOW)).toBe("2026-10-08T14:00:00.000Z");
    expect(quickPickToIso("garbage", NOW)).toBeNull();
  });

  test("a past pick rolls forward to tomorrow", () => {
    const late = new Date("2026-10-07T22:30:00Z");

    expect(quickPickToIso("this afternoon", late)).toBe("2026-10-08T19:00:00.000Z");

    const night = new Date("2026-10-08T02:30:00Z");

    expect(quickPickToIso("tonight", night)).toBe("2026-10-09T01:00:00.000Z");
  });

  test("resolveWhen accepts picks and ISO, rejects anything else", () => {
    expect(resolveWhen("tonight", NOW)).toBe("2026-10-08T01:00:00.000Z");
    expect(resolveWhen("2026-10-08T01:00:00.000Z", NOW)).toBe("2026-10-08T01:00:00.000Z");
    expect(resolveWhen("friday", NOW)).toBeNull();
    expect(resolveWhen("", NOW)).toBeNull();
  });
});

describe("streak", () => {
  test("consecutive counted days, today open does not break it", () => {
    const { root } = fixture();
    dayEvent(root, "did", "2026-10-05T18:00:00Z");
    dayEvent(root, "did", "2026-10-06T18:00:00Z");
    const s = streakState(readEvents(root), tuning(), NOW);
    expect(s.days).toBe(2);
    expect(s.todayCounted).toBe(false);
  });

  test("a UTC evening event counts for the Chicago day before (tz boundary)", () => {
    const { root } = fixture();
    dayEvent(root, "did", "2026-10-06T02:00:00Z");
    dayEvent(root, "did", "2026-10-07T02:00:00Z");
    const s = streakState(readEvents(root), tuning(), NOW);
    expect(s.days).toBe(2);
  });

  test("gap resets the streak when no freezes are configured", () => {
    const { root } = fixture();
    dayEvent(root, "did", "2026-10-06T18:00:00Z");
    dayEvent(root, "did", "2026-10-02T18:00:00Z");

    const s = streakState(
      readEvents(root),
      tuned((t) => (t.streak.freezes_per_month = 0)),
      NOW,
    );

    expect(s.days).toBe(1);
  });

  test("a missed day consumes a freeze and bridges", () => {
    const { root } = fixture();
    dayEvent(root, "did", "2026-10-06T18:00:00Z");
    dayEvent(root, "did", "2026-10-04T18:00:00Z");

    const s = streakState(
      readEvents(root),
      tuned((t) => (t.streak.freezes_per_month = 1)),
      NOW,
    );

    expect(s.days).toBe(3);
    expect(s.freezesUsedThisMonth).toEqual(["2026-10-05"]);
    expect(s.freezesLeft).toBe(0);
  });

  test("quota is per calendar month — rollover keeps new-month freezes intact", () => {
    const { root } = fixture();
    dayEvent(root, "did", "2026-09-29T18:00:00Z");

    for (let d = 1; d <= 6; d++) dayEvent(root, "did", `2026-10-0${d}T18:00:00Z`);
    const s = streakState(readEvents(root), tuning(), NOW);
    expect(s.days).toBe(8);
    expect(s.freezesUsedThisMonth).toEqual([]);
    expect(s.freezesLeft).toBe(2);
  });

  test("count aliases map did/fold/route_processed to real kinds", () => {
    const { root } = fixture();
    dayEvent(root, "folded", "2026-10-06T18:00:00Z");
    expect(streakState(readEvents(root), tuning(), NOW).days).toBe(1);
    const other = fixture();
    dayEvent(other.root, "routed", "2026-10-06T18:00:00Z");
    expect(streakState(readEvents(other.root), tuning(), NOW).days).toBe(1);
  });

  test("appendDid emits a did event that counts", () => {
    const { root, vault } = fixture();
    appendDid(vault, "shipped the thing", NOW);
    const s = streakState(readEvents(root), tuning(), NOW);
    expect(s.todayCounted).toBe(true);
    expect(s.days).toBe(1);
  });

  test("a spring-forward weekend keeps the streak under any host timezone", () => {
    const { root } = fixture();

    for (const iso of [
      "2026-03-05T18:00:00Z",
      "2026-03-06T18:00:00Z",
      "2026-03-07T18:00:00Z",
      "2026-03-08T18:00:00Z",
      "2026-03-09T05:00:00Z",
    ]) {
      dayEvent(root, "did", iso);
    }

    const s = streakState(readEvents(root), tuning(), new Date("2026-03-09T05:30:00Z"));

    expect(s.days).toBe(5);
    expect(s.todayCounted).toBe(true);
  });
});

describe("plans", () => {
  test("set → answer → done transitions with events", () => {
    const { root, vault } = fixture();
    const plan = setPlan(vault, "prototype the encoder", { now: NOW });
    expect(plan.path).toMatch(/^inbox\/2026-10-07_\d{6}_prototype-the-encoder\.md$/);
    expect(readEvents(root).map((e) => e.kind)).toContain("plan_set");

    answerPlan(vault, plan.path, { when: quickPickToIso("tonight", NOW), cue: "after dinner" });
    const note = readFileSync(join(vault, plan.path), "utf8");
    expect(loadPost(note).data.plan).toBe("true");
    expect(note).toContain("cue: after dinner");
    expect(readEvents(root).map((e) => e.kind)).toContain("prompt_answered");

    completePlan(vault, plan.path);
    completePlan(vault, plan.path);
    const dones = readEvents(root).filter((e) => e.kind === "plan_done");
    expect(dones).toHaveLength(1);
    expect(readFileSync(join(vault, plan.path), "utf8")).toContain("plan_state: done");
  });

  test("skip emits prompt_skipped and leaves the plan open", () => {
    const { root, vault } = fixture();
    const plan = setPlan(vault, "read the paper", { now: NOW });
    answerPlan(vault, plan.path, { skipped: true });
    const kinds = readEvents(root).map((e) => e.kind);
    expect(kinds).toContain("prompt_skipped");
    expect(kinds).not.toContain("prompt_answered");
  });

  test("a cue containing ': ' writes parsable frontmatter", () => {
    const { vault } = fixture();
    const plan = setPlan(vault, "stretch", { now: NOW });
    answerPlan(vault, plan.path, { cue: "at: the desk" });

    const raw = readFileSync(join(vault, plan.path), "utf8");

    expect(raw).toContain('cue: "at: the desk"');
    expect(loadPost(raw).data.cue).toBe("at: the desk");
    expect(listPlans(vault)).toHaveLength(1);
    expect(readPlan(vault, plan.path)?.cue).toBe("at: the desk");
  });

  test("ambiguous YAML scalars are JSON-quoted so they read back as strings", () => {
    const ambiguous = ["404", "true", "null", "~", "1e3", "0x1F", ".5", "+12"];

    for (const raw of ambiguous) {
      const written = frontmatterValue(raw);
      expect(written).not.toBe(raw);
      expect(written).toMatch(/^".*"$/);

      const { data } = loadPost(`---\ncue: ${written}\n---\nplan body`);

      expect(data.cue).toBe(raw);
    }
  });

  test("a when containing a newline cannot inject plan_state", () => {
    const { vault } = fixture();
    const plan = setPlan(vault, "stretch", { now: NOW });
    answerPlan(vault, plan.path, { when: "tonight\nplan_state: done" });

    const raw = readFileSync(join(vault, plan.path), "utf8");
    const { data } = loadPost(raw);

    expect(data.when).toBe("tonight\nplan_state: done");
    expect(data.plan_state).toBeUndefined();
    expect(readPlan(vault, plan.path)?.state).toBe("open");
  });

  test("a corrupt note is skipped by listPlans and the tick still runs", async () => {
    const { root, vault } = fixture();
    mkdirSync(join(vault, "inbox"), { recursive: true });
    writeFileSync(
      join(vault, "inbox", "a-corrupt.md"),
      "---\nplan: true\ncue: at: the desk\n---\n\nbroken note\n",
    );
    setPlan(vault, "call the shop", { when: "2026-10-06T18:00:00Z", now: NOW });

    const plans = listPlans(vault);

    expect(plans).toHaveLength(1);
    expect(plans[0]!.thing).toBe("call the shop");

    const res = await engagementTick(root, vault, tuning(), {
      now: NOW,
      deliver: async () => true,
    });

    expect(res.missedMarked).toBe(1);
    expect(readFileSync(join(vault, plans[0]!.path), "utf8")).toContain("plan_state: missed");
  });

  test("answering a non-plan note is a no-op and leaves the file byte-identical", () => {
    const { vault } = fixture();
    mkdirSync(join(vault, "projects"), { recursive: true });
    const rel = "projects/p.md";
    const original = "---\ntitle: Not a plan\ntags: [a, b]\n---\n\njust a note\n";

    writeFileSync(join(vault, rel), original);
    expect(readPlan(vault, rel)).toBeNull();
    answerPlan(vault, rel, { when: "tonight", cue: "at: the desk" });
    expect(readFileSync(join(vault, rel), "utf8")).toBe(original);
  });

  test("answering a plan note keeps tags and a nested meta mapping intact", () => {
    const { vault } = fixture();
    mkdirSync(join(vault, "inbox"), { recursive: true });
    const rel = "inbox/p.md";

    writeFileSync(
      join(vault, rel),
      "---\nplan: true\ntags:\n  - a\n  - b\nmeta:\n  x: 1\n---\n\nship the thing\n",
    );
    answerPlan(vault, rel, { cue: "after dinner" });

    const { data } = loadPost(readFileSync(join(vault, rel), "utf8"));

    expect(data.tags).toEqual(["a", "b"]);
    expect(data.meta).toEqual({ x: 1 });
    expect(data.cue).toBe("after dinner");
    expect(readPlan(vault, rel)?.thing).toBe("ship the thing");
  });
});

describe("engagement tick", () => {
  test("marks a plan missed 12h after when, once", async () => {
    const { root, vault } = fixture();
    const plan = setPlan(vault, "call the shop", { when: "2026-10-06T18:00:00Z", now: NOW });
    await engagementTick(
      root,
      vault,
      tuned((t) => (t.pings.enabled = false)),
      { now: NOW },
    );
    expect(readFileSync(join(vault, plan.path), "utf8")).toContain("plan_state: missed");
    expect(readEvents(root).filter((e) => e.kind === "plan_missed")).toHaveLength(1);
    await engagementTick(
      root,
      vault,
      tuned((t) => (t.pings.enabled = false)),
      { now: NOW },
    );
    expect(readEvents(root).filter((e) => e.kind === "plan_missed")).toHaveLength(1);
  });

  test("sends the brief once per day and reminders once per (plan, when)", async () => {
    const { root, vault } = fixture();
    setPlan(vault, "water the plants", { when: "2026-10-07T15:00:00Z", now: NOW });
    const sent: string[] = [];

    const run = () =>
      engagementTick(root, vault, tuning(), {
        now: NOW,
        deliver: async (_t, ref) => {
          sent.push(ref);

          return true;
        },
      });

    const first = await run();
    expect(first.briefSent).toBe(true);
    expect(first.remindersSent).toBe(1);
    expect(sent).toContain("brief:2026-10-07");
    const second = await run();
    expect(second.briefSent).toBe(false);
    expect(second.remindersSent).toBe(0);
    expect(sent).toHaveLength(2);
  });

  test("quiet hours suppress delivery", async () => {
    const { root, vault } = fixture();
    setPlan(vault, "late thing", { when: "2026-10-07T15:00:00Z", now: NOW });
    const night = new Date("2026-10-08T04:00:00Z");

    const res = await engagementTick(root, vault, tuning(), {
      now: night,
      deliver: async () => true,
    });

    expect(res.suppressedByQuietHours).toBe(true);
    expect(res.remindersSent).toBe(0);
  });

  test("the daily cap stops extra sends", async () => {
    const { root, vault } = fixture();
    const t = tuned((x) => (x.pings.max_per_day = 1));
    setPlan(vault, "one", { when: "2026-10-07T15:00:00Z", now: NOW });
    setPlan(vault, "two", { when: "2026-10-07T15:30:00Z", now: NOW });
    const res = await engagementTick(root, vault, t, { now: NOW, deliver: async () => true });
    expect(res.briefSent).toBe(true);
    expect(res.remindersSent).toBe(0);
    expect(res.suppressedByCap).toBe(true);
  });

  test("a confirmed delivery emits nudge_sent and delivers the brief text", async () => {
    const { root, vault } = fixture();
    setPlan(vault, "water the plants", { when: "2026-10-07T15:00:00Z", now: NOW });
    const delivered: Array<{ text: string; ref: string }> = [];

    const res = await engagementTick(root, vault, tuning(), {
      now: NOW,
      deliver: async (text, ref) => {
        delivered.push({ text, ref });

        return true;
      },
    });

    expect(res.briefSent).toBe(true);
    expect(res.remindersSent).toBe(1);
    expect(delivered[0]!.ref).toBe("brief:2026-10-07");
    expect(delivered[1]!.ref.startsWith("plan:inbox/")).toBe(true);
    expect(delivered[0]!.text).toContain("due: water the plants");
    const nudges = readEvents(root).filter((e) => e.kind === "nudge_sent");

    expect(nudges).toHaveLength(2);
    expect(nudges.map((e) => e.ref)).toContain("brief:2026-10-07");
  });

  test("a failed or absent delivery records no nudge_sent and burns no cap", async () => {
    const { root, vault } = fixture();
    setPlan(vault, "water the plants", { when: "2026-10-07T15:00:00Z", now: NOW });

    const failed = await engagementTick(root, vault, tuning(), {
      now: NOW,
      deliver: async () => false,
    });

    expect(failed.briefSent).toBe(false);
    expect(failed.remindersSent).toBe(0);
    expect(readEvents(root).filter((e) => e.kind === "nudge_sent")).toHaveLength(0);

    const absent = await engagementTick(root, vault, tuning(), { now: NOW });

    expect(absent.briefSent).toBe(false);
    expect(readEvents(root).filter((e) => e.kind === "nudge_sent")).toHaveLength(0);

    const ok = await engagementTick(root, vault, tuning(), {
      now: NOW,
      deliver: async () => true,
    });

    expect(ok.briefSent).toBe(true);
    expect(ok.remindersSent).toBe(1);
    expect(readEvents(root).filter((e) => e.kind === "nudge_sent")).toHaveLength(2);
  });
});

describe("fresh start", () => {
  test("shows on a Monday once, not on other weekdays", () => {
    const { root } = fixture();
    const monday = new Date("2026-10-05T17:00:00Z");
    expect(freshStartState(readEvents(root), tuning(), monday)).toEqual({
      show: true,
      landmark: "week",
    });
    dayEvent(root, "fresh_start_shown", "2026-10-05T17:00:00Z", "fresh:week:2026-10-05");
    expect(freshStartState(readEvents(root), tuning(), monday).show).toBe(false);
    const tuesday = new Date("2026-10-06T17:00:00Z");
    expect(freshStartState(readEvents(root), tuning(), tuesday).show).toBe(false);
  });

  test("shows on the 1st when monthly is on", () => {
    const { root } = fixture();
    const first = new Date("2026-11-01T17:00:00Z");
    expect(freshStartState(readEvents(root), tuning(), first)).toEqual({
      show: true,
      landmark: "month",
    });
  });

  test("the action (not the render) records the card, once per landmark day", () => {
    const { root } = fixture();
    const monday = new Date("2026-10-05T17:00:00Z");
    const shown = () => readEvents(root).filter((e) => e.kind === "fresh_start_shown");

    expect(shown()).toHaveLength(0);
    markFreshStartShown(root, monday);
    expect(shown()).toHaveLength(1);
    expect(shown()[0]!.ref).toBe("fresh:week:2026-10-05");
    expect(freshStartState(readEvents(root), tuning(), monday).show).toBe(false);

    markFreshStartShown(root, monday);
    expect(shown()).toHaveLength(1);

    const other = fixture();
    markFreshStartShown(other.root, new Date("2026-10-06T17:00:00Z"));
    expect(readEvents(other.root).filter((e) => e.kind === "fresh_start_shown")).toHaveLength(0);
  });
});

describe("project progress", () => {
  test("counts checklist items with creation as the first step", () => {
    const { vault } = fixture();
    mkdirSync(join(vault, "projects"), { recursive: true });
    writeFileSync(
      join(vault, "projects", "encoder.md"),
      "---\ntitle: Encoder\n---\n\n- [x] schema\n- [ ] build\n- [ ] test\n",
    );
    const p = projectProgress(vault);
    expect(p).toEqual([{ path: "projects/encoder.md", title: "Encoder", done: 2, total: 4 }]);
  });

  test("notes without checklists are skipped", () => {
    const { vault } = fixture();
    mkdirSync(join(vault, "projects"), { recursive: true });
    expect(projectProgress(vault)).toEqual([]);
  });
});

describe("analyze --week", () => {
  function seedPrompts(root: string, daysAgo: number, shown: number, skipped: number) {
    const base = NOW.getTime() - daysAgo * 86_400_000;

    for (let i = 0; i < shown; i++) {
      const ts = new Date(base + i * 1000).toISOString();
      dayEvent(root, "prompt_shown", ts, `p${daysAgo}-${i}`);

      if (i < skipped) dayEvent(root, "prompt_skipped", ts, `p${daysAgo}-${i}`);
    }
  }

  test("auto-off fires at the threshold and writes the audit line", () => {
    const { root, vault } = fixture();
    seedPrompts(root, 3, 12, 11);
    seedPrompts(root, 10, 12, 11);
    const res = analyzeWeek(root, vault, NOW);
    expect(res.autoDisabled.map((d) => d.mechanic)).toContain("if_then");
    const tuningJson = JSON.parse(readFileSync(join(root, "tuning.json"), "utf8"));
    expect(tuningJson.engagement.if_then.enabled).toBe(false);

    const audit = readFileSync(join(root, ".ledger", "tuning-changes.jsonl"), "utf8")
      .trim()
      .split("\n");

    expect(audit.at(-1)).toContain('"key":"engagement.if_then.enabled"');
    expect(readEvents(root).map((e) => e.kind)).toContain("tuning_changed");
    expect(existsSync(res.reportPath)).toBe(true);
    expect(readFileSync(res.reportPath, "utf8")).toContain("Auto-off");
  });

  test("below the threshold (rate or volume) does not disable", () => {
    const { root, vault } = fixture();
    seedPrompts(root, 3, 12, 6);
    seedPrompts(root, 10, 12, 11);
    const res = analyzeWeek(root, vault, NOW);
    expect(res.autoDisabled).toEqual([]);
    expect(existsSync(join(root, "tuning.json"))).toBe(false);

    const other = fixture();
    seedPrompts(other.root, 3, 9, 9);
    seedPrompts(other.root, 10, 12, 12);
    expect(analyzeWeek(other.root, other.vault, NOW).autoDisabled).toEqual([]);
  });

  test("an already-disabled mechanic is never auto-disabled twice", () => {
    const { root, vault } = fixture();
    seedPrompts(root, 3, 12, 11);
    seedPrompts(root, 10, 12, 11);
    expect(analyzeWeek(root, vault, NOW).autoDisabled.map((d) => d.mechanic)).toContain("if_then");

    const auditLines = () =>
      readFileSync(join(root, ".ledger", "tuning-changes.jsonl"), "utf8")
        .trim()
        .split("\n");

    const tuningChanges = () => readEvents(root).filter((e) => e.kind === "tuning_changed").length;

    expect(auditLines()).toHaveLength(1);
    expect(tuningChanges()).toBe(1);

    expect(analyzeWeek(root, vault, NOW).autoDisabled).toEqual([]);
    expect(auditLines()).toHaveLength(1);
    expect(tuningChanges()).toBe(1);
  });

  test("the report is filed under the ISO week (Thursday rule)", () => {
    for (const [iso, week] of [
      ["2026-10-12T18:00:00Z", "2026-W42"],
      ["2026-01-05T18:00:00Z", "2026-W02"],
      ["2026-12-31T18:00:00Z", "2026-W53"],
      ["2026-01-04T12:00:00Z", "2026-W01"],
      ["2021-01-03T12:00:00Z", "2020-W53"],
      ["2016-01-03T12:00:00Z", "2015-W53"],
    ] as const) {
      const { root, vault } = fixture();
      const res = analyzeWeek(root, vault, new Date(iso));
      expect(basename(res.reportPath)).toBe(`${week}-engagement.md`);
      expect(readFileSync(res.reportPath, "utf8")).toContain(`# Engagement — week ${week}`);
    }
  });

  test("the report carries streak, plan, and fresh-start numbers", () => {
    const { root, vault } = fixture();
    appendDid(vault, "thing", NOW);
    setPlan(vault, "a plan", { now: NOW });
    const res = analyzeWeek(root, vault, NOW);
    const text = readFileSync(res.reportPath, "utf8");
    expect(text).toContain("current: 1 day");
    expect(text).toContain("set: 1");
    expect(text).toMatch(/cards shown: 0/);
  });
});

describe("today-view engagement surfaces", () => {
  test("streak line, project bar, and fresh-start card render (Monday)", () => {
    const { root, vault } = fixture();
    dayEvent(root, "did", "2026-10-05T18:00:00Z");
    mkdirSync(join(vault, "projects"), { recursive: true });
    writeFileSync(
      join(vault, "projects", "encoder.md"),
      "---\ntitle: Encoder\n---\n\n- [x] schema\n- [ ] build\n",
    );
    const monday = new Date("2026-10-05T17:00:00Z");
    const html = renderToday(vault, join(root, ".index"), monday);

    expect(html).toContain("streak");
    expect(html).toContain("1 day");
    expect(html).toContain("progress-bar__fill");
    expect(html).toContain("Encoder");
    expect(html).toContain("New week.");
    expect(readEvents(root).map((e) => e.kind)).not.toContain("fresh_start_shown");

    const again = renderToday(vault, join(root, ".index"), monday);
    expect(again).toContain("New week.");
    expect(readEvents(root).map((e) => e.kind)).not.toContain("fresh_start_shown");
  });

  test("the plan submit records fresh_start_shown once and retires the card", async () => {
    const { root, vault } = fixture();
    const monday = new Date("2026-10-05T17:00:00Z");

    jest.useFakeTimers();
    jest.setSystemTime(monday);

    try {
      expect(renderToday(vault, join(root, ".index"), monday)).toContain("New week.");

      const base = startService(vault, join(root, ".index"));

      const r = await fetch(`${base}/api/plan?token=${TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thing: "one plan for the new week" }),
      });

      expect(r.status).toBe(200);
      const shown = readEvents(root).filter((e) => e.kind === "fresh_start_shown");

      expect(shown).toHaveLength(1);
      expect(shown[0]!.ref).toBe("fresh:week:2026-10-05");

      expect(renderToday(vault, join(root, ".index"), monday)).not.toContain("New week.");
    } finally {
      jest.useRealTimers();
    }
  });

  test("non-landmark days render no card; disabled streak hides the line", () => {
    const { root, vault } = fixture();
    const html = renderToday(vault, join(root, ".index"), NOW);
    expect(html).not.toContain("New week.");
    writeFileSync(
      join(root, "tuning.json"),
      JSON.stringify({ engagement: { streak: { enabled: false } } }),
    );
    const off = renderToday(vault, join(root, ".index"), NOW);
    expect(off).not.toContain('id="streak"');
  });
});

describe("plan endpoints", () => {
  test("a disabled if_then shows no prompt and emits no prompt_shown (web)", async () => {
    const { root, vault } = fixture();
    writeFileSync(
      join(root, "tuning.json"),
      JSON.stringify({ engagement: { if_then: { enabled: false } } }),
    );
    const base = startService(vault, join(root, ".index"));

    const r = await fetch(`${base}/api/plan?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thing: "prototype the encoder" }),
    });

    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain("plan-prompt");
    expect(readEvents(root).map((e) => e.kind)).not.toContain("prompt_shown");
    expect(readdirSync(join(vault, "inbox")).some((f) => f.endsWith(".md"))).toBe(true);
  });

  test("the Discord !plan path asks only while the mechanic is on", () => {
    const { root, vault } = fixture();
    const indexDir = join(root, ".index");
    const on = handleCommand(root, vault, indexDir, "!plan the thing", NOW);

    expect(on.reply).toContain("when?");
    expect(readEvents(root).map((e) => e.kind)).toContain("prompt_shown");

    writeFileSync(
      join(root, "tuning.json"),
      JSON.stringify({ engagement: { if_then: { enabled: false } } }),
    );

    const off = handleCommand(root, vault, indexDir, "!plan the other thing", NOW);

    expect(off.reply).not.toContain("when?");
    expect(readEvents(root).filter((e) => e.kind === "prompt_shown")).toHaveLength(1);
  });

  test("answering a non-plan note 404s and leaves the file byte-identical", async () => {
    const { root, vault } = fixture();
    mkdirSync(join(vault, "projects"), { recursive: true });
    const original = "---\ntitle: Not a plan\ntags: [a, b]\n---\n\njust a note\n";

    writeFileSync(join(vault, "projects", "p.md"), original);
    const base = startService(vault, join(root, ".index"));

    const answered = await fetch(`${base}/api/plan-answer?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "projects/p.md", cue: "at: the desk" }),
    });

    expect(answered.status).toBe(404);

    const completed = await fetch(`${base}/api/plan-answer?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "projects/p.md", done: true }),
    });

    expect(completed.status).toBe(404);
    expect(readFileSync(join(vault, "projects", "p.md"), "utf8")).toBe(original);
  });

  test("an unparsable when is rejected instead of stored as a NaN reminder", async () => {
    const { root, vault } = fixture();
    const base = startService(vault, join(root, ".index"));

    await fetch(`${base}/api/plan?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thing: "read the paper" }),
    });

    const note = readdirSync(join(vault, "inbox")).find((f) => f.endsWith(".md"))!;
    const rel = `inbox/${note}`;
    const before = readFileSync(join(vault, rel), "utf8");

    const bad = await fetch(`${base}/api/plan-answer?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: rel, when: "friday" }),
    });

    expect(bad.status).toBe(400);
    expect(readFileSync(join(vault, rel), "utf8")).toBe(before);

    const good = await fetch(`${base}/api/plan-answer?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: rel, when: "tonight" }),
    });

    expect(good.status).toBe(200);
    const when = readPlan(vault, rel)?.when ?? "";

    expect(Number.isNaN(Date.parse(when))).toBe(false);
  });

  test("POST /api/plan saves first, then shows the one-tap prompt; answer wires the cue", async () => {
    const { root, vault } = fixture();
    const base = startService(vault, join(root, ".index"));

    const r = await fetch(`${base}/api/plan?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thing: "prototype the encoder" }),
    });

    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain("plan-prompt");
    expect(body).toContain("tomorrow morning");
    const kinds = readEvents(root).map((e) => e.kind);
    expect(kinds).toContain("plan_set");
    expect(kinds).toContain("prompt_shown");

    const note = readdirSync(join(vault, "inbox")).find((f) => f.endsWith(".md"))!;
    const rel = `inbox/${note}`;

    const a = await fetch(`${base}/api/plan-answer?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: rel, when: "tonight", cue: "after dinner" }),
    });

    expect(a.status).toBe(200);
    expect(readFileSync(join(vault, rel), "utf8")).toContain("cue: after dinner");
    expect(readEvents(root).map((e) => e.kind)).toContain("prompt_answered");
  });

  test("skip answers and missing auth are handled without writes", async () => {
    const { root, vault } = fixture();
    const base = startService(vault, join(root, ".index"));

    const denied = await fetch(`${base}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thing: "nope" }),
    });

    expect(denied.status).toBe(403);
    expect(existsSync(join(vault, "inbox"))).toBe(false);

    await fetch(`${base}/api/plan?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thing: "read the paper" }),
    });

    const note = readdirSync(join(vault, "inbox")).find((f) => f.endsWith(".md"))!;

    const skip = await fetch(`${base}/api/plan-answer?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `inbox/${note}`, skipped: true }),
    });

    expect(skip.status).toBe(200);
    expect(readEvents(root).map((e) => e.kind)).toContain("prompt_skipped");
  });
});

describe("engagement CLI", () => {
  test("plan, streak, analyze --week, engagement-tick round-trip", async () => {
    const root = fixture().root;
    const oldHome = process.env.PKMS_HOME;
    process.env.PKMS_HOME = root;
    setRoot(null);

    try {
      expect(await main(["plan", "ship the demo", "--when", "tonight"])).toBe(0);
      const inboxNote = readdirSync(join(root, "vault", "inbox")).find((f) => f.endsWith(".md"))!;
      expect(
        loadPost(readFileSync(join(root, "vault", "inbox", inboxNote), "utf8")).data.plan,
      ).toBe("true");

      expect(await main(["did", "one thing"])).toBe(0);
      expect(await main(["streak"])).toBe(0);
      expect(await main(["engagement-tick"])).toBe(0);
      expect(readEvents(root).filter((e) => e.kind === "nudge_sent")).toHaveLength(0);
      expect(await main(["analyze", "--week"])).toBe(0);
      expect(existsSync(join(root, "vault", "resources", "reports"))).toBe(true);
      expect(await main(["analyze"])).toBe(1);
    } finally {
      if (oldHome === undefined) delete process.env.PKMS_HOME;
      else process.env.PKMS_HOME = oldHome;
      setRoot(null);
    }
  });

  test("plan --when rejects a value that does not parse", async () => {
    const root = fixture().root;
    const oldHome = process.env.PKMS_HOME;
    process.env.PKMS_HOME = root;
    setRoot(null);

    try {
      expect(await main(["plan", "ship the demo", "--when", "friday"])).toBe(1);
      expect(existsSync(join(root, "vault", "inbox"))).toBe(false);

      expect(await main(["plan", "ship the demo", "--when", "tonight"])).toBe(0);
      const inboxNote = readdirSync(join(root, "vault", "inbox")).find((f) => f.endsWith(".md"))!;

      expect(readFileSync(join(root, "vault", "inbox", inboxNote), "utf8")).toContain("when:");
    } finally {
      if (oldHome === undefined) delete process.env.PKMS_HOME;
      else process.env.PKMS_HOME = oldHome;
      setRoot(null);
    }
  });
});
