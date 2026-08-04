"""Keep ingest: baseline-prime, ledger dedupe, OCR-at-ingest, honest reports."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

import pkms.keep_ingest as ki
from pkms.keep_ingest import (
    append_ledger,
    ingest_keep,
    load_ledger,
    record_completed,
    render_report,
)


class FakeKeep:
    def __init__(self, notes):
        self._notes = notes

    def all(self):
        return self._notes

    def getMediaLink(self, blob):
        return f"https://keep.example/{blob.id}"

    def sync(self):
        pass


def note(
    nid,
    text="some text",
    title="",
    trashed=False,
    images=(),
    archived=False,
    timestamps=None,
):
    ns = SimpleNamespace(
        id=nid,
        text=text,
        title=title,
        trashed=trashed,
        images=list(images),
        archived=archived,
        timestamps=timestamps,
    )
    return ns


def _aware_dt(year=2025, month=1, day=1, hour=12, minute=0, second=0):
    return datetime(year, month, day, hour, minute, second, tzinfo=UTC)


def _timestamps(created=None, updated=None, edited=None):
    return SimpleNamespace(created=created, updated=updated, edited=edited)


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


def test_existing_empty_ledger_is_initialized_not_first_contact(project):
    """An empty ledger FILE means 'initialized, nothing seen yet' — not first
    contact. Treating zero bytes as first contact re-primes forever and
    swallows the first real note."""
    vault, index_dir, root = project
    index_dir.mkdir(parents=True, exist_ok=True)
    (index_dir / "keep-ledger.txt").write_text("", encoding="utf-8")
    keep = FakeKeep([note("a1"), note("a2")])
    report = ingest_keep(vault, index_dir, root, keep=keep)
    assert report["new"] == 2  # ingested, NOT primed
    assert "baseline" not in report
    assert load_ledger(index_dir) == {"a1", "a2"}


def test_zero_note_first_contact_then_first_real_note_is_captured(project):
    """First contact against an empty Keep account must still initialize the
    ledger, so the next run captures the first real note instead of priming it."""
    vault, index_dir, root = project
    assert ingest_keep(vault, index_dir, root, keep=FakeKeep([])) == {"baseline": 0}
    assert (index_dir / "keep-ledger.txt").exists()  # initialized despite zero notes

    report = ingest_keep(vault, index_dir, root,
                         keep=FakeKeep([note("b1", text="first real thought")]))
    assert report["new"] == 1
    assert "baseline" not in report
    body = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "first real thought" in body


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


def test_seen_ids_from_ledger_union_completed(project):
    """A note in the completed DB but not the flat ledger is not re-ingested as new."""
    vault, index_dir, root = project
    append_ledger(index_dir, ["a1"])
    # Note b2 is in the completed DB but not the ledger — should not be re-ingested.
    record_completed(index_dir, "b2", keep_created_at=_aware_dt().isoformat())
    keep = FakeKeep([note("a1"), note("b2", text="already captured")])
    report = ingest_keep(vault, index_dir, root, keep=keep)
    assert report["new"] == 0
    assert not (vault / "inbox").exists()


def test_title_lands_above_text_and_trashed_skipped(project):
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])  # past baseline
    keep = FakeKeep([note("t1", text="body", title="Heading"),
                     note("t2", trashed=True)])
    report = ingest_keep(vault, index_dir, root, keep=keep)
    assert report["new"] == 1
    body = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "Heading\n\nbody" in body


def test_archived_notes_excluded_from_ingest(project):
    """Archived notes must not be ingested even if not trashed."""
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])
    keep = FakeKeep([
        note("live", text="active note"),
        note("archived", text="archived note", archived=True),
    ])
    report = ingest_keep(vault, index_dir, root, keep=keep)
    assert report["new"] == 1
    assert "live" in load_ledger(index_dir)
    assert "archived" not in load_ledger(index_dir)
    files = list((vault / "inbox").glob("*.md"))
    assert len(files) == 1
    assert "active note" in files[0].read_text(encoding="utf-8")


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


def test_failed_media_does_not_write_capture_or_completion_or_ledger(project, monkeypatch):
    """If any attachment download fails, the entire note is skipped — no capture,
    no completion row, no ledger entry — so it remains retryable."""
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])

    def boom(url):
        raise OSError("network")

    monkeypatch.setattr(ki, "_download_bytes", boom)
    media = root / "media"
    keep = FakeKeep([note("i4", text="txt", images=[SimpleNamespace(id="b")])])
    report = ingest_keep(vault, index_dir, root, keep=keep, media_dir=media)
    assert report["media_failed"] == 1
    assert report["new"] == 0
    # No capture file written.
    inbox = vault / "inbox"
    assert not inbox.exists() or not any(inbox.glob("*.md"))
    # No completion row in the DB.
    assert "i4" not in ki.completed_keep_ids(index_dir)
    # No ledger entry.
    assert "i4" not in load_ledger(index_dir)


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


def test_aware_datetime_timestamp_emits_utc_iso(project, monkeypatch):
    """gkeepapi 0.17.1 timestamps.created is a timezone-aware datetime."""
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])
    aware_created = _aware_dt(2025, 6, 15, 10, 30, 0)
    ts = _timestamps(created=aware_created)
    keep = FakeKeep([note("dt1", text="aware ts note", timestamps=ts)])
    report = ingest_keep(vault, index_dir, root, keep=keep)
    assert report["new"] == 1
    body = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "keep_created_at" in body
    # The stored value should be UTC-aware ISO, not a numeric epoch.
    assert "2025-06-15T10:30:00+00:00" in body


def test_naive_iso_legacy_timestamp_parsed_as_utc(project, monkeypatch):
    """Legacy naive ISO strings in timestamps.created are treated as UTC."""
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])
    # Simulate a legacy numeric test double (epoch microseconds).
    # 2025-06-15T10:30:00 UTC = 1749983400000000 microseconds
    epoch_us = 1749983400000000
    ts = _timestamps(created=epoch_us)
    keep = FakeKeep([note("legacy1", text="legacy ts note", timestamps=ts)])
    report = ingest_keep(vault, index_dir, root, keep=keep)
    assert report["new"] == 1
    body = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "keep_created_at" in body
    # Should emit UTC-aware ISO, not a raw epoch number.
    assert "2025-06-15T10:30:00+00:00" in body


def test_naive_iso_string_timestamp_parsed_as_utc(project):
    """A naive ISO string (no timezone) in timestamps.created is treated as UTC."""
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])
    naive_iso = "2025-06-15T10:30:00"  # no timezone info
    ts = _timestamps(created=naive_iso)
    keep = FakeKeep([note("legacy2", text="naive iso note", timestamps=ts)])
    report = ingest_keep(vault, index_dir, root, keep=keep)
    assert report["new"] == 1
    body = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "keep_created_at" in body
    assert "2025-06-15T10:30:00+00:00" in body


def test_edited_recapture_refreshes_completion(project, monkeypatch):
    """A previously completed note whose live updated timestamp is newer than
    completed_at should be recaptured and record_completed should refresh metadata."""
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])

    now = datetime.now(UTC)
    # First capture: note "r1" with an updated timestamp before now.
    old_updated = now - timedelta(hours=1)
    ts1 = _timestamps(created=now - timedelta(days=2), updated=old_updated)
    keep1 = FakeKeep([note("r1", text="original text", timestamps=ts1)])
    ingest_keep(vault, index_dir, root, keep=keep1)

    # Verify first capture is recorded.
    assert "r1" in ki.completed_keep_ids(index_dir)
    body1 = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "original text" in body1

    # Second run: note "r1" has a newer updated timestamp (after completed_at).
    new_updated = now + timedelta(hours=1)
    ts2 = _timestamps(created=now - timedelta(days=2), updated=new_updated)
    keep2 = FakeKeep([note("r1", text="updated text", timestamps=ts2)])
    report = ingest_keep(vault, index_dir, root, keep=keep2)

    # Should be recaptured as new (report counts it as a new capture).
    assert report["new"] == 1

    # The completion record should be refreshed (INSERT OR REPLACE).
    assert "r1" in ki.completed_keep_ids(index_dir)

    # The new capture should contain the updated text (most recent file).
    body2 = sorted((vault / "inbox").glob("*.md"))[-1].read_text(encoding="utf-8")
    assert "updated text" in body2


def test_no_recapture_when_note_unchanged(project, monkeypatch):
    """A previously completed note whose updated timestamp is NOT newer than
    completed_at should NOT be recaptured."""
    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])

    now = datetime.now(UTC)
    updated = now - timedelta(hours=1)  # before completed_at
    ts = _timestamps(created=now - timedelta(days=2), updated=updated)
    keep1 = FakeKeep([note("r2", text="text", timestamps=ts)])
    ingest_keep(vault, index_dir, root, keep=keep1)

    # Second run with same timestamps — no recapture.
    keep2 = FakeKeep([note("r2", text="text", timestamps=ts)])
    report = ingest_keep(vault, index_dir, root, keep=keep2)
    assert report["new"] == 0

@pytest.mark.parametrize("bogus", [10**30, float("inf"), -(10**30)])
def test_absurd_timestamp_is_invalid_not_fatal(project, bogus):
    """An out-of-range numeric timestamp must degrade to 'no age data', never
    raise. datetime.fromtimestamp() raises OverflowError (not ValueError) for
    these, so one corrupt note would otherwise abort the whole ingest run."""
    assert ki._to_aware_dt(bogus) is None

    vault, index_dir, root = project
    append_ledger(index_dir, ["seed"])  # past baseline
    keep = FakeKeep([note("bad", text="note with a corrupt timestamp",
                          timestamps=_timestamps(created=bogus, updated=bogus))])
    report = ingest_keep(vault, index_dir, root, keep=keep)
    assert report["new"] == 1  # captured anyway; only the age data is lost
    body = next((vault / "inbox").glob("*.md")).read_text(encoding="utf-8")
    assert "corrupt timestamp" in body
