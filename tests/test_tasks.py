"""Task model: six states, ⏱▶✓ metadata, line-hash identity, reshape query."""

from datetime import date, timedelta

import pytest

from pkms.db import connect
from pkms.tasks import extract_tasks, stale_tasks, task_hash


def test_open_and_done():
    ts = extract_tasks("- [ ] do the thing\n- [x] did the thing\n")
    assert [t["state"] for t in ts] == ["open", "done"]
    assert [t["done"] for t in ts] == [False, True]


def test_all_six_states_parse():
    content = (
        "- [ ] open one\n- [x] done one\n- [?] stuck one\n"
        "- [~] not now one\n- [p] paused one (wake: after slice 6)\n- [i] iced one\n"
    )
    states = [t["state"] for t in extract_tasks(content)]
    assert states == ["open", "done", "stuck", "not-now", "paused", "iceboxed"]


def test_metadata_tokens_any_order():
    t = extract_tasks("- [ ] call dentist ✓ appointment booked ⏱10m ▶ find the number\n")[0]
    assert t["text"] == "call dentist"
    assert t["size"] == "10m"
    assert t["first_action"] == "find the number"
    assert t["done_when"] == "appointment booked"


def test_missing_metadata_is_none_not_absent():
    t = extract_tasks("- [ ] bare task\n")[0]
    assert t["size"] is None and t["first_action"] is None and t["done_when"] is None


def test_line_numbers_count_from_one():
    ts = extract_tasks("intro\n- [ ] first\ntext\n- [x] second\n")
    assert [t["line"] for t in ts] == [2, 4]


def test_non_task_checkboxes_ignored():
    assert extract_tasks("  - [ ] indented\n-[ ] no space\n- [z] bad marker\n") == []


def test_hash_changes_on_edit_and_state_flip():
    base = extract_tasks("- [ ] same words\n")[0]["hash"]
    assert extract_tasks("- [ ] same words\n")[0]["hash"] == base  # stable
    assert extract_tasks("- [ ] same words!\n")[0]["hash"] != base  # edit = touch
    assert extract_tasks("- [~] same words\n")[0]["hash"] != base  # state flip = touch


def test_text_is_stripped():
    assert extract_tasks("- [ ]   padded   \n")[0]["text"] == "padded"


# --- stale_tasks: the reshape clock (G4, N=14d) ---

@pytest.fixture
def conn(tmp_path):
    c = connect(tmp_path / ".index")
    yield c
    c.close()


def _seed(conn, *, state="open", first_seen_days_ago=20, text="old task"):
    h = task_hash(f"[ ] {text}")
    line = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] + 1
    conn.execute(
        "INSERT INTO tasks (note_path, line, text, done, state, hash) VALUES (?,?,?,?,?,?)",
        ("projects/p.md", line, text, 0, state, h),
    )
    seen = (date.today() - timedelta(days=first_seen_days_ago)).isoformat()
    conn.execute(
        "INSERT INTO task_seen (note_path, hash, first_seen) VALUES (?,?,?)",
        ("projects/p.md", h, seen),
    )


def test_stale_finds_old_open_tasks(conn):
    _seed(conn, first_seen_days_ago=20)
    rows = stale_tasks(conn)
    assert len(rows) == 1
    assert rows[0]["text"] == "old task"


def test_fresh_and_boundary_tasks_are_not_stale(conn):
    _seed(conn, first_seen_days_ago=13, text="fresh")
    assert stale_tasks(conn) == []
    _seed(conn, first_seen_days_ago=14, text="exactly at the line")
    assert [r["text"] for r in stale_tasks(conn)] == ["exactly at the line"]


def test_only_open_tasks_reshape(conn):
    for state in ("done", "stuck", "not-now", "paused", "iceboxed"):
        _seed(conn, state=state, text=f"{state} task")
    assert stale_tasks(conn) == []
