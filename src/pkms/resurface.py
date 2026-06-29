"""Resurfacing card (build-plan slice 6): old knowledge comes back as a
curious question — never a count badge, never a nag (decisions G5/G8).

Mechanics, bound to the design language:

- **Scorer is a pure function over the index** — heuristics first (links into
  recently-active notes, dormancy, backlink degree); embeddings stay deferred
  until a week of real candidates misses (G5 sub-decision, default: defer).
- **One rationed ambient surface**: the today-view shows AT MOST ONE candidate;
  `pkms resurface` shows up to three on demand (on-demand isn't ambient).
- **Transparent ranking** (§9): every candidate carries a one-line "why this".
- **Never repeated unchanged** (§5): question templates rotate with the offer
  count; an offered note rests 3 days before it can reappear at all.
- **Dismiss = silent decay + no-renag window** (30 days, stored in the index —
  machine timing state, regenerable; losing it can only make the card quieter).
- **Forever-exit acts on the content** (§5): `resurface: never` in the note's
  frontmatter — user-visible state lives in the file, not the index. As cheap
  as accepting; reversible by deleting the line.
- **One machine fate per content class** (§5): vault knowledge resurfaces and
  is never silently decayed. Daily notes, inbox captures, and the reading
  queue never enter this surface — they have their own fates. Hoarder-sourced
  reading material is excluded here; identity/entertainment content never
  reappears as work.
"""

import sqlite3
from datetime import date, timedelta
from pathlib import Path
from typing import Any, TypeAlias

Candidate: TypeAlias = dict[str, Any]

OFFER_REST_DAYS = 3  # an offered card rests before it may reappear
DISMISS_REST_DAYS = 30  # "not now" — silent, no-renag window
ACTIVE_WINDOW_DAYS = 21  # notes created/modified inside this count as "active"
DORMANT_AFTER_DAYS = 30  # younger notes aren't "old enough to be interesting"

_EXCLUDED_PREFIXES = ("daily/", "inbox/", "resources/reading/", "archive/")

# Varied question forms (§5: never repeated unchanged) — rotated by offer count.
_TEMPLATES = (
    "still thinking about {title}?",
    "remember {title}?",
    "{title} — worth another look?",
    "does {title} still spark anything?",
)


