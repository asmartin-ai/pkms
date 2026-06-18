"""Full-text search and backlinks, including the FTS5-operator query regression."""


import pytest

from pkms.indexer import index_vault
from pkms.search import _sanitize, backlinks, search


@pytest.fixture
def indexed(vault, index_dir):
    index_vault(vault, index_dir)
    return index_dir


def test_search_finds_note(indexed):
    results = search("gamma", indexed)
    assert [r["path"] for r in results] == ["projects/alpha.md"]
    assert results[0]["title"] == "Alpha Project"
    assert "gamma" in results[0]["excerpt"]


def test_search_no_results(indexed):
    assert search("zzzznothing", indexed) == []


def test_search_respects_limit(indexed):
    assert len(search("note", indexed, limit=1)) == 1


def test_hyphenated_query_does_not_crash(indexed):
    """Regression: a hyphen in a plain query ('external-content') is FTS5 column-filter
    syntax and raised OperationalError before the sanitize fallback was added."""
    results = search("external-content", indexed)
    assert [r["path"] for r in results] == ["resources/beta.md"]


@pytest.mark.parametrize("query", ["NEAR(", 'unbalanced "quote', "trailing-", "wild*card ("])
def test_operator_laden_queries_do_not_crash(indexed, query):
    search(query, indexed)  # must not raise; result content is irrelevant


def test_sanitize_quotes_every_token():
    assert _sanitize("external-content fts5") == '"external-content" "fts5"'
    assert _sanitize('say "hi"') == '"say" """hi"""'


def test_backlinks_by_stem_and_path(indexed):
    # links store the raw wikilink target ('beta'), so stem and full path must both resolve
    assert backlinks("beta", indexed) == ["projects/alpha.md"]
    assert backlinks("resources/beta.md", indexed) == ["projects/alpha.md"]
    assert backlinks("no-such-note", indexed) == []
