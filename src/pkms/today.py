"""Assemble the minimal today-view (build-plan slice 1).

Front door, not a dashboard: where you left off (breadcrumb), what's new
(inbox as progress, never debt), and one next action per note (never a wall).
Copy rules: no backlog counts, no overdue framing, empty state reads as a win
(design language §3/§6).
"""

import re
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, TypeAlias

from .capture import inbox_count

JsonDict: TypeAlias = dict[str, Any]

MAX_NOTES_SHOWN = 8

_WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def _display_text(text: str) -> str:
    """Task text for humans: [[target|label]] renders as its label, [[target]] as target."""
    return _WIKILINK_RE.sub(lambda m: m.group(2) or m.group(1), text).strip()


def _breadcrumb(vault: Path, today_stem: str) -> JsonDict | None:
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
                lines = lines[i + 1 :]
                break
    body = [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith(("#", "<!--"))]
    return {"name": last.stem, "lines": body[-3:]}


def _next_actions(index_dir: Path) -> list[JsonDict]:
    """First OPEN task per note, projects first — stuck/not-now/paused/iceboxed
    are not next actions (§6). Inbox captures are excluded — their tasks
    surface after folding, not before."""
    if not (index_dir / "pkms.db").exists():
        return []
    from .db import connect
    from .tasks import next_action_per_note

    conn = connect(index_dir)
    rows = next_action_per_note(conn)
    conn.close()
    return [
        {
            "note": r["note_path"],
            "title": r["title"] or Path(r["note_path"]).stem,
            "text": _display_text(r["text"]),
            "size": r["size"],
            "first_action": r["first_action"],
        }
        for r in rows
    ]


def _snoozed_notes(index_dir: Path) -> list[JsonDict]:
    """Notes whose only open-but-unfinished tasks are [~] not-now.

    The recognisable-snooze surface (§6): at least one not-now task and NO
    open task. Notes with a [ ] open task stay in next_actions, not here.
    Excludes inbox captures — same rule as _next_actions."""
    if not (index_dir / "pkms.db").exists():
        return []
    from .db import connect
    from .tasks import snoozed_notes

    conn = connect(index_dir)
    rows = snoozed_notes(conn)
    conn.close()
    return [
        {"note": r["note_path"], "title": r["title"] or Path(r["note_path"]).stem} for r in rows
    ]


def _done_today(vault: Path, today_stem: str) -> int:
    """Win pebbles: done tasks in today's note (disk, not index — state lives
    in files). Wins reset without debt; 0 renders as nothing, never a gap."""
    path = vault / "daily" / f"{today_stem}.md"
    if not path.exists():
        return 0
    from .tasks import extract_tasks

    return sum(1 for t in extract_tasks(path.read_text(encoding="utf-8")) if t["done"])


def _next_read(vault: Path) -> JsonDict | None:
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
            queued.append(
                {
                    "title": str(meta.get("title") or p.stem),
                    "minutes": meta.get("reading_minutes"),
                    "promoted": str(meta.get("promoted", "")),
                }
            )
    if not queued:
        return None
    queued.sort(key=lambda q: q["promoted"])
    return queued[0]


def reading_queue(vault: Path) -> list[JsonDict]:
    """All queued reading items, oldest promoted first."""
    reading = vault / "resources" / "reading"
    if not reading.is_dir():
        return []
    import frontmatter

    items = []
    for p in sorted(reading.glob("*.md")):
        meta = frontmatter.load(p).metadata
        if meta.get("reading") == "queued":
            rel = "/".join(p.relative_to(vault).parts)
            items.append(
                {
                    "title": str(meta.get("title") or p.stem),
                    "minutes": meta.get("reading_minutes"),
                    "promoted": str(meta.get("promoted", "")),
                    "why": "next up in your reading queue",
                    "path": rel,
                }
            )
    items.sort(key=lambda i: i["promoted"])
    return items


