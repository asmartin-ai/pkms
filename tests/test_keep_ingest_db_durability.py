"""G-batch oracle G1 — keep-ingest ledger durability invariant."""

from types import SimpleNamespace

from pkms import keep_ingest
from pkms.keep_ingest import append_ledger, ingest_keep


class _FakeKeep:
    def __init__(self, notes):
        self._notes = notes

    def all(self):
        return self._notes


def _note(nid, text):
    return SimpleNamespace(id=nid, text=text, title=None, trashed=False, images=[])


def test_completed_note_is_recoverable_after_partial_failure(tmp_path, monkeypatch):
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

    # Propagation is an implementation choice; the durability invariant is the contract.
    try:
        ingest_keep(vault, index_dir, tmp_path, keep=keep)
    except RuntimeError:
        pass

    # The durability contract: a completed keep note ID must be recoverable from
    # the SQLite index (a durable, queryable store), not solely from the
    # append-only flat ledger file. The recovery surface must exist on the
    # keep_ingest module so callers can rebuild dedupe state after a crash.
    recover = getattr(keep_ingest, "completed_keep_ids", None)
    assert recover is not None, (
        "completed_keep_ids(index_dir) must exist so completed keep IDs survive a "
        "partial-failure crash in a queryable store, not only in the flat ledger"
    )
    recovered = recover(index_dir)
    assert "n1" in recovered, "the completed note (n1) must be recoverable from the durable store"
    assert "n2" not in recovered, (
        "the note that failed mid-capture (n2) must not be recorded as completed"
    )
