"""PKMS command-line interface."""

import os
import subprocess
from datetime import date
from pathlib import Path
from typing import Any

import typer
from rich.console import Console
from rich.markup import escape
from rich.table import Table

app = typer.Typer(help="Personal Knowledge Management System")
console = Console()


def _project_root() -> Path:
    """Locate the PKMS root: $PKMS_HOME if set, else nearest ancestor of cwd containing vault/."""
    env = os.environ.get("PKMS_HOME")
    if env:
        return Path(env)
    cwd = Path.cwd()
    for candidate in (cwd, *cwd.parents):
        if (candidate / "vault").is_dir():
            return candidate
    raise SystemExit(
        "No vault/ found in current directory or its parents. "
        "Set PKMS_HOME or cd into the PKMS project."
    )


_ROOT = _project_root()
VAULT = _ROOT / "vault"
INDEX = _ROOT / ".index"


@app.command()
def index(verbose: bool = typer.Option(False, "--verbose", "-v")):
    """Rebuild the full index from the vault."""
    from .indexer import index_vault

    console.print("[bold]Indexing vault…[/bold]")
    stats = index_vault(VAULT, INDEX, verbose=verbose)
    console.print(
        f"[green]Done.[/green] {stats['notes']} notes, {stats['links']} links, "
        f"{stats['tasks']} tasks"
    )


@app.command()
def search(
    query: str,
    limit: int = typer.Option(20, "--limit", "-n"),
    raw: bool = typer.Option(
        False,
        "--raw",
        help=(
            "Pass the query straight to FTS5 (boolean operators, prefixes). "
            "Power-user escape hatch; literal-by-default stays the contract."
        ),
    ),
):
    """Full-text search across all notes."""
    from .search import search as _search

    results = _search(query, INDEX, limit=limit, raw=raw)
    if not results:
        console.print("[yellow]No results.[/yellow]")
        return
    t = Table("Path", "Title", "Excerpt")
    for r in results:
        t.add_row(r["path"], r["title"], r["excerpt"])
    console.print(t)


@app.command()
def backlinks(note: str):
    """Show notes that link to a given note (path or stem)."""
    from .search import backlinks as _backlinks

    sources = _backlinks(note, INDEX)
    if not sources:
        console.print("[yellow]No backlinks found.[/yellow]")
        return
    for s in sources:
        console.print(f"  [cyan]{s}[/cyan]")


def _task_line(r, *, show_state: bool = False) -> str:
    bits = [escape(r["text"])]
    if r["size"]:
        bits.append(f"[dim]⏱{escape(r['size'])}[/dim]")
    if show_state and r["state"] != "open":
        bits.append(f"[yellow]· {r['state']}[/yellow]")
    return "  ".join(bits)


