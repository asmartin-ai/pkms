"""Slice 9 oracle — content-hoarder promotion ingest (S3 spec).

Contract: a JSON POST to /capture carrying a `ch_item_id` accepts the
additive promotion envelope, flattens it to capture frontmatter, and dedupes
against `.index/ch-promote-ledger.txt` (per-note pattern from keep_ingest /
discord_capture). A plain capture without `ch_item_id` is byte-for-byte the
old behavior — no new frontmatter keys, no ledger interaction. Response
bodies are deterministic (CH-side receipt evidence).
"""

import json
import threading
import urllib.request
from urllib.error import HTTPError

import pytest

from pkms.capture_service import load_ch_ledger, make_server

TOKEN = "test-token"


@pytest.fixture
def base_url(vault, index_dir):
    server = make_server(vault, index_dir, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()


def _post_json(url: str, payload: dict[str, object], token: str = TOKEN):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Capture-Token": token},
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, resp.read().decode("utf-8")


ENVELOPE = {
    "text": (
        "Reliance on LLMs is killing people's mental models\n\n"
        "A senior-dev discussion about mental-model erosion after heavy LLM use.\n\n"
        "https://www.reddit.com/r/ExperiencedDevs/comments/fixture001/"
    ),
    "source_account_id": "acct_fixture_reddit_personal",
    "raw_ref": "https://www.reddit.com/r/ExperiencedDevs/comments/fixture001/",
    "context": {"device": "desktop", "app": "content-hoarder"},
    "ch_item_id": "ext_ch_item_001",
    "ch_origin_ref": "content-hoarder:fullname:reddit:t3_fixture001",
    "ch_captured_at": "2026-07-12T05:51:25Z",
}


def test_envelope_fields_land_in_frontmatter(vault, index_dir, base_url):
    status, body = _post_json(f"{base_url}/capture?source=content-hoarder", ENVELOPE)
    assert status == 200 and body.startswith("saved ✓")
    files = list((vault / "inbox").glob("*.md"))
    assert len(files) == 1
    note = files[0].read_text(encoding="utf-8")
    assert "source: content-hoarder" in note
    assert "source_account_id: acct_fixture_reddit_personal" in note
    assert "raw_ref: https://www.reddit.com/r/ExperiencedDevs/comments/fixture001/" in note
    assert "context_device: desktop" in note
    assert "context_app: content-hoarder" in note
    assert "ch_item_id: ext_ch_item_001" in note
    assert "ch_origin_ref: content-hoarder:fullname:reddit:t3_fixture001" in note
    assert "ch_captured_at: 2026-07-12T05:51:25Z" in note
    # body composition: title + summary + url
    assert "Reliance on LLMs" in note
    assert load_ch_ledger(index_dir) == {"ext_ch_item_001"}


def test_replay_same_ch_item_adds_no_second_file(vault, index_dir, base_url):
    status1, body1 = _post_json(f"{base_url}/capture", ENVELOPE)
    status2, body2 = _post_json(f"{base_url}/capture", ENVELOPE)
    assert status1 == 200 and body1.startswith("saved ✓")
    assert status2 == 200 and body2.startswith("already saved ✓")
    files = list((vault / "inbox").glob("*.md"))
    assert len(files) == 1
    # body names the existing file — deterministic receipt evidence
    assert body2 == f"already saved ✓ {files[0].name}"
    # no double-append
    assert load_ch_ledger(index_dir) == {"ext_ch_item_001"}


def test_replay_after_manual_file_removal_still_dedupes(vault, index_dir, base_url):
    _post_json(f"{base_url}/capture", ENVELOPE)
    next((vault / "inbox").glob("*.md")).unlink()
    status, body = _post_json(f"{base_url}/capture", ENVELOPE)
    assert status == 200 and body.startswith("already saved ✓")
    assert list((vault / "inbox").glob("*.md")) == []  # still no new file


def test_replay_after_fold_moves_note_still_names_it(vault, index_dir, base_url):
    """/fold moves the promoted capture out of inbox; replay must still name it."""
    _post_json(f"{base_url}/capture", ENVELOPE)
    note = next((vault / "inbox").glob("*.md"))
    folded = vault / "projects"
    folded.mkdir(exist_ok=True)
    moved = folded / note.name
    note.rename(moved)
    status, body = _post_json(f"{base_url}/capture", ENVELOPE)
    assert status == 200
    assert body == f"already saved ✓ {moved.name}"
    assert list((vault / "inbox").glob("*.md")) == []  # still no second file


def test_plain_json_capture_without_ch_item_is_unchanged(vault, index_dir, base_url):
    status, _ = _post_json(f"{base_url}/capture", {"text": "plain thought"})
    assert status == 200
    note = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    for key in (
        "ch_item_id:",
        "ch_origin_ref:",
        "ch_captured_at:",
        "source_account_id:",
        "raw_ref:",
        "context_device:",
        "context_app:",
    ):
        assert key not in note
    assert load_ch_ledger(index_dir) == set()


def test_envelope_fields_ignored_without_ch_item_id(vault, index_dir, base_url):
    payload = {
        "text": "thought",
        "source_account_id": "acct_x",
        "raw_ref": "https://x.example",
        "context": {"device": "desktop", "app": "some-app"},
    }
    status, _ = _post_json(f"{base_url}/capture", payload)
    assert status == 200
    note = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "source_account_id:" not in note
    assert "raw_ref:" not in note
    assert "context_device:" not in note
    assert load_ch_ledger(index_dir) == set()


def test_empty_text_still_rejected_even_with_envelope(vault, index_dir, base_url):
    payload = dict(ENVELOPE, text="   \n ")
    with pytest.raises(HTTPError) as exc:
        _post_json(f"{base_url}/capture", payload)
    assert exc.value.code == 400
    assert list((vault / "inbox").glob("*.md")) == []
    assert load_ch_ledger(index_dir) == set()


def test_ledger_append_only_and_unknown_fields_ignored(vault, index_dir, base_url):
    payload = dict(ENVELOPE, ch_item_id="ext_ch_item_002", mystery="ignored")
    _post_json(f"{base_url}/capture", payload)
    assert load_ch_ledger(index_dir) == {"ext_ch_item_002"}
    lines = (index_dir / "ch-promote-ledger.txt").read_text(encoding="utf-8").splitlines()
    assert lines == ["ext_ch_item_002"]  # one id per line, append-only
    note = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "mystery:" not in note
