"""Bakeoff oracle — B2: Keep ingest must durably ledger each completed note.

`ingest_keep` accumulates `done_ids` and calls `append_ledger` once AFTER the
whole loop. If a later note raises mid-batch, the captures already written to
vault/inbox/ never reach the ledger, so the next run re-ingests them as
duplicates. This RED test pins the invariant: a completed note is recorded
before a later failure, and the failing note is not. It goes green once the
ledger is written per-note (or flushed in a finally) — see
vault/projects/pkms-design/sweep-findings-2026-06-17.md (B2).
"""

from types import SimpleNamespace

from pkms import keep_ingest
from pkms.keep_ingest import append_ledger, ingest_keep, load_ledger


class _FakeKeep:
    def __init__(self, notes):
        self._notes = notes

    def all(self):
        return self._notes


def _note(nid, text):
    return SimpleNamespace(id=nid, text=text, title=None, trashed=False, images=[])


def test_completed_note_is_ledgered_even_when_a_later_note_fails(tmp_path, monkeypatch):
    vault = tmp_path / "vault"
    index_dir = tmp_path / ".index"
    # Seed the ledger so this is NOT the first-contact baseline path.
    append_ledger(index_dir, ["seed-existing"])

    keep = _FakeKeep([_note("n1", "first note"), _note("n2", "second note")])

    # n1 writes fine; processing n2 raises mid-batch.
    real_write = keep_ingest.write_capture
    calls = {"n": 0}

    def flaky_write(body, vlt, **kw):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("simulated mid-batch failure on the 2nd note")
        return real_write(body, vlt, **kw)

    monkeypatch.setattr(keep_ingest, "write_capture", flaky_write)

    # Propagation is an implementation choice; the durable-ledger invariant is the contract.
    try:
        ingest_keep(vault, index_dir, tmp_path, keep=keep)
    except RuntimeError:
        pass

    ledger = load_ledger(index_dir)
    assert "n1" in ledger, "a completed note must be ledgered before a later note fails"
    assert "n2" not in ledger, "the failing (unwritten) note must NOT be ledgered"
