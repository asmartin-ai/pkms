import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { appendText, pyStrip, splitLines, writeText } from "./textio.ts";
import { emit, eventTs, readEvents, type LedgerEvent } from "./events.ts";
import { loadPost, type Frontmatter } from "./indexer.ts";
import { loadTuning, type Tuning } from "./route_rules.ts";
import { frontmatterValue, writeCapture } from "./capture.ts";
import { z } from "zod";

export type EngagementTuning = Tuning["engagement"];

const LOCAL_TZ = "America/Chicago";

export function localDay(at: Date = new Date(), timeZone: string = LOCAL_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function localMinutes(at: Date = new Date(), timeZone: string = LOCAL_TZ): string {
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);

  return hm === "24:00" ? "00:00" : hm;
}

export function withinQuiet(minutes: string, quietStart: string, quietEnd: string): boolean {
  if (quietStart === quietEnd) return false;

  if (quietStart < quietEnd) return minutes >= quietStart && minutes < quietEnd;

  return minutes >= quietStart || minutes < quietEnd;
}

const COUNT_ALIASES = {
  did: ["did"],
  fold: ["folded"],
  route_processed: ["routed", "noise", "hold"],
} satisfies Record<string, readonly string[]>;

function countKinds(configured: string[]): Set<string> {
  const kinds = new Set<string>();

  const aliases = new Map(Object.entries(COUNT_ALIASES));

  for (const name of configured) for (const k of aliases.get(name) ?? [name]) kinds.add(k);

  return kinds;
}

export interface StreakState {
  days: number;
  freezesLeft: number;
  todayCounted: boolean;
  freezesUsedThisMonth: string[];
}

export function streakState(
  events: LedgerEvent[],
  tuning: EngagementTuning,
  now: Date = new Date(),
): StreakState {
  const kinds = countKinds(tuning.streak.counts);
  const countedDays = new Set<string>();

  for (const e of events) {
    if (!kinds.has(e.kind)) continue;
    countedDays.add(localDay(new Date(e.ts)));
  }

  const today = localDay(now);
  const month = today.slice(0, 7);
  const freezesUsed: string[] = [];

  let key = countedDays.has(today) ? today : prevDayKey(today);

  let days = 0;

  for (;;) {
    if (countedDays.has(key)) {
      days += 1;
      key = prevDayKey(key);
      continue;
    }

    const gapMonth = key.slice(0, 7);
    const usedThisGapMonth = freezesUsed.filter((d) => d.slice(0, 7) === gapMonth).length;
    const remaining = tuning.streak.freezes_per_month - usedThisGapMonth;

    let reach = 0;
    let probe = key;

    for (let i = 1; i <= remaining; i++) {
      probe = prevDayKey(probe);

      if (countedDays.has(probe)) {
        reach = i;
        break;
      }
    }

    if (reach === 0) break;

    for (let i = 0; i < reach; i++) {
      freezesUsed.push(key);
      days += 1;
      key = prevDayKey(key);
    }
  }

  const usedCurrentMonth = freezesUsed.filter((d) => d.slice(0, 7) === month).length;

  return {
    days,
    freezesLeft: Math.max(0, tuning.streak.freezes_per_month - usedCurrentMonth),
    todayCounted: countedDays.has(today),
    freezesUsedThisMonth: freezesUsed.filter((d) => d.slice(0, 7) === month),
  };
}

function nextDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);

  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function prevDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);

  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

function zoneOffsetMs(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const noonGuess = new Date(Date.UTC(y, m - 1, d, 12));

  return (hhmmToMinutes(localMinutes(noonGuess)) - 12 * 60) * 60_000;
}

function isoAtLocal(dayKey: string, minutes: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);

  return new Date(Date.UTC(y, m - 1, d) + minutes * 60_000 - zoneOffsetMs(dayKey)).toISOString();
}