@app.command()
def tasks(
    all_: bool = typer.Option(False, "--all", help="The whole backlog, grouped by note"),
    stash: bool = typer.Option(
        False, "--stash", help="Paused/iceboxed tasks — recoverable, always"
    ),
    stale: bool = typer.Option(
        False, "--stale", help="Reshape candidates (untouched 14d+) — briefing fodder"
    ),
    done: bool = typer.Option(False, "--done", help="Done tasks"),
):
    """One next action per note (default); everything else is one flag away."""
    from .db import connect

    conn = connect(INDEX)

    if stale:
        from .tasks import stale_tasks

        rows = stale_tasks(conn)
        conn.close()
        if not rows:
            console.print("[dim]nothing has sat long enough to reshape.[/dim]")
            return
        console.print(
            "  [bold]been quiet a while[/bold] "
            "[dim]— the briefing offers at most one, reshaped smaller[/dim]"
        )
        for r in rows:
            title = r["title"] or Path(r["note_path"]).stem
            console.print(
                f"  [cyan]{escape(title)}[/cyan]  {escape(r['text'])}"
                f"  [dim]· untouched since {r['first_seen']}[/dim]"
            )
        return

    if stash:
        rows = conn.execute(
            """SELECT t.note_path, n.title, t.text, t.size, t.state FROM tasks t
               LEFT JOIN notes n ON n.path = t.note_path
               WHERE t.state IN ('paused','iceboxed') ORDER BY t.note_path, t.line""",
        ).fetchall()
        conn.close()
        if not rows:
            console.print("[dim]the stash is empty.[/dim]")
            return
        console.print("  [bold]stashed[/bold] [dim]— nothing here is gone[/dim]")
        for r in rows:
            title = r["title"] or Path(r["note_path"]).stem
            console.print(f"  [cyan]{escape(title)}[/cyan]  {_task_line(r, show_state=True)}")
        console.print(
            "  [dim]wake one: flip its marker back to [ ] in the note, or ask the agent[/dim]"
        )
        return

    if done:
        rows = conn.execute(
            "SELECT note_path, line, text, size, state FROM tasks WHERE state='done' "
            "ORDER BY note_path, line",
        ).fetchall()
        conn.close()
        for r in rows:
            console.print(
                f"  [green]✓[/green] [dim]{escape(r['note_path'])}[/dim]  {escape(r['text'])}"
            )
        if not rows:
            console.print('[dim]no dones recorded yet — pkms did "thing" counts one.[/dim]')
        return

    if all_:
        rows = conn.execute(
            """SELECT t.note_path, n.title, t.text, t.size, t.first_action, t.state FROM tasks t
               LEFT JOIN notes n ON n.path = t.note_path
               WHERE t.state IN ('open','stuck','not-now') ORDER BY t.note_path, t.line""",
        ).fetchall()
        conn.close()
        current = None
        for r in rows:
            if r["note_path"] != current:
                current = r["note_path"]
                console.print(
                    f"\n  [cyan bold]{escape(r['title'] or Path(current).stem)}[/cyan bold]"
                )
            console.print(f"    {_task_line(r, show_state=True)}")
        console.print()
        return

    # default: one next action per note — never a wall (§6)
    from .tasks import next_action_per_note

    rows = next_action_per_note(conn)
    extra = conn.execute(
        "SELECT COUNT(*) FROM tasks WHERE state IN ('open','stuck','not-now')",
    ).fetchone()[0] - len(rows)
    stashed = conn.execute(
        "SELECT COUNT(*) FROM tasks WHERE state IN ('paused','iceboxed')",
    ).fetchone()[0]
    conn.close()
    if not rows:
        console.print("[dim]no next actions on deck — capture something, or just enjoy it.[/dim]")
        return
    console.print("  [bold]next actions[/bold] [dim]— one per note[/dim]")
    for r in rows:
        title = r["title"] or Path(r["note_path"]).stem
        hint = "" if r["first_action"] else "  [dim]· could use a first step[/dim]"
        console.print(f"  [cyan]{escape(title)}[/cyan]  {_task_line(r)}{hint}")
    if extra > 0:
        console.print("  [dim]the rest is one flag away: pkms tasks --all[/dim]")
    if stashed:
        console.print("  [dim]stashed safe: pkms tasks --stash[/dim]")


@app.command()
def resurface(
    not_now: str = typer.Option(
        "", "--not-now", help="Rest a note (by stem/path) for 30 days — silent"
    ),
    let_go: str = typer.Option(
        "",
        "--let-go",
        help="Stop asking about a note forever (reversible: delete its 'resurface: never' line)",
    ),
):
    """Up to three curious questions from the vault — each says why it came up."""
    from .db import connect
    from .resurface import candidates, dismiss, filter_never
    from .resurface import let_go as _let_go
    from .search import resolve_note

    if not_now or let_go:
        target = resolve_note(not_now or let_go, INDEX)
        if not target:
            console.print(
                f"[yellow]couldn't find[/yellow] {escape(not_now or let_go)}"
                f" — try the path shown by pkms resurface"
            )
            raise typer.Exit(1)
        if not_now:
            conn = connect(INDEX)
            dismiss(conn, target)
            conn.close()
            console.print("[dim]rested — it won't come up for a month.[/dim]")
        else:
            _let_go(VAULT, target)
            console.print(
                "[dim]let go — it stays in the vault, the asking stops. "
                "(undo: remove 'resurface: never' from its frontmatter)[/dim]"
            )
        return

    conn = connect(INDEX)
    cands = filter_never(VAULT, candidates(conn, k=3))
    conn.close()
    if not cands:
        console.print("[dim]nothing to wonder about today — the vault is settled.[/dim]")
        return
    for c in cands:
        console.print(f"  [yellow]?[/yellow] {escape(c['question'])}")
        console.print(f"    [dim]{escape(c['why'])} · {escape(c['path'])}[/dim]")
    console.print("  [dim]open one, or --not-now / --let-go a stem — both are free.[/dim]")


@app.command()
def did(thing: str):
    """Log a done thing — counts today; retroactive entries welcome."""
    from .daily import append_did

    append_did(VAULT, thing)
    console.print("[green]✓ counted[/green] [dim]— it shows in pkms today[/dim]")


@app.command()
def capture(
    text: str,
    source: str = typer.Option("cli", "--source", "-s", help="Which ramp this came from"),
):
    """Dump a thought into vault/inbox/ — no filing, no decisions."""
    from .capture import write_capture

    path = write_capture(text, VAULT, source=source)
    console.print(f"[green]saved ✓[/green] inbox/{path.name}")


