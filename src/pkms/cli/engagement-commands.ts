import { basename } from "node:path";
import { indexVault } from "../indexer.ts";
import { readEvents } from "../events.ts";
import { appendDid } from "../daily.ts";
import {
  analyzeWeek,
  engagementTick,
  PLAN_QUICK_PICKS,
  resolveWhen,
  setPlan,
  streakState,
} from "../engagement.ts";
import { loadTuning } from "../route_rules.ts";
import { resolveSecret } from "../secrets.ts";
import { API_BASE } from "../discord_gateway.ts";
import { sendDm } from "../discord_agent.ts";
import { parseArgs, str, bool } from "./args.ts";
import { print } from "./output.ts";
import { root, VAULT, INDEX } from "./context.ts";

export function cmdDid(argv: string[]): number {
  const thing = argv.join(" ");
  appendDid(VAULT(), thing);
  print("[green]✓ counted[/green] [dim]— it shows in pkms today[/dim]");

  return 0;
}

export function cmdPlan(argv: string[]): number {
  const { flags, positionals } = parseArgs(argv, {
    "--when": "value",
    "-w": "value",
    "--cue": "value",
    "-c": "value",
  });

  const thing = positionals.join(" ");

  if (!thing.trim()) {
    print(
      "[yellow]usage:[/yellow] pkms plan <thing> [--when <iso|this afternoon|tonight|tomorrow morning>] [--cue <text>]",
    );

    return 1;
  }

  const when = str(flags, "--when", "") || str(flags, "-w", "");
  const cue = str(flags, "--cue", "") || str(flags, "-c", "");

  let iso: string | null = null;

  if (when) {
    iso = resolveWhen(when);

    if (iso === null) {
      print(
        "[yellow]unknown when:[/yellow] use an ISO timestamp or one of " +
          PLAN_QUICK_PICKS.join(" / "),
      );

      return 1;
    }
  }

  const plan = setPlan(VAULT(), thing, { when: iso, cue: cue || null, source: "cli" });
  print(
    `[green]planned ✓[/green] inbox/${basename(plan.path)}` +
      (iso ? ` [dim]· when ${iso}[/dim]` : ""),
  );

  return 0;
}

export function cmdStreak(): number {
  const tuning = loadTuning(root()).engagement;
  const s = streakState(readEvents(root(), { limit: -1 }), tuning);
  const freezes = `${s.freezesLeft} freeze${s.freezesLeft === 1 ? "" : "s"} left this month`;

  if (s.days === 0) {
    print("[dim]no streak yet — one did today starts one[/dim]");

    return 0;
  }

  print(
    `[green]🔥 ${s.days} day${s.days === 1 ? "" : "s"}[/green] [dim]· ${freezes}` +
      `${s.todayCounted ? "" : " · today still open"}[/dim]`,
  );

  return 0;
}

export function cmdAnalyze(argv: string[]): number {
  const { flags } = parseArgs(argv, { "--week": "bool" });

  if (!bool(flags, "--week")) {
    print("[yellow]usage:[/yellow] pkms analyze --week");

    return 1;
  }

  const result = analyzeWeek(root(), VAULT());

  for (const d of result.autoDisabled) {
    print(`[yellow]auto-off:[/yellow] ${d.mechanic} at ${(d.rate * 100).toFixed(0)}% skip+dismiss`);
  }

  indexVault(VAULT(), INDEX());
  print(`[green]report ✓[/green] ${result.reportPath.slice(VAULT().length + 1)}`);

  return 0;
}

export async function cmdEngagementTick(): Promise<number> {
  const botToken = resolveSecret(root(), "discord-bot-token");
  const discordUserId = resolveSecret(root(), "discord-user-id");

  if (!botToken || !discordUserId) {
    print(
      "[dim]discord delivery not configured — pings are held (create " +
        ".secrets/discord-bot-token and .secrets/discord-user-id)[/dim]",
    );
  }

  const result = await engagementTick(root(), VAULT(), undefined, {
    deliver:
      botToken && discordUserId
        ? async (text) => (await sendDm(API_BASE, botToken, discordUserId, text)) !== null
        : undefined,
  });

  const bits: string[] = [];

  if (result.missedMarked)
    bits.push(`${result.missedMarked} plan${result.missedMarked === 1 ? "" : "s"} missed`);

  if (result.briefSent) bits.push("brief sent");

  if (result.remindersSent)
    bits.push(`${result.remindersSent} reminder${result.remindersSent === 1 ? "" : "s"}`);

  if (result.suppressedByQuietHours) bits.push("quiet hours held");

  if (result.suppressedByCap) bits.push("daily cap held");

  print(bits.length ? bits.join(" · ") : "[dim]nothing due[/dim]");

  return 0;
}