export const PLAN_QUICK_PICKS = ["this afternoon", "tonight", "tomorrow morning"] as const;

export function quickPickToIso(pick: string, now: Date = new Date()): string | null {
  const today = localDay(now);
  const minutes = hhmmToMinutes(localMinutes(now));

  switch (pick) {
    case "this afternoon":
      return isoAtLocal(minutes >= 14 * 60 ? nextDayKey(today) : today, 14 * 60);
    case "tonight":
      return isoAtLocal(minutes >= 20 * 60 ? nextDayKey(today) : today, 20 * 60);
    case "tomorrow morning":
      return isoAtLocal(nextDayKey(today), 9 * 60);
    default:
      return null;
  }
}

export function resolveWhen(when: string, now: Date = new Date()): string | null {
  const resolved = quickPickToIso(when, now) ?? when;

  return Number.isNaN(Date.parse(resolved)) ? null : resolved;
}

export interface PlanNote {
  path: string;
  thing: string;
  when: string | null;
  cue: string | null;
  state: "open" | "done" | "missed";
}

function upsertFrontmatter(absPath: string, patch: Record<string, string>): void {
  const raw = pyStrip(readFileSync(absPath, "utf8"));
  const { data, content } = loadPost(raw);
  const merged: Frontmatter = {};

  for (const [k, v] of Object.entries(data ?? {})) merged[k] = v;

  for (const [k, v] of Object.entries(patch)) merged[k] = v;

  const fm = Object.entries(merged).map(([k, v]) => `${k}: ${frontmatterValue(v)}`);
  const text = `---\n${fm.join("\n")}\n---\n\n${pyStrip(content)}\n`;
  const temporary = `${absPath}.${randomUUID()}.tmp`;

  try {
    writeFileSync(temporary, text, { encoding: "utf8", flag: "wx", mode: 0o600 });
    renameSync(temporary, absPath);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function vaultRelative(vault: string, abs: string): string {
  return abs.slice(vault.length + 1).replace(/\\/g, "/");
}

function rootOf(vault: string): string {
  return dirname(vault);
}

const PlanFmSchema = z
  .object({
    plan: z.union([z.boolean(), z.string()]).optional(),
    when: z.string().optional(),
    cue: z.string().optional(),
    plan_state: z.string().optional(),
  })
  .catchall(z.unknown());

const NoteFmSchema = z
  .object({
    title: z.string().optional(),
    hidden: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
  })
  .catchall(z.unknown());

export function readPlan(vault: string, rel: string): PlanNote | null {
  const abs = join(vault, rel);

  if (!existsSync(abs)) return null;

  try {
    const { data, content } = loadPost(pyStrip(readFileSync(abs, "utf8")));
    const d = PlanFmSchema.parse(data ?? {});

    if (String(d.plan ?? "") !== "true") return null;
    const state = String(d.plan_state ?? "open");

    return {
      path: rel,
      thing: splitLines(pyStrip(content)).find((l) => l.trim()) ?? rel,
      when: d.when ? String(d.when) : null,
      cue: d.cue ? String(d.cue) : null,
      state: state === "done" ? "done" : state === "missed" ? "missed" : "open",
    };
  } catch {
    return null;
  }
}

export function setPlan(
  vault: string,
  thing: string,
  opts: { when?: string | null; cue?: string | null; source?: string; now?: Date } = {},
): PlanNote {
  const now = opts.now ?? new Date();

  const extra = new Map<string, string>([["plan", "true"]]);

  if (opts.when) extra.set("when", opts.when);

  if (opts.cue) extra.set("cue", opts.cue);

  const abs = writeCapture(thing, vault, {
    source: opts.source ?? "plan",
    now,
    extra: Object.fromEntries(extra),
  });

  const rel = vaultRelative(vault, abs);
  emit(rootOf(vault), "plan_set", {
    source: opts.source ?? "plan",
    ref: rel,
    payload: { mechanic: "if_then", when: opts.when ?? "", cue: opts.cue ?? "" },
    at: now,
  });

  return { path: rel, thing, when: opts.when ?? null, cue: opts.cue ?? null, state: "open" };
}

export function answerPlan(
  vault: string,
  rel: string,
  answer: { when?: string | null; cue?: string | null; skipped?: boolean },
): void {
  if (readPlan(vault, rel) === null) return;

  const patch: Record<string, string> = {};

  if (answer.when) patch.when = answer.when;

  if (answer.cue) patch.cue = answer.cue;

  if (Object.keys(patch).length) upsertFrontmatter(join(vault, rel), patch);
  emit(rootOf(vault), answer.skipped ? "prompt_skipped" : "prompt_answered", {
    source: "plan",
    ref: rel,
    payload: answer.skipped
      ? { mechanic: "if_then" }
      : { mechanic: "if_then", when: answer.when ?? "", cue: answer.cue ?? "" },
  });
}

export function completePlan(vault: string, rel: string): void {
  const plan = readPlan(vault, rel);

  if (!plan || plan.state !== "open") return;
  upsertFrontmatter(join(vault, rel), { plan_state: "done" });
  emit(rootOf(vault), "plan_done", { source: "plan", ref: rel, payload: { mechanic: "if_then" } });
}

export function listPlans(vault: string): PlanNote[] {
  const inbox = join(vault, "inbox");

  if (!existsSync(inbox)) return [];
  const out: PlanNote[] = [];

  for (const name of readdirSync(inbox)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const plan = readPlan(vault, `inbox/${name}`);

    if (plan) out.push(plan);
  }

  return out;
}

export interface TickOptions {
  deliver?: (text: string, ref: string) => Promise<boolean> | boolean;
  now?: Date;
}

export interface TickResult {
  briefSent: boolean;
  remindersSent: number;
  missedMarked: number;
  streakObserved: boolean;
  suppressedByQuietHours: boolean;
  suppressedByCap: boolean;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);

  return (h ?? 0) * 60 + (m ?? 0);
}

function sentToday(events: LedgerEvent[], kinds: string[], day: string): number {
  return events.filter((e) => kinds.includes(e.kind) && localDay(new Date(e.ts)) === day).length;
}

export async function engagementTick(
  root: string,
  vault: string,
  tuning?: EngagementTuning,
  opts: TickOptions = {},
): Promise<TickResult> {
  const now = opts.now ?? new Date();
  const cfg = tuning ?? loadTuning(root).engagement;
  const events = readEvents(root, { limit: -1 });
  const day = localDay(now);

  const result: TickResult = {
    briefSent: false,
    remindersSent: 0,
    missedMarked: 0,
    streakObserved: false,
    suppressedByQuietHours: false,
    suppressedByCap: false,
  };

  if (cfg.if_then.enabled) {
    for (const plan of listPlans(vault)) {
      if (plan.state !== "open" || !plan.when) continue;

      if (now.getTime() - Date.parse(plan.when) > 12 * 3600_000) {
        if (events.some((e) => e.kind === "plan_missed" && e.ref === plan.path)) continue;
        upsertFrontmatter(join(vault, plan.path), { plan_state: "missed" });
        emit(root, "plan_missed", {
          source: "plan",
          ref: plan.path,
          payload: { mechanic: "if_then" },
          at: now,
        });
        result.missedMarked += 1;
      }
    }
  }

  if (cfg.streak.enabled) {
    const streak = streakState(events, cfg, now);

    if (
      streak.todayCounted &&
      !events.some((e) => e.kind === "streak_day" && e.ref === `streak:${day}`)
    ) {
      emit(root, "streak_day", {
        source: "pkms",
        ref: `streak:${day}`,
        payload: { mechanic: "streak", days: streak.days },
        at: now,
      });
      result.streakObserved = true;
    }

    for (const date of streak.freezesUsedThisMonth) {
      if (!events.some((e) => e.kind === "streak_freeze_used" && e.ref === `freeze:${date}`)) {
        emit(root, "streak_freeze_used", {
          source: "pkms",
          ref: `freeze:${date}`,
          payload: { mechanic: "streak" },
          at: now,
        });
      }
    }
  }

  if (!cfg.pings.enabled) return result;

  const quiet = withinQuiet(localMinutes(now), cfg.pings.quiet_start, cfg.pings.quiet_end);
  let sent = sentToday(events, ["nudge_sent"], day);

  const canSend = (): boolean => {
    if (quiet) {
      result.suppressedByQuietHours = true;

      return false;
    }

    if (sent >= cfg.pings.max_per_day) {
      result.suppressedByCap = true;

      return false;
    }

    return true;
  };

  const deliver = opts.deliver;

  const send = async (text: string, ref: string, mechanic: string): Promise<boolean> => {
    if (!canSend()) return false;

    if (!deliver || !(await deliver(text, ref))) return false;
    emit(root, "nudge_sent", {
      source: "pkms",
      ref,
      payload: { mechanic, channel: "discord" },
      at: now,
    });
    sent += 1;

    return true;
  };

  const briefRef = `brief:${day}`;
  const nowMinutes = hhmmToMinutes(localMinutes(now));

  if (
    nowMinutes >= hhmmToMinutes(cfg.pings.brief_at) &&
    !events.some((e) => e.kind === "nudge_sent" && e.ref === briefRef)
  ) {
    const streak = streakState(events, cfg, now);
    const lines: string[] = [];

    if (cfg.streak.enabled) {
      lines.push(
        `streak: ${streak.days} day${streak.days === 1 ? "" : "s"}${streak.todayCounted ? "" : " — today is still open"}`,
      );
    }

    const due = cfg.if_then.enabled
      ? listPlans(vault).filter(
          (p) => p.state === "open" && p.when && Date.parse(p.when) <= now.getTime() + 6 * 3600_000,
        )
      : [];

    for (const p of due.slice(0, 3)) lines.push(`due: ${p.thing}`);

    if (lines.length) result.briefSent = await send(lines.join("\n"), briefRef, "brief");
  }

  if (cfg.if_then.enabled) {
    for (const plan of listPlans(vault)) {
      if (plan.state !== "open" || !plan.when) continue;
      const dueAt = Date.parse(plan.when);

      if (dueAt > now.getTime() || now.getTime() - dueAt > 12 * 3600_000) continue;
      const ref = `plan:${plan.path}:${plan.when}`;

      if (events.some((e) => e.kind === "nudge_sent" && e.ref === ref)) continue;
      const whenText = plan.cue || localMinutes(new Date(dueAt));

      if (await send(`It's ${whenText}: you said you'd ${plan.thing}.`, ref, "plan_reminder")) {
        result.remindersSent += 1;
      }
    }
  }

  return result;
}

export interface FreshStart {
  show: boolean;
  landmark: "week" | "month" | null;
}

export function freshStartState(
  events: LedgerEvent[],
  tuning: EngagementTuning,
  now: Date = new Date(),
): FreshStart {
  if (!tuning.fresh_start.enabled) return { show: false, landmark: null };
  const day = localDay(now);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();

  const landmark: "week" | "month" | null =
    weekday === 1 && tuning.fresh_start.weekly
      ? "week"
      : day.endsWith("-01") && tuning.fresh_start.monthly
        ? "month"
        : null;

  if (!landmark) return { show: false, landmark: null };
  const ref = `fresh:${landmark}:${day}`;

  return { show: !events.some((e) => e.kind === "fresh_start_shown" && e.ref === ref), landmark };
}

export function markFreshStartShown(root: string, now: Date = new Date()): void {
  const events = readEvents(root, { limit: -1 });
  const fresh = freshStartState(events, loadTuning(root).engagement, now);

  if (!fresh.show || !fresh.landmark) return;

  emit(root, "fresh_start_shown", {
    source: "web",
    ref: `fresh:${fresh.landmark}:${localDay(now)}`,
    payload: { mechanic: "fresh_start", landmark: fresh.landmark },
  });
}

export interface ProjectProgress {
  path: string;
  title: string;
  done: number;
  total: number;
}

export function projectProgress(vault: string): ProjectProgress[] {
  const projects = join(vault, "projects");

  if (!existsSync(projects)) return [];
  const out: ProjectProgress[] = [];

  const walk = (dir: string, rel: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name);
      const r = rel ? `${rel}/${name}` : name;

      if (statSync(abs).isDirectory()) {
        walk(abs, r);
        continue;
      }

      if (!name.endsWith(".md")) continue;
      const { data, content } = loadPost(pyStrip(readFileSync(abs, "utf8")));

      const d = NoteFmSchema.parse(data ?? {});

      if (d.hidden === true) continue;
      const items = splitLines(pyStrip(content)).filter((l) => /^\s*[-*]\s+\[[ xX]\]/.test(l));

      if (!items.length) continue;
      const checked = items.filter((l) => /^\s*[-*]\s+\[[xX]\]/.test(l)).length;
      out.push({
        path: `projects/${r}`,
        title: String(d.title || name.replace(/\.md$/, "")),
        done: checked + 1,
        total: items.length + 1,
      });
    }
  };

  walk(projects, "");
  out.sort((a, b) => (a.path < b.path ? -1 : 1));

  return out.slice(0, 6);
}

