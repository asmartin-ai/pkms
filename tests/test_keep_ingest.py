"""Keep ingest: baseline-prime, ledger dedupe, OCR-at-ingest, honest reports."""

from types import SimpleNamespace
from pathlib import Path

import pytest

import pkms.keep_ingest as ki
from pkms.keep_ingest import append_ledger, ingest_keep, load_ledger, render_report


class FakeKeep:
    def __init__(self, notes):
        self._notes = notes

    def all(self):
        return self._notes

    def getMediaLink(self, blob):
        return f"https://keep.example/{blob.id}"


def note(nid, text="some text", title="", trashed=False, images=()):
    return SimpleNamespace(id=nid, text=text, title=title, trashed=trashed,
                           images=list(images))


@pytest.fixture
def project(tmp_path):
    vault = tmp_path / "vault"
    vault.mkdir()
    return vault, tmp_path / ".index", tmp_path


def test_first_run_primes_baseline_without_ingesting(project):
    vault, index_dir, root = project
    keep = FakeKeep([note("a1"), note("a2")])
    report = ingest_keep(vault, index_dir, root, keep=keep)
    assert report == {"baseline": 2}
    assert load_ledger(index_dir) == {"a1", "a2"}
    assert not (vault / "inbox").exists()  # nothing dumped on first contact
    assert "existing notes stay in Keep" in render_report(report)


def test_second_run_ingests_only_new_notes(project):
    vault, index_dir, root = project
    ingest_keep(vault, index_dir, root, keep=FakeKeep([note("a1")]))
    report = ingest_keep(vault, index_dir, root,
                         keep=FakeKeep([note("a1"), note("b2", text="fresh thought")]))
    assert report["new"] == 1
    files = list((vault / "inbox").glob("*.md"))
    assert len(files) == 1
    text = files[0].read_text(encoding="utf-8")
    assert "source: keep" in text and "keep_id: b2" in text
    assert "fresh thought" in text
    assert "b2" in load_ledger(index_dir)  # third run would skip it
    assert ingest_keep(vault, index_dir, root,
                       keep=FakeKeep([note("a1"), note("b2")]))["new"] == 0


def test_title_lands_above_text_and_trashed_skipped(project):
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])  # past baseline
    keep = FakeKeep([note("t1", text="body", title="Heading"),
                     note("t2", trashed=True)])
    report = ingest_keep(vault, index_dir, root, keep=keep)
    assert report["new"] == 1
    body = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "Heading\n\nbody" in body


def test_image_downloaded_and_ocr_text_inlined(project, monkeypatch):
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])
    # New seam: _download_bytes returns bytes; code hashes + writes to sha-named file.
    monkeypatch.setattr(ki, "_download_bytes", lambda url: b"\xff\xd8fake-jpg-bytes")
    monkeypatch.setattr(ki, "extract_text", lambda p: "words inside the image")
    media = root / "media"
    keep = FakeKeep([note("i1", text="see pic", images=[SimpleNamespace(id="blob1")])])
    report = ingest_keep(vault, index_dir, root, keep=keep, media_dir=media)
    assert report["images"] == 1 and report["ocr_missing"] == 0
    # file::// link to off-vault mirror
    body = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "words inside the image" in body
    assert "![keep attachment](file:///" in body


def test_missing_ocr_engine_is_disclosed_not_fatal(project, monkeypatch):
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])
    monkeypatch.setattr(ki, "_download_bytes", lambda url: b"\xff\xd8fake-jpg-bytes")
    monkeypatch.setattr(ki, "extract_text", lambda p: None)  # no engine
    media = root / "media"
    keep = FakeKeep([note("i2", images=[SimpleNamespace(id="b")])])
    report = ingest_keep(vault, index_dir, root, keep=keep, media_dir=media)
    assert report["new"] == 1 and report["ocr_missing"] == 1
    assert "saved unread" in render_report(report)


def test_failed_download_keeps_image_in_keep_and_says_so(project, monkeypatch):
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])

    def boom(url):
        raise OSError("network")

    monkeypatch.setattr(ki, "_download_bytes", boom)
    media = root / "media"
    keep = FakeKeep([note("i3", text="txt", images=[SimpleNamespace(id="b")])])
    report = ingest_keep(vault, index_dir, root, keep=keep, media_dir=media)
    assert report["media_failed"] == 1
    assert "they stay in Keep" in render_report(report)


def test_no_token_reports_setup_needed(project):
    vault, index_dir, root = project
    # no .secrets files; keep=None triggers the early return
    report = ingest_keep(vault, index_dir, root, keep=None)
    assert report["setup_needed"] is True
    assert "keep-setup.md" in render_report(report)


def test_nothing_new_copy_is_quiet(project):
    vault, index_dir, root = project
    append_ledger(index_dir, ["a1"])  # past baseline
    report = ingest_keep(vault, index_dir, root, keep=FakeKeep([note("a1")]))
    assert report["new"] == 0
    assert render_report(report) == "keep: nothing new"
