import { resolveToken } from "../capture_service.ts";
import { resolveSecret } from "../secrets.ts";
import { runBot } from "../discord_gateway.ts";
import { parseArgs, str } from "./args.ts";
import { print } from "./output.ts";
import { root, VAULT, INDEX } from "./context.ts";

export async function cmdDiscordBot(argv: string[]): Promise<number> {
  const { flags } = parseArgs(argv, {
    "--base-url": "value",
    "--channel-id": "value",
    "--user-ids": "value",
    "--gateway-url": "value",
  });

  const botToken = resolveSecret(root(), "discord-bot-token");

  if (!botToken) {
    print(
      "[yellow]discord bot token not found[/yellow] — create " +
        ".secrets/discord-bot-token (Discord dev portal → Bot → Reset Token)",
    );

    return 1;
  }

  const rawUserIds = flags.has("--user-ids")
    ? str(flags, "--user-ids", "")
    : (resolveSecret(root(), "discord-user-ids") ?? "");

  const agentUserIds = rawUserIds.trim() === "" ? [] : rawUserIds.split(",").map((id) => id.trim());

  if (agentUserIds.some((id) => !/^[0-9]{17,20}$/.test(id))) {
    print("[red]discord user ids must be comma-separated Discord numeric user ids[/red]");

    return 1;
  }

  const captureToken = resolveToken(root());

  const code = await runBot({
    botToken,
    indexDir: INDEX(),
    baseUrl: str(flags, "--base-url", "http://127.0.0.1:8765"),
    captureToken,
    allowedChannelId: str(flags, "--channel-id", "") || null,
    vault: VAULT(),
    agentUserIds,
    gatewayUrl: str(flags, "--gateway-url", "") || undefined,
  });

  return code;
}
