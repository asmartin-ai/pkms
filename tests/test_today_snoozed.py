"""G-batch oracle G3 — today_view hides snoozed notes on request."""

from pkms.indexer import index_vault
from pkms.today import today_view
from tests.conftest import write_note


def test_today_view_reports_snoozed_section_by_default(vault, index_dir):
    # A snoozed note: only [~] not-now tasks, no active [ ] task.
    write_note(
        vault / "projects" / "snoozer.md",
        """\
        - [~] parked for later, not now
        """,
        title="Snoozer Project",
    )
    # The fixture's projects/alpha.md has only a [ ] open task (no [~]) — it is
    # active, not snoozed, and must NOT appear in the snoozed section.
    index_vault(vault, index_dir)

    view = today_view(vault, index_dir)

    assert "snoozed" in view, (
        "the today-view must surface a snoozed section listing notes whose only "
        "open-but-unfinished tasks are not-now ([~])"
    )
    snoozed_notes = {s["note"] for s in view["snoozed"]}
    assert snoozed_notes == {"projects/snoozer.md"}, (
        "the snoozed section must contain exactly the notes whose only "
        "open-but-unfinished tasks are [~]; an active note (projects/alpha.md, "
        "which has a [ ] open task and no [~]) must NOT appear"
    )


def test_today_view_hides_snoozed_section_when_flagged(vault, index_dir):
    write_note(
        vault / "projects" / "snoozer.md",
        """\
        - [~] parked for later, not now
        """,
        title="Snoozer Project",
    )
    index_vault(vault, index_dir)

    view = today_view(vault, index_dir, hide_snoozed=True)

    assert view.get("snoozed", []) == [], "hide_snoozed=True must suppress the snoozed section"
    # Other sections of the view are unaffected.
    assert "next_actions" in view and "breadcrumb" in view
