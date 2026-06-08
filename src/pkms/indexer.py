"""Scan vault and populate the SQLite index."""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import frontmatter

from .db import connect
from .linker import extract_links
from .tasks import extract_tasks


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def index_vault(vault_root: Path, index_dir: Path, *, verbose: bool = False) -> dict:
    conn = connect(index_dir)
    stats = {"notes": 0, "links": 0, "tasks": 0}

    for md_path in sorted(vault_root.rglob("*.md")):
        rel = str(md_path.relative_to(vault_root))
        post = frontmatter.load(md_path)
        content = post.content
        meta = post.metadata

        title = meta.get("title") or md_path.stem
        tags = json.dumps(meta.get("tags") or [])

        conn.execute(
            """INSERT INTO notes (path, title, created, modified, tags, content, indexed_at)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(path) DO UPDATE SET
                 title=excluded.title, created=excluded.created,
                 modified=excluded.modified, tags=excluded.tags,
                 content=excluded.content, indexed_at=excluded.indexed_at""",
            (rel, title, str(meta.get("created", "")), str(meta.get("modified", "")), tags, content, _now()),
        )
        row_id = conn.execute("SELECT id FROM notes WHERE path=?", (rel,)).fetchone()[0]

        # FTS sync
        conn.execute("DELETE FROM notes_fts WHERE rowid=?", (row_id,))
        conn.execute("INSERT INTO notes_fts(rowid, path, title, content) VALUES (?,?,?,?)", (row_id, rel, title, content))

        # Links
        conn.execute("DELETE FROM links WHERE source=?", (rel,))
        for target in extract_links(content):
            conn.execute("INSERT OR IGNORE INTO links (source, target) VALUES (?,?)", (rel, target))
            stats["links"] += 1

        # Tasks
        conn.execute("DELETE FROM tasks WHERE note_path=?", (rel,))
        for t in extract_tasks(content):
            conn.execute(
                "INSERT OR IGNORE INTO tasks (note_path, line, text, done) VALUES (?,?,?,?)",
                (rel, t["line"], t["text"], int(t["done"])),
            )
            stats["tasks"] += 1

        stats["notes"] += 1
        if verbose:
            print(f"  indexed {rel}")

    conn.commit()
    conn.close()
    return stats
