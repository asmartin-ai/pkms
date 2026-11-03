import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { SourceRecord } from "./sources.ts";

const AUTOMATED_LOCAL_TOKENS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "notification",
  "notifications",
  "newsletter",
  "news",
  "mailer-daemon",
  "marketing",
  "promo",
  "update",
  "updates",
  "info",
  "hello",
  "team",
  "alert",
  "alerts",
  "billing",
  "invoice",
  "invoices",
  "statement",
  "statements",
  "receipt",
  "receipts",
  "orders",
  "support",
  "service",
]);

const AUTOMATED_LOCAL_PATTERN = /noreply|donotreply|mailerdaemon|(service|support|alerts)$/;

function automatedSender(sender: string): boolean {
  const [local = ""] = sender.split("@");

  return (
    AUTOMATED_LOCAL_TOKENS.has(local) ||
    local.split(/[._+-]/).some((token) => AUTOMATED_LOCAL_TOKENS.has(token)) ||
    AUTOMATED_LOCAL_PATTERN.test(local.replace(/[._+-]/g, ""))
  );
}

export const TuningSchema = z
  .object({
    route_min_confidence: z.number().min(0).max(1).default(0.8),
    route_batch_size: z.number().int().positive().max(1000).default(20),
    route_llm_daily_cap: z.number().int().positive().default(500),
    gmail_auto_archive: z.boolean().default(false),
    keep_poll_minutes: z.number().int().positive().default(10),
    email: z
      .object({
        route_senders: z.array(z.string().trim().toLowerCase().min(1)).default([]),
        noise_senders: z.array(z.string().trim().toLowerCase().min(1)).default([]),
        dismiss_threshold: z.number().int().positive().default(3),
      })
      .default({ route_senders: [], noise_senders: [], dismiss_threshold: 3 }),
    keep: z
      .object({
        recent_days: z.number().int().nonnegative().default(30),
        checklist_days: z.number().int().nonnegative().default(365),
      })
      .default({ recent_days: 30, checklist_days: 365 }),
    engagement: z
      .object({
        if_then: z
          .object({
            enabled: z.boolean().default(true),
            ask_on_capture: z.boolean().default(false),
            ask_on_plan: z.boolean().default(true),
          })
          .default({ enabled: true, ask_on_capture: false, ask_on_plan: true }),
        streak: z
          .object({
            enabled: z.boolean().default(true),
            freezes_per_month: z.number().int().nonnegative().default(2),
            counts: z.array(z.string().min(1)).default(["did", "fold", "route_processed"]),
          })
          .default({
            enabled: true,
            freezes_per_month: 2,
            counts: ["did", "fold", "route_processed"],
          }),
        progress: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
        pings: z
          .object({
            enabled: z.boolean().default(true),
            brief_at: z
              .string()
              .regex(/^\d{2}:\d{2}$/)
              .default("14:00"),
            quiet_start: z
              .string()
              .regex(/^\d{2}:\d{2}$/)
              .default("22:00"),
            quiet_end: z
              .string()
              .regex(/^\d{2}:\d{2}$/)
              .default("09:00"),
            max_per_day: z.number().int().positive().default(3),
          })
          .default({
            enabled: true,
            brief_at: "14:00",
            quiet_start: "22:00",
            quiet_end: "09:00",
            max_per_day: 3,
          }),
        fresh_start: z
          .object({
            enabled: z.boolean().default(true),
            weekly: z.boolean().default(true),
            monthly: z.boolean().default(true),
          })
          .default({ enabled: true, weekly: true, monthly: true }),
      })
      .default({
        if_then: { enabled: true, ask_on_capture: false, ask_on_plan: true },
        streak: { enabled: true, freezes_per_month: 2, counts: ["did", "fold", "route_processed"] },
        progress: { enabled: true },
        pings: {
          enabled: true,
          brief_at: "14:00",
          quiet_start: "22:00",
          quiet_end: "09:00",
          max_per_day: 3,
        },
        fresh_start: { enabled: true, weekly: true, monthly: true },
      }),
  })
  .strict();

