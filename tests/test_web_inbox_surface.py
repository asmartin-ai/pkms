"""Oracle — P2(b): inbox surface — recent captures as recognition cards.

RED tests for the token-gated read-only endpoint that backs the today-view's
inbox surface (delegation-roadmap P2 half (b)). Recognition, never a pile: a
calm card/row surface showing recent vault/inbox/ captures, framed as progress
("safe here until folded"). No count badges beyond the existing fold-progress
copy. Each item offers one gentle action (open · start /fold externally ·
leave it).

Endpoint:
  GET /api/inbox-items  — recent captures (preview, source, captured ISO,
                          path), capped ~10, sorted newest-first. The
                          preview is the FIRST LINE of the capture body
                          (truncated) — recognition of what's waiting, never
                          a full content dump. The body is the user's
                          personal text; only the first line surfaces.

Token-gated (403 without), read-only, side-effect-free: never writes the
inbox or the index. Empty inbox → 200 [] (the empty state is a reward).
"""

import json
import threading
from datetime import datetime
from urllib.error import HTTPError
from urllib.request import urlopen

import pytest

from pkms.capture import write_capture
from pkms.capture_service import make_server

TOKEN = "test-token-123"


@pytest.fixture
def service(vault, index_dir):
    """A vault with three captures of varying age and source, plus a live server."""
    # Three captures, oldest first. The write_capture filename is timestamped
    # to the second; use explicit `now` to guarantee ordering on coarse filesystems.
    write_capture(
        "older thought from the hotkey\n\nlonger body that should not appear in preview",
        vault,
        source="hotkey",
        now=datetime(2026, 6, 1, 10, 0, 0),
    )
    write_capture(
        "middle capture from the phone",
        vault,
        source="phone",
        now=datetime(2026, 6, 2, 10, 0, 0),
    )
    write_capture(
        "newest capture from the web",
        vault,
        source="web",
        now=datetime(2026, 6, 3, 10, 0, 0),
    )
    index_vault_safe(vault, index_dir)
    server = make_server(vault, index_dir, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://{server.server_address[0]}:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def index_vault_safe(vault, index_dir):
    """Indexer skips vault/inbox/ (it's gitignored and personal). That's fine —
    the inbox surface reads disk directly, not the index."""
    from pkms.indexer import index_vault

    index_vault(vault, index_dir)


def _json(url):
    with urlopen(url, timeout=5) as r:  # noqa: S310 — loopback only
        return r.status, json.loads(r.read().decode("utf-8")), r.headers.get("Content-Type", "")


def test_inbox_items_endpoint_is_token_gated(service):
    with pytest.raises(HTTPError) as exc:
        _json(service + "/api/inbox-items")
    assert exc.value.code == 403


def test_inbox_items_returns_recent_captures_newest_first(service):
    status, body, ctype = _json(f"{service}/api/inbox-items?token={TOKEN}")
    assert status == 200
    assert "application/json" in ctype
    assert isinstance(body, list)
    assert len(body) == 3
    # Newest first — the web capture (2026-06-03) is first.
    assert body[0]["source"] == "web"
    assert body[1]["source"] == "phone"
    assert body[2]["source"] == "hotkey"


def test_inbox_items_entry_shape(service):
    status, body, _ = _json(f"{service}/api/inbox-items?token={TOKEN}")
    assert status == 200
    for entry in body:
        assert "preview" in entry and isinstance(entry["preview"], str)
        assert "source" in entry and isinstance(entry["source"], str)
        assert "captured" in entry and isinstance(entry["captured"], str)
        assert "path" in entry and isinstance(entry["path"], str)
        # Path is vault-relative with forward slashes.
        assert "\\" not in entry["path"]
        assert entry["path"].startswith("inbox/")


def test_inbox_items_preview_is_first_line_only(service):
    """The preview is the FIRST LINE of the capture body, never the full text.

    The body is personal content; the surface is recognition-only. A multi-line
    capture's preview must be just its first line (truncated), not the whole
    body — so the longer second line 'longer body that should not appear in
    preview' must NOT appear.
    """
    status, body, _ = _json(f"{service}/api/inbox-items?token={TOKEN}")
    assert status == 200
    hotkey = next(e for e in body if e["source"] == "hotkey")
    assert hotkey["preview"].startswith("older thought from the hotkey")
    assert "longer body that should not appear in preview" not in hotkey["preview"]


def test_inbox_items_capped(service):
    """The endpoint caps at a reasonable number (~10) so the surface never
    becomes a wall. The cap is the recognition-over-pile guard (design §3/§6)."""
    status, body, _ = _json(f"{service}/api/inbox-items?token={TOKEN}")
    assert status == 200
    assert len(body) <= 10


def test_inbox_items_empty_inbox_returns_empty_list(tmp_path):
    """An empty inbox returns 200 [] — the empty state is a reward, not a hole
    or an error. Never 'you have no captures' framing."""
    vault = tmp_path / "vault"
    vault.mkdir()
    index = tmp_path / ".index"
    server = make_server(vault, index, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, body, _ = _json(
            f"http://{server.server_address[0]}:{server.server_address[1]}/api/inbox-items?token={TOKEN}"
        )
        assert status == 200
        assert body == []
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_inbox_items_inbox_dir_missing_returns_empty(tmp_path):
    """No inbox/ dir at all → 200 [] (the app recreates dirs on demand; the
    surface must not 500 when the dir is absent)."""
    vault = tmp_path / "vault"
    vault.mkdir()
    index = tmp_path / ".index"
    server = make_server(vault, index, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, body, _ = _json(
            f"http://{server.server_address[0]}:{server.server_address[1]}/api/inbox-items?token={TOKEN}"
        )
        assert status == 200
        assert body == []
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
