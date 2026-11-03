import { ingestEmailOnce, renderEmailReport } from "../email_ingest.ts";
import { imapEndpoint } from "../imap.ts";
import type { InputRamp, RampContext, RampReport } from "../ramp.ts";

export const EMAIL_RAMP_NAME = "email";

export const emailRamp: InputRamp = {
  name: EMAIL_RAMP_NAME,
  description: "Archive new Gmail inbox mail and route the useful messages",
  setupDoc: "docs/email-discord-setup.md",
  secrets: ["email-address", "email-app-password"],
  async pull(ctx: RampContext): Promise<RampReport> {
    const address = ctx.readSecret("email-address");
    const password = ctx.readSecret("email-app-password");

    if (!address || !password) {
      throw new NotConnectedError(
        "create .secrets/email-address (your Gmail address) and " +
          ".secrets/email-app-password (a Gmail app password); " +
          "https://myaccount.google.com/apppasswords",
      );
    }

    const result = await ingestEmailOnce(
      { root: ctx.root, vault: ctx.vault, indexDir: ctx.indexDir },
      { address, password, endpoint: imapEndpoint(process.env) },
    );

    const line = renderEmailReport(result).join("\n");

    if (result.busy) return { captured: 0, skipped: 0, line };

    return {
      captured: result.routed.filter((item) => item.capture !== null).length,
      skipped: result.alreadyArchived,
      line,
    };
  },
};

export class NotConnectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotConnectedError";
  }
}
