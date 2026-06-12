"""Assemble the minimal today-view (build-plan slice 1).

Front door, not a dashboard: where you left off (breadcrumb), what's new
(inbox as progress, never debt), and one next action per note (never a wall).
Copy rules: no backlog counts, no overdue framing, empty state reads as a win
(design language §3/§6).
"""

import re
from datetime import date
from pathlib import Path

from .capture import inbox_count

MAX_NOTES_SHOWN = 8

_WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def _display_text(text: str) -> str:
    """Task text for humans: [[target|label]] renders as its label, [[target]] as target."""
    return _WIKILINK_RE.sub(lambda m: m.group(2) or m.group(1), text).strip()


def _breadcrumb(vault: Path, today_stem: str) -> dict | None:
    """Where you left off: the newest daily note with breadcrumb-section content.
    Today's own note counts — same-day re-entry is the common case (§7).
    Legacy notes without the section fall back to their tail."""
    daily = vault / "daily"
    if not daily.is_dir():
        return None
    from .daily import BREADCRUMB_HEADING, section_lines
    notes = sorted(daily.glob("*.md"), reverse=True)
    for p in notes:
        lines = section_lines(p.read_text(encoding="utf-8"), BREADCRUMB_HEADING)
        if lines:
            return {"name": p.stem, "lines": lines[:4]}
    prior = [p for p in notes if p.stem != today_stem]
    if not prior:
        return None
    last = prior[0]
    lines = last.read_text(encoding="utf-8").splitlines()
    if lines and lines[0].strip() == "---":  # drop frontmatter
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                lines = lines[i + 1:]
                break
    body = [ln.strip() for ln in lines
            if ln.strip() and not ln.strip().startswith(("#", "<!--"))]
    return {"name": last.stem, "lines": body[-3:]}


def _next_actions(index_dir: Path) -> list[dict]:
    """First open task per note, projects first. Inbox captures are excluded —
    their tasks surface after folding, not before."""
    if not (index_dir / "pkms.db").exists():
        return []
    from .db import connect
    conn = connect(index_dir)
    rows = conn.execute(
        """SELECT t.note_path, n.title, t.text, MIN(t.line) FROM tasks t
           LEFT JOIN notes n ON n.path = t.note_path
           WHERE t.done=0 AND t.note_path NOT LIKE 'inbox%'
           GROUP BY t.note_path
           ORDER BY CASE WHEN t.note_path LIKE 'projects%' THEN 0 ELSE 1 END, t.note_path""",
    ).fetchall()
    conn.close()
    return [
        {"note": r["note_path"], "title": r["title"] or Path(r["note_path"]).stem,
         "text": _display_text(r["text"])}
        for r in rows
    ]


def _next_read(vault: Path) -> dict | None:
    """ONE queued promoted thread, oldest first — recognition, never a pile.
    Reads frontmatter from disk: the reading state lives in the notes themselves."""
    reading = vault / "resources" / "reading"
    if not reading.is_dir():
        return None
    import frontmatter
    queued = []
    for p in sorted(reading.glob("*.md")):
        meta = frontmatter.load(p).metadata
        if meta.get("reading") == "queued":
            queued.append({
                "title": str(meta.get("title") or p.stem),
                "minutes": meta.get("reading_minutes"),
                "promoted": str(meta.get("promoted", "")),
            })
    if not queued:
        return None
    queued.sort(key=lambda q: q["promoted"])
    return queued[0]


def today_view(vault: Path, index_dir: Path) -> dict:
    today_stem = date.today().isoformat()
    actions = _next_actions(index_dir)
    return {
        "date": today_stem,
        "breadcrumb": _breadcrumb(vault, today_stem),
        "inbox_new": inbox_count(vault),
        "next_read": _next_read(vault),
        "next_actions": actions[:MAX_NOTES_SHOWN],
        "more_notes": max(0, len(actions) - MAX_NOTES_SHOWN),
    }