@app.command()
def today():
    """The front door: where you left off, what's new, one next action per note."""
    from .today import today_view

    view = today_view(VAULT, INDEX, record_offer=True)
    day = date.fromisoformat(view["date"])
    console.print()
    console.rule(f"[bold]{day:%A} · {day:%B %d}[/bold]", style="dim")
    console.print()

    crumb = view["breadcrumb"]
    if crumb and crumb["lines"]:
        console.print(f"  [dim]last time · {crumb['name']}[/dim]")
        for line in crumb["lines"]:
            console.print(f"  [italic dim]{line}[/italic dim]")
        console.print()

    if view["inbox_new"]:
        console.print(
            f"  [cyan]●[/cyan] [bold]{view['inbox_new']} new to fold in[/bold]"
            f" [dim]— captured, safe[/dim]"
        )
    else:
        console.print("  [green]✓[/green] inbox clear")

    if view["done_today"]:  # win pebbles: quiet, forward-only, reset without debt (§3)
        pebbles = "·" * min(view["done_today"], 12)
        console.print(f"  [green]{pebbles}[/green] [dim]{view['done_today']} done today[/dim]")

    nxt = view["next_read"]
    if nxt:
        mins = f" [dim]· ~{nxt['minutes']} min[/dim]" if nxt.get("minutes") else ""
        console.print(
            f"  [magenta]▸[/magenta] up next to read: [italic]{escape(nxt['title'])}[/italic]{mins}"
        )

    card = view["resurface"]
    if card:  # the one rationed curious question (§5) — why-line included (§9)
        console.print(
            f"  [yellow]?[/yellow] {escape(card['question'])}"
            f"  [dim]{escape(card['why'])} · pkms resurface[/dim]"
        )
    console.print()

    if view["next_actions"]:

        def fit(s: str, w: int) -> str:
            return s if len(s) <= w else s[: w - 1] + "…"

        title_w = 24
        text_w = max(20, console.width - title_w - 6)
        console.print("  [bold]next actions[/bold]")
        for a in view["next_actions"]:
            title = escape(fit(a["title"], title_w).ljust(title_w))
            console.print(f"  [cyan]{title}[/cyan]  {escape(fit(a['text'], text_w))}")
        if view["more_notes"]:
            console.print("  [dim]everything else: pkms tasks[/dim]")
        console.print()

    # the briefing ends with an invitation, never an assignment (§3)
    console.print("  [dim]start with whatever pulls you — the rest keeps.[/dim]")
    console.print()


def _print_promoted(result: dict[str, Any]) -> None:
    rel = result["note"].relative_to(VAULT).as_posix()
    console.print(
        f"[green]promoted ✓[/green] vault/{rel}"
        f"  [dim]· queued · ~{result['minutes']} min read[/dim]"
    )
    console.print(
        "[dim]it'll show in pkms today until you read it (flip 'reading: queued' when done)[/dim]"
    )


@app.command()
def promote(query: str):
    """Promote a hoarded Reddit thread (URL/id, or search terms to pick from) into the vault."""
    from .promote import promote as _promote

    result = _promote(query, VAULT)

    if "candidates" in result:
        cands = result["candidates"]
        if not cands:
            console.print(
                "[yellow]Nothing hydrated matches.[/yellow] "
                "Try other words, or paste the thread URL."
            )
            return
        console.print("[bold]which one?[/bold]")
        for i, c in enumerate(cands, 1):
            bits = [
                b
                for b in (
                    f"r/{c['subreddit']}" if c["subreddit"] else "",
                    f"saved {c['saved']}" if c["saved"] else "",
                )
                if b
            ]
            tail = f"  [dim]{' · '.join(bits)}[/dim]" if bits else ""
            console.print(f"  [cyan]{i}.[/cyan] {escape(c['title'][:80])}{tail}")
        try:
            choice = typer.prompt(
                "\npromote which? (number · Enter to skip)", default="", show_default=False
            ).strip()
        except (typer.Abort, EOFError):  # no input available — skipping is free
            return
        if not choice.isdigit() or not 1 <= int(choice) <= len(cands):
            return  # skipping costs nothing
        # t3_ prefix forces the id path even for the rare all-letter id
        _print_promoted(_promote(f"t3_{cands[int(choice) - 1]['id']}", VAULT))
        return

    if "missing" in result:
        console.print(
            f"[yellow]Not in the hoard yet[/yellow] (id {result['missing']}). "
            "Save it in content-hoarder first — fresh-URL fetch is on the build plan (F2)."
        )
        return

    _print_promoted(result)


