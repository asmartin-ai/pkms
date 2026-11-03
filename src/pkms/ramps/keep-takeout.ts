import { importTakeout, renderTakeoutReport } from "../keep_takeout.ts";
import type { InputRamp, RampContext, RampReport } from "../ramp.ts";
import { NotConnectedError } from "./email.ts";

export const KEEP_TAKEOUT_RAMP_NAME = "keep-takeout";

export const keepTakeoutRamp: InputRamp = {
  name: KEEP_TAKEOUT_RAMP_NAME,
  description: "One-shot bulk import of every Google Keep note from a Takeout ZIP",
  setupDoc: "docs/keep-setup.md",
  secrets: [],
  async pull(ctx: RampContext): Promise<RampReport> {
    const zipPath = process.env.PKMS_TAKEOUT_ZIP?.trim();

    if (!zipPath) {
      throw new NotConnectedError(
        "set PKMS_TAKEOUT_ZIP to the Takeout ZIP path (or run " +
          "`pkms ingest keep-takeout <zip>`) — export from " +
          "https://takeout.google.com/ with only Keep enabled",
      );
    }

    const report = await importTakeout(zipPath, ctx.vault, ctx.indexDir, {
      root: ctx.root,
    });

    return {
      captured: report.notes,
      skipped: report.skipped_already_imported + report.skipped_trashed + report.skipped_empty,
      line: renderTakeoutReport(report),
    };
  },
};
