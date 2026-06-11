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
