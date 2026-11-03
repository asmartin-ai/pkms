import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hasSecret } from "./secrets.ts";

const flights = new Map<string, Promise<void>>();

const PULL_FRESH_MS = 120_000;

const PULL_FAILURE_COOLDOWN_MS = 5 * 60_000;

const PULL_FAILURE = "keep-pull-failure";

export function recordKeepPull(root: string, now: Date = new Date()): void {
  mkdirSync(join(root, ".ledger"), { recursive: true });
  writeFileSync(join(root, ".ledger", "last_pull_at"), `${now.toISOString()}\n`, "utf8");
  const failure = join(root, ".ledger", PULL_FAILURE);

  if (existsSync(failure)) unlinkSync(failure);
}

export function recordKeepFailure(root: string, now: Date = new Date()): void {
  mkdirSync(join(root, ".ledger"), { recursive: true });
  writeFileSync(join(root, ".ledger", PULL_FAILURE), `${now.toISOString()}\n`, "utf8");
}

async function runKeepCommand(root: string): Promise<void> {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, "cli.ts"), "ingest", "keep"], {
    env: { ...process.env, PKMS_HOME: root },
    stdin: "ignore",
    stdout: "ignore",
    stderr: "inherit",
  });

  const code = await child.exited;

  if (code !== 0) throw new Error(`Keep pull exited ${code}`);
}

export function pullKeepIfStale(
  root: string,
  pull?: () => Promise<void>,
  now: Date = new Date(),
): void {
  root = resolve(root);

  if (flights.has(root)) return;

  if (!pull && (!hasSecret(root, "keep-email") || !hasSecret(root, "keep-master-token"))) return;

  try {
    const lastPath = join(root, ".ledger", "last_pull_at");

    const last = existsSync(lastPath)
      ? Date.parse(readFileSync(lastPath, "utf8").trim())
      : Number.NaN;

    if (Number.isFinite(last) && now.getTime() - last <= PULL_FRESH_MS) return;

    const failurePath = join(root, ".ledger", PULL_FAILURE);

    const failed = existsSync(failurePath)
      ? Date.parse(readFileSync(failurePath, "utf8").trim())
      : Number.NaN;

    if (Number.isFinite(failed) && now.getTime() - failed <= PULL_FAILURE_COOLDOWN_MS) return;
  } catch (error) {
    console.error("[keep] cannot read last pull time:", error);

    return;
  }

  const flight = Promise.resolve()
    .then(() => (pull ? pull() : runKeepCommand(root)))
    .catch((error) => {
      recordKeepFailure(root, now);
      console.error("[keep] pull-on-open failed:", error);
    })
    .finally(() => flights.delete(root));

  flights.set(root, flight);
}