def _resurface_card(vault: Path, index_dir: Path, *, record_offer: bool = False) -> JsonDict | None:
    """AT MOST ONE candidate — the today-view is the single rationed ambient
    surface (§5). Showing it starts the card's rest window only when
    record_offer=True (interactive open); plain reads are side-effect-free."""
    if not (index_dir / "pkms.db").exists():
        return None
    from .db import connect
    from .resurface import candidates, filter_never, mark_offered

    conn = connect(index_dir)
    cands = filter_never(vault, candidates(conn, k=3))[:1]
    if cands and record_offer:
        mark_offered(conn, [c["path"] for c in cands])
    conn.close()
    return cands[0] if cands else None


def recognition_cards(vault: Path, index_dir: Path, *, k: int = 3) -> list[JsonDict]:
    """Curated recognition card row: at most k cards spanning reading + resurface.
    Side-effect-free: never records a resurface offer (§5)."""
    # Reading cards from the promoted queue
    reading_dir = vault / "resources" / "reading"
    reading_cards: list[JsonDict] = []
    if reading_dir.is_dir():
        import frontmatter

        queued = []
        for p in sorted(reading_dir.glob("*.md")):
            meta = frontmatter.load(p).metadata
            if meta.get("reading") == "queued":
                queued.append(
                    {
                        "kind": "reading",
                        "title": str(meta.get("title") or p.stem),
                        "why": "next in your reading queue",
                        "minutes": meta.get("reading_minutes"),
                        "promoted": str(meta.get("promoted", "")),
                        "path": "/".join(p.relative_to(vault).parts),
                    }
                )
        queued.sort(key=lambda q: q["promoted"])
        reading_cards = queued

    # Resurface cards
    resurface_cards: list[JsonDict] = []
    if (index_dir / "pkms.db").exists():
        from .db import connect
        from .resurface import candidates, filter_never

        conn = connect(index_dir)
        cands = filter_never(vault, candidates(conn, k=k))
        conn.close()
        resurface_cards = [
            {"kind": "resurface", "title": c["title"], "why": c["why"], "path": c["path"]}
            for c in cands
        ]

    # Curate: round-robin so both sources appear when available, cap at k
    result: list[JsonDict] = []
    ri, si = 0, 0
    while len(result) < k:
        if ri < len(reading_cards):
            result.append(reading_cards[ri])
            ri += 1
        if len(result) >= k:
            break
        if si < len(resurface_cards):
            result.append(resurface_cards[si])
            si += 1
        if ri >= len(reading_cards) and si >= len(resurface_cards):
            break
    return result


def today_view(
    vault: Path,
    index_dir: Path,
    *,
    record_offer: bool = False,
    hide_snoozed: bool = False,
) -> JsonDict:
    today_stem = date.today().isoformat()
    actions = _next_actions(index_dir)
    return {
        "date": today_stem,
        "breadcrumb": _breadcrumb(vault, today_stem),
        "inbox_new": inbox_count(vault),
        "done_today": _done_today(vault, today_stem),
        "next_read": _next_read(vault),
        "resurface": _resurface_card(vault, index_dir, record_offer=record_offer),
        "next_actions": actions[:MAX_NOTES_SHOWN],
        "more_notes": max(0, len(actions) - MAX_NOTES_SHOWN),
        "snoozed": [] if hide_snoozed else _snoozed_notes(index_dir),
    }


def recent_notes(vault: Path, index_dir: Path, *, limit: int = 8) -> list[JsonDict]:
    """Recently touched notes (recognition-first picker candidates).

    Reuses the index for the candidate set (title + path); mtime from disk is the
    sort key — ground truth, not index-derivable. The index is regenerable
    (`indexed_at` resets on every reindex, `modified` frontmatter is often
    empty), so file mtime is the only honest recency signal. Read-only,
    side-effect-free: never writes the index or the vault.
    """
    if not (index_dir / "pkms.db").exists():
        return []
    from .db import connect

    conn = connect(index_dir)
    rows = conn.execute("SELECT path, title FROM notes").fetchall()
    conn.close()
    out: list[JsonDict] = []
    for r in rows:
        p = vault / r["path"]
        if not p.is_file():
            continue
        mtime = p.stat().st_mtime
        out.append(
            {
                "title": r["title"],
                "path": Path(r["path"]).as_posix(),
                "last_touched": datetime.fromtimestamp(mtime, tz=UTC).isoformat(),
            }
        )
    out.sort(key=lambda e: str(e["last_touched"]), reverse=True)
    return out[:limit]


