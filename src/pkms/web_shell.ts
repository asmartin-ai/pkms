import nunjucks from "nunjucks";
import { z } from "zod";
import { dirname, join } from "node:path";
import {
  readingQueue,
  todayView,
  inboxItems,
  areaTiles,
  recognitionCards,
  recentNotes,
  type TodayView,
  type NextAction,
  type NextRead,
  type RecognitionCard,
  type InboxItem,
  type AreaTile,
} from "./today.ts";
import { search } from "./search.ts";
import { readEvents } from "./events.ts";
import { loadTuning } from "./route_rules.ts";

import { freshStartState, projectProgress, streakState, PLAN_QUICK_PICKS } from "./engagement.ts";

const JsonValueSchema = z.json();

type JsonValue = z.infer<typeof JsonValueSchema>;

export const TEMPLATES_DIR = join(import.meta.dir, "web", "templates");

const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(TEMPLATES_DIR), {
  autoescape: true,
});

env.addFilter("json", (v: JsonValue) => JSON.stringify(v));

env.addFilter("longdate", longDate);

env.addFilter("shortdate", shortDate);

env.addFilter("touched", touched);

env.addFilter("stripbullet", stripBullet);

function longDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");

  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");

  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function touched(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso);

  if (Number.isNaN(t.getTime())) return "";
  const diffMs = Date.now() - t.getTime();
  const sec = Math.max(0, Math.round(diffMs / 1000));

  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);

  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);

  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);

  if (day === 1) return "yesterday";

  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);

  if (wk === 1) return "last week";

  if (wk < 5) return `${wk}w ago`;

  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function stripBullet(line: string): string {
  return line.replace(/^-\s+/, "");
}

function leadMeta(today: TodayView): string {
  const lead = today.next_actions[0];

  if (!lead) return "";
  const parts: string[] = [];

  if (lead.size) parts.push(`⏱ ${lead.size}`);

  if (lead.note) parts.push(lead.note);

  return parts.join(" · ");
}

export interface TodayContext {
  today: TodayView;
  lead: NextAction | null;
  rest: NextAction[];
  leadMeta: string;
  nextRead: NextRead | null;
  recognitionCards: RecognitionCard[];
  inboxItems: InboxItem[];
  areaTiles: AreaTile[];
  streak: { days: number; freezesLeft: number; todayCounted: boolean } | null;
  projects: { path: string; title: string; done: number; total: number }[];
  freshStart: { landmark: "week" | "month" } | null;
}

export function buildTodayCtx(
  vault: string,
  indexDir: string,
  now: Date = new Date(),
): TodayContext {
  const today = todayView(vault, indexDir);
  const reading = readingQueue(vault);
  const lead = today.next_actions[0] ?? null;
  const rest = lead ? today.next_actions.slice(1) : today.next_actions;
  const nextRead = (reading.length ? reading[0] : null) ?? today.next_read ?? null;
  const root = dirname(vault);
  const engagement = loadTuning(root).engagement;
  const events = readEvents(root, { limit: -1 });
  const streak = streakState(events, engagement, now);
  const fresh = freshStartState(events, engagement, now);

  return {
    today,
    lead,
    rest,
    leadMeta: lead ? leadMeta(today) : "",
    nextRead,
    recognitionCards: recognitionCards(vault, indexDir),
    inboxItems: inboxItems(vault),
    areaTiles: areaTiles(vault, indexDir),
    streak: engagement.streak.enabled
      ? { days: streak.days, freezesLeft: streak.freezesLeft, todayCounted: streak.todayCounted }
      : null,
    projects: engagement.progress.enabled ? projectProgress(vault) : [],
    freshStart:
      engagement.if_then.enabled && engagement.if_then.ask_on_plan && fresh.show && fresh.landmark
        ? { landmark: fresh.landmark }
        : null,
  };
}

export function renderToday(vault: string, indexDir: string, now: Date = new Date()): string {
  return env.render("today.njk", buildTodayCtx(vault, indexDir, now)).trim();
}

export function renderReadingQueue(vault: string): string {
  return env.render("reading_queue.njk", { items: readingQueue(vault) }).trim();
}

export function renderActions(vault: string, indexDir: string): string {
  const today = todayView(vault, indexDir);

  return env.render("actions.njk", { actions: today.next_actions }).trim();
}

export function renderRecentNotes(vault: string, indexDir: string): string {
  return env.render("recent_notes.njk", { notes: recentNotes(vault, indexDir) }).trim();
}

export function renderSearchResults(query: string, indexDir: string): string {
  const q = query.trim();
  const results = q ? search(q, indexDir) : [];

  return env.render("search_results.njk", { q, results }).trim();
}

export function renderResurfaceCell(vault: string, indexDir: string, gone: boolean): string {
  const today = todayView(vault, indexDir);

  return renderResurfaceCellToday(gone ? { ...today, resurface: null } : today);
}

export function renderResurfaceCellToday(today: TodayView): string {
  return env.render("partials/_resurface_cell.njk", { today }).trim();
}

export function renderPlanPrompt(path: string): string {
  return env.render("partials/_plan_prompt.njk", { path, picks: PLAN_QUICK_PICKS }).trim();
}

export function renderPlanConfirmed(skipped: boolean): string {
  return skipped
    ? `<div class="plan-answer" id="plan-answer">saved — no time set.</div>`
    : `<div class="plan-answer" id="plan-answer">planned ✓ — you'll get one ping at the time.</div>`;
}
