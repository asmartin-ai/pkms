"""PKMS command-line interface."""

import os
import subprocess
from datetime import date
from pathlib import Path

import typer
from rich.console import Console
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
    raise SystemExit("No vault/ found in current directory or its parents. Set PKMS_HOME or cd into the PKMS project.")


_ROOT = _project_root()
VAULT = _ROOT / "vault"
INDEX = _ROOT / ".index"


@app.command()
def index(verbose: bool = typer.Option(False, "--verbose", "-v")):
    """Rebuild the full index from the vault."""
    from .indexer import index_vault
    console.print("[bold]Indexing vault…[/bold]")
    stats = index_vault(VAULT, INDEX, verbose=verbose)
    console.print(f"[green]Done.[/green] {stats['notes']} notes, {stats['links']} links, {stats['tasks']} tasks")


@app.command()
def search(query: str, limit: int = typer.Option(20, "--limit", "-n")):
    """Full-text search across all notes."""
    from .search import search as _search
    results = _search(query, INDEX, limit=limit)
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


@app.command()
def tasks(done: bool = typer.Option(False, "--done", help="Show completed tasks instead")):
    """List open (or completed) tasks across all notes."""
    from .db import connect
    conn = connect(INDEX)
    rows = conn.execute(
        "SELECT note_path, line, text FROM tasks WHERE done=? ORDER BY note_path, line",
        (int(done),),
    ).fetchall()
    conn.close()
    if not rows:
        console.print("[yellow]No tasks.[/yellow]")
        return
    t = Table("Note", "Line", "Task")
    for r in rows:
        t.add_row(r["note_path"], str(r["line"]), r["text"])
    console.print(t)


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
    view = today_view(VAULT, INDEX)
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
        console.print(f"  [cyan]●[/cyan] [bold]{view['inbox_new']} new to fold in[/bold]"
                      f" [dim]— captured, safe[/dim]")
    else:
        console.print("  [green]✓[/green] inbox clear")

    nxt = view["next_read"]
    if nxt:
        mins = f" [dim]· ~{nxt['minutes']} min[/dim]" if nxt.get("minutes") else ""
        from rich.markup import escape as _esc
        console.print(f"  [magenta]▸[/magenta] up next to read: [italic]{_esc(nxt['title'])}[/italic]{mins}")
    console.print()

    if view["next_actions"]:
        from rich.markup import escape

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


def _print_promoted(result: dict):
    rel = result["note"].relative_to(VAULT)
    console.print(f"[green]promoted ✓[/green] vault/{rel}  [dim]· queued · ~{result['minutes']} min read[/dim]")
    console.print("[dim]it'll show in pkms today until you read it (flip 'reading: queued' when done)[/dim]")


@app.command()
def promote(query: str):
    """Promote a hoarded Reddit thread (URL/id, or search terms to pick from) into the vault."""
    from .promote import promote as _promote
    result = _promote(query, VAULT)

    if "candidates" in result:
        cands = result["candidates"]
        if not cands:
            console.print("[yellow]Nothing hydrated matches.[/yellow] "
                          "Try other words, or paste the thread URL.")
            return
        from rich.markup import escape as _esc
        console.print("[bold]which one?[/bold]")
        for i, c in enumerate(cands, 1):
            bits = [b for b in (f"r/{c['subreddit']}" if c["subreddit"] else "",
                                f"saved {c['saved']}" if c["saved"] else "") if b]
            tail = f"  [dim]{' · '.join(bits)}[/dim]" if bits else ""
            console.print(f"  [cyan]{i}.[/cyan] {_esc(c['title'][:80])}{tail}")
        try:
            choice = typer.prompt("\npromote which? (number · Enter to skip)",
                                  default="", show_default=False).strip()
        except (typer.Abort, EOFError):  # no input available — skipping is free
            return
        if not choice.isdigit() or not 1 <= int(choice) <= len(cands):
            return  # skipping costs nothing
        # t3_ prefix forces the id path even for the rare all-letter id
        _print_promoted(_promote(f"t3_{cands[int(choice) - 1]['id']}", VAULT))
        return

    if "missing" in result:
        console.print(f"[yellow]Not in the hoard yet[/yellow] (id {result['missing']}). "
                      "Save it in content-hoarder first — fresh-URL fetch is on the build plan (F2).")
        return

    _print_promoted(result)


@app.command()
def serve(
    host: str = typer.Option("0.0.0.0", "--host"),
    port: int = typer.Option(8765, "--port", "-p"),
    token: str = typer.Option("", "--token", envvar="PKMS_CAPTURE_TOKEN",
                              help="Capture token; default reads/creates .secrets/capture-token"),
):
    """Run the capture endpoint (token always required; resident on the tailnet)."""
    from .capture_service import run
    run(VAULT, _ROOT, host=host, port=port, token=token or None)


@app.command()
def daily(
    open_editor: bool = typer.Option(True, "--open/--no-open",
                                     help="Open in $EDITOR (--no-open: just ensure it exists)"),
):
    """Open or create today's daily note (breadcrumb + folded-today slots built in)."""
    from .daily import ensure_daily
    path, created = ensure_daily(VAULT)
    console.print(f"[green]Created[/green] {path}" if created else f"{path}")
    if open_editor:
        editor = os.environ.get("EDITOR", "notepad")
        subprocess.Popen([editor, str(path)])


@app.command()
def new(title: str, folder: str = typer.Option("", "--folder", "-f", help="Subfolder inside vault")):
    """Create a new note."""
    from datetime import datetime
    slug = title.lower().replace(" ", "-")
    target_dir = VAULT / folder if folder else VAULT
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / f"{slug}.md"
    today = datetime.now().date().isoformat()
    if path.exists():
        console.print(f"[yellow]Already exists:[/yellow] {path}")
    else:
        path.write_text(f"---\ntitle: {title}\ncreated: {today}\ntags: []\n---\n\n# {title}\n\n")
        console.print(f"[green]Created[/green] {path}")
    editor = os.environ.get("EDITOR", "notepad")
    subprocess.Popen([editor, str(path)])


if __name__ == "__main__":  # enables `pythonw -m pkms.cli serve` from the startup shortcut
    app()
