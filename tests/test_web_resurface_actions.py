"""Persistent resurface actions for the web frontend.

The new-tab UI's not-now / let-it-go buttons must call a token-gated backend
endpoint. Local-only UI state is not enough: not-now updates the no-renag window
in the derived index, and let-go writes the user-visible forever-exit to note
frontmatter.
"""

import json
import threading
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import frontmatter
import pytest

from pkms.capture_service import make_server
from pkms.db import connect
from pkms.indexer import index_vault

TOKEN = "test-token-123"


@pytest.fixture
def service(vault, index_dir):
    target = vault / "resources" / "old-idea.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        "---\ntitle: Old Idea\ncreated: 2026-01-01\n---\n\nAn old idea worth maybe resurfacing.\n",
        encoding="utf-8",
    )
    index_vault(vault, index_dir)
    server = make_server(vault, index_dir, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host = server.server_address[0]
    port = server.server_address[1]
    try:
        yield f"http://{host}:{port}", vault, index_dir
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _post_json(url, payload):
    req = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=5) as r:  # noqa: S310 — loopback only
        return r.status, json.loads(r.read().decode("utf-8")), r.headers.get("Content-Type", "")


def test_resurface_action_endpoint_is_token_gated(service):
    base, _, _ = service
    with pytest.raises(HTTPError) as exc:
        _post_json(base + "/api/resurface", {"path": "resources/old-idea.md", "action": "not-now"})
    assert exc.value.code == 403


def test_resurface_not_now_persists_rest_window(service):
    base, _, index_dir = service
    status, body, ctype = _post_json(
        f"{base}/api/resurface?token={TOKEN}",
        {"path": "resources/old-idea.md", "action": "not-now"},
    )
    assert status == 200
    assert "application/json" in ctype
    assert body == {"ok": True, "action": "not-now", "path": "resources/old-idea.md"}

    conn = connect(index_dir)
    row = conn.execute(
        "SELECT rest_until FROM resurface_offers WHERE path = ?",
        ("resources/old-idea.md",),
    ).fetchone()
    conn.close()
    assert row is not None
    assert row["rest_until"] > "2026-01-01"


def test_resurface_let_go_writes_frontmatter(service):
    base, vault, _ = service
    status, body, _ = _post_json(
        f"{base}/api/resurface?token={TOKEN}",
        {"path": "resources/old-idea.md", "action": "let-go"},
    )
    assert status == 200
    assert body == {"ok": True, "action": "let-go", "path": "resources/old-idea.md"}

    meta = frontmatter.load(vault / "resources" / "old-idea.md").metadata
    assert meta["resurface"] == "never"


def test_resurface_action_rejects_unknown_action_without_changing_file(service):
    base, vault, _ = service
    before = (vault / "resources" / "old-idea.md").read_text(encoding="utf-8")
    with pytest.raises(HTTPError) as exc:
        _post_json(
            f"{base}/api/resurface?token={TOKEN}",
            {"path": "resources/old-idea.md", "action": "explode"},
        )
    assert exc.value.code == 400
    after = (vault / "resources" / "old-idea.md").read_text(encoding="utf-8")
    assert after == before
