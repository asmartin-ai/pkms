"""F-batch oracle F1 — `pkms search --raw` CLI flag exposes the raw-FTS path.

`search.search()` accepts `raw=False` (literal-by-default — B4 contract, the
`test_search_operators_literal.py` oracle) and a `raw=True` escape hatch that
passes the query straight to FTS5 so power users can run boolean queries
(`foo OR bar`, `title:x`, `a*`). The web `/api/search?q=` endpoint is
literal-by-default only — no raw escape there (intentional; raw is a CLI power
feature, not a public surface).

The `pkms search` CLI command (cli.py `search()`) currently calls
`search.search(query, INDEX, limit=limit)` — it never passes `raw=`, so the
escape hatch is unreachable from the CLI. This RED test pins the contract:
`pkms search --raw "Alpha OR beta"` runs the boolean OR and surfaces BOTH
alpha.md (contains "Alpha") and beta.md (contains "beta"), while the bare
`pkms search "Alpha OR beta"` stays literal (matches nothing — no note contains
the literal token "OR").

Goes green once `cli.search` grows a `--raw` flag that forwards to
`search.search(..., raw=...)`. Scope: `src/pkms/cli.py` only.
"""

from typer.testing import CliRunner

import pkms.cli as cli
from pkms.indexer import index_vault
from tests.conftest import write_note

runner = CliRunner()


def _vault(tmp_path, monkeypatch, vault_root):
    """Reuse the conftest `vault` fixture's shape but allow custom notes."""
    index_dir = tmp_path / ".index"
    monkeypatch.setattr(cli, "VAULT", vault_root)
    monkeypatch.setattr(cli, "INDEX", index_dir)
    return vault_root, index_dir


def test_search_raw_flag_runs_boolean_or(tmp_path, monkeypatch):
    vault = tmp_path / "vault"
    write_note(
        vault / "projects" / "alpha.md",
        "Alpha references [[beta]] and [[gamma|the gamma note]].\n",
        title="Alpha Project",
        created="2026-06-01",
    )
    write_note(
        vault / "resources" / "beta.md",
        "Beta covers the FTS5 external-content table pattern.\n",
        title="Beta Note",
        created="2026-06-01",
    )
    vault_root, index_dir = _vault(tmp_path, monkeypatch, vault)
    index_vault(vault_root, index_dir)

    # --raw: FTS5 boolean OR → both notes match (one has Alpha, the other beta).
    raw_out = runner.invoke(cli.app, ["index"]).output  # ensure indexed
    _ = raw_out
    raw_result = runner.invoke(cli.app, ["search", "--raw", "Alpha OR beta"])
    assert raw_result.exit_code == 0, raw_result.output
    assert "alpha.md" in raw_result.output, (
        f"--raw boolean OR must match alpha.md (contains 'Alpha'); got: {raw_result.output}"
    )
    assert "beta.md" in raw_result.output, (
        f"--raw boolean OR must match beta.md (contains 'beta'); got: {raw_result.output}"
    )


def test_search_without_raw_stays_literal_for_or(tmp_path, monkeypatch):
    """Bare `pkms search "Alpha OR beta"` is literal — no note has the token OR."""
    vault = tmp_path / "vault"
    write_note(
        vault / "projects" / "alpha.md",
        "Alpha references [[beta]] and [[gamma|the gamma note]].\n",
        title="Alpha Project",
        created="2026-06-01",
    )
    write_note(
        vault / "resources" / "beta.md",
        "Beta covers the FTS5 external-content table pattern.\n",
        title="Beta Note",
        created="2026-06-01",
    )
    vault_root, index_dir = _vault(tmp_path, monkeypatch, vault)
    index_vault(vault_root, index_dir)

    runner.invoke(cli.app, ["index"])
    literal_result = runner.invoke(cli.app, ["search", "Alpha OR beta"])
    assert literal_result.exit_code == 0, literal_result.output
    assert "No results" in literal_result.output, (
        "bare (literal) search for 'Alpha OR beta' must NOT run as boolean OR — "
        f"no note contains the literal token 'OR'. got: {literal_result.output}"
    )