def inbox_items(vault: Path, *, limit: int = 10) -> list[JsonDict]:
    """Recent inbox captures — recognition of what's waiting, never a pile.

    Returns one entry per capture (preview, source, captured ISO, path),
    newest-first, capped at `limit` (the recognition-over-pile guard — design
    §3/§6). The preview is the FIRST LINE of the capture body (truncated) so
    the surface shows recognition cues, never a full content dump — the body
    is personal text. Read-only, side-effect-free: never writes the inbox or
    the index. Empty/missing inbox → [] (the empty state is a reward).
    """
    inbox = vault / "inbox"
    if not inbox.is_dir():
        return []
    import frontmatter

    out: list[JsonDict] = []
    for p in sorted(inbox.glob("*.md"), reverse=True):
        try:
            post = frontmatter.load(p)
        except Exception:  # noqa: S112
            # A malformed capture shouldn't 500 the surface — skip it.
            continue
        body = post.content.strip()
        first_line = next(
            (ln.strip() for ln in body.splitlines() if ln.strip()),
            "",
        )
        # Truncate the preview so a long first line doesn't become a wall.
        if len(first_line) > 120:
            first_line = first_line[:117].rstrip() + "…"
        out.append(
            {
                "preview": first_line,
                "source": str(post.metadata.get("source", "")),
                "captured": str(post.metadata.get("captured", "")),
                "path": Path(p.relative_to(vault)).as_posix(),
            }
        )
        if len(out) >= limit:
            break
    # Sort newest-first by captured timestamp; the glob's reverse() is a
    # fallback when captured is missing (the filename is timestamp-prefixed).
    out.sort(key=lambda e: str(e["captured"]), reverse=True)
    return out[:limit]


def area_tiles(vault: Path, index_dir: Path) -> list[JsonDict]:
    """Life-domain tiles for the today-view row — Lamplight rule.

    One next action per tile, never a pile: each tile carries exactly the
    note's single OPEN next action (or None when the note has none, or when
    the index db is missing — tiles still render from disk). No counts, no
    urgency cues, ever — the tiles are a quiet recognition surface, not a
    dashboard. Empty/missing `areas/` → [] (the agent never invents the
    user's life structure). A malformed area note is skipped entirely, not a
    500. Read-only: never writes the vault or the index. Capped at 8, sorted
    by vault-relative POSIX path for calm and stable ordering.
    """
    areas = vault / "areas"
    if not areas.is_dir():
        return []

    # Reuse the index for the next-action set; same guarded open as _next_actions.
    next_action_for: dict[str, str] = {}
    if (index_dir / "pkms.db").exists():
        from .db import connect
        from .tasks import next_action_per_note

        conn = connect(index_dir)
        rows = next_action_per_note(conn)
        conn.close()
        next_action_for = {r["note_path"]: _display_text(r["text"]) for r in rows}

    import frontmatter

    out: list[JsonDict] = []
    for p in sorted(areas.glob("*.md")):
        try:
            meta = frontmatter.load(p).metadata
        except Exception:  # noqa: S112
            # Malformed area note: skip, never 500 the surface.
            continue
        rel = "/".join(p.relative_to(vault).parts)
        mtime = p.stat().st_mtime
        out.append(
            {
                "title": str(meta.get("title") or p.stem),
                "path": Path(rel).as_posix(),
                "next_action": next_action_for.get(rel),
                "last_touched": datetime.fromtimestamp(mtime, tz=UTC).isoformat(),
            }
        )
    out.sort(key=lambda t: t["path"])
    return out[:8]
