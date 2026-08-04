"""Tests for the destructive sweep of old+unpinned Keep notes.

The load-bearing safety property tested here: a note that exists in Keep
but was never imported into the vault must NEVER be deleted, even with
--apply. This is the "delete only after import" gate from the user's brief.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from pkms.keep_ingest import (
    record_completed,
    render_sweep_report,
    sweep_old_unpinned,
)


class FakeKeep:
    def __init__(self, notes: list[Any]):
        self._notes = notes
        self.trashed_ids: list[str] = []
        self._sync_fail = False
        self.sync_calls = 0
        self._fail_first = 0

    def all(self):
        return list(self._notes)

    def sync(self):
        self.sync_calls += 1
        if self._sync_fail or self._fail_first >= self.sync_calls:
            raise RuntimeError("sync failed")

    def set_sync_fail(self, fail: bool = True):
        self._sync_fail = fail

    def fail_first_syncs(self, n: int):
        """Fail the first `n` sync() calls, then succeed."""
        self._fail_first = n


def _note(
    note_id: str,
    *,
    pinned: bool = False,
    trashed: bool = False,
    archived: bool = False,
) -> Any:
    return SimpleNamespace(id=note_id, pinned=pinned, trashed=trashed, archived=archived)


def _trashable_note(
    note_id: str,
    *,
    pinned: bool = False,
    trashed: bool = False,
    archived: bool = False,
) -> Any:
    """Note that supports a `trash()` method (the gkeepapi contract)."""

    class T(SimpleNamespace):
        def trash(self_inner):
            self_inner.trashed = True
            return None

    return T(id=note_id, pinned=pinned, trashed=trashed, archived=archived)


def _iso_days_ago(days: int) -> str:
    return (datetime.now(UTC) - timedelta(days=days)).isoformat()


@pytest.fixture
def index_dir(tmp_path: Path) -> Path:
    return tmp_path / ".index"


# --- core sweep behavior ---


def test_sweep_dry_run_is_default_and_does_not_call_trash(index_dir: Path):
    keep = FakeKeep([_note("a"), _note("b")])
    record_completed(index_dir, "a", keep_created_at=_iso_days_ago(60))
    record_completed(index_dir, "b", keep_created_at=_iso_days_ago(60))

    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=True)
    assert report["dry_run"] is True
    assert report["eligible"] == 2
    assert report["deleted"] == 0
    assert keep.trashed_ids == []


def test_sweep_apply_actually_deletes_eligible(index_dir: Path):
    n_old = _trashable_note("old", pinned=False, trashed=False, archived=False)
    n_recent = _trashable_note("recent", pinned=False, trashed=False, archived=False)
    keep = FakeKeep([n_old, n_recent])
    record_completed(index_dir, "old", keep_created_at=_iso_days_ago(60))
    record_completed(index_dir, "recent", keep_created_at=_iso_days_ago(5))

    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=False)
    assert report["deleted"] == 1
    assert report["eligible"] == 1
    assert report["skipped_recent"] == 1
    assert n_old.trashed is True
    assert n_recent.trashed is False


def test_age_threshold_respected(index_dir: Path):
    keep = FakeKeep([_note("a"), _note("b"), _note("c")])
    record_completed(index_dir, "a", keep_created_at=_iso_days_ago(10))
    record_completed(index_dir, "b", keep_created_at=_iso_days_ago(29))
    record_completed(index_dir, "c", keep_created_at=_iso_days_ago(31))
    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=True)
    assert report["eligible"] == 1  # only c
    assert report["eligible_ids"] == ["c"]
    assert report["skipped_recent"] == 2


# --- skip rules ---


def test_sweep_skips_pinned_notes(index_dir: Path):
    keep = FakeKeep([_note("pinned", pinned=True)])
    record_completed(index_dir, "pinned", keep_created_at=_iso_days_ago(60))
    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=True)
    assert report["eligible"] == 0
    assert report["skipped_pinned"] == 1


def test_sweep_skips_uncaptured_notes(index_dir: Path):
    keep = FakeKeep([_note("not_imported")])
    # No record_completed call - note not in vault
    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=True)
    assert report["eligible"] == 0
    assert report["skipped_uncaptured"] == 1


def test_sweep_grandfathers_notes_without_age_data(index_dir: Path):
    keep = FakeKeep([_note("no_age")])
    # record_completed with no keep_created_at - the v3->v4 grandfather case
    record_completed(index_dir, "no_age")
    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=True)
    assert report["eligible"] == 0
    assert report["skipped_grandfathered"] == 1


def test_sweep_skips_trashed_and_archived(index_dir: Path):
    keep = FakeKeep(
        [
            _note("trashed", trashed=True),
            _note("archived", archived=True),
        ]
    )
    record_completed(index_dir, "trashed", keep_created_at=_iso_days_ago(60))
    record_completed(index_dir, "archived", keep_created_at=_iso_days_ago(60))
    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=True)
    assert report["skipped_trashed"] == 1
    assert report["skipped_archived"] == 1
    assert report["eligible"] == 0


# --- "delete ONLY after import" safety gate (the load-bearing one) ---


def test_apply_never_deletes_uncaptured_note(index_dir: Path):
    """The user's brief: 'I only want to delete old+unpinned items AFTER
    I have imported them.' This is the load-bearing safety property:
    an old, unpinned, non-trashed, non-archived Keep note that was NEVER
    imported must never be deleted, even on --apply."""
    n = _trashable_note("never_imported", pinned=False, trashed=False, archived=False)
    keep = FakeKeep([n])
    # No record_completed - this note exists in Keep but never made it to vault.
    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=False)
    assert report["deleted"] == 0
    assert report["eligible"] == 0
    assert report["skipped_uncaptured"] == 1
    assert n.trashed is False, "uncaptured note must never be trashed"


def test_apply_never_deletes_recent_uncaptured_note(index_dir: Path):
    """Combined safety: uncaptured + recent = double-skip. Even a fresh
    note that has not been imported must be untouched."""
    n = _trashable_note("fresh_uncaptured", pinned=False, trashed=False, archived=False)
    keep = FakeKeep([n])
    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=False)
    assert n.trashed is False
    assert report["skipped_uncaptured"] == 1


# --- state + report ---


def test_sweep_records_deletions_in_state_file(index_dir: Path):
    n = _trashable_note("a", pinned=False, trashed=False, archived=False)
    keep = FakeKeep([n])
    record_completed(index_dir, "a", keep_created_at=_iso_days_ago(60))
    sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=False)
    state = json.loads((index_dir / "keep-sweep.json").read_text(encoding="utf-8"))
    assert "a" in state["swept"]
    assert state["swept"]["a"]["age_days_at_delete"] >= 60


def test_sweep_dry_run_does_not_write_state_file(index_dir: Path):
    keep = FakeKeep([_note("a")])
    record_completed(index_dir, "a", keep_created_at=_iso_days_ago(60))
    sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=True)
    assert not (index_dir / "keep-sweep.json").exists()


def test_render_sweep_report_says_dry_run_explicitly(index_dir: Path):
    keep = FakeKeep([_note("a")])
    record_completed(index_dir, "a", keep_created_at=_iso_days_ago(60))
    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=True)
    line = render_sweep_report(report)
    assert "DRY RUN" in line
    assert "eligible 1" in line


# --- sync contract ---


def test_sync_success_records_swept_and_deleted(index_dir: Path):
    """After trash() + sync(), the swept state and deleted count are recorded."""
    n = _trashable_note("a", pinned=False, trashed=False, archived=False)
    keep = FakeKeep([n])
    record_completed(index_dir, "a", keep_created_at=_iso_days_ago(60))

    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=False)

    assert report["deleted"] == 1
    assert report["eligible"] == 1
    assert n.trashed is True
    # Swept state file must exist and contain the note.
    state = json.loads((index_dir / "keep-sweep.json").read_text(encoding="utf-8"))
    assert "a" in state["swept"]


def test_sync_failure_records_error_and_no_swept_or_deleted(index_dir: Path):
    """If keep.sync() fails after trash(), no swept/deleted state is recorded
    and the error is captured — the note remains retryable."""
    n = _trashable_note("a", pinned=False, trashed=False, archived=False)
    keep = FakeKeep([n])
    keep.set_sync_fail(True)
    record_completed(index_dir, "a", keep_created_at=_iso_days_ago(60))

    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=False)

    assert report["deleted"] == 0
    assert report["eligible"] == 1
    assert len(report["errors"]) == 1
    assert "sync failed" in report["errors"][0]
    # Note was trashed locally but not recorded in swept state.
    assert n.trashed is True
    # Swept state file must exist but must NOT contain the note.
    state = json.loads((index_dir / "keep-sweep.json").read_text(encoding="utf-8"))
    assert "a" not in state["swept"]

def test_batch_sync_called_once_for_multiple_notes(index_dir: Path):
    """gkeepapi's sync() flushes EVERY dirty node, so the sweep must sync once
    for the whole batch — not once per note."""
    a = _trashable_note("a")
    b = _trashable_note("b")
    keep = FakeKeep([a, b])
    record_completed(index_dir, "a", keep_created_at=_iso_days_ago(60))
    record_completed(index_dir, "b", keep_created_at=_iso_days_ago(60))

    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=False)

    assert keep.sync_calls == 1  # per-note syncing would be 2
    assert report["deleted"] == 2
    state = json.loads((index_dir / "keep-sweep.json").read_text(encoding="utf-8"))
    assert {"a", "b"} <= set(state["swept"])


def test_first_sync_failure_never_reports_a_hidden_deletion(index_dir: Path):
    """Per-note syncing let a LATER note's successful sync silently push an
    EARLIER note's trash while that note was reported as an error — a real
    server-side deletion hidden behind a failure. One batch sync makes the
    outcome all-or-nothing, so the report can never understate what was deleted."""
    a = _trashable_note("a")
    b = _trashable_note("b")
    keep = FakeKeep([a, b])
    keep.fail_first_syncs(1)  # old per-note code: a errors, b's sync flushes BOTH
    record_completed(index_dir, "a", keep_created_at=_iso_days_ago(60))
    record_completed(index_dir, "b", keep_created_at=_iso_days_ago(60))

    report = sweep_old_unpinned(keep, index_dir, age_days=30, dry_run=False)

    assert keep.sync_calls == 1
    assert report["deleted"] == 0  # nothing claimed as deleted
    assert len(report["errors"]) == 1
    state = json.loads((index_dir / "keep-sweep.json").read_text(encoding="utf-8"))
    assert state["swept"] == {}  # both stay retryable
