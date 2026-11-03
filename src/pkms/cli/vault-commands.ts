import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { indexVault } from "../indexer.ts";
import { search as searchIndex, backlinks, stemOf as stem, resolveNote } from "../search.ts";
import { emit, readEvents, type ReadEventsOptions } from "../events.ts";
import { connect } from "../db.ts";
import { staleTasks, nextActionPerNote } from "../tasks.ts";
import { candidates, dismiss, filterNever, letGo } from "../resurface.ts";
import { ensureDaily, isoDay } from "../daily.ts";
import { todayView } from "../today.ts";
import { parseArgs, num, str, bool } from "./args.ts";
import { print, esc } from "./output.ts";
import { root, VAULT, INDEX } from "./context.ts";

interface TaskLineRow {
  text: string;
  size: string | null;
  state?: string;
}

function taskLine(r: TaskLineRow, showState = false): string {
  const bits = [esc(r.text)];

  if (r.size) bits.push(`[dim]⏱${esc(r.size)}[/dim]`);

  if (showState && r.state !== "open") bits.push(`[yellow]· ${r.state}[/yellow]`);

  return bits.join("  ");
}

export function cmdIndex(argv: string[]): number {
  const { flags } = parseArgs(argv, { "--verbose": "bool", "-v": "bool" });
  print("[bold]Indexing vault…[/bold]");

  const stats = indexVault(VAULT(), INDEX(), {
    verbose: bool(flags, "--verbose", "-v"),
  });

  print(`[green]Done.[/green] ${stats.notes} notes, ${stats.links} links, ${stats.tasks} tasks`);

  return 0;
}

export function cmdEvents(argv: string[]): number {
  const { flags } = parseArgs(argv, { "--since": "value", "--kind": "value" });
  const since = str(flags, "--since", "");
  const kind = str(flags, "--kind", "");

  if (since && !Number.isFinite(Date.parse(since))) {
    print("[red]--since requires an ISO timestamp[/red]");

    return 1;
  }

  const options: ReadEventsOptions = {};

  if (since) options.since = since;

  if (kind) options.kind = kind;
  const events = readEvents(root(), options);
  console.log("ID\tTimestamp\tKind\tSource\tRef");

  for (const event of events) {
    console.log(
      `${event.id}\t${event.ts}\t${event.kind}\t${event.source}\t${event.ref.replace(/[\r\n\t]/g, " ")}`,
    );
  }

  return 0;
}

export function cmdSearch(argv: string[]): number {
  const { flags, positionals } = parseArgs(argv, {
    "--limit": "value",
    "-n": "value",
    "--raw": "bool",
  });

  const query = positionals.join(" ");

  const results = searchIndex(query, INDEX(), {
    limit: num(flags, "--limit", 20),
    raw: bool(flags, "--raw"),
  });

  if (!results.length) {
    print("[yellow]No results.[/yellow]");

    return 0;
  }

  const wPath = Math.max(4, ...results.map((r) => r.path.length));
  const wTitle = Math.max(5, ...results.map((r) => r.title.length));
  print(`${"Path".padEnd(wPath)}  ${"Title".padEnd(wTitle)}  Excerpt`);

  for (const r of results) {
    print(`${r.path.padEnd(wPath)}  ${r.title.padEnd(wTitle)}  ${r.excerpt}`);
  }

  return 0;
}

export function cmdBacklinks(argv: string[]): number {
  const note = argv[0] ?? "";
  const sources = backlinks(note, INDEX());

  if (!sources.length) {
    print("[yellow]No backlinks found.[/yellow]");

    return 0;
  }

  for (const s of sources) print(`  [cyan]${esc(s)}[/cyan]`);

  return 0;
}

interface StashRow {
  note_path: string;
  title: string | null;
  text: string;
  size: string | null;
  state: string;
}

interface DoneRow {
  note_path: string;
  line: number;
  text: string;
  size: string | null;
  state: string;
}

interface AllRow extends StashRow {
  first_action: string | null;
}

