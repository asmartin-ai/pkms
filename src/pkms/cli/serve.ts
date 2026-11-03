import { run as serveRun } from "../capture_service.ts";
import { mcpServerOptionsFromCli, runMcpServer } from "../mcp_server.ts";
import { parseArgs, num, str } from "./args.ts";
import { root, VAULT } from "./context.ts";

export interface ServeOptions {
  host: string;
  port: number;
  token: string | undefined;
}

export function serveOptions(argv: string[]): ServeOptions {
  const { flags } = parseArgs(argv, {
    "--host": "value",
    "--port": "value",
    "-p": "value",
    "--token": "value",
  });

  return {
    host: str(flags, "--host", "127.0.0.1"),
    port: num(flags, "--port", num(flags, "-p", 8765)),
    token: str(flags, "--token", "") || undefined,
  };
}

export function cmdServe(argv: string[]): number {
  serveRun(VAULT(), root(), serveOptions(argv));

  return 0;
}

export async function cmdMcp(): Promise<number> {
  await runMcpServer(mcpServerOptionsFromCli());

  return 0;
}
