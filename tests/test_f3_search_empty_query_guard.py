"""F-batch oracle F3 — `search.search()` guards empty/whitespace queries.

`search.search(query, index_dir)` (search.py) sanitizes the query by quoting
each token, but the `else` (literal-by-default) branch has no guard for empty
or whitespace-only input. An empty query sanitizes to the empty string `""`,
which FTS5 rejects with `OperationalError: fts5: syntax error`. A whitespace-
only query (`"   "`, `"\t"`) splits to zero tokens and joins to the same empty
string — same crash.

The web `/api/search` endpoint guards this at the route level
(`search(q, index_dir) if q.strip() else []` — see capture_service.py:188),
but the library function itself is unguarded, so any direct caller (the CLI, a
future surface, a test) hits the OperationalError. The fix lives in
`search.search()`: return `[]` immediately when the query has no non-whitespace
content. Scope: `src/pkms/search.py` only (the `search` function); the web
guard stays as defense-in-depth.

This is the library-level gap the web guard papered over. The web endpoint's
own test (`test_search_endpoint_empty_query_returns_empty_or_200`) pins the
route behavior; this one pins the underlying function.
"""

import pytest

from pkms.indexer import index_vault
from pkms.search import search
from tests.conftest import write_note


def _indexed(tmp_path):
    vault = tmp_path / "vault"
    write_note(
        vault / "projects" / "alpha.md",
        "Alpha references [[beta]].\n",
        title="Alpha",
        created="2026-06-01",
    )
    index_dir = tmp_path / ".index"
    index_vault(vault, index_dir)
    return index_dir


@pytest.mark.parametrize("empty", ["", "   ", "\t", "\n  \n"])
def test_empty_or_whitespace_query_returns_empty_list(tmp_path, empty):
    idx = _indexed(tmp_path)
    # Must NOT raise OperationalError; must return [] (the empty state is a
    # reward — design language §3).
    result = search(empty, idx)
    assert result == [], f"empty/whitespace query {empty!r} must return [], got {result}"


def test_nonempty_query_still_matches(tmp_path):
    """The guard must not swallow real queries — regression guard for the fix."""
    idx = _indexed(tmp_path)
    result = search("alpha", idx)
    assert len(result) == 1
    assert result[0]["path"] == "projects/alpha.md"