export function cmdTasks(argv: string[]): number {
  const { flags } = parseArgs(argv, {
    "--all": "bool",
    "--stash": "bool",
    "--stale": "bool",
    "--done": "bool",
  });

  const db = connect(INDEX());

  try {
    if (bool(flags, "--stale")) {
      const rows = staleTasks(db);

      if (!rows.length) {
        print("[dim]nothing has sat long enough to reshape.[/dim]");

        return 0;
      }

      print(
        "  [bold]been quiet a while[/bold] [dim]— the briefing offers at most one, reshaped smaller[/dim]",
      );

      for (const r of rows) {
        print(
          `  [cyan]${esc(r.title || stem(r.note_path))}[/cyan]  ${esc(r.text)}` +
            `  [dim]· untouched since ${r.first_seen}[/dim]`,
        );
      }

      return 0;
    }

    if (bool(flags, "--stash")) {
      const rows = db
        .query<StashRow, []>(
          `SELECT t.note_path, n.title, t.text, t.size, t.state FROM tasks t
           LEFT JOIN notes n ON n.path = t.note_path
           WHERE t.state IN ('paused','iceboxed') ORDER BY t.note_path, t.line`,
        )
        .all();

      if (!rows.length) {
        print("[dim]the stash is empty.[/dim]");

        return 0;
      }

      print("  [bold]stashed[/bold] [dim]— nothing here is gone[/dim]");

      for (const r of rows) {
        print(`  [cyan]${esc(r.title || stem(r.note_path))}[/cyan]  ${taskLine(r, true)}`);
      }

      print("  [dim]wake one: flip its marker back to [ ] in the note, or ask the agent[/dim]");

      return 0;
    }

    if (bool(flags, "--done")) {
      const rows = db
        .query<DoneRow, []>(
          "SELECT note_path, line, text, size, state FROM tasks WHERE state='done' " +
            "ORDER BY note_path, line",
        )
        .all();

      for (const r of rows) {
        print(`  [green]✓[/green] [dim]${esc(r.note_path)}[/dim]  ${esc(r.text)}`);
      }

      if (!rows.length) {
        print('[dim]no dones recorded yet — pkms did "thing" counts one.[/dim]');
      }

      return 0;
    }

    if (bool(flags, "--all")) {
      const rows = db
        .query<AllRow, []>(
          `SELECT t.note_path, n.title, t.text, t.size, t.first_action, t.state FROM tasks t
           LEFT JOIN notes n ON n.path = t.note_path
           WHERE t.state IN ('open','stuck','not-now') ORDER BY t.note_path, t.line`,
        )
        .all();

      let current: string | null = null;

      for (const r of rows) {
        if (r.note_path !== current) {
          current = r.note_path;
          print(`\n  [cyan bold]${esc(r.title || stem(current))}[/cyan bold]`);
        }

        print(`    ${taskLine(r, true)}`);
      }

      print();

      return 0;
    }

    const rows = nextActionPerNote(db);

    const extra =
      db
        .query<{ c: number }, []>(
          "SELECT COUNT(*) AS c FROM tasks WHERE state IN ('open','stuck','not-now')",
        )
        .get()!.c - rows.length;

    const stashed = db
      .query<{ c: number }, []>(
        "SELECT COUNT(*) AS c FROM tasks WHERE state IN ('paused','iceboxed')",
      )
      .get()!.c;

    if (!rows.length) {
      print("[dim]no next actions on deck — capture something, or just enjoy it.[/dim]");

      return 0;
    }

    print("  [bold]next actions[/bold] [dim]— one per note[/dim]");

    for (const r of rows) {
      const title = r.title || stem(r.note_path);
      const hint = r.first_action ? "" : "  [dim]· could use a first step[/dim]";
      print(`  [cyan]${esc(title)}[/cyan]  ${taskLine(r)}${hint}`);
    }

    if (extra > 0) print("  [dim]the rest is one flag away: pkms tasks --all[/dim]");

    if (stashed > 0) print("  [dim]stashed safe: pkms tasks --stash[/dim]");

    return 0;
  } finally {
    db.close();
  }
}

export function cmdResurface(argv: string[]): number {
  const { flags } = parseArgs(argv, {
    "--not-now": "value",
    "--let-go": "value",
  });

  const notNow = str(flags, "--not-now", "");
  const letGoRef = str(flags, "--let-go", "");

  if (notNow || letGoRef) {
    const target = resolveNote(notNow || letGoRef, INDEX());

    if (!target) {
      print(
        `[yellow]couldn't find[/yellow] ${esc(notNow || letGoRef)}` +
          ` — try the path shown by pkms resurface`,
      );

      return 1;
    }

    if (notNow) {
      const db = connect(INDEX());

      try {
        dismiss(db, target);
      } finally {
        db.close();
      }

      print("[dim]rested — it won't come up for a month.[/dim]");
    } else {
      letGo(VAULT(), target);
      print(
        "[dim]let go — it stays in the vault, the asking stops. " +
          "(undo: remove 'resurface: never' from its frontmatter)[/dim]",
      );
    }

    emit(root(), notNow ? "resurface_not_now" : "resurface_let_go", {
      source: "pkms",
      ref: target,
      payload: { path: target },
    });

    return 0;
  }

  const db = connect(INDEX());
  let cands;

  try {
    cands = filterNever(VAULT(), candidates(db, { k: 3 }));
  } finally {
    db.close();
  }

  if (!cands.length) {
    print("[dim]nothing to wonder about today — the vault is settled.[/dim]");

    return 0;
  }

  for (const c of cands) {
    print(`  [yellow]?[/yellow] ${esc(c.question)}`);
    print(`    [dim]${esc(c.why)} · ${esc(c.path)}[/dim]`);
  }

  print("  [dim]open one, or --not-now / --let-go a stem — both are free.[/dim]");

  return 0;
}

