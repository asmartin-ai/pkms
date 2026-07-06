"""Parse [[wikilinks]] and build backlink index."""

import re
from collections import defaultdict
from pathlib import Path

from pkms.db import connect

WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]")


def extract_links(content: str) -> list[str]:
    """Return raw wikilink targets found in content."""
    return WIKILINK_RE.findall(content)


def find_orphans(index_dir: Path) -> list[dict]:
    """Return wikilink targets that resolve to no indexed note.

    Each entry is {"target": <raw wikilink text>, "sources": [sorted note
    paths that reference it]}. A target 'resolves' when a note's path-or-
    stem matches the target text case-insensitively (e.g. 'gamma' matches
    a note path ending in 'gamma.md').
    """
    conn = connect(index_dir)
    try:
        # Build the set of indexed stems: lowercase basename without '.md'.
        stems = set()
        for (path,) in conn.execute("SELECT path FROM notes").fetchall():
            stem = Path(path).stem.lower()
            if stem:
                stems.add(stem)

        # Group link sources by target.
        target_to_sources: dict[str, set[str]] = defaultdict(set)
        for source, target in conn.execute("SELECT source, target FROM links").fetchall():
            target_to_sources[target.strip()].add(source)

        orphans = []
        for target, sources in target_to_sources.items():
            if target.lower() not in stems:
                orphans.append({"target": target, "sources": sorted(sources)})
        return orphans
    finally:
        conn.close()
