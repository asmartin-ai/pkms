import { basename } from "node:path";
import { writeCapture } from "../capture.ts";
import { promote } from "../promote.ts";
import { parseArgs, str } from "./args.ts";
import { print, esc } from "./output.ts";
import { VAULT } from "./context.ts";

export function cmdCapture(argv: string[]): number {
  const { flags, positionals } = parseArgs(argv, {
    "--source": "value",
    "-s": "value",
  });

  const text = positionals.join(" ");
  const source = str(flags, "--source", "") || str(flags, "-s", "") || "cli";
  const path = writeCapture(text, VAULT(), { source });
  print(`[green]saved ✓[/green] inbox/${basename(path)}`);

  return 0;
}

function printPromoted(result: { note?: string; minutes?: number; error?: string }): number {
  if (!result.note) {
    print(`[red]${esc(result.error ?? "Promotion was not confirmed.")}[/red]`);

    return 1;
  }

  const rel = result.note!.slice(VAULT().length + 1).replaceAll("\\", "/");
  print(
    `[green]promoted ✓[/green] vault/${rel}` +
      `  [dim]· queued · ~${result.minutes} min read[/dim]`,
  );
  print("[dim]it'll show in pkms today until you read it (flip 'reading: queued' when done)[/dim]");

  return 0;
}

export async function cmdPromote(argv: string[]): Promise<number> {
  try {
    const query = argv.join(" ");
    const result = await promote(query, VAULT());

    if ("candidates" in result && result.candidates) {
      const cands = result.candidates;

      if (!cands.length) {
        print(
          "[yellow]Nothing hydrated matches.[/yellow] Try other words, or paste the thread URL.",
        );

        return 0;
      }

      print("[bold]which one?[/bold]");
      cands.forEach((c, i) => {
        const bits = [
          c.subreddit ? `r/${c.subreddit}` : "",
          c.saved ? `saved ${c.saved}` : "",
        ].filter(Boolean);

        const tail = bits.length ? `  [dim]${bits.join(" · ")}[/dim]` : "";
        print(`  [cyan]${i + 1}.[/cyan] ${esc(c.title!.slice(0, 80))}${tail}`);
      });
      const choice = await promptLine("\npromote which? (number · Enter to skip)");

      if (choice === null) return 0;
      const trimmed = choice.trim();
      const n = Number(trimmed);

      if (!/^\d+$/.test(trimmed) || n < 1 || n > cands.length) return 0;

      return printPromoted(await promote(`t3_${cands[n - 1]!.id}`, VAULT()));
    }

    if ("missing" in result && result.missing) {
      print(
        `[yellow]Not in the hoard yet[/yellow] (id ${result.missing}). ` +
          "Save it in content-hoarder first — fresh-URL fetch is on the build plan (F2).",
      );

      return 0;
    }

    return printPromoted(result);
  } catch (error) {
    print(`[red]${esc(error instanceof Error ? error.message : String(error))}[/red]`);

    return 1;
  }
}

function promptLine(promptText: string): Promise<string | null> {
  process.stdout.write(promptText + " ");

  const { promise, resolve } = Promise.withResolvers<string | null>();
  let buf = "";

  const onData = (chunk: Uint8Array | Buffer): void => {
    buf += chunk.toString("utf8");
    const nl = buf.indexOf("\n");

    if (nl !== -1) {
      cleanup();
      resolve(buf.slice(0, nl));
    }
  };

  const onEnd = (): void => {
    cleanup();
    resolve(buf.includes("\n") ? buf.slice(0, buf.indexOf("\n")) : null);
  };

  function cleanup(): void {
    process.stdin.removeListener("data", onData);
    process.stdin.removeListener("end", onEnd);
    process.stdin.pause();
  }

  process.stdin.resume();
  process.stdin.on("data", onData);
  process.stdin.on("end", onEnd);

  return promise;
}
