"""Capture service: token-gating, the desktop today-view app, and /api/today JSON.

Drives make_server() through a real loopback socket so the routing, auth, and
JSON serialization are exercised exactly as the resident service runs them.
"""

import json
import threading
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

from pkms.capture_service import make_server
from pkms.indexer import index_vault

TOKEN = "test-token-123"


@pytest.fixture
def service(vault, index_dir):
    """A live server on an ephemeral port; yields its base URL, torn down after."""
    index_vault(vault, index_dir)  # /api/today reads the index
    server = make_server(vault, index_dir, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    try:
        yield f"http://{host}:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _get(url):
    with urlopen(url, timeout=5) as r:  # noqa: S310 — loopback only
        return r.status, r.read().decode("utf-8"), r.headers.get("Content-Type", "")


def test_health_needs_no_token(service):
    status, body, _ = _get(service + "/health")
    assert status == 200 and body == "ok"


def test_root_serves_today_app_with_token(service):
    status, body, ctype = _get(f"{service}/?token={TOKEN}")
    assert status == 200
    assert "text/html" in ctype
    assert "/api/today" in body  # the app fetches its data from there
    assert "pkms · today" in body


def test_root_rejects_missing_token(service):
    with pytest.raises(HTTPError) as exc:
        _get(service + "/")
    assert exc.value.code == 403


def test_api_today_returns_view_json(service):
    status, body, ctype = _get(f"{service}/api/today?token={TOKEN}")
    assert status == 200
    assert "application/json" in ctype
    view = json.loads(body)
    # same shape the CLI renders — one action per project, projects first
    assert {"date", "inbox_new", "next_actions", "done_today"} <= view.keys()
    assert view["next_actions"][0]["note"].startswith("projects")


def test_api_today_rejects_bad_token(service):
    with pytest.raises(HTTPError) as exc:
        _get(service + "/api/today?token=wrong")
    assert exc.value.code == 403


def test_capture_page_side_door_still_served(service):
    status, body, ctype = _get(f"{service}/capture-page?token={TOKEN}")
    assert status == 200 and "text/html" in ctype
    assert "dump a thought" in body


def test_capture_from_web_lands_in_inbox(service, vault):
    req = Request(f"{service}/capture?token={TOKEN}", data=b"a thought from the web",
                  method="POST")
    with urlopen(req, timeout=5) as r:  # noqa: S310 — loopback only
        assert r.status == 200
    files = list((vault / "inbox").glob("*.md"))
    assert len(files) == 1
    text = files[0].read_text(encoding="utf-8")
    assert "a thought from the web" in text
    assert "source: web" in text


def test_make_server_refuses_without_token(vault, index_dir):
    with pytest.raises(ValueError):
        make_server(vault, index_dir, "127.0.0.1", 0, "")
