"""Tests for the Google Takeout -> PKMS vault importer.

Synthetic Takeout ZIPs are built in tmp_path using zipfile; the parser is
exercised the same way real production data would exercise it.
"""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from pkms.keep_takeout import (
    import_takeout,
    render_takeout_report,
)


def _note_member(name: str, payload: dict) -> bytes:
    return json.dumps(payload, indent=2).encode("utf-8")


def _build_takeout_zip(
    path: Path,
    notes: list[tuple[str, dict]],
    attachments: list[tuple[str, bytes]] | None = None,
) -> None:
    """Build a synthetic Takeout ZIP: Takeout/Keep/*.json + Takeout/attachments/."""
    attachments = attachments or []
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        for stem, payload in notes:
            zf.writestr(f"Takeout/Keep/{stem}.json", _note_member(stem, payload))
        for filename, data in attachments:
            zf.writestr(f"Takeout/{filename}", data)


def _write_legacy_takeout(
    path: Path, notes: list[tuple[str, dict]], attachments: list[tuple[str, bytes]] | None = None
) -> None:
    """Older Takeout format: notes at root, attachments in /attachments/."""
    attachments = attachments or []
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        for stem, payload in notes:
            zf.writestr(f"{stem}.json", _note_member(stem, payload))
        for filename, data in attachments:
            zf.writestr(f"attachments/{filename}", data)


def _read_capture(path: Path) -> tuple[dict, str]:
    """Parse a write_capture file: (frontmatter_dict, body)."""
    raw = path.read_text(encoding="utf-8")
    assert raw.startswith("---\n")
    end = raw.find("\n---\n", 4)
    fm_block = raw[4:end]
    body = raw[end + 5 :]
    body = body.lstrip("\n")
    fm = {}
    for line in fm_block.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip()
    return fm, body


def test_import_takeout_writes_one_capture_per_note(tmp_path: Path):
    vault = tmp_path / "vault"
    index = tmp_path / ".index"
    zpath = tmp_path / "takeout.zip"
    _build_takeout_zip(
        zpath,
        notes=[
            ("a", {"title": "Buy milk", "textContent": "and eggs", "timestamps": {"createTime": 1_700_000_000_000_000}}),
            ("b", {"title": "Read PKMS docs", "textContent": "", "timestamps": {"createTime": 1_700_000_001_000_000}}),
        ],
    )

    media = tmp_path / "media"
    report = import_takeout(zpath, vault, index, media_dir=media)

    assert report["notes"] == 2
    assert report["attachments_mirrored"] == 0
    assert report["errors"] == []
    captures = sorted((vault / "inbox").glob("*.md"))
    assert len(captures) == 2


def test_import_takeout_frontmatter_records_keep_metadata(tmp_path: Path):
    vault = tmp_path / "vault"
    index = tmp_path / ".index"
    zpath = tmp_path / "takeout.zip"
    iso = "2024-01-15T10:30:00+00:00"
    _build_takeout_zip(
        zpath,
        notes=[
            (
                "shopping",
                {
                    "title": "Groceries",
                    "textContent": "milk, eggs, bread",
                    "timestamps": {"createTime": iso, "updateTime": iso},
                    "isPinned": True,
                    "color": "RED",
                    "labels": [{"name": "shopping"}],
                },
            )
        ],
    )

    import_takeout(zpath, vault, index, media_dir=tmp_path / "media")
    capture = next((vault / "inbox").glob("*.md"))
    fm, body = _read_capture(capture)
    assert fm["source"] == "keep-takeout"
    assert fm["keep_id"].startswith("takeout:")
    assert fm["pinned"] == "true"
    assert fm["color"] == "RED"
    assert fm["labels"] == "shopping"
    # ISO timestamps round-trip through fromisoformat
    assert datetime.fromisoformat(fm["keep_created_at"]) == datetime.fromisoformat(iso)
    # Title lands above text
    assert body.splitlines()[0] == "Groceries"
    assert "milk, eggs, bread" in body


def test_import_takeout_mirrors_attachments_with_file_link(tmp_path: Path):
    vault = tmp_path / "vault"
    index = tmp_path / ".index"
    zpath = tmp_path / "takeout.zip"
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"fake-png-data" * 10
    _build_takeout_zip(
        zpath,
        notes=[
            (
                "img-note",
                {
                    "title": "pic",
                    "textContent": "see attached",
                    "annotations": [{"mimeType": "image/png", "filename": "shot.png"}],
                },
            )
        ],
        attachments=[("attachments/shot.png", png_bytes)],
    )

    media = tmp_path / "media"
    report = import_takeout(zpath, vault, index, media_dir=media)

    assert report["attachments_mirrored"] == 1
    files = list(media.glob("*.png"))
    assert len(files) == 1
    # file:// link in capture
    capture = next((vault / "inbox").glob("*.md"))
    _, body = _read_capture(capture)
    assert "![keep attachment](file:///" in body
    assert "shot.png" not in body  # only the sha256 name is in the link
    assert files[0].stem in body  # sha256 stem is in the link


