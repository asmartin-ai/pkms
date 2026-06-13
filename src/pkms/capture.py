"""Zero-decision capture: append-only timestamped files in vault/inbox/.

Every ramp (CLI, hotkey, phone POST, future side doors) lands here as one file
per capture — no filing, tagging, or naming on the dump path (decisions G2).
Append-only one-file-per-capture keeps sync conflict-free by construction.
"""

import re
from datetime import datetime
from pathlib import Path


def write_capture(
    text: str,
    vault: Path,
    *,
    source: str,
    now: datetime | None = None,
    extra: dict[str, str] | None = None,
) -> Path:
    """Write one capture file into vault/inbox/ and return its path.
    `extra` adds flat frontmatter fields (e.g. keep_id for ingest ledgers)."""
    text = text.strip()
    if not text:
        raise ValueError("empty capture")
    inbox = vault / "inbox"
    inbox.mkdir(parents=True, exist_ok=True)
    now = now or datetime.now()
    slug = re.sub(r"[^a-z0-9]+", "-", text[:32].lower()).strip("-") or "capture"
    base = f"{now:%Y-%m-%d_%H%M%S}_{slug}"
    path = inbox / f"{base}.md"
    n = 1
    while path.exists():  # same-second collision: suffix, never overwrite
        n += 1
        path = inbox / f"{base}-{n}.md"
    fm = [f"captured: {now:%Y-%m-%d %H:%M:%S}", f"source: {source}"]
    fm += [f"{k}: {v}" for k, v in (extra or {}).items()]
    path.write_text(
        "---\n" + "\n".join(fm) + f"\n---\n\n{text}\n",
        encoding="utf-8",
    )
    return path


def inbox_count(vault: Path) -> int:
    """Captures waiting to be folded in."""
    inbox = vault / "inbox"
    return sum(1 for _ in inbox.glob("*.md")) if inbox.is_dir() else 0
