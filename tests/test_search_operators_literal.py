"""Bakeoff oracle — B4: plain search must treat FTS5 operators as LITERAL text.

`search()` currently passes the raw query straight to `notes_fts MATCH` and only
sanitizes on an OperationalError. Queries that are *valid* FTS5 syntax but meant
literally (`foo OR bar`, `title:x`, `a*`) therefore run as operators and return
wrong results without erroring. This RED test pins the contract: a plain query is
literal text. It goes green once `search()` sanitizes by default (raw FTS behind
an explicit flag) — see vault/projects/pkms-design/sweep-findings-2026-06-17.md (B4).
"""


from pkms.indexer import index_vault
from pkms.search import search

from conftest import write_note


def test_or_in_a_plain_query_is_literal_not_a_boolean_operator(tmp_path):
    vault = tmp_path / "vault"
    write_note(
        vault / "resources" / "both.md",
        "foo OR bar appear together in this note.\n",
        title="Both", created="2026-01-01",
    )
    write_note(
        vault / "resources" / "foo_only.md",
        "foo appears here but the second keyword does not.\n",
        title="Foo Only", created="2026-01-01",
    )
    index_dir = tmp_path / ".index"
    index_vault(vault, index_dir)

    paths = [r["path"] for r in search("foo OR bar", index_dir)]

    both = "resources/both.md"
    foo_only = "resources/foo_only.md"
    # the note literally containing "foo OR bar" must match…
    assert both in paths
    # …and the foo-only note must NOT match — `OR` is literal, not a boolean operator
    assert foo_only not in paths
