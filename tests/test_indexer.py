"""Vault scanning → index population, including re-index idempotency."""

import json

from pkms.db import connect
from pkms.indexer import index_vault


def test_counts_match_fixture(vault, index_dir):
    stats = index_vault(vault, index_dir)
    assert stats == {"notes": 3, "links": 2, "tasks": 3}


def test_frontmatter_metadata_stored(vault, index_dir):
    index_vault(vault, index_dir)
    conn = connect(index_dir)
    row = conn.execute("SELECT * FROM notes WHERE path LIKE '%alpha.md'").fetchone()
    assert row["title"] == "Alpha Project"
    assert json.loads(row["tags"]) == ["project", "active"]
    assert row["created"] == "2026-06-01"
    assert "[[beta]]" in row["content"]
    assert "title:" not in row["content"]  # frontmatter stripped from indexed body
    conn.close()


def test_title_falls_back_to_stem(vault, index_dir):
    index_vault(vault, index_dir)
    conn = connect(index_dir)
    row = conn.execute("SELECT title FROM notes WHERE path LIKE '%2026-06-01.md'").fetchone()
    assert row["title"] == "2026-06-01"
    conn.close()


def test_reindex_is_idempotent(vault, index_dir):
    index_vault(vault, index_dir)
    stats = index_vault(vault, index_dir)
    assert stats == {"notes": 3, "links": 2, "tasks": 3}

    conn = connect(index_dir)
    assert conn.execute("SELECT count(*) c FROM notes").fetchone()["c"] == 3
    assert conn.execute("SELECT count(*) c FROM links").fetchone()["c"] == 2
    assert conn.execute("SELECT count(*) c FROM tasks").fetchone()["c"] == 3
    # FTS index must hold exactly one row per note after a double index
    assert conn.execute("SELECT count(*) c FROM notes_fts WHERE notes_fts MATCH 'alpha'").fetchone()["c"] == 1
    conn.close()


def test_reindex_removes_deleted_notes(vault, index_dir):
    """A note deleted from the vault must disappear from notes, links, tasks, and FTS."""
    index_vault(vault, index_dir)
    (vault / "projects" / "alpha.md").unlink()
    stats = index_vault(vault, index_dir)
    assert stats["notes"] == 2

    conn = connect(index_dir)
    assert conn.execute("SELECT count(*) c FROM notes").fetchone()["c"] == 2
    assert conn.execute("SELECT count(*) c FROM links").fetchone()["c"] == 0  # both links lived in alpha
    assert conn.execute("SELECT count(*) c FROM tasks WHERE note_path LIKE '%alpha.md'").fetchone()["c"] == 0
    assert conn.execute("SELECT count(*) c FROM notes_fts WHERE notes_fts MATCH 'alpha'").fetchone()["c"] == 0
    conn.close()


def test_reshape_clock_survives_reindex_and_resets_on_edit(vault, index_dir):
    index_vault(vault, index_dir)
    conn = connect(index_dir)
    row = conn.execute(
        "SELECT ts.hash h, ts.first_seen FROM task_seen ts JOIN tasks t "
        "ON t.note_path=ts.note_path AND t.hash=ts.hash WHERE t.text='open task one'",
    ).fetchone()
    # backdate the clock; a reindex with the line unchanged must keep the date
    conn.execute("UPDATE task_seen SET first_seen='2026-05-01' WHERE hash=?", (row["h"],))
    conn.commit()
    conn.close()
    index_vault(vault, index_dir)
    conn = connect(index_dir)
    assert conn.execute(
        "SELECT first_seen FROM task_seen WHERE hash=?", (row["h"],)
    ).fetchone()["first_seen"] == "2026-05-01"
    conn.close()

    # edit the line: old clock pruned, fresh clock starts (human touch, §4)
    alpha = vault / "projects" / "alpha.md"
    alpha.write_text(
        alpha.read_text(encoding="utf-8").replace("open task one", "open task one, reshaped"),
        encoding="utf-8",
    )
    index_vault(vault, index_dir)
    conn = connect(index_dir)
    assert conn.execute(
        "SELECT count(*) c FROM task_seen WHERE hash=?", (row["h"],)
    ).fetchone()["c"] == 0  # stale clock pruned with its line
    fresh = conn.execute(
        "SELECT ts.first_seen FROM task_seen ts JOIN tasks t "
        "ON t.note_path=ts.note_path AND t.hash=ts.hash "
        "WHERE t.text='open task one, reshaped'",
    ).fetchone()
    assert fresh["first_seen"] != "2026-05-01"
    conn.close()


def test_task_metadata_lands_in_index(vault, index_dir):
    from conftest import write_note
    write_note(
        vault / "projects" / "meta.md",
        """\
        - [ ] shaped task ⏱25m ▶ open the file ✓ tests green
        - [i] iced task
        """,
        title="Meta",
    )
    index_vault(vault, index_dir)
    conn = connect(index_dir)
    shaped = conn.execute("SELECT * FROM tasks WHERE text='shaped task'").fetchone()
    assert (shaped["size"], shaped["first_action"], shaped["done_when"]) == \
        ("25m", "open the file", "tests green")
    assert shaped["state"] == "open"
    iced = conn.execute("SELECT state FROM tasks WHERE text='iced task'").fetchone()
    assert iced["state"] == "iceboxed"
    conn.close()


def test_reindex_picks_up_edits(vault, index_dir):
    index_vault(vault, index_dir)
    beta = vault / "resources" / "beta.md"
    beta.write_text(
        "---\ntitle: Beta Note\n---\n\nRewritten body, task removed, now links [[alpha]].",
        encoding="utf-8",
    )
    stats = index_vault(vault, index_dir)
    assert stats["tasks"] == 2  # beta's open task is gone

    conn = connect(index_dir)
    row = conn.execute("SELECT content FROM notes WHERE path LIKE '%beta.md'").fetchone()
    assert "Rewritten" in row["content"]
    targets = [
        r["target"]
        for r in conn.execute("SELECT target FROM links WHERE source LIKE '%beta.md'")
    ]
    assert targets == ["alpha"]
    conn.close()