def test_import_takeout_renders_checklist_as_task_list(tmp_path: Path):
    vault = tmp_path / "vault"
    index = tmp_path / ".index"
    zpath = tmp_path / "takeout.zip"
    _build_takeout_zip(
        zpath,
        notes=[
            (
                "todo",
                {
                    "title": "Today",
                    "textContent": "",
                    "listContent": [
                        {"text": "first", "checked": False},
                        {"text": "second", "checked": True},
                    ],
                },
            )
        ],
    )
    import_takeout(zpath, vault, index, media_dir=tmp_path / "media")
    capture = next((vault / "inbox").glob("*.md"))
    _, body = _read_capture(capture)
    assert "- [ ] first" in body
    assert "- [x] second" in body


def test_import_takeout_is_idempotent(tmp_path: Path):
    vault = tmp_path / "vault"
    index = tmp_path / ".index"
    zpath = tmp_path / "takeout.zip"
    _build_takeout_zip(
        zpath,
        notes=[
            ("dup", {"title": "same", "textContent": "body"}),
        ],
    )
    r1 = import_takeout(zpath, vault, index, media_dir=tmp_path / "media")
    r2 = import_takeout(zpath, vault, index, media_dir=tmp_path / "media")
    assert r1["notes"] == 1
    assert r2["notes"] == 0
    assert r2["skipped_already_imported"] == 1
    assert len(list((vault / "inbox").glob("*.md"))) == 1


def test_import_takeout_skips_trashed_notes(tmp_path: Path):
    vault = tmp_path / "vault"
    index = tmp_path / ".index"
    zpath = tmp_path / "takeout.zip"
    _build_takeout_zip(
        zpath,
        notes=[
            ("live", {"title": "live", "textContent": "kept"}),
            ("dead", {"title": "dead", "textContent": "trashed", "isTrashed": True}),
        ],
    )
    report = import_takeout(zpath, vault, index, media_dir=tmp_path / "media")
    assert report["notes"] == 1
    assert report["skipped_trashed"] == 1


def test_import_takeout_handles_legacy_format(tmp_path: Path):
    vault = tmp_path / "vault"
    index = tmp_path / ".index"
    zpath = tmp_path / "takeout.zip"
    _write_legacy_takeout(
        zpath,
        notes=[("legacy", {"title": "old", "textContent": "shape"})],
    )
    report = import_takeout(zpath, vault, index, media_dir=tmp_path / "media")
    assert report["notes"] == 1
    assert report["errors"] == []


def test_import_takeout_missing_attachment_is_skipped_not_fatal(tmp_path: Path):
    vault = tmp_path / "vault"
    index = tmp_path / ".index"
    zpath = tmp_path / "takeout.zip"
    _build_takeout_zip(
        zpath,
        notes=[
            (
                "ref",
                {
                    "title": "broken ref",
                    "textContent": "where is it",
                    "annotations": [{"mimeType": "image/png", "filename": "missing.png"}],
                },
            )
        ],
        # attachments dir exists but is empty
    )
    report = import_takeout(zpath, vault, index, media_dir=tmp_path / "media")
    assert report["notes"] == 1  # note still captured
    assert report["attachments_skipped"] == 1


def test_render_takeout_report_quiet_when_nothing_imported(tmp_path: Path):
    r = {"notes": 0, "skipped_already_imported": 0, "skipped_trashed": 0, "skipped_empty": 0, "attachments_mirrored": 0, "attachments_skipped": 0, "errors": []}
    assert render_takeout_report(r) == "takeout: nothing new"


def test_import_takeout_empty_zip_errors_cleanly(tmp_path: Path):
    vault = tmp_path / "vault"
    index = tmp_path / ".index"
    zpath = tmp_path / "empty.zip"
    with zipfile.ZipFile(zpath, "w") as zf:
        zf.writestr("readme.txt", b"no notes here")
    report = import_takeout(zpath, vault, index, media_dir=tmp_path / "media")
    assert report["notes"] == 0
    assert report["errors"] == []
    assert list((vault / "inbox").glob("*.md")) == []
