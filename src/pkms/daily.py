"""Daily note: the day's sink and re-entry surface (build-plan slice 3).

The template carries two stable section anchors for the agent layer:
`## breadcrumb` (/resume keeps it current; today-view reads it back) and
`## folded today` (/fold logs each filed capture — done things stay visible,
design language §6 done-log). Agents edit section content, never the headings.
"""

from datetime import date
from pathlib import Path

BREADCRUMB_HEADING = "## breadcrumb"
FOLDED_HEADING = "## folded today"

_TEMPLATE = """\
---
title: {day}
created: {day}
tags: [daily]
---

# {day}

## breadcrumb
<!-- where you left off — /resume keeps this current -->

## folded today
<!-- what got filed where — /fold logs each one -->

## notes

"""


def daily_path(vault: Path, day: date | None = None) -> Path:
    return vault / "daily" / f"{(day or date.today()).isoformat()}.md"


def ensure_daily(vault: Path, day: date | None = None) -> tuple[Path, bool]:
    """Create the day's note from the template if missing; never touch an existing one."""
    path = daily_path(vault, day)
    if path.exists():
        return path, False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_TEMPLATE.format(day=(day or date.today()).isoformat()), encoding="utf-8")
    return path, True


def section_lines(text: str, heading: str) -> list[str]:
    """Content lines of a `## section` — blanks and HTML comments dropped,
    stops at the next `##` heading. [] when the section is absent or empty."""
    lines = text.splitlines()
    try:
        start = next(i for i, ln in enumerate(lines) if ln.strip().lower() == heading)
    except StopIteration:
        return []
    out: list[str] = []
    for ln in lines[start + 1:]:
        s = ln.strip()
        if s.startswith("## "):
            break
        if not s or s.startswith("<!--"):
            continue
        out.append(s)
    return out
