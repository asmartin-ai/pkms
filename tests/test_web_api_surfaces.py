"""Web API surfaces for the new-tab frontend.

These tests pin the read-only JSON endpoints that let src/pkms/web/app.js
replace mock/empty arrays with real vault data. They intentionally exercise the
HTTP service because the web shell calls these routes directly.
"""

import json
import threading
from urllib.error import HTTPError
from urllib.request import urlopen

import pytest

from pkms.capture_service import make_server
from pkms.indexer import index_vault

TOKEN = "test-token-123"


@pytest.fixture
def service(vault, index_dir):
    reading = vault / "resources" / "reading"
    reading.mkdir(parents=True, exist_ok=True)
    (reading / "queued-thread.md").write_text(
        "---\n"
        "title: Queued Thread\n"
        "created: 2026-06-01\n"
        "reading: queued\n"
        "reading_minutes: 12\n"
        "promoted: 2026-06-10\n"
        "---\n\n"
        "A promoted thread body.\n",
        encoding="utf-8",
    )
    (reading / "finished-thread.md").write_text(
        "---\n"
        "title: Finished Thread\n"
        "created: 2026-06-01\n"
        "reading: done\n"
        "reading_minutes: 99\n"
        "promoted: 2026-06-09\n"
        "---\n\n"
        "Already read.\n",
        encoding="utf-8",
    )

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


def test_reading_queue_endpoint_is_token_gated(service):
    with pytest.raises(HTTPError) as exc:
        _json(service + "/api/reading-queue")
    assert exc.value.code == 403


def test_reading_queue_endpoint_returns_queued_notes_only(service):
    status, body, ctype = _json(f"{service}/api/reading-queue?token={TOKEN}")
    assert status == 200
    assert "application/json" in ctype
    assert body == [
        {
            "title": "Queued Thread",
            "minutes": 12,
            "promoted": "2026-06-10",
            "why": "next up in your reading queue",
            "path": "resources/reading/queued-thread.md",
        }
    ]


def test_recognition_cards_endpoint_includes_real_reading_card(service):
    status, body, ctype = _json(f"{service}/api/recognition-cards?token={TOKEN}")
    assert status == 200
    assert "application/json" in ctype
    assert body, "expected at least the queued reading card"
    assert body[0]["kind"] == "reading"
    assert body[0]["title"] == "Queued Thread"
    assert body[0]["minutes"] == 12
    assert body[0]["promoted"] == "2026-06-10"
    assert "why" in body[0]