export type Tuning = z.infer<typeof TuningSchema>;

export interface RouteContext {
  tuning: Tuning;
  now: Date;
}

export interface RouteDecision {
  decision: "route" | "noise" | "hold";
  reason: string;
  rule: string;
}

export type SourceItem = SourceRecord;

export type RouteBackend = (
  item: SourceItem,
  ctx: RouteContext,
) => RouteDecision | Promise<RouteDecision>;

export function loadTuning(root: string): Tuning {
  const path = join(root, "tuning.json");

  return TuningSchema.parse(existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {});
}

export function senderAddress(from: string): string {
  const stripped = from.replace(/"[^"]*"/g, " ").replace(/\([^()]*\)/g, " ");

  const brackets = [...stripped.matchAll(/<([^<>]+)>/g)].map((match) => match[1]!.trim());
  const candidate = (brackets.at(-1) ?? stripped).trim().toLowerCase();

  return /^[^\s<>@]+@[^\s<>@]+$/.test(candidate) ? candidate : "";
}

function senderMatches(sender: string, entries: string[]): boolean {
  if (!sender) return false;
  const domain = sender.slice(sender.lastIndexOf("@"));

  return entries.some((entry) => (entry.startsWith("@") ? entry === domain : sender === entry));
}

export function decide(item: SourceItem, ctx: RouteContext): RouteDecision {
  const meta = item.data;

  if (meta.source === "email") {
    const sender = senderAddress(meta.from ?? "");

    if (senderMatches(sender, ctx.tuning.email.route_senders)) {
      return {
        decision: "route",
        reason: "sender selected for routing",
        rule: "email.route-sender",
      };
    }

    if (senderMatches(sender, ctx.tuning.email.noise_senders)) {
      return { decision: "noise", reason: "sender selected as noise", rule: "email.noise-sender" };
    }

    if (meta.has_calendar === "true") {
      return { decision: "route", reason: "calendar invite", rule: "email.calendar" };
    }

    const precedence = (meta.precedence ?? "").trim().toLowerCase();
    const autoSubmitted = (meta.auto_submitted ?? "").trim().toLowerCase();

    const bulk =
      "list_unsubscribe" in meta ||
      "list_id" in meta ||
      "feedback_id" in meta ||
      ["bulk", "list", "junk"].includes(precedence) ||
      ("auto_submitted" in meta && autoSubmitted !== "no") ||
      automatedSender(sender);

    if (bulk) return { decision: "noise", reason: "bulk or automated message", rule: "email.bulk" };

    return { decision: "route", reason: "from a person", rule: "email.person" };
  }

  if (meta.source === "keep") {
    if (meta.pinned === "true") {
      return { decision: "route", reason: "pinned note", rule: "keep.pinned" };
    }

    if (meta.keep_archived === "true") {
      return { decision: "hold", reason: "already archived in Keep", rule: "keep.keep-archived" };
    }

    const edited = Date.parse(meta.keep_edited_at ?? "");
    const age = ctx.now.getTime() - edited;

    const editedWithin = (days: number) =>
      Number.isFinite(edited) && age >= 0 && age <= days * 86_400_000;

    if (editedWithin(ctx.tuning.keep.recent_days)) {
      return { decision: "route", reason: "recently edited note", rule: "keep.recent" };
    }

    if (meta.has_unchecked === "true" && editedWithin(ctx.tuning.keep.checklist_days)) {
      return { decision: "route", reason: "open checklist", rule: "keep.open-checklist" };
    }

    return { decision: "hold", reason: "archived for later discovery", rule: "keep.hold" };
  }

  return {
    decision: "hold",
    reason: "WhatsApp uses its direct capture ramp",
    rule: "whatsapp.direct-capture",
  };
}
