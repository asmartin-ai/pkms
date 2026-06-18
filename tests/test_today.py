"""Today-view: breadcrumb, inbox-as-progress copy, one action per note, no walls."""


from typer.testing import CliRunner

import pkms.cli as cli
from pkms.capture import write_capture
from pkms.indexer import index_vault
from pkms.today import today_view

from conftest import write_note

runner = CliRunner()


def test_breadcrumb_tails_last_daily_note(vault, index_dir):
    view = today_view(vault, index_dir)
    crumb = view["breadcrumb"]
    assert crumb["name"] == "2026-06-01"
    assert "Plain daily note, no frontmatter at all." in crumb["lines"]


def test_breadcrumb_skips_frontmatter_and_headings(vault, index_dir):
    write_note(
        vault / "daily" / "2026-06-02.md",
        """\
        # 2026-06-02

        worked on the capture slice
        stopped at the token tests
        """,
        title="2026-06-02",
    )
    crumb = today_view(vault, index_dir)["breadcrumb"]
    assert crumb["name"] == "2026-06-02"
    assert crumb["lines"] == ["worked on the capture slice", "stopped at the token tests"]
    assert all("---" not in ln and not ln.startswith("#") for ln in crumb["lines"])


def test_breadcrumb_prefers_section_content_including_today(vault, index_dir):
    from datetime import date
    from pkms.daily import ensure_daily
    path, _ = ensure_daily(vault)  # today's own note — same-day re-entry counts
    text = path.read_text(encoding="utf-8")
    path.write_text(
        text.replace(
            "<!-- where you left off — /resume keeps this current -->",
            "stopped at the fold skill\n▶ run /fold on the inbox",
        ),
        encoding="utf-8",
    )
    crumb = today_view(vault, index_dir)["breadcrumb"]
    assert crumb["name"] == date.today().isoformat()
    assert crumb["lines"] == ["stopped at the fold skill", "▶ run /fold on the inbox"]


def test_breadcrumb_empty_section_falls_back_to_legacy_tail(vault, index_dir):
    from pkms.daily import ensure_daily
    ensure_daily(vault)  # fresh template: breadcrumb slot holds only a comment
    crumb = today_view(vault, index_dir)["breadcrumb"]
    assert crumb["name"] == "2026-06-01"  # fixture's legacy note, by its tail
    assert "Plain daily note, no frontmatter at all." in crumb["lines"]


def test_one_next_action_per_note_projects_first(vault, index_dir):
    index_vault(vault, index_dir)
    actions = today_view(vault, index_dir)["next_actions"]
    notes = [a["note"] for a in actions]
    assert len(notes) == len(set(notes))  # one per note
    assert notes[0].startswith("projects")
    texts = {a["note"]: a["text"] for a in actions}
    assert texts["projects/alpha.md"] == "open task one"  # first open, not the done one


def test_inbox_tasks_stay_out_of_next_actions(vault, index_dir):
    write_capture("- [ ] raw unfolded task", vault, source="cli")
    index_vault(vault, index_dir)
    actions = today_view(vault, index_dir)["next_actions"]
    assert all(not a["note"].startswith("inbox") for a in actions)


def test_today_view_without_index_degrades_gracefully(vault, index_dir):
    view = today_view(vault, index_dir)  # no pkms.db yet
    assert view["next_actions"] == []


def test_next_actions_use_titles_and_strip_wikilinks(vault, index_dir):
    write_note(
        vault / "projects" / "zeta.md",
        """\
        - [ ] read [[11-hn]] and [[12-reddit|the reddit note]] tonight
        """,
        title="Zeta Project",
    )
    index_vault(vault, index_dir)
    actions = today_view(vault, index_dir)["next_actions"]
    zeta = next(a for a in actions if a["note"] == "projects/zeta.md")
    assert zeta["title"] == "Zeta Project"
    assert zeta["text"] == "read 11-hn and the reddit note tonight"
    assert "[[" not in zeta["text"]


# --- CLI rendering & copy rules (design language §3) ---

def _cli_project(vault, index_dir, monkeypatch):
    monkeypatch.setattr(cli, "VAULT", vault)
    monkeypatch.setattr(cli, "INDEX", index_dir)


def test_today_renders_inbox_as_progress_not_debt(vault, index_dir, monkeypatch):
    _cli_project(vault, index_dir, monkeypatch)
    write_capture("thought one", vault, source="cli")
    write_capture("thought two", vault, source="cli")
    out = runner.invoke(cli.app, ["today"]).output
    assert "2 new to fold in" in out
    assert "backlog" not in out.split("rest of the backlog")[0]  # no debt framing
    assert "overdue" not in out.lower()


def test_today_empty_inbox_reads_as_a_win(vault, index_dir, monkeypatch):
    _cli_project(vault, index_dir, monkeypatch)
    out = runner.invoke(cli.app, ["today"]).output
    assert "inbox clear" in out


def test_today_ends_with_invitation_not_assignment(vault, index_dir, monkeypatch):
    _cli_project(vault, index_dir, monkeypatch)
    out = runner.invoke(cli.app, ["today"]).output
    assert "start with whatever pulls you" in out
    assert out.rstrip().endswith("the rest keeps.")


def test_capture_command_confirms_instantly(vault, index_dir, monkeypatch):
    _cli_project(vault, index_dir, monkeypatch)
    result = runner.invoke(cli.app, ["capture", "a cli thought"])
    assert result.exit_code == 0
    assert "saved" in result.output
    files = list((vault / "inbox").glob("*.md"))
    assert len(files) == 1
    assert "source: cli" in files[0].read_text(encoding="utf-8")
