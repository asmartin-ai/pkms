import { rampNames, findRamp } from "./ramps/index.ts";
import {
  cmdIndex,
  cmdEvents,
  cmdSearch,
  cmdBacklinks,
  cmdTasks,
  cmdResurface,
  cmdToday,
  cmdDaily,
  cmdNew,
} from "./cli/vault-commands.ts";
import { cmdCapture, cmdPromote } from "./cli/capture-commands.ts";
import {
  cmdDid,
  cmdPlan,
  cmdStreak,
  cmdAnalyze,
  cmdEngagementTick,
} from "./cli/engagement-commands.ts";
import { cmdRoute, cmdIngestRamp, INGEST_COMMANDS } from "./cli/ingest-commands.ts";
import { cmdDiscordBot } from "./cli/discord-commands.ts";
import { cmdServe, cmdMcp } from "./cli/serve.ts";
import { print } from "./cli/output.ts";

export { projectRoot, setRoot } from "./cli/context.ts";

export { serveOptions, type ServeOptions } from "./cli/serve.ts";

type CliCommandHandler = (argv: string[]) => number | Promise<number>;

const COMMANDS = new Map<string, CliCommandHandler>([
  ["index", cmdIndex],
  ["events", cmdEvents],
  ["route", cmdRoute],
  ["search", cmdSearch],
  ["backlinks", cmdBacklinks],
  ["tasks", cmdTasks],
  ["resurface", cmdResurface],
  ["did", cmdDid],
  ["capture", cmdCapture],
  ["today", cmdToday],
  ["promote", cmdPromote],
  ["serve", cmdServe],
  ["daily", cmdDaily],
  ["new", cmdNew],
  ["plan", cmdPlan],
  ["streak", cmdStreak],
  ["analyze", cmdAnalyze],
  ["engagement-tick", cmdEngagementTick],
  ["mcp", cmdMcp],
]);

export async function main(argv: string[] = Bun.argv.slice(2)): Promise<number> {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printUsage();

    return 0;
  }

  if (cmd === "ingest") {
    const sub = rest[0];

    if (sub === undefined) {
      print(`[dim]ingest ramps:[/dim] ${rampNames()} (plus keep-sweep)`);

      return 0;
    }

    const handler = INGEST_COMMANDS.get(sub);

    if (handler !== undefined) return await handler(rest.slice(1));

    if (findRamp(sub) !== null) return await cmdIngestRamp(sub);

    print(`[yellow]unknown ingest command[/yellow] — one of: ${rampNames()}, keep-sweep`);

    return 1;
  }

  if (cmd === "discord-bot") return cmdDiscordBot(rest);
  const fn = COMMANDS.get(cmd);

  if (!fn) {
    print(`[yellow]unknown command:[/yellow] ${cmd}`);
    printUsage();

    return 1;
  }

  return await fn(rest);
}

function printUsage(): void {
  print("Personal Knowledge Management System");
  print();
  print("Commands:");
  print("  index       Rebuild the full index from the vault");
  print("  events      Inspect the operational ledger (--since/--kind)");
  print("  route       Route pending archives (--source/--limit/--dry-run)");
  print("  search      Full-text search across all notes (--raw for FTS5 syntax)");
  print("  backlinks   Show notes that link to a given note");
  print("  tasks       One next action per note (--all/--stash/--stale/--done)");
  print("  resurface   Up to three curious questions (--not-now/--let-go)");
  print("  did         Log a done thing");
  print("  capture     Dump a thought into vault/inbox/");
  print("  today       The front door briefing");
  print("  promote     Promote a hoarded Reddit thread into the vault");
  print("  serve       Run the capture endpoint (--host/--port/--token)");
  print(`  ingest      Pull side-door captures into the inbox (${rampNames()}|keep-sweep)`);
  print("  discord-bot Run the Discord capture bot");
  print("  daily       Open or create today's daily note (--open/--no-open)");
  print("  new         Create a new note (--folder)");
  print("  mcp         Serve the khaos MCP tools over stdio (for Hermes)");
}

if (import.meta.main) {
  main().then((code) => {
    if (code !== 0) process.exit(code);
  });
}
