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
def daily():
    """Open or create today's daily note."""
    today = date.today().isoformat()
    path = VAULT / "daily" / f"{today}.md"
    if not path.exists():
        path.write_text(f"---\ntitle: {today}\ncreated: {today}\ntags: [daily]\n---\n\n# {today}\n\n")
        console.print(f"[green]Created[/green] {path}")
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
