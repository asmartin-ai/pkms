"""Parse [[wikilinks]] and build backlink index."""

import re

WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]")


def extract_links(content: str) -> list[str]:
    """Return raw wikilink targets found in content."""
    return WIKILINK_RE.findall(content)
