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
