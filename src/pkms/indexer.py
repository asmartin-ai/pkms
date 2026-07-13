"""Scan vault and populate the SQLite index."""

import json
from datetime import UTC, datetime
from pathlib import Path

import frontmatter

from .db import connect
from .linker import extract_links
from .tasks import extract_tasks


def _now() -> str:
    return datetime.now(UTC).isoformat()


def index_vault(vault_root: Path, index_dir: Path, *, verbose: bool = False) -> dict[str, int]:
    conn = connect(index_dir)
    stats = {"notes": 0, "links": 0, "tasks": 0}
    seen: set[str] = set()
    today = datetime.now().date().isoformat()

    for md_path in sorted(vault_root.rglob("*.md")):
        rel = md_path.relative_to(vault_root).as_posix()
        try:
            post = frontmatter.load(md_path)
        except Exception:
            # One unreadable note (non-UTF8 bytes, broken YAML) must not kill
            # the whole index run. Skip it — and leave it out of `seen`, so a
            # previously-indexed copy is pruned like a deleted file rather
            # than lingering stale.
            print(f"  skipped (unreadable): {rel}")
            continue
        seen.add(rel)
        content = post.content
        meta = post.metadata

        # str(): YAML parses date-like titles into date objects, which sqlite's
        # (deprecated) default adapter would otherwise swallow silently
        title = str(meta.get("title") or md_path.stem)
        tags = json.dumps(meta.get("tags") or [])

        conn.execute(
            """INSERT INTO notes (path, title, created, modified, tags, content, indexed_at)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(path) DO UPDATE SET
                 title=excluded.title, created=excluded.created,
                 modified=excluded.modified, tags=excluded.tags,
                 content=excluded.content, indexed_at=excluded.indexed_at""",
            (rel, title, str(meta.get("created", "")), str(meta.get("modified", "")),
             tags, content, _now()),
        )
        # FTS stays in sync via triggers on the notes table (see db.SCHEMA)

        # Links
        conn.execute("DELETE FROM links WHERE source=?", (rel,))
        for target in extract_links(content):
            conn.execute("INSERT OR IGNORE INTO links (source, target) VALUES (?,?)", (rel, target))
            stats["links"] += 1

        # Tasks
        conn.execute("DELETE FROM tasks WHERE note_path=?", (rel,))
        for t in extract_tasks(content):
            conn.execute(
                """INSERT OR IGNORE INTO tasks
                   (note_path, line, text, done, state, size, first_action, done_when, hash)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (rel, t["line"], t["text"], int(t["done"]), t["state"],
                 t["size"], t["first_action"], t["done_when"], t["hash"]),
            )
            # reshape clock: keeps its original date while the line is unchanged
            conn.execute(
                "INSERT OR IGNORE INTO task_seen (note_path, hash, first_seen) VALUES (?,?,?)",
                (rel, t["hash"], today),
            )
            stats["tasks"] += 1

        stats["notes"] += 1
        if verbose:
            print(f"  indexed {rel}")

    # Drop rows for notes deleted/renamed since the last index run
    for row in conn.execute("SELECT path FROM notes").fetchall():
        if row["path"] not in seen:
            conn.execute("DELETE FROM notes WHERE path=?", (row["path"],))
            conn.execute("DELETE FROM links WHERE source=?", (row["path"],))
            conn.execute("DELETE FROM tasks WHERE note_path=?", (row["path"],))
            if verbose:
                print(f"  removed {row['path']}")

    # Reshape clocks for lines that no longer exist (edited, done, removed)
    conn.execute(
        """DELETE FROM task_seen WHERE NOT EXISTS
           (SELECT 1 FROM tasks t
            WHERE t.note_path = task_seen.note_path AND t.hash = task_seen.hash)"""
    )

    conn.commit()
    conn.close()
    return stats
