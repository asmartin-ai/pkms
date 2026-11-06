import { print } from "./output.ts";
import { INDEX } from "./context.ts";
import { migrateOperational } from "../migrate_operational.ts";

export function cmdMigrateDurableState(argv: string[]): number {
  if (
    argv.some((arg) => arg !== "--apply" && arg !== "--dry-run") ||
    (argv.includes("--apply") && argv.includes("--dry-run"))
  ) {
    print("Usage: pkms migrate-durable-state [--dry-run | --apply]");

    return 1;
  }

  const apply = argv.includes("--apply");

  try {
    const report = migrateOperational(INDEX(), { apply });
    print(report.applied ? "Operational state migrated." : "Inspection only; no records moved.");
    print(`Files: ${report.files.join(", ") || "none"}`);

    for (const [table, count] of Object.entries(report.rows)) print(`${table}: ${count}`);

    if (report.conflicts.length > 0) {
      print(
        `Conflicting state: ${report.conflicts.join(", ")}. Nothing was overwritten. Reconcile copies before retrying.`,
      );

      return 1;
    }

    if (!apply)
      print("Stop all PKMS writers and back up .index and .ledger before rerunning with --apply.");

    return 0;
  } catch (error) {
    print(`Migration stopped: ${error instanceof Error ? error.message : String(error)}`);

    return 1;
  }
}
