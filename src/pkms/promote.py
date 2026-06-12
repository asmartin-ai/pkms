"""Promote hoarded Reddit threads into the vault (build-plan slice 2 — the B11 win).

Reads the content-hoarder DB strictly read-only (mode=ro URI; decisions G6: pull,
no coupling). A promoted thread becomes a permanent markdown note in
vault/resources/reading/ with its comment tree, provenance frontmatter, and a
consume-cost estimate; `reading: queued` marks it for the today-view queue.

Fresh URLs not in the hoard are out of scope here (build-plan F2) — the hoard is
the system of record; save there first.
"""

import json
import re
import sqlite3
from datetime import date, datetime
from pathlib import Path

HOARDER_DB = Path(r"K:\Projects\content-hoarder\data\app.db")
READING_DIR = ("resources", "reading")
WPM = 200                # consume-cost estimate basis
MAX_COMMENTS = 150       # keep notes readable; the full thread stays one click away
MAX_DEPTH = 4            # deeper replies are noise at reading time

_URL_ID_RE = re.compile(r"(?:redd\.it|reddit\.com)/(?:r/[^/]+/comments/|comments/)?([a-z0-9]{5,9})", re.I)
_BARE_ID_RE = re.compile(r"^(?:t3_)?([a-z0-9]{5,9})$", re.I)


def connect_hoarder(db_path: Path = HOARDER_DB) -> sqlite3.Connection:
    if not db_path.exists():
        raise FileNotFoundError(f"content-hoarder DB not found: {db_path}")
    conn = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def extract_post_id(query: str) -> str | None:
    """Reddit URL or t3_/bare id → post id, else None (treat as search terms).
    A bare token only counts as an id if it carries a digit or the t3_ prefix —
    otherwise single search words ('retain') would be misread as ids."""
    if "/" in query or "." in query:
        m = _URL_ID_RE.search(query)
        return m.group(1).lower() if m else None
    q = query.strip()
    m = _BARE_ID_RE.match(q)
    if m and (q.lower().startswith("t3_") or any(ch.isdigit() for ch in m.group(1))):
        return m.group(1).lower()
    return None


def fetch_thread(conn: sqlite3.Connection, post_id: str) -> dict | None:
    row = conn.execute(
        """SELECT i.title, i.author, i.url, i.created_utc, i.saved_utc, i.metadata,
                  rt.thread_json
           FROM reddit_threads rt JOIN items i ON i.fullname = rt.fullname
           WHERE rt.fullname = ?""",
        (f"reddit:t3_{post_id}",),
    ).fetchone()
    if row is None:
        return None
    meta = json.loads(row["metadata"] or "{}")
    return {
        "id": post_id,
        "title": row["title"],
        "author": row["author"],
        "url": row["url"],
        "created_utc": row["created_utc"],
        "saved_utc": row["saved_utc"],
        "subreddit": meta.get("subreddit", ""),
        "permalink": meta.get("permalink", row["url"]),
        "thread_json": json.loads(row["thread_json"]),
    }


def search_threads(conn: sqlite3.Connection, terms: str, limit: int = 8) -> list[dict]:
    """Candidates among HYDRATED threads only — recognition over recall: show
    options, let the user say 'that one'."""
    like = f"%{terms}%"
    rows = conn.execute(
        """SELECT i.fullname, i.title, i.saved_utc, i.metadata
           FROM reddit_threads rt JOIN items i ON i.fullname = rt.fullname
           WHERE i.kind = 'post' AND (i.title LIKE ? OR i.search_text LIKE ?)
           ORDER BY i.saved_utc DESC LIMIT ?""",
        (like, like, limit),
    ).fetchall()
    # kind='post' only: the hoard also hydrates saved COMMENTS (t1_*), but promote
    # is keyed on the post id — saved-comment promotion is a later refinement.
    out = []
    for r in rows:
        meta = json.loads(r["metadata"] or "{}")
        out.append({
            "id": r["fullname"].removeprefix("reddit:t3_"),
            "title": r["title"],
            "subreddit": meta.get("subreddit", ""),
            "saved": _day(r["saved_utc"]),
        })
    return out


def _day(utc: int | None) -> str:
    return datetime.fromtimestamp(utc).date().isoformat() if utc else ""


