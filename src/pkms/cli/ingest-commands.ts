import { existsSync } from "node:fs";
import { runRouter, type RouterOptions } from "../route.ts";
import { SourceSchema } from "../sources.ts";
import { importTakeout, renderTakeoutReport } from "../keep_takeout.ts";
import {
  ingestEmailOnce,
  queueEmailLabels,
  quietReport,
  renderEmailReport,
  watchEmail,
  type EmailAccount,
} from "../email_ingest.ts";
import { imapEndpoint } from "../imap.ts";
import { resolveSecret } from "../secrets.ts";
import {
  ingestKeep,
  makeKeep,
  renderReport,
  renderSweepReport,
  sweepOldUnpinned,
  withKeepLock,
} from "../keep_ingest.ts";
import { findRamp } from "../ramps/index.ts";
import { NotConnectedError } from "../ramps/email.ts";
import { parseArgs, num, str, bool } from "./args.ts";
import { print } from "./output.ts";
import { root, VAULT, INDEX } from "./context.ts";

export async function cmdRoute(argv: string[]): Promise<number> {
  const { flags, positionals } = parseArgs(argv, {
    "--source": "value",
    "--limit": "value",
    "--dry-run": "bool",
  });

  if (positionals.length > 0) {
    print("usage: pkms route [--source email|keep|whatsapp] [--limit N] [--dry-run]");

    return 1;
  }

  const options: RouterOptions = { dryRun: bool(flags, "--dry-run"), label: queueEmailLabels };

  if (flags.has("--source")) {
    const source = SourceSchema.shape.source.safeParse(str(flags, "--source", ""));

    if (!source.success) {
      print("--source must be email, keep, or whatsapp");

      return 1;
    }

    options.source = source.data;
  }

  if (flags.has("--limit")) {
    const limit = num(flags, "--limit", 0);

    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      print("--limit must be an integer from 1 to 1000");

      return 1;
    }

    options.limit = limit;
  }

  const result = await runRouter(root(), VAULT(), options);

  if (result.busy) {
    print("router already running; no changes made");

    return 0;
  }

  print(`router: ${result.backend}${options.dryRun ? " (dry run; no local changes)" : ""}`);

  for (const item of result.items) {
    print(
      `${item.decision?.decision ?? "pending"}\t${item.sourceNote}\t${item.decision?.reason ?? item.error}`,
    );
  }

  return result.items.some((item) => item.error) ? 1 : 0;
}

export async function cmdIngestKeep(): Promise<number> {
  try {
    const report = await ingestKeep(VAULT(), INDEX(), root());
    print(`[dim]${renderReport(report)}[/dim]`);

    return 0;
  } catch (e) {
    if (e instanceof Error && e.name === "LoginException") {
      print(
        `[yellow]keep login failed[/yellow] (${e.message}) — if this repeats, ` +
          "the master token was revoked; docs/keep-setup.md has the refresh steps",
      );

      return 1;
    }

    throw e;
  }
}

export async function cmdIngestKeepSweep(argv: string[]): Promise<number> {
  const { flags } = parseArgs(argv, { "--age-days": "value", "--apply": "bool" });
  const ageDays = num(flags, "--age-days", 30);

  if (ageDays < 1) throw new Error("--age-days must be >= 1");
  const apply = flags.get("--apply") === true;

  const email = resolveSecret(root(), "keep-email");
  const token = resolveSecret(root(), "keep-master-token");

  if (!email || !token) {
    print(
      "[yellow]keep isn't connected yet[/yellow] — docs/keep-setup.md has " +
        "the one-time setup (~5 min)",
    );

    return 1;
  }

  const keep = await makeKeep(email, token, INDEX());

  const outcome = await withKeepLock(root(), async () =>
    sweepOldUnpinned(keep, INDEX(), {
      ageDays,
      dryRun: !apply,
    }),
  );

  if ("busy" in outcome) {
    print("[dim]keep pull already running[/dim]");

    return 0;
  }

  const report = outcome;

  print(`[dim]${renderSweepReport(report)}[/dim]`);

  if (report.eligible_ids.length > 0 && !apply) {
    print(
      `  [dim]re-run with --apply to delete ${report.eligible_ids.length} ` +
        `note${report.eligible_ids.length !== 1 ? "s" : ""} from Keep[/dim]`,
    );
  }

  return 0;
}