export interface MechanicStats {
  shown: number;
  answered: number;
  skipped: number;
  dismissed: number;
  acted: number;
  skipDismissRate: number;
}

export interface AnalyzeResult {
  reportPath: string;
  autoDisabled: { mechanic: string; rate: number }[];
}

function window(events: LedgerEvent[], now: Date, daysBack: number): LedgerEvent[] {
  const cutoff = now.getTime() - daysBack * 86_400_000;

  return events.filter((e) => Date.parse(e.ts) >= cutoff);
}

function mechanicStats(events: LedgerEvent[], mechanic: "if_then" | "pings"): MechanicStats {
  const kinds =
    mechanic === "if_then"
      ? { shown: "prompt_shown", skipped: "prompt_skipped", answered: "prompt_answered" }
      : { shown: "nudge_sent", skipped: "nudge_dismissed", answered: "nudge_acted" };

  const count = (kind: string) => events.filter((e) => e.kind === kind).length;
  const shown = count(kinds.shown);
  const skipped = count(kinds.skipped);
  const dismissed = mechanic === "if_then" ? count("prompt_dismissed") : 0;
  const answered = count(kinds.answered);
  const acted = count("nudge_acted") + count("nudge_opened");

  return {
    shown,
    answered,
    skipped,
    dismissed,
    acted,
    skipDismissRate: shown === 0 ? 0 : (skipped + dismissed) / shown,
  };
}