@app.command()
def serve(
    host: str = typer.Option("0.0.0.0", "--host"),  # noqa: S104
    port: int = typer.Option(8765, "--port", "-p"),
    token: str = typer.Option(
        "",
        "--token",
        envvar="PKMS_CAPTURE_TOKEN",
        help="Capture token; default reads/creates .secrets/capture-token",
    ),
):
    """Run the capture endpoint (token always required; resident on the tailnet)."""
    from .capture_service import run

    run(VAULT, _ROOT, host=host, port=port, token=token or None)


ingest_app = typer.Typer(help="Pull side-door captures into the inbox")
app.add_typer(ingest_app, name="ingest")


@ingest_app.command("keep")
def ingest_keep_cmd():
    """Pull new Google Keep notes (images OCR'd at ingest) into vault/inbox/."""
    from .keep_ingest import ingest_keep, render_report

    try:
        report = ingest_keep(VAULT, INDEX, _ROOT)
    except Exception as e:  # auth/network: honest, no traceback wall
        if type(e).__name__ == "LoginException":
            console.print(
                "[yellow]keep login failed[/yellow] — the master token may have "
                "expired; docs/keep-setup.md has the refresh steps"
            )
            raise typer.Exit(1) from e
        raise
    console.print(f"[dim]{render_report(report)}[/dim]")


@ingest_app.command("email")
def ingest_email_cmd(
    label: str = typer.Option("pkms", "--label", "-l", help="Gmail label to poll"),
):
    """Pull new email from a Gmail label into vault/inbox/."""
    from .email_ingest import ingest_email, make_imap_fetch
    from .keep_ingest import read_secret

    address = read_secret(_ROOT, "email-address")
    password = read_secret(_ROOT, "email-app-password")
    if not address or not password:
        console.print(
            "[yellow]email isn't connected yet[/yellow] — create "
            ".secrets/email-address (your Gmail address) and "
            ".secrets/email-app-password (a Gmail app password); "
            "https://myaccount.google.com/apppasswords"
        )
        raise typer.Exit(1)
    fetch = make_imap_fetch(address, password, label)
    report = ingest_email(VAULT, INDEX, fetch=fetch)
    console.print(
        f"[dim]email: captured {report['captured']}, "
        f"skipped {report['skipped']}[/dim]"
    )


@app.command()
def discord_bot(
    base_url: str = typer.Option(
        "http://127.0.0.1:8765", "--base-url", help="PKMS capture service URL"
    ),
    channel_id: str = typer.Option(
        None, "--channel-id", help="One channel id to listen in (DMs always allowed)"
    ),
):
    """Run the Discord capture bot (DMs always, plus one optional channel)."""
    from .capture_service import resolve_token
    from .discord_capture import run_bot
    from .keep_ingest import read_secret

    bot_token = read_secret(_ROOT, "discord-bot-token")
    if not bot_token:
        console.print(
            "[yellow]discord bot token not found[/yellow] — create "
            ".secrets/discord-bot-token (Discord dev portal → Bot → Reset Token)"
        )
        raise typer.Exit(1)
    capture_token = resolve_token(_ROOT)
    run_bot(
        bot_token,
        INDEX,
        base_url=base_url,
        capture_token=capture_token,
        allowed_channel_id=channel_id,
    )


@app.command()
def daily(
    open_editor: bool = typer.Option(
        True, "--open/--no-open", help="Open in $EDITOR (--no-open: just ensure it exists)"
    ),
):
    """Open or create today's daily note (breadcrumb + folded-today slots built in)."""
    from .daily import ensure_daily

    path, created = ensure_daily(VAULT)
    console.print(f"[green]Created[/green] {path}" if created else f"{path}")
    if open_editor:
        editor = os.environ.get("EDITOR", "notepad")
        subprocess.Popen([editor, str(path)])  # noqa: S603


@app.command()
def new(
    title: str, folder: str = typer.Option("", "--folder", "-f", help="Subfolder inside vault")
):
    """Create a new note."""
    from datetime import datetime

    slug = title.lower().replace(" ", "-")
    target_dir = VAULT / folder if folder else VAULT
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / f"{slug}.md"
    n = 1
    while path.exists():
        n += 1
        path = target_dir / f"{slug}-{n}.md"
    today = datetime.now().date().isoformat()
    path.write_text(f"---\ntitle: {title}\ncreated: {today}\ntags: []\n---\n\n# {title}\n\n")
    console.print(f"[green]Created[/green] {path}")
    editor = os.environ.get("EDITOR", "notepad")
    subprocess.Popen([editor, str(path)])  # noqa: S603


if __name__ == "__main__":  # enables `pythonw -m pkms.cli serve` from the startup shortcut
    app()