export async function cmdIngestKeepTakeout(argv: string[]): Promise<number> {
  const { flags, positionals } = parseArgs(argv, { "--media-dir": "value" });
  const zipPath = positionals[0];

  if (!zipPath || !existsSync(zipPath)) {
    print(`[red]takeout zip not found: ${zipPath ?? ""}[/red]`);

    return 1;
  }

  const report = await importTakeout(zipPath, VAULT(), INDEX(), {
    mediaDir: str(flags, "--media-dir", "") || undefined,
  });

  print(`[dim]${renderTakeoutReport(report)}[/dim]`);

  if (report.errors.length) {
    for (const err of report.errors.slice(0, 5)) print(`  [dim]! ${err}[/dim]`);

    if (report.errors.length > 5) {
      print(`  [dim]... and ${report.errors.length - 5} more[/dim]`);
    }
  }

  return report.errors.length ? 1 : 0;
}

export async function cmdIngestEmail(argv: string[]): Promise<number> {
  const { flags, positionals } = parseArgs(argv, { "--watch": "bool" });

  if (positionals.length > 0) {
    print("usage: pkms ingest email [--watch]");

    return 1;
  }

  const address = resolveSecret(root(), "email-address");
  const password = resolveSecret(root(), "email-app-password");

  if (!address || !password) {
    print(
      "[yellow]email isn't connected yet[/yellow] — create " +
        ".secrets/email-address (your Gmail address) and " +
        ".secrets/email-app-password (a Gmail app password); " +
        "https://myaccount.google.com/apppasswords",
    );

    return 1;
  }

  const paths = { root: root(), vault: VAULT(), indexDir: INDEX() };
  let account: EmailAccount;

  try {
    account = { address, password, endpoint: imapEndpoint(process.env) };

    if (!bool(flags, "--watch")) {
      for (const line of renderEmailReport(await ingestEmailOnce(paths, account))) print(line);

      return 0;
    }
  } catch (error) {
    console.error(`email: ${error instanceof Error ? error.message : String(error)}`);

    return 1;
  }

  const controller = new AbortController();
  const stop = (): void => controller.abort();

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  print(`email: watching ${account.endpoint.host} INBOX (IDLE)`);

  try {
    const ran = await watchEmail(paths, account, {
      signal: controller.signal,
      onReport: (report) => {
        if (!quietReport(report)) for (const line of renderEmailReport(report)) print(line);
      },
      onError: (message, retryInMs) => {
        console.error(`email: ${message}; reconnecting in ${Math.round(retryInMs / 1000)}s`);
      },
    });

    if (!ran) {
      print(renderEmailReport({ busy: true })[0]);

      return 1;
    }
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }

  return 0;
}

export async function cmdIngestRamp(name: string): Promise<number> {
  const ramp = findRamp(name);

  if (!ramp) return 1;

  try {
    const report = await ramp.pull({
      root: root(),
      vault: VAULT(),
      indexDir: INDEX(),
      readSecret: (n: string) => resolveSecret(root(), n),
    });

    print(`[dim]${report.line}[/dim]`);

    return 0;
  } catch (e) {
    if (e instanceof NotConnectedError) {
      print(`[yellow]${name} isn't connected yet[/yellow] — ${e.message}`);

      return 1;
    }

    throw e;
  }
}

type IngestCommandHandler = (argv: string[]) => number | Promise<number>;

export const INGEST_COMMANDS = new Map<string, IngestCommandHandler>([
  ["keep", cmdIngestKeep],
  ["keep-takeout", cmdIngestKeepTakeout],
  ["keep-sweep", cmdIngestKeepSweep],
  ["email", cmdIngestEmail],
]);