def _ensure_offers_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS resurface_offers (
               path         TEXT PRIMARY KEY,
               offer_count  INTEGER NOT NULL DEFAULT 0,
               rest_until   TEXT NOT NULL DEFAULT ''
           )"""
    )


def _note_date(row: Any) -> str:
    return str(row["modified"] or row["created"] or "")


def candidates(
    conn: sqlite3.Connection, *, today: date | None = None, k: int = 3
) -> list[Candidate]:
    """Top-k resurfacing candidates with transparent why-lines."""
    today = today or date.today()
    _ensure_offers_table(conn)
    active_cutoff = (today - timedelta(days=ACTIVE_WINDOW_DAYS)).isoformat()
    dormant_cutoff = (today - timedelta(days=DORMANT_AFTER_DAYS)).isoformat()

    notes = conn.execute("SELECT path, title, created, modified FROM notes").fetchall()
    rest = {r["path"]: r for r in conn.execute("SELECT * FROM resurface_offers").fetchall()}
    links = conn.execute("SELECT source, target FROM links").fetchall()

    # active set: notes touched recently (frontmatter dates — the vault's own clock)
    stem_to_path = {Path(n["path"]).stem.lower(): n["path"] for n in notes}
    active_paths, active_titles = set(), {}
    for n in notes:
        d = _note_date(n)
        if d and d >= active_cutoff:
            active_paths.add(n["path"])
            active_titles[Path(n["path"]).stem.lower()] = n["title"] or Path(n["path"]).stem

    backlinks: dict[str, int] = {}
    woven_into_active: dict[str, list[str]] = {}  # candidate path → active titles
    for ln in links:
        tgt = ln["target"].lower()
        backlinks[tgt] = backlinks.get(tgt, 0) + 1
        if ln["source"] in active_paths and tgt in stem_to_path:
            # an active note points AT this one — the strongest pull (§5)
            src_stem = Path(ln["source"]).stem.lower()
            woven_into_active.setdefault(stem_to_path[tgt], []).append(
                active_titles.get(src_stem, Path(ln["source"]).stem)
            )
        elif tgt in active_titles:
            # this note points INTO active work — still a pull, same why-shape
            woven_into_active.setdefault(ln["source"], []).append(active_titles[tgt])

    out: list[Candidate] = []
    for n in notes:
        path = n["path"]
        if path.replace("\\", "/").startswith(_EXCLUDED_PREFIXES):
            continue  # other fates own these (§5 one-fate-per-class)
        r = rest.get(path)
        if r and r["rest_until"] and r["rest_until"] > today.isoformat():
            continue  # resting (offered recently or dismissed)
        d = _note_date(n)
        if d and d >= dormant_cutoff:
            continue  # not old enough to be interesting yet

        why, score = [], 0.0
        stem = Path(path).stem.lower()
        if stem in active_titles:
            continue  # it's already on the desk
        woven = woven_into_active.get(path, [])
        if woven:
            score += 3.0 + 0.5 * len(woven)
            why.append(f"links into [[{woven[0]}]], where things are moving")
        deg = backlinks.get(stem, 0)
        if deg >= 2:
            score += 1.0 + 0.25 * deg
            why.append(f"linked from {deg} notes")
        if d:
            age = (today - date.fromisoformat(d[:10])).days
            score += min(age / 60.0, 2.0)
            why.append(f"quiet for a while (since {d[:10]})")
        else:
            why.append("undated — been around")
            score += 0.5
        if score <= 0.5:
            continue
        count = r["offer_count"] if r else 0
        out.append(
            {
                "path": path,
                "title": n["title"] or Path(path).stem,
                "question": _TEMPLATES[count % len(_TEMPLATES)].format(
                    title=n["title"] or Path(path).stem
                ),
                "why": " · ".join(why[:2]),
                "score": round(score, 2),
            }
        )

    out.sort(key=lambda c: -c["score"])
    return out[:k]


def filter_never(vault: Path, cands: list[Candidate]) -> list[Candidate]:
    """Drop notes whose frontmatter carries the forever-exit (resurface: never).
    Read from disk — user-visible state lives in the file, never only the index."""
    import frontmatter

    kept: list[Candidate] = []
    for c in cands:
        p = vault / c["path"]
        try:
            if str(frontmatter.load(p).metadata.get("resurface", "")).lower() == "never":
                continue
        except OSError:
            continue  # note vanished between index and read: just skip
        kept.append(c)
    return kept


def mark_offered(conn: sqlite3.Connection, paths: list[str], *, today: date | None = None) -> None:
    """An offered card rests OFFER_REST_DAYS so nothing repeats back-to-back."""
    today = today or date.today()
    _ensure_offers_table(conn)
    until = (today + timedelta(days=OFFER_REST_DAYS)).isoformat()
    for p in paths:
        conn.execute(
            """INSERT INTO resurface_offers (path, offer_count, rest_until) VALUES (?,1,?)
               ON CONFLICT(path) DO UPDATE SET
                 offer_count = offer_count + 1, rest_until = excluded.rest_until""",
            (p, until),
        )
    conn.commit()


def dismiss(conn: sqlite3.Connection, path: str, *, today: date | None = None) -> None:
    """Not now: silent, no-renag for DISMISS_REST_DAYS. No copy ever counts these."""
    today = today or date.today()
    _ensure_offers_table(conn)
    until = (today + timedelta(days=DISMISS_REST_DAYS)).isoformat()
    conn.execute(
        """INSERT INTO resurface_offers (path, offer_count, rest_until) VALUES (?,0,?)
           ON CONFLICT(path) DO UPDATE SET rest_until = excluded.rest_until""",
        (path, until),
    )
    conn.commit()


def let_go(vault: Path, rel_path: str) -> Path:
    """Forever-exit: write `resurface: never` into the note's frontmatter.
    The content stays; only the asking stops. Reversible by deleting the line."""
    import frontmatter

    p = vault / rel_path
    post = frontmatter.load(p)
    post.metadata["resurface"] = "never"
    p.write_bytes(frontmatter.dumps(post).encode("utf-8"))
    return p
