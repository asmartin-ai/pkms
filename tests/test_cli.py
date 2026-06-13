"""CLI: project-root discovery regression and command smoke tests."""

import pytest
from typer.testing import CliRunner

import pkms.cli as cli

runner = CliRunner()


# --- _project_root (regression: was hardcoded parents[3], broke when cwd moved) ---

def test_project_root_honors_pkms_home(tmp_path, monkeypatch):
    monkeypatch.setenv("PKMS_HOME", str(tmp_path))
    assert cli._project_root() == tmp_path


def test_project_root_walks_up_to_vault(tmp_path, monkeypatch):
    monkeypatch.delenv("PKMS_HOME", raising=False)
    (tmp_path / "vault").mkdir()
    nested = tmp_path / "deep" / "subdir"
    nested.mkdir(parents=True)
    monkeypatch.chdir(nested)
    assert cli._project_root() == tmp_path


def test_project_root_exits_when_no_vault(tmp_path, monkeypatch):
    monkeypatch.delenv("PKMS_HOME", raising=False)
    monkeypatch.chdir(tmp_path)
    with pytest.raises(SystemExit):
        cli._project_root()


# --- command smoke tests against a temp vault/index ---

@pytest.fixture
def cli_project(vault, index_dir, monkeypatch):
    monkeypatch.setattr(cli, "VAULT", vault)
    monkeypatch.setattr(cli, "INDEX", index_dir)
    monkeypatch.setattr(cli.subprocess, "Popen", lambda *a, **kw: None)  # never spawn an editor
    return vault


def test_index_then_search(cli_project):
    result = runner.invoke(cli.app, ["index"])
    assert result.exit_code == 0
    assert "3 notes, 2 links, 3 tasks" in result.output

    result = runner.invoke(cli.app, ["search", "gamma"])
    assert result.exit_code == 0
    assert "alpha.md" in result.output


def test_search_no_results_message(cli_project):
    runner.invoke(cli.app, ["index"])
    result = runner.invoke(cli.app, ["search", "zzzznothing"])
    assert result.exit_code == 0
    assert "No results" in result.output


def test_tasks_open_and_done(cli_project):
    runner.invoke(cli.app, ["index"])
    open_out = runner.invoke(cli.app, ["tasks"]).output
    assert "open task one" in open_out and "finished task" not in open_out
    done_out = runner.invoke(cli.app, ["tasks", "--done"]).output
    assert "finished task" in done_out and "open task one" not in done_out


def test_tasks_default_is_one_per_note_with_flag_hints(cli_project):
    from conftest import write_note
    write_note(
        cli_project / "projects" / "two.md",
        """\
        - [ ] first of two ▶ tiny step
        - [ ] second of two
        - [i] iced away
        """,
        title="Two Tasks",
    )
    runner.invoke(cli.app, ["index"])
    out = runner.invoke(cli.app, ["tasks"]).output
    assert "first of two" in out and "second of two" not in out  # one per note
    assert "pkms tasks --all" in out          # backlog one flag away, named not counted
    assert "pkms tasks --stash" in out        # stash visibly recoverable
    assert "could use a first step" in out    # alpha's task has no ▶ — surfaced state


def test_tasks_all_shows_backlog_grouped_with_states(cli_project):
    from conftest import write_note
    write_note(
        cli_project / "projects" / "mix.md",
        """\
        - [ ] plain open
        - [?] blocked thing
        - [~] later thing
        """,
        title="Mix",
    )
    runner.invoke(cli.app, ["index"])
    out = runner.invoke(cli.app, ["tasks", "--all"]).output
    assert "blocked thing" in out and "stuck" in out
    assert "later thing" in out and "not-now" in out


def test_tasks_stash_recovery_path_is_visible(cli_project):
    from conftest import write_note
    write_note(
        cli_project / "projects" / "ice.md",
        "- [p] paused thing (wake: after slice 6)\n- [i] iced thing\n",
        title="Icebox",
    )
    runner.invoke(cli.app, ["index"])
    out = runner.invoke(cli.app, ["tasks", "--stash"]).output
    assert "paused thing" in out and "iced thing" in out
    assert "nothing here is gone" in out
    assert "wake one" in out


def test_tasks_stale_lists_reshape_candidates(cli_project):
    from pkms.db import connect as db_connect
    runner.invoke(cli.app, ["index"])
    conn = db_connect(cli_project.parent / ".index")
    conn.execute("UPDATE task_seen SET first_seen='2026-05-01'")  # age everything
    conn.commit()
    conn.close()
    out = runner.invoke(cli.app, ["tasks", "--stale"]).output
    assert "open task one" in out
    assert "untouched since 2026-05-01" in out
    assert "at most one" in out  # the briefing's G8 budget, stated in copy


def test_did_logs_to_daily_note_and_pebbles_render(cli_project):
    result = runner.invoke(cli.app, ["did", "shipped the thing"])
    assert result.exit_code == 0
    assert "counted" in result.output
    from datetime import date
    note = (cli_project / "daily" / f"{date.today().isoformat()}.md").read_text(encoding="utf-8")
    assert "## did" in note and "- [x] shipped the thing" in note

    runner.invoke(cli.app, ["did", "another one"])
    out = runner.invoke(cli.app, ["today"]).output
    assert "2 done today" in out
    assert "streak" not in out.lower()  # wins only, never streaks


def test_backlinks_command(cli_project):
    runner.invoke(cli.app, ["index"])
    result = runner.invoke(cli.app, ["backlinks", "beta"])
    assert result.exit_code == 0
    assert "alpha.md" in result.output


def test_new_creates_note_with_frontmatter(cli_project):
    result = runner.invoke(cli.app, ["new", "Test Note", "--folder", "resources"])
    assert result.exit_code == 0
    created = cli_project / "resources" / "test-note.md"
    assert created.exists()
    text = created.read_text(encoding="utf-8")
    assert text.startswith("---\ntitle: Test Note\n")

    # second run must not clobber the existing note
    created.write_text(text + "user content", encoding="utf-8")
    runner.invoke(cli.app, ["new", "Test Note", "--folder", "resources"])
    assert "user content" in created.read_text(encoding="utf-8")


def test_daily_creates_today_note(cli_project):
    result = runner.invoke(cli.app, ["daily"])
    assert result.exit_code == 0
    notes = list((cli_project / "daily").glob("*.md"))
    assert len(notes) == 2  # fixture's 2026-06-01 + today's
