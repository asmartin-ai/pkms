"""Promote: URL parsing, read-only access, candidate search, rendering, queue."""

import json
import sqlite3
from pathlib import Path

import pytest

from pkms.promote import (
    _sqlite_readonly_uri,
    connect_hoarder,
    extract_post_id,
    fetch_thread,
    promote,
    render_note,
    search_threads,
)
from pkms.today import today_view


def _comment(author, body, score, replies=None, kind="t1"):
    data = {"author": author, "body": body, "score": score}
    if replies:
        data["replies"] = {"kind": "Listing", "data": {"children": replies}}
    return {"kind": kind, "data": data}


THREAD_JSON = [
    {
        "kind": "Listing",
        "data": {
            "children": [
                {
                    "kind": "t3",
                    "data": {
                        "title": "How do you actually retain what you read?",
                        "selftext": "I save everything and read nothing. " * 10,
                        "score": 412,
                    },
                }
            ]
        },
    },
    {
        "kind": "Listing",
        "data": {
            "children": [
                _comment("lowvoter", "early but mediocre take", 3),
                _comment(
                    "topvoter",
                    "Spaced repetition changed everything for me.\n\nSecond paragraph.",
                    250,
                    replies=[
                        _comment(
                            "replier",
                            "Agreed — and write summaries.",
                            90,
                            replies=[
                                _comment("[deleted]", "[deleted]", 5),
                                _comment(
                                    "deep1",
                                    "level 3",
                                    4,
                                    replies=[
                                        _comment(
                                            "deep2",
                                            "level 4",
                                            3,
                                            replies=[
                                                _comment(
                                                    "deep3",
                                                    "level 5 at MAX_DEPTH",
                                                    2,
                                                    replies=[
                                                        _comment(
                                                            "deep4", "abyss level — collapsed", 1
                                                        ),
                                                    ],
                                                ),
                                            ],
                                        ),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
                {"kind": "more", "data": {"count": 17}},
            ]
        },
    },
]


@pytest.fixture
def hoarder_db(tmp_path):
    db = tmp_path / "app.db"
    conn = sqlite3.connect(db)
    conn.executescript("""
        CREATE TABLE items (fullname TEXT, source TEXT, kind TEXT, title TEXT,
            url TEXT, author TEXT, created_utc INTEGER, saved_utc INTEGER,
            search_text TEXT, metadata TEXT);
        CREATE TABLE reddit_threads (fullname TEXT, thread_json TEXT, hydrated_at INTEGER);
    """)
    meta = json.dumps(
        {"subreddit": "PKMS", "permalink": "https://www.reddit.com/r/PKMS/comments/abc123/how/"}
    )
    conn.execute(
        "INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?)",
        (
            "reddit:t3_abc123",
            "reddit",
            "post",
            "How do you actually retain what you read?",
            "https://www.reddit.com/r/PKMS/comments/abc123/how/",
            "asker",
            1686300000,
            1686400000,
            "retain read spaced repetition",
            meta,
        ),
    )
    conn.execute(
        "INSERT INTO reddit_threads VALUES (?,?,?)",
        ("reddit:t3_abc123", json.dumps(THREAD_JSON), 1780000000),
    )
    # a hydrated decoy + an UNhydrated item that must never appear in candidates
    conn.execute(
        "INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?)",
        (
            "reddit:t3_zzz999",
            "reddit",
            "post",
            "Unhydrated post about reading",
            "u",
            "a",
            1,
            2,
            "reading",
            "{}",
        ),
    )
    conn.commit()
    conn.close()
    return db


# --- query parsing ---


@pytest.mark.parametrize(
    "q",
    [
        "https://www.reddit.com/r/PKMS/comments/abc123/how_do_you/",
        "https://reddit.com/comments/abc123",
        "https://redd.it/abc123",
        "t3_abc123",
        "abc123",
    ],
)
def test_extract_post_id_variants(q):
    assert extract_post_id(q) == "abc123"


def test_search_terms_are_not_ids():
    assert extract_post_id("spaced repetition notes") is None


# --- read-only + lookup ---


def test_readonly_uri_handles_windows_extended_paths():
    import platform
    if platform.system() != "Windows":
        pytest.skip("Windows extended-path test requires Windows")
    uri = _sqlite_readonly_uri(Path(r"\\?\O:\Temp\pkms space\app.db"))
    assert uri == "file:/O:/Temp/pkms%20space/app.db?mode=ro"


def test_hoarder_connection_is_read_only(hoarder_db):
    conn = connect_hoarder(hoarder_db)
    with pytest.raises(sqlite3.OperationalError):
        conn.execute("INSERT INTO reddit_threads VALUES ('x','[]',0)")
    conn.close()


def test_search_only_returns_hydrated(hoarder_db):
    conn = connect_hoarder(hoarder_db)
    hits = search_threads(conn, "read")
    conn.close()
    ids = [h["id"] for h in hits]
    assert "abc123" in ids and "zzz999" not in ids


# --- rendering ---


@pytest.fixture
def thread(hoarder_db):
    conn = connect_hoarder(hoarder_db)
    t = fetch_thread(conn, "abc123")
    conn.close()
    return t


def test_render_frontmatter_and_provenance(thread):
    note, minutes = render_note(thread)
    assert 'title: "How do you actually retain what you read?"' in note
    assert "reading: queued" in note
    assert f"reading_minutes: {minutes}" in note
    assert "source: https://www.reddit.com/r/PKMS/comments/abc123/how/" in note
    assert "subreddit: PKMS" in note
    assert minutes >= 1


def test_render_orders_comments_by_score(thread):
    note, _ = render_note(thread)
    assert note.index("topvoter") < note.index("lowvoter")


def test_render_nests_replies_and_collapses_deep_ones(thread):
    note, _ = render_note(thread)
    assert "> **u/replier**" in note  # depth 1 quoted
    assert "level 5 at MAX_DEPTH" in note  # depth == MAX_DEPTH stays
    assert "abyss level" not in note  # beyond MAX_DEPTH collapsed
    assert "full thread" in note  # omitted pointer (incl. the 'more' stub's 17)

    # search words must not be misread as bare ids
    assert extract_post_id("retain") is None


def test_render_skips_deleted_but_keeps_descendants(thread):
    note, _ = render_note(thread)
    assert "[deleted]" not in note
    assert "level 3" in note  # child of the deleted comment survives


# --- promote orchestration ---


def test_promote_url_writes_queued_note(hoarder_db, tmp_path):
    vault = tmp_path / "vault"
    result = promote("https://redd.it/abc123", vault, hoarder_db)
    path = result["note"]
    assert path.parent == vault / "resources" / "reading"
    text = path.read_text(encoding="utf-8")
    assert "Spaced repetition changed everything" in text
    # promoting again must not clobber the existing note
    again = promote("abc123", vault, hoarder_db)
    assert again["note"] != path


def test_promote_search_returns_candidates(hoarder_db, tmp_path):
    result = promote("retain", tmp_path / "vault", hoarder_db)
    assert result["candidates"][0]["id"] == "abc123"


def test_promote_unhoarded_id_reports_missing(hoarder_db, tmp_path):
    assert promote("https://redd.it/nope777", tmp_path / "vault", hoarder_db) == {
        "missing": "nope777"
    }


# --- today-view queue ---


def test_today_shows_oldest_queued_read(hoarder_db, tmp_path, index_dir):
    vault = tmp_path / "vault"
    promote("abc123", vault, hoarder_db)
    view = today_view(vault, index_dir)
    assert view["next_read"]["title"] == "How do you actually retain what you read?"
    assert view["next_read"]["minutes"] >= 1


def test_today_queue_empties_when_marked_read(hoarder_db, tmp_path, index_dir):
    vault = tmp_path / "vault"
    path = promote("abc123", vault, hoarder_db)["note"]
    path.write_text(
        path.read_text(encoding="utf-8").replace("reading: queued", "reading: done"),
        encoding="utf-8",
    )
    assert today_view(vault, index_dir)["next_read"] is None


# --- interactive selection menu (CLI) ---


@pytest.fixture
def cli_promote(hoarder_db, tmp_path, monkeypatch):
    from typer.testing import CliRunner

    import pkms.cli as cli
    import pkms.promote as promote_mod

    vault = tmp_path / "vault"
    monkeypatch.setattr(cli, "VAULT", vault)
    monkeypatch.setattr(promote_mod, "HOARDER_DB", hoarder_db)
    return CliRunner(), cli.app, vault


def test_menu_number_promotes_in_place(cli_promote):
    runner, app, vault = cli_promote
    result = runner.invoke(app, ["promote", "retain"], input="1\n")
    assert result.exit_code == 0
    assert "which one?" in result.output and "promoted" in result.output
    assert list((vault / "resources" / "reading").glob("*.md"))


def test_menu_enter_skips_for_free(cli_promote):
    runner, app, vault = cli_promote
    result = runner.invoke(app, ["promote", "retain"], input="\n")
    assert result.exit_code == 0
    assert "promoted" not in result.output
    assert not (vault / "resources" / "reading").exists()


def test_menu_junk_input_also_skips(cli_promote):
    runner, app, vault = cli_promote
    result = runner.invoke(app, ["promote", "retain"], input="99\n")
    assert result.exit_code == 0
    assert not (vault / "resources" / "reading").exists()