export function cmdToday(): number {
  const view = todayView(VAULT(), INDEX(), { recordOffer: true });
  emit(root(), "today_opened", { source: "pkms", ref: "today", payload: { surface: "cli" } });
  const day = new Date(`${view.date}T00:00:00`);
  const weekday = day.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = `${day.toLocaleDateString("en-US", { month: "long" })} ${String(day.getDate()).padStart(2, "0")}`;
  print();
  print(`[dim]${weekday} · ${monthDay}[/dim]`);
  print();

  const crumb = view.breadcrumb;

  if (crumb && crumb.lines.length) {
    print(`  [dim]last time · ${crumb.name}[/dim]`);

    for (const line of crumb.lines) print(`  [italic dim]${line}[/italic dim]`);
    print();
  }

  if (view.inbox_new) {
    print(
      `  [cyan]●[/cyan] [bold]${view.inbox_new} new to fold in[/bold] [dim]— captured, safe[/dim]`,
    );
  } else {
    print("  [green]✓[/green] inbox clear");
  }

  if (view.done_today) {
    const pebbles = "·".repeat(Math.min(view.done_today, 12));
    print(`  [green]${pebbles}[/green] [dim]${view.done_today} done today[/dim]`);
  }

  const nxt = view.next_read;

  if (nxt) {
    const mins = nxt.minutes ? ` [dim]· ~${nxt.minutes} min[/dim]` : "";
    print(`  [magenta]▸[/magenta] up next to read: [italic]${esc(nxt.title)}[/italic]${mins}`);
  }

  const card = view.resurface;

  if (card) {
    print(
      `  [yellow]?[/yellow] ${esc(card.question)}  [dim]${esc(card.why)} · pkms resurface[/dim]`,
    );
  }

  print();

  if (view.next_actions.length) {
    const fit = (s: string, w: number): string => (s.length <= w ? s : `${s.slice(0, w - 1)}…`);

    const titleW = 24;
    const textW = Math.max(20, (process.stdout.columns || 80) - titleW - 6);
    print("  [bold]next actions[/bold]");

    for (const a of view.next_actions) {
      const title = fit(a.title, titleW).padEnd(titleW);
      print(`  [cyan]${title}[/cyan]  ${esc(fit(a.text, textW))}`);
    }

    if (view.more_notes) print("  [dim]everything else: pkms tasks[/dim]");
    print();
  }

  print("  [dim]start with whatever pulls you — the rest keeps.[/dim]");
  print();

  return 0;
}

export function cmdDaily(argv: string[]): number {
  const { flags } = parseArgs(argv, { "--open": "bool", "--no-open": "bool" });
  const openEditor = bool(flags, "--open") || !bool(flags, "--no-open");
  const [path, created] = ensureDaily(VAULT());
  print(created ? `[green]Created[/green] ${path}` : path);

  if (openEditor) openInEditor(path);

  return 0;
}

export function cmdNew(argv: string[]): number {
  const { flags, positionals } = parseArgs(argv, {
    "--folder": "value",
    "-f": "value",
  });

  const title = positionals.join(" ");
  const folder = str(flags, "--folder", "") || str(flags, "-f", "");
  const vault = resolve(VAULT());
  const targetDir = folder ? join(vault, folder) : vault;

  if (targetDir !== vault && !targetDir.startsWith(`${vault}${sep}`)) {
    print(`[red]--folder must stay inside the vault: ${folder}[/red]`);

    return 1;
  }

  const slug =
    title
      .slice(0, 60)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "note";

  mkdirSync(targetDir, { recursive: true });
  let path = join(targetDir, `${slug}.md`);
  let n = 1;

  while (existsSync(path)) {
    n += 1;
    path = join(targetDir, `${slug}-${n}.md`);
  }

  const today = isoDay(new Date());
  writeFileSync(
    path,
    `---\ntitle: ${JSON.stringify(title)}\ncreated: ${today}\ntags: []\n---\n\n# ${title}\n\n`,
    "utf8",
  );
  print(`[green]Created[/green] ${path}`);
  openInEditor(path);

  return 0;
}

function openInEditor(path: string): void {
  const editor =
    process.env.EDITOR ||
    (process.platform === "win32"
      ? "notepad"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open");

  const child = spawn(editor, [path], { stdio: "ignore", detached: true });
  child.unref();
}