def _comment_lines(node: dict, depth: int, lines: list[str], stats: dict) -> None:
    if stats["shown"] >= MAX_COMMENTS or depth > MAX_DEPTH:
        stats["omitted"] += 1 + _descendants(node)
        return
    if node.get("kind") != "t1":  # 'more' stubs and anything exotic
        stats["omitted"] += int(node.get("data", {}).get("count") or 0)
        return
    d = node["data"]
    body = (d.get("body") or "").strip()
    if body in ("[deleted]", "[removed]", ""):
        pass  # skip the husk but keep walking replies
    else:
        stats["shown"] += 1
        q = "> " * depth
        score = d.get("score")
        pts = f" · {score} pts" if isinstance(score, int) else ""
        lines.append(f"{q}**u/{d.get('author', '?')}**{pts}")
        for ln in body.splitlines():
            lines.append(f"{q}{ln}")
        lines.append(q.rstrip() if depth else "")
    replies = d.get("replies")
    children = replies["data"]["children"] if isinstance(replies, dict) else []
    for child in sorted(children, key=lambda c: c.get("data", {}).get("score") or 0, reverse=True):
        _comment_lines(child, depth + 1, lines, stats)


def _descendants(node: dict) -> int:
    if node.get("kind") != "t1":
        return int(node.get("data", {}).get("count") or 0)
    replies = node["data"].get("replies")
    children = replies["data"]["children"] if isinstance(replies, dict) else []
    return 1 + sum(_descendants(c) for c in children)


def render_note(thread: dict, *, today: date | None = None) -> tuple[str, int]:
    """Thread → (markdown note, reading minutes)."""
    today = today or date.today()
    listing = thread["thread_json"]
    post = listing[0]["data"]["children"][0]["data"]
    top_comments = listing[1]["data"]["children"] if len(listing) > 1 else []

    body_lines: list[str] = []
    stats = {"shown": 0, "omitted": 0}
    for child in sorted(top_comments, key=lambda c: c.get("data", {}).get("score") or 0, reverse=True):
        before = len(body_lines)
        _comment_lines(child, 0, body_lines, stats)
        if len(body_lines) > before:
            body_lines.append("---")
            body_lines.append("")
    while body_lines and body_lines[-1] in ("", "---"):
        body_lines.pop()

    selftext = (post.get("selftext") or "").strip()
    words = len(post.get("title", "").split()) + len(selftext.split()) + sum(
        len(ln.split()) for ln in body_lines
    )
    minutes = max(1, round(words / WPM))

    discussion = f"## Discussion ({stats['shown']} comments"
    if stats["omitted"]:
        discussion += f" shown · {stats['omitted']} more in the [full thread]({thread['permalink']})"
    discussion += ")"

    head_bits = [
        f"r/{thread['subreddit']}" if thread["subreddit"] else "",
        f"u/{thread['author']}",
        f"{post.get('score')} pts" if isinstance(post.get("score"), int) else "",
        f"posted {_day(thread['created_utc'])}",
        f"[thread]({thread['permalink']})",
        f"~{minutes} min read",
    ]
    fm = [
        f"title: {json.dumps(thread['title'])}",
        f"created: {today.isoformat()}",
        "tags: [reading, promoted]",
        "reading: queued",
        f"reading_minutes: {minutes}",
        f"source: {thread['permalink']}",
        f"subreddit: {thread['subreddit']}",
        f"author: {thread['author']}",
        f"posted: {_day(thread['created_utc'])}",
        f"saved: {_day(thread['saved_utc'])}",
        f"promoted: {today.isoformat()}",
    ]
    note = "\n".join([
        "---",
        *[ln for ln in fm if not ln.endswith(": ")],  # omit provenance the hoard lacks
        "---",
        "",
        f"# {thread['title']}",
        "",
        "*" + " · ".join(b for b in head_bits if b) + "*",
        "",
        *( [selftext, ""] if selftext else ([f"Link post → {thread['url']}", ""] if thread["url"] else []) ),
        discussion,
        "",
        *body_lines,
        "",
    ])
    return note, minutes


def write_note(note: str, title: str, vault: Path) -> Path:
    reading = vault.joinpath(*READING_DIR)
    reading.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", title[:60].lower()).strip("-") or "thread"
    path = reading / f"{slug}.md"
    n = 1
    while path.exists():
        n += 1
        path = reading / f"{slug}-{n}.md"
    path.write_text(note, encoding="utf-8")
    return path


def promote(query: str, vault: Path, db_path: Path | None = None) -> dict:
    """URL/id → {'note': Path, 'minutes': int} · search terms → {'candidates': [...]}.
    Unhoarded id → {'missing': id}. db_path resolves at call time so tests can
    point HOARDER_DB elsewhere."""
    conn = connect_hoarder(db_path or HOARDER_DB)
    try:
        post_id = extract_post_id(query)
        if post_id is None:
            return {"candidates": search_threads(conn, query)}
        thread = fetch_thread(conn, post_id)
        if thread is None:
            return {"missing": post_id}
        note, minutes = render_note(thread)
        path = write_note(note, thread["title"], vault)
        return {"note": path, "minutes": minutes, "title": thread["title"]}
    finally:
        conn.close()
