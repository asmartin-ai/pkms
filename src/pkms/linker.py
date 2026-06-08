"""Parse [[wikilinks]] and build backlink index."""

import re
from pathlib import Path

WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]")


def extract_links(content: str) -> list[str]:
    """Return raw wikilink targets found in content."""
    return WIKILINK_RE.findall(content)


def resolve_link(target: str, vault_root: Path) -> Path | None:
    """Try to find the note a wikilink points to."""
    # Exact match first, then case-insensitive search
    for md in vault_root.rglob("*.md"):
        if md.stem == target or md.stem.lower() == target.lower():
            return md.relative_to(vault_root)
    return None
