"""Resurfacing card: scorer picks, fates, rest windows, forever-exit, ration."""

from datetime import date

import pytest

from pkms.db import connect
from pkms.indexer import index_vault
from pkms.resurface import (
    candidates,
    dismiss,
    filter_never,
    let_go,
    mark_offered,
)

from conftest import write_note

TODAY = date(2026, 6, 12)


@pytest.fixture
def garden(tmp_path):
    """A vault with one active project, one old linked note, one old orphan."""
    vault = tmp_path / "vault"
    write_note(
        vault / "projects" / "active.md",
        "Working here, references [[old-gold]] often.\n",
        title="Active Project", created="2026-06-10",
    )
    write_note(
        vault / "resources" / "old-gold.md",
        "An old idea that the active project links to.\n",
        title="Old Gold", created="2026-01-15",
    )
    write_note(
        vault / "resources" / "old-orphan.md",
        "Old, unlinked, still mildly interesting.\n",
        title="Old Orphan", created="2026-02-01",
    )
    write_note(
        vault / "daily" / "2026-03-01.md", "a daily\n", title="2026-03-01",
        created="2026-03-01",
    )
    index_dir = tmp_path / ".index"
    index_vault(vault, index_dir)
    return vault, index_dir


def test_linked_to_active_outranks_orphan_and_why_says_so(garden):
    vault, index_dir = garden
    conn = connect(index_dir)
    cands = candidates(conn, today=TODAY)
    conn.close()
    titles = [c["title"] for c in cands]
    assert titles[0] == "Old Gold"
    assert "Active Project" in cands[0]["why"]  # transparent ranking (§9)
    assert "Old Orphan" in titles  # dormancy alone is a (weaker) signal


def test_recent_daily_and_reading_notes_never_surface(garden):
    vault, index_dir = garden
    write_note(
        vault / "resources" / "reading" / "queued-thread.md",
        "promoted thread\n", title="Queued Thread", created="2026-01-01",
    )
    write_note(
        vault / "projects" / "fresh.md",
        "Too young to wonder about.\n", title="Fresh", created="2026-06-01",
    )
    index_vault(vault, index_dir.parent / ".index")
    conn = connect(index_dir)
    titles = {c["title"] for c in candidates(conn, today=TODAY, k=10)}
    conn.close()
    assert "Queued Thread" not in titles   # the reading queue owns its fate
    assert "Fresh" not in titles           # not dormant yet
    assert "2026-03-01" not in titles      # dailies never resurface
    assert "Active Project" not in titles  # already on the desk


def test_offered_card_rests_then_question_varies(garden):
    vault, index_dir = garden
    conn = connect(index_dir)
    first = candidates(conn, today=TODAY)[0]
    mark_offered(conn, [first["path"]], today=TODAY)
    # resting: gone tomorrow…
    assert first["path"] not in {c["path"] for c in candidates(conn, today=date(2026, 6, 13))}
    # …back after the rest window, asked DIFFERENTLY (§5 never repeated unchanged)
    later = next(c for c in candidates(conn, today=date(2026, 6, 16))
                 if c["path"] == first["path"])
    assert later["question"] != first["question"]
    conn.close()


def test_dismiss_is_a_thirty_day_silence(garden):
    vault, index_dir = garden
    conn = connect(index_dir)
    target = candidates(conn, today=TODAY)[0]["path"]
    dismiss(conn, target, today=TODAY)
    assert target not in {c["path"] for c in candidates(conn, today=date(2026, 7, 11))}
    assert target in {c["path"] for c in candidates(conn, today=date(2026, 7, 13))}
    conn.close()


def test_let_go_is_reversible_and_filters_out(garden):
    vault, index_dir = garden
    conn = connect(index_dir)
    cands = candidates(conn, today=TODAY)
    target = cands[0]
    let_go(vault, target["path"])
    kept = filter_never(vault, cands)
    assert target["path"] not in {c["path"] for c in kept}
    # reversible: the note itself is untouched apart from one frontmatter line
    text = (vault / target["path"]).read_text(encoding="utf-8")
    assert "resurface: never" in text
    assert "An old idea" in text  # content intact — exit acts on asking, not words


def test_today_view_rations_exactly_one_card(garden):
    vault, index_dir = garden
    from pkms.today import today_view
    view = today_view(vault, index_dir)
    card = view["resurface"]
    assert card is not None and isinstance(card, dict)  # one dict, never a list
    assert card["why"]  # the why-line always rides along
