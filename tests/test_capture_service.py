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
    host = server.server_address[0]
    port = server.server_address[1]
    try:
        yield f"http://{host}:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _get(url):
    with urlopen(url, timeout=5) as r:  # noqa: S310 — loopback only
        return r.status, r.read().decode("utf-8"), r.headers.get("Content-Type", "")


def _get_no_redirect(url):
    """GET that does NOT follow redirects, returning (status, location_header)."""
    import urllib.request

    class _NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None

    no_redir = urllib.request.build_opener(_NoRedirect)
    try:
        with no_redir.open(url, timeout=5) as r:  # noqa: S310 — loopback only
            return r.status, r.headers.get("Location", "")
    except HTTPError as e:
        # a 302 surfaces as HTTPError under the no-redirect handler
        return e.code, e.headers.get("Location", "")


def test_health_needs_no_token(service):
    status, body, _ = _get(service + "/health")
    assert status == 200 and body == "ok"


def test_root_redirects_to_web(vault, index_dir, service):
    """The desktop front door is now /web/ (the new-tab poster); / 302-redirects there."""
    status, location = _get_no_redirect(f"{service}/?token={TOKEN}")
    assert status == 302
    assert location.startswith("/web/")


def test_root_redirect_preserves_token_query(service):
    """The 302 to /web/ carries the ?token=… so the authed page loads without re-prompt."""
    _, location = _get_no_redirect(f"{service}/?token={TOKEN}")
    assert "token=" in location


def test_web_shell_is_open_without_token(service):
    """The static shell (/web/) is intentionally OPEN — browsers fetch
    sub-resources (styles.css, app.js) via <script>/<link> which do NOT carry
    ?token=, so gating them 403s the sub-resource and the page never runs.
    The shell holds no vault data; the real data boundary is /api/today
    (covered by test_api_today_rejects_bad_token)."""
    status, body, ctype = _get(f"{service}/web/")
    assert status == 200, "the static shell must load without a token"
    assert "text/html" in ctype


def test_web_subresources_load_without_token(service):
    """Regression: browsers request <script src='app.js'> without ?token=.
    styles.css + app.js must serve 200 without a token or the page breaks
    in a real browser (app.js never runs → renders empty 'nothing owed')."""
    for sub in ("/web/styles.css", "/web/app.js"):
        status, _, _ = _get(service + sub)
        assert status == 200, f"{sub} must load without ?token= (browser sub-resource)"


def test_web_index_html_served(service):
    """GET /web/?token=... returns the new-tab poster HTML, which loads its data layer (app.js)."""
    status, body, ctype = _get(f"{service}/web/?token={TOKEN}")
    assert status == 200
    assert "text/html" in ctype
    assert "pkms" in body.lower()
    # the page loads app.js (Task 4 wires app.js to fetch /api/today).
    assert "app.js" in body


def test_web_app_js_fetches_api_today(service):
    """app.js must fetch /api/today (live data), not rely on inlined fake JSON."""
    status, body, ctype = _get(f"{service}/web/app.js?token={TOKEN}")
    assert status == 200 and "text/javascript" in ctype
    assert "fetch(" in body and "/api/today" in body
    # the inlined fake-data constants must be gone (mockup-only artifact)
    assert "inbox_new: 3" not in body, "app.js still carries inlined fake data"


def test_web_static_assets_served_with_correct_types(service):
    """styles.css, app.js, manifest.webmanifest, icon.svg serve with right content-types."""
    cases = [
        ("/web/styles.css", "text/css"),
        ("/web/app.js", "text/javascript"),
        ("/web/manifest.webmanifest", "application/manifest+json"),
        ("/web/icon.svg", "image/svg+xml"),
    ]
    for path, expected_ctype in cases:
        status, body, ctype = _get(f"{service}{path}?token={TOKEN}")
        assert status == 200, f"{path} returned {status}"
        assert ctype.startswith(expected_ctype), f"{path}: expected {expected_ctype}, got {ctype}"
        assert len(body) > 0


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
    req = Request(f"{service}/capture?token={TOKEN}", data=b"a thought from the web", method="POST")
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
