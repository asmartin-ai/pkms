"""Task model (build-plan slice 5): markdown-native tasks with ⏱▶✓ metadata
and six states (decisions G4).

Syntax — one line, metadata tokens in any order after the text:

    - [ ] call the dentist ⏱10m ▶ find the number in keep ✓ appointment booked

States by checkbox marker:

    [ ] open · [x] done · [?] stuck · [~] not-now (guilt-free, back of queue)
    [p] paused — text carries its written reactivation condition,
        e.g. "(wake: after slice 6 ships)" · [i] iceboxed (the stash)

"needs a first step" is a *derived* view-flag (open task with no ▶), never a
stored state — the agent offers to fill it (§6). The reshape clock lives in
the index's task_seen table keyed by line-hash: any manual edit to the line
changes the hash and resets the clock, which is exactly the human-touch-strips-
machine-marks rule (§4) with no extra bookkeeping.
"""

import hashlib
import re
from datetime import date, timedelta

MARKERS = {
    " ": "open",
    "x": "done",
    "?": "stuck",
    "~": "not-now",
    "p": "paused",
    "i": "iceboxed",
}

TASK_RE = re.compile(r"^- \[([ x?~pi])\] (.+)$", re.MULTILINE)
_META_SPLIT = re.compile(r"([⏱▶✓])")
_META_KEY = {"⏱": "size", "▶": "first_action", "✓": "done_when"}
_WAKE_RE = re.compile(r"\(wake:\s*([^)]+)\)")

RESHAPE_DAYS = 14  # G4: untouched this long → re-offered reshaped, never nagged


def task_hash(raw_line: str) -> str:
    """Identity of one task line (marker included — a state flip is a touch)."""
    return hashlib.sha1(raw_line.strip().encode("utf-8")).hexdigest()[:16]


def _split_meta(raw: str) -> tuple[str, dict]:
    parts = _META_SPLIT.split(raw)
    meta = {"size": None, "first_action": None, "done_when": None}
    for token, value in zip(parts[1::2], parts[2::2]):
        value = value.strip()
        if value:
            meta[_META_KEY[token]] = value
    return parts[0].strip(), meta


def extract_tasks(content: str) -> list[dict]:
    out = []
    for m in TASK_RE.finditer(content):
        state = MARKERS[m.group(1)]
        raw = m.group(2).strip()
        wake = None
        if state == "paused":
            wm = _WAKE_RE.search(raw)
            if wm:
                wake = wm.group(1).strip()
        text, meta = _split_meta(raw)
        out.append({
            "state": state,
            "done": state == "done",
            "text": text,
            "line": content[: m.start()].count("\n") + 1,
            "hash": task_hash(f"[{m.group(1)}] {raw}"),
            **meta,
            "wake": wake,
        })
    return out


def stale_tasks(conn, *, days: int = RESHAPE_DAYS, today: date | None = None) -> list[dict]:
    """Reshape candidates: open tasks whose exact line has sat untouched for
    `days`. The briefing offers AT MOST ONE of these per session (G8 budget)."""
    cutoff = ((today or date.today()) - timedelta(days=days)).isoformat()
    rows = conn.execute(
        """SELECT t.note_path, n.title, t.text, t.size, t.first_action, s.first_seen
           FROM tasks t
           JOIN task_seen s ON s.note_path = t.note_path AND s.hash = t.hash
           LEFT JOIN notes n ON n.path = t.note_path
           WHERE t.state = 'open' AND s.first_seen <= ?
           ORDER BY s.first_seen""",
        (cutoff,),
    ).fetchall()
    return [dict(r) for r in rows]


def next_action_per_note(conn) -> list[dict]:
    """One OPEN task per note, projects first — stuck/not-now/paused/iceboxed
    are not next actions (§6). Inbox captures are excluded — their tasks
    surface after folding, not before."""
    rows = conn.execute(
        """SELECT t.note_path, n.title, t.text, t.size, t.first_action, t.state, MIN(t.line)
           FROM tasks t LEFT JOIN notes n ON n.path = t.note_path
           WHERE t.state='open' AND t.note_path NOT LIKE 'inbox%'
           GROUP BY t.note_path
           ORDER BY CASE WHEN t.note_path LIKE 'projects%' THEN 0 ELSE 1 END, t.note_path""",
    ).fetchall()
    return [dict(r) for r in rows]
