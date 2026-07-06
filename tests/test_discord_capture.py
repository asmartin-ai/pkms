"""Slice 8 oracle — Discord bot ramp (pkms.discord_capture).

Contract: a DM (or a message in the one allowed channel) is POSTed to the
capture service as source=discord, deduped by Discord message id against an
append-only ledger in .index/discord-ledger.txt. The discord.py wiring is
NOT under test (and discord must not be imported at module level — this
suite runs without it installed); the routing/dedupe/post core is.
"""

import threading
from pathlib import Path
from urllib.error import HTTPError

import pytest

from pkms.capture_service import make_server
from pkms.discord_capture import (
    capture_message,
    load_discord_ledger,
    make_poster,
    should_capture,
)

TOKEN = "test-token"


@pytest.fixture
def base_url(vault: Path, index_dir: Path):
    server = make_server(vault, index_dir, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()


def test_should_capture_matrix():
    dm = dict(is_dm=True, channel_id=None, allowed_channel_id=None)
    assert should_capture(author_is_bot=False, **dm)
    assert not should_capture(author_is_bot=True, **dm)  # never echo bots
    assert should_capture(
        author_is_bot=False, is_dm=False, channel_id="42", allowed_channel_id="42"
    )
    assert not should_capture(
        author_is_bot=False, is_dm=False, channel_id="99", allowed_channel_id="42"
    )
    # no allowed channel configured: only DMs capture
    assert not should_capture(
        author_is_bot=False, is_dm=False, channel_id="42", allowed_channel_id=None
    )


def test_capture_message_posts_once_and_dedupes(index_dir: Path):
    posted: list[str] = []
    assert capture_message("a thought", "msg-1", index_dir, post=posted.append)
    assert posted == ["a thought"]
    assert load_discord_ledger(index_dir) == {"msg-1"}
    # duplicate id: not re-posted, reports False
    assert not capture_message("a thought", "msg-1", index_dir, post=posted.append)
    assert posted == ["a thought"]


def test_capture_message_failed_post_is_not_ledgered(index_dir: Path):
    def boom(_text: str) -> None:
        raise RuntimeError("service down")

    with pytest.raises(RuntimeError):
        capture_message("lost?", "msg-2", index_dir, post=boom)
    # not ledgered, so a retry can succeed
    assert "msg-2" not in load_discord_ledger(index_dir)


def test_make_poster_lands_capture_file(vault: Path, index_dir: Path, base_url: str):
    post = make_poster(base_url, TOKEN)
    post("from discord with love")
    files = list((vault / "inbox").glob("*.md"))
    assert len(files) == 1
    body = files[0].read_text(encoding="utf-8")
    assert "source: discord" in body
    assert "from discord with love" in body


def test_make_poster_bad_token_raises(vault: Path, index_dir: Path, base_url: str):
    post = make_poster(base_url, "wrong-token")
    with pytest.raises(HTTPError):
        post("should not land")
    assert list((vault / "inbox").glob("*.md")) == []
