"""Bakeoff oracle — B1: reading the today-view must NOT mutate resurface state.

`today_view()` calls `_resurface_card()`, which calls `mark_offered()`
(offer_count + 1, rest window, commit). The web app re-fetches GET /api/today
after every capture, so each captured thought silently rests/rotates the
rationed resurface card without it ever being seen — violating the design-
language rule that resurfacing is side-effect-free to read.

These RED tests pin the split: today_view() is read-only by default, and an
explicit interactive open (record_offer=True) records exactly one offer. They go
green once that flag exists and gates the side-effect — see
vault/projects/pkms-design/sweep-findings-2026-06-17.md (B1).

Resolved open decision: the interactive signal is a `record_offer: bool = False`
parameter on today_view (most isolated + unit-testable), not a separate endpoint.
"""

from pkms.db import connect
from pkms.indexer import index_vault
from pkms.today import today_view
from tests.conftest import write_note


def _vault_with_one_old_candidate(tmp_path):
    """A single dormant, unlinked note — the only possible resurface candidate,
    so the offer count is deterministic regardless of the real run date."""
    vault = tmp_path / "vault"
    write_note(
        vault / "resources" / "old-idea.md",
        "An old idea worth revisiting one day.\n",
        title="Old Idea",
        created="2026-01-01",
    )
    index_dir = tmp_path / ".index"
    index_vault(vault, index_dir)
    return vault, index_dir


def _offer_rows(index_dir):
    conn = connect(index_dir)
    try:
        return conn.execute("SELECT path, offer_count FROM resurface_offers").fetchall()
    finally:
        conn.close()


def test_reading_today_view_does_not_record_an_offer(tmp_path):
    vault, index_dir = _vault_with_one_old_candidate(tmp_path)

    card = today_view(vault, index_dir)["resurface"]
    assert card is not None  # sanity: a candidate exists that COULD be (wrongly) recorded
    today_view(vault, index_dir)  # a second read, e.g. the post-capture /api/today refresh

    rows = _offer_rows(index_dir)
    # a pure read must leave the resurface ledger untouched
    assert rows == [] or all(r["offer_count"] == 0 for r in rows), (
        "reading today_view recorded a resurface offer (offer_count advanced on a read)"
    )


def test_interactive_open_records_exactly_one_offer(tmp_path):
    vault, index_dir = _vault_with_one_old_candidate(tmp_path)

    today_view(vault, index_dir, record_offer=True)  # a genuine interactive open

    rows = _offer_rows(index_dir)
    assert len(rows) == 1 and rows[0]["offer_count"] == 1, (
        "an interactive open must record exactly one offer for the shown card"
    )
