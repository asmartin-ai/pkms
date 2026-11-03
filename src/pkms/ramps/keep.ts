import type { InputRamp, RampContext, RampReport } from "../ramp.ts";
import {
  ingestKeep,
  makeKeep,
  renderReport,
  renderSweepReport,
  sweepOldUnpinned,
} from "../keep_ingest.ts";
import { NotConnectedError } from "./email.ts";

export const KEEP_RAMP_NAME = "keep";

export const keepRamp: InputRamp = {
  name: KEEP_RAMP_NAME,
  description: "Archive existing Google Keep notes, then capture new and edited notes",
  setupDoc: "docs/keep-setup.md",
  secrets: ["keep-email", "keep-master-token"],
  async pull(ctx: RampContext): Promise<RampReport> {
    const email = ctx.readSecret("keep-email");
    const token = ctx.readSecret("keep-master-token");

    if (!email || !token) {
      throw new NotConnectedError(
        "keep isn't connected yet — docs/keep-setup.md has the one-time " +
          "setup (~5 min): a master token extracted from an Android device " +
          "with Keep logged in",
      );
    }

    const report = await ingestKeep(ctx.vault, ctx.indexDir, ctx.root);

    return {
      captured: report.new,
      skipped: 0,
      line: renderReport(report),
    };
  },
  async sweep(ctx: RampContext, opts) {
    const email = ctx.readSecret("keep-email");
    const token = ctx.readSecret("keep-master-token");

    if (!email || !token) {
      throw new NotConnectedError(
        "keep isn't connected yet — docs/keep-setup.md has the one-time setup",
      );
    }

    const ageDays = Number(opts["age-days"] ?? 30);
    const keep = await makeKeep(email, token, ctx.indexDir);

    const report = await sweepOldUnpinned(keep, ctx.indexDir, {
      ageDays,
      dryRun: !opts.apply,
    });

    return {
      captured: report.eligible_ids.length,
      skipped: 0,
      line:
        renderSweepReport(report) +
        (report.eligible_ids.length && !opts.apply
          ? ` — re-run with --apply to delete ${report.eligible_ids.length} note${
              report.eligible_ids.length !== 1 ? "s" : ""
            } from Keep`
          : ""),
    };
  },
};
