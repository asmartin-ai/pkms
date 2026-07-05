"""Parse [[wikilinks]] and build backlink index."""

import re
from pathlib import Path

from pkms.db import connect

WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]")


def extract_links(content: str) -> list[str]:
    """Return raw wikilink targets found in content."""
    return WIKILINK_RE.findall(content)


def find_orphans(index_dir: Path) -> list[dict]:
    """Return wikilink targets that resolve to no indexed note.

    Walks the links table and groups by raw target. A target resolves when a
    note's path stem (path with its `.md` suffix stripped, lower-cased) matches
    the target (also lower-cased). Targets that resolve to nothing are
    orphans; each orphan entry lists every source note that references it.
    """
    conn = connect(index_dir)
    try:
        stems: set[str] = set()
        for row in conn.execute("SELECT path FROM notes").fetchall():
            p = row["path"]
            lower = p.lower()
            if lower.endswith(".md"):
                stem = lower[:-3]
            else:
                stem = lower
            stems.add(stem)
            # Also index the basename stem so bare wikilinks like [[beta]]
            # resolve to notes at any depth (e.g. resources/beta.md).
            basename = stem.rsplit("/", 1)[-1]
            stems.add(basename)

        groups: dict[str, set[str]] = {}
        for row in conn.execute("SELECT source, target FROM links").fetchall():
            groups.setdefault(row["target"], set()).add(row["source"])
    finally:
        conn.close()

    orphans: list[dict] = []
    for target, sources in groups.items():
        if target.lower() not in stems:
            orphans.append({"target": target, "sources": sorted(sources)})
    return orphans