function isoWeek(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  const thursday = new Date(d);

  thursday.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const year = thursday.getUTCFullYear();
  const week = 1 + Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 / 7);

  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function autoDisableMechanic(
  root: string,
  mechanic: "if_then" | "pings",
  rate: number,
  now: Date,
): void {
  const tuning = loadTuning(root);
  const next = structuredClone(tuning);
  next.engagement[mechanic].enabled = false;
  const key = `engagement.${mechanic}.enabled`;

  appendText(
    join(root, ".ledger", "tuning-changes.jsonl"),
    `${JSON.stringify({
      ts: eventTs(now),
      key,
      value: false,
      because: `skip+dismiss rate ${(rate * 100).toFixed(0)}% over ≥10 shows in each of the last 2 weeks`,
    })}\n`,
  );

  const path = join(root, "tuning.json");
  const temporary = `${path}.${randomUUID()}.tmp`;

  try {
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, {
      encoding: "utf-8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }

  emit(root, "tuning_changed", {
    source: "pkms",
    ref: key,
    payload: { mechanic, value: false, by: "analyze", because: "auto-off threshold" },
    at: now,
  });
}

export function analyzeWeek(root: string, vault: string, now: Date = new Date()): AnalyzeResult {
  const events = readEvents(root, { limit: -1 });
  const thisWeek = window(events, now, 7);
  const lastWeek = window(events, now, 14).filter((e) => !thisWeek.includes(e));
  const tuning = loadTuning(root).engagement;
  const autoDisabled: { mechanic: string; rate: number }[] = [];

  for (const mechanic of ["if_then"] as const) {
    if (!tuning[mechanic].enabled) continue;

    const a = mechanicStats(thisWeek, mechanic);
    const b = mechanicStats(lastWeek, mechanic);

    if (a.shown >= 10 && b.shown >= 10 && a.skipDismissRate > 0.7 && b.skipDismissRate > 0.7) {
      const rate = Math.min(a.skipDismissRate, b.skipDismissRate);
      autoDisableMechanic(root, mechanic, rate, now);
      autoDisabled.push({ mechanic, rate });
    }
  }

  const ifThen = mechanicStats(thisWeek, "if_then");
  const pings = mechanicStats(thisWeek, "pings");
  const plansSet = thisWeek.filter((e) => e.kind === "plan_set").length;
  const plansDone = thisWeek.filter((e) => e.kind === "plan_done").length;
  const plansMissed = thisWeek.filter((e) => e.kind === "plan_missed").length;
  const streak = streakState(events, tuning, now);
  const freezes = thisWeek.filter((e) => e.kind === "streak_freeze_used").length;
  const fresh = thisWeek.filter((e) => e.kind === "fresh_start_shown").length;
  const day = localDay(now);
  const week = isoWeek(day);
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

  const lines = [
    `# Engagement — week ${week}`,
    "",
    `Window: 7 days ending ${day}. Generated by \`pkms analyze --week\`.`,
    "",
    ...(autoDisabled.length
      ? [
          `> **Auto-off:** ${autoDisabled
            .map((d) => `\`${d.mechanic}\` at ${pct(d.rate)} skip+dismiss`)
            .join(
              ", ",
            )} — disabled by the weekly rule (reversible: flip \`engagement.<mechanic>.enabled\` back in tuning.json).`,
          "",
        ]
      : []),
    "## Mechanics",
    "",
    "| Mechanic | Shows | Answered | Skipped/Dismissed | Skip+dismiss |",
    "|---|---|---|---|---|",
    `| if–then prompts | ${ifThen.shown} | ${ifThen.answered} | ${ifThen.skipped + ifThen.dismissed} | ${pct(ifThen.skipDismissRate)} |`,
    `| pings | ${pings.shown} | ${pings.acted} | no dismiss signal yet | n/a |`,
    "",
    "## Plans",
    "",
    `- set: ${plansSet}, done: ${plansDone}, missed: ${plansMissed}`,
    "",
    "## Streak",
    "",
    `- current: ${streak.days} day${streak.days === 1 ? "" : "s"}; freezes used this week: ${freezes}; left this month: ${streak.freezesLeft}`,
    "",
    "## Fresh starts",
    "",
    `- cards shown: ${fresh}`,
    "",
    "## Friction watch",
    "",
    "- Capture stays one step everywhere; prompts are post-save and skippable.",
    `- if–then skip rate ${pct(ifThen.skipDismissRate)} (auto-off threshold: >70% over ≥10 shows, two weeks running); pings: no dismiss signal yet emitted.`,
    "",
  ].join("\n");

  const reportsDir = join(vault, "resources", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, `${week}-engagement.md`);
  writeText(reportPath, `${lines}\n`);

  return { reportPath, autoDisabled };
}
