"""Oracle — P2: recognition-first search candidates + literal search endpoint.

RED tests for two token-gated read-only endpoints the today-view search surface
needs (delegation-roadmap P2). Both go green when `capture_service.make_server`
routes them; the literal-by-default contract (B4) is preserved.

Endpoints:
  GET /api/recent-notes  — recently-touched notes (title, vault-relative "/" path,
                            last-touched ISO), capped ~8, sorted by recency desc.
                            Reuses index data for the candidate set; mtime is the
                            sort key (ground truth, not index-derivable — the index
                            is regenerable and `modified` frontmatter is often empty).
  GET /api/search?q=     — literal-by-default free-text search hitting search.search().
                            Returns [{path, title, excerpt}], no result counts.
                            FTS5 operators in the query are LITERAL text (B4 contract):
                            a plain query is sanitized to quoted tokens joined by
                            implicit AND, so "foo OR bar" requires all of foo, OR,
                            bar to appear — it does NOT run as a boolean OR.

Both endpoints are token-gated (403 without), read-only, side-effect-free.
"""

import json
import threading
import time
from urllib.error import HTTPError
from urllib.request import urlopen

import pytest

from pkms.capture_service import make_server
from pkms.indexer import index_vault

TOKEN = "test-token-123"


@pytest.fixture
def service(vault, index_dir):
    """A vault with several notes of varying mtime, indexed, plus a live server."""
    # Touch the three conftest notes in a known recency order. The fixture creates
    # alpha.md, beta.md, daily/2026-06-01.md. Touch beta LAST so it is the most recent.
    # Use time.sleep to guarantee mtime ordering on filesystems with coarse mtime.
    alpha = vault / "projects" / "alpha.md"
    beta = vault / "resources" / "beta.md"
    daily = vault / "daily" / "2026-06-01.md"
    # Order: daily (oldest) -> alpha -> beta (newest)
    for p in (alpha, daily):
        p.write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
        time.sleep(0.05)
    beta.write_text(beta.read_text(encoding="utf-8"), encoding="utf-8")
    time.sleep(0.05)

    index_vault(vault, index_dir)
    server = make_server(vault, index_dir, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host = server.server_address[0]
    port = server.server_address[1]
    try:
        yield f"http://{host}:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _json(url):
    with urlopen(url, timeout=5) as r:  # noqa: S310 — loopback only
        return r.status, json.loads(r.read().decode("utf-8")), r.headers.get("Content-Type", "")


# ── /api/recent-notes ──────────────────────────────────────────────────────────


def test_recent_notes_endpoint_is_token_gated(service):
    with pytest.raises(HTTPError) as exc:
        _json(service + "/api/recent-notes")
    assert exc.value.code == 403


def test_recent_notes_returns_recently_touched_notes(service):
    status, body, ctype = _json(f"{service}/api/recent-notes?token={TOKEN}")
    assert status == 200
    assert "application/json" in ctype
    assert isinstance(body, list)
    # Cap: at most 8 (the roadmap's "~8" cap; allow the server a small headroom).
    assert len(body) <= 8
    # Each entry has the shape the search picker needs.
    for entry in body:
        assert "title" in entry and isinstance(entry["title"], str)
        assert "path" in entry and isinstance(entry["path"], str)
        assert "last_touched" in entry and isinstance(entry["last_touched"], str)
        # Path is vault-relative with forward slashes (the app.js contract).
        assert "\\" not in entry["path"]


def test_recent_notes_sorted_most_recent_first(service):
    """The most recently touched note is first; ordering is by recency desc."""
    status, body, _ = _json(f"{service}/api/recent-notes?token={TOKEN}")
    assert status == 200
    titles = [e["title"] for e in body]
    # beta was touched last in the fixture; it should appear before alpha and daily.
    assert titles.index("Beta Note") < titles.index("Alpha Project")


def test_recent_notes_excludes_nothing_for_empty_vault(tmp_path):
    """An empty vault returns [] not 500 — the picker renders the empty state."""
    from pkms.capture_service import make_server as _make

    vault = tmp_path / "vault"
    vault.mkdir()
    index = tmp_path / ".index"
    server = _make(vault, index, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, body, _ = _json(
            f"http://{server.server_address[0]}:{server.server_address[1]}/api/recent-notes?token={TOKEN}"
        )
        assert status == 200
        assert body == []
    finally:
        server.shutdown()
        server.server_close()


# ── /api/search ─────────────────────────────────────────────────────────────────


def test_search_endpoint_is_token_gated(service):
    with pytest.raises(HTTPError) as exc:
        _json(service + "/api/search?q=foo")
    assert exc.value.code == 403


def test_search_endpoint_preserves_literal_by_default_contract(service):
    """The endpoint is literal-by-default (B4 contract).

    `search.search()` with `raw=False` sanitizes the query to quoted tokens joined
    by FTS5 implicit AND. So "foo OR bar" is three literal tokens (foo, OR, bar)
    that ALL must appear — it does NOT run as a boolean OR. Only notes containing
    every token surface; the boolean OR would surface notes with foo OR bar alone.
    """
    # alpha.md body contains "Alpha references [[beta]] and [[gamma|the gamma note]]."
    # — it contains "Alpha" and "references" but NOT "OR" or "foobar". Use a query
    # whose literal-token form the test vault can satisfy: "Alpha references" both
    # appear in alpha.md, so the sanitized "Alpha" "references" matches it.
    status, body, ctype = _json(f"{service}/api/search?q=Alpha%20references&token={TOKEN}")
    assert status == 200
    assert "application/json" in ctype
    assert isinstance(body, list)
    paths = {r["path"] for r in body}
    assert "projects/alpha.md" in paths, (
        "literal-by-default: 'Alpha references' sanitized to quoted tokens "
        "must match alpha.md (contains both tokens)."
    )
    # And the boolean-OR trap: a query like "Alpha OR beta" must NOT run as a
    # boolean OR — it requires literal tokens Alpha, OR, beta. No note contains
    # the literal token "OR" as a word, so this returns []. If the endpoint passed
    # raw=True (or didn't sanitize), it would surface notes with Alpha or beta.
    status2, body2, _ = _json(f"{service}/api/search?q=Alpha%20OR%20beta&token={TOKEN}")
    assert status2 == 200
    # No note in the conftest vault contains the literal word "OR", so the
    # implicit-AND of "Alpha" "OR" "beta" matches nothing.
    assert body2 == [], (
        f"literal-by-default broken: 'Alpha OR beta' must NOT run as boolean OR. got: {body2}"
    )


def test_search_endpoint_result_shape(service):
    status, body, _ = _json(f"{service}/api/search?q=alpha&token={TOKEN}")
    assert status == 200
    assert isinstance(body, list)
    for r in body:
        assert "path" in r and isinstance(r["path"], str)
        assert "title" in r and isinstance(r["title"], str)
        assert "excerpt" in r and isinstance(r["excerpt"], str)


def test_search_endpoint_empty_query_returns_empty_or_200(service):
    """An empty query must not 500 — the picker handles the empty state."""
    status, body, _ = _json(f"{service}/api/search?q=&token={TOKEN}")
    assert status == 200
    assert isinstance(body, list)


def test_search_endpoint_missing_q_param_does_not_500(service):
    """No ?q= at all: 200 with [] (the picker renders the empty state)."""
    status, body, _ = _json(f"{service}/api/search?token={TOKEN}")
    assert status == 200
    assert isinstance(body, list)
