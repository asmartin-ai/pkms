"""Capture core + service: file format, token enforcement, body parsing."""

import threading
import urllib.error
import urllib.request
from datetime import datetime

import pytest

from pkms.capture import inbox_count, write_capture
from pkms.capture_service import make_server, resolve_token

# --- write_capture ---

def test_capture_writes_frontmatter_and_body(tmp_path):
    path = write_capture("a fleeting thought", tmp_path, source="cli")
    assert path.parent == tmp_path / "inbox"
    text = path.read_text(encoding="utf-8")
    assert text.startswith("---\ncaptured: ")
    assert "source: cli\n" in text
    assert text.rstrip().endswith("a fleeting thought")


def test_capture_slug_is_sanitized(tmp_path):
    path = write_capture("Buy milk?! (2% or whole)", tmp_path, source="cli")
    assert path.name.endswith("_buy-milk-2-or-whole.md")


def test_capture_unicode_body_survives_even_when_slug_dies(tmp_path):
    path = write_capture("日本語のメモ", tmp_path, source="phone")
    assert path.stem.endswith("_capture")  # slug falls back, body keeps the text
    assert "日本語のメモ" in path.read_text(encoding="utf-8")


def test_capture_same_second_collision_gets_suffix(tmp_path):
    now = datetime(2026, 6, 12, 12, 0, 0)
    first = write_capture("same thought", tmp_path, source="cli", now=now)
    second = write_capture("same thought", tmp_path, source="cli", now=now)
    assert first != second
    assert second.stem.endswith("-2")


def test_capture_rejects_empty(tmp_path):
    with pytest.raises(ValueError):
        write_capture("   \n  ", tmp_path, source="cli")


def test_inbox_count(tmp_path):
    assert inbox_count(tmp_path) == 0
    write_capture("one", tmp_path, source="cli")
    write_capture("two", tmp_path, source="cli")
    assert inbox_count(tmp_path) == 2


# --- token resolution ---

def test_resolve_token_explicit_wins(tmp_path):
    assert resolve_token(tmp_path, "abc") == "abc"
    assert not (tmp_path / ".secrets").exists()


def test_resolve_token_generates_then_reuses(tmp_path):
    first = resolve_token(tmp_path)
    assert len(first) >= 24
    assert (tmp_path / ".secrets" / "capture-token").exists()
    assert resolve_token(tmp_path) == first


# --- capture service over real HTTP ---

@pytest.fixture
def service(tmp_path):
    server = make_server(tmp_path, tmp_path / ".index", "127.0.0.1", 0, "sekrit")
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    yield base, tmp_path
    server.shutdown()


def _post(url, data, headers=None):
    req = urllib.request.Request(url, data=data.encode("utf-8"), headers=headers or {})
    with urllib.request.urlopen(req) as resp:
        return resp.status, resp.read().decode("utf-8")


def test_service_refuses_to_start_without_token(tmp_path):
    with pytest.raises(ValueError):
        make_server(tmp_path, tmp_path / ".index", "127.0.0.1", 0, "")


def test_post_without_token_is_403_and_writes_nothing(service):
    base, vault = service
    with pytest.raises(urllib.error.HTTPError) as exc:
        _post(f"{base}/capture", "stolen thought")
    assert exc.value.code == 403
    assert inbox_count(vault) == 0


def test_post_with_header_token_writes_capture(service):
    base, vault = service
    status, body = _post(f"{base}/capture", "phone thought",
                         {"X-Capture-Token": "sekrit"})
    assert status == 200 and "saved" in body
    assert inbox_count(vault) == 1


def test_post_with_query_token_and_source(service):
    base, vault = service
    _post(f"{base}/capture?token=sekrit&source=phone", "from the couch")
    note = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "source: phone" in note


def test_post_json_body(service):
    base, vault = service
    _post(f"{base}/capture?token=sekrit", '{"text": "json thought"}',
          {"Content-Type": "application/json"})
    note = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "json thought" in note


def test_post_form_body(service):
    base, vault = service
    _post(f"{base}/capture?token=sekrit", "text=form+thought",
          {"Content-Type": "application/x-www-form-urlencoded"})
    note = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "form thought" in note


def test_post_empty_is_400(service):
    base, vault = service
    with pytest.raises(urllib.error.HTTPError) as exc:
        _post(f"{base}/capture?token=sekrit", "   ")
    assert exc.value.code == 400
    assert inbox_count(vault) == 0


def test_health_needs_no_token_capture_page_does(service):
    base, _ = service
    with urllib.request.urlopen(f"{base}/health") as resp:
        assert resp.status == 200
    with pytest.raises(urllib.error.HTTPError) as exc:
        urllib.request.urlopen(f"{base}/")
    assert exc.value.code == 403
    with urllib.request.urlopen(f"{base}/?token=sekrit") as resp:
        assert b"textarea" in resp.read()
