"""Google Keep ingest (build-plan slice 4): Keep dumps land in the inbox,
searchable, images included.

Two ingestion paths share this module:

1. **Live** — gkeepapi (unofficial mobile API) + a master token in
   `.secrets/`. The one-time token dance is docs/keep-setup.md. Incremental:
   the first run primes a baseline instead of ingesting years of history.

2. **Takeout** — see keep_takeout.py. A one-shot bulk import of a Google
   Takeout ZIP; no auth, official export.

Behavior rules (apply to both paths):

- **Ledger in `.index/keep-ledger.txt`** (live) and `.index/keep-takeout-ledger.txt`
  (takeout) make dedupe invisible (§1). Wiping `.index` re-primes the live
  baseline; re-running takeout is naturally idempotent via its own ledger.
- **Quiet disclosure** (§4): the report says what happened, including anything
  skipped or unreadable.
- **Attachments** are mirrored to the configured media directory (Spec 10
  convention) with sha256 filenames; the capture references them via
  `file://` markdown image links. The destination is overridable via the
  `PKMS_KEEP_MEDIA_DIR` env var (default `keep-media`).
- **Destructive sweep** — `sweep_old_unpinned()` deletes old+unpinned
  captured notes from Keep itself. Dry-run by default; the CLI requires
  `--apply` for the destructive path.
"""

from __future__ import annotations

import hashlib
import json
import os
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .capture import write_capture
from .db import connect as _db_connect
from .ocr import extract_text

LEDGER = "keep-ledger.txt"
STATE = "keep-state.json"
SWEEP_STATE = "keep-sweep.json"

DEFAULT_MEDIA_DIR = Path(os.environ.get("PKMS_KEEP_MEDIA_DIR", "keep-media"))


def _media_dir() -> Path:
    """Honour PKMS_KEEP_MEDIA_DIR if set; else Spec 10 default."""
    env = os.environ.get("PKMS_KEEP_MEDIA_DIR")
    return Path(env) if env else DEFAULT_MEDIA_DIR


def _attachment_link(dest: Path) -> str:
    """Markdown image link via file:// URL so off-vault mirror resolves in
    Obsidian and other viewers. Forward slashes per file:// URI conventions."""
    try:
        rel = dest.resolve().as_posix()
    except OSError:
        rel = dest.as_posix()
    if not rel.startswith("/"):
        rel = "/" + rel
    return f"![keep attachment](file://{rel})"


# --- secrets / ledger ---


def read_secret(root: Path, name: str) -> str | None:
    p = root / ".secrets" / name
    return p.read_text(encoding="utf-8").strip() if p.exists() else None


def load_ledger(index_dir: Path) -> set[str]:
    p = index_dir / LEDGER
    if not p.exists():
        return set()
    return {ln.strip() for ln in p.read_text(encoding="utf-8").splitlines() if ln.strip()}


def append_ledger(index_dir: Path, note_ids: list[str]) -> None:
    index_dir.mkdir(parents=True, exist_ok=True)
    with (index_dir / LEDGER).open("a", encoding="utf-8") as f:
        for nid in note_ids:
            f.write(nid + "\n")


def record_completed(
    index_dir: Path,
    note_id: str,
    *,
    source: str = "live",
    keep_created_at: str | None = None,
    pinned: bool = False,
) -> None:
    """Mark a keep note as fully captured in the durable SQLite store.

    Called immediately after write_capture succeeds, before append_ledger, so
    a crash between the SQLite write and the flat-ledger append still leaves
    a queryable record of what completed (G1 oracle).

    Uses INSERT OR REPLACE so that a recapture (note modified since last
    capture) refreshes completed_at and other metadata rather than being
    silently ignored.

    `source` distinguishes Takeout-bulk ('takeout') from gkeepapi-live
    captures; `keep_created_at` and `pinned` are snapshots used by the sweep
    to decide deletion eligibility. NULL keep_created_at rows are
    grandfathered (skipped) by the sweep.
    """
    conn = _db_connect(index_dir)
    try:
        conn.execute(
            "INSERT OR REPLACE INTO keep_completed"
            "(id, completed_at, source, keep_created_at, pinned) "
            "VALUES (?, ?, ?, ?, ?)",
            (note_id, _now_iso(), source, keep_created_at, 1 if pinned else 0),
        )
        conn.commit()
    finally:
        conn.close()


def completed_keep_ids(index_dir: Path) -> set[str]:
    """Return the set of keep IDs that have been fully captured, per the
    durable SQLite index. The flat ledger is a hint; this is the contract."""
    conn = _db_connect(index_dir)
    try:
        rows = conn.execute("SELECT id FROM keep_completed").fetchall()
    finally:
        conn.close()
    return {r[0] for r in rows}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _to_aware_dt(val: Any) -> datetime | None:
    """Convert a timestamp value to a timezone-aware datetime.

    Accepts datetime objects (aware as-is, naive → UTC), numeric
    epoch microsecond values, or ISO strings (naive → UTC).
    Returns None for missing/invalid input.
    """
    if val is None:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=UTC)
    try:
        epoch = float(val)
        return datetime.fromtimestamp(epoch / 1_000_000, tz=UTC)
    except (OSError, OverflowError, TypeError, ValueError):
        pass
    try:
        dt = datetime.fromisoformat(str(val))
        return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    except (ValueError, TypeError):
        return None


# --- keep client (seam: tests inject a fake) ---


def make_keep(email: str, token: str, index_dir: Path):
    import gkeepapi

    keep = gkeepapi.Keep()
    state = None
    state_path = index_dir / STATE
    if state_path.exists():
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
        except ValueError:
            state = None  # corrupt cache: resync from scratch
    keep.authenticate(email, token, state=state)
    try:
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(json.dumps(keep.dump()), encoding="utf-8")
    except OSError:
        pass  # cache is an optimization, never load-bearing
    return keep


def _safe_get_media_link(keep: Any, blob: Any) -> str | None:
    """gkeepapi.Keep.getMediaLink raises on some NodeImage blobs without a
    parent (issue #99) — return None instead of letting the whole note fail."""
    try:
        return keep.getMediaLink(blob)
    except Exception:  # noqa: BLE001 — gkeepapi raises non-specific errors
        return None


def _download_bytes(url: str) -> bytes:
    """Fetch URL bytes. Tests monkeypatch this to avoid real network calls
    (the FakeKeep in test_keep_ingest returns fake URLs that won't resolve)."""
    with urllib.request.urlopen(url) as resp:  # noqa: S310
        return resp.read()


def _guess_ext(url: str, data: bytes) -> str:
    """Pick an extension from the URL path or the data's first bytes (magic)."""
    path = urlparse(url).path
    if "." in path:
        ext = "." + path.rsplit(".", 1)[-1].lower()
        if len(ext) <= 6 and ext.replace(".", "").isalnum():
            return ext
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:2] == b"\xff\xd8":
        return ".jpg"
    if data[:4] == b"GIF8":
        return ".gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return ".bin"


def _iso_or_none(ts: Any) -> str | None:
    """Serialize a timestamps.created value to UTC-aware ISO string.

    Accepts real datetime objects (gkeepapi 0.17.1+), numeric
    epoch microsecond values (legacy/test doubles), and legacy
    naive ISO strings (parsed as UTC). Returns None for missing/invalid input.
    """
    if ts is None:
        return None
    created = getattr(ts, "created", None)
    if created is None:
        return None
    dt = _to_aware_dt(created)
    return dt.isoformat() if dt else None


def _note_latest_mod_iso(note: Any) -> str | None:
    """Return the latest updated/edited timestamp from a note as UTC-aware ISO."""
    timestamps = getattr(note, "timestamps", None)
    if timestamps is None:
        return None
    latest = None
    for attr in ("updated", "edited"):
        dt = _to_aware_dt(getattr(timestamps, attr, None))
        if dt is None:
            continue
        if latest is None or dt > latest:
            latest = dt
    return latest.isoformat() if latest else None


# --- ingest ---


def ingest_keep(
    vault: Path,
    index_dir: Path,
    root: Path,
    *,
    keep: Any = None,
    media_dir: Path | None = None,
) -> dict[str, Any]:
    """Pull new Keep notes into vault/inbox/. Returns a report dict the CLI
    renders as one quiet line. Inject `keep` in tests.

    `media_dir` defaults to PKMS_KEEP_MEDIA_DIR if set, else `keep-media`
    (Spec 10). Attachments are mirrored with sha256 filenames and referenced
    from the capture via file:// links.

    Safety contracts:
    - First contact (ledger file absent) primes a baseline without ingesting.
    - Seen IDs = flat ledger ∪ durable completed IDs — a note in either is
      not re-ingested as "new".
    - Archived notes are excluded from live ingest.
    - If any attachment link/download fails for a note, the entire note is
      skipped (no capture, no completion row, no ledger entry) — left
      retryable for the next run.
    - A previously completed note whose live updated/edited timestamp is
      newer than completed_at is recaptured; record_completed refreshes
      the completion metadata.
    """
    email = read_secret(root, "keep-email")
    token = read_secret(root, "keep-master-token")
    if keep is None and (not email or not token):
        return {"setup_needed": True}

    if keep is None:
        assert email is not None and token is not None  # noqa: S101
        keep = make_keep(email, token, index_dir)

    media_dir = Path(media_dir) if media_dir is not None else _media_dir()
    ledger = load_ledger(index_dir)
    completed = completed_keep_ids(index_dir)
    seen = ledger | completed  # flat ledger union durable completed IDs

    # Exclude trashed AND archived notes from live ingest.
    notes = [
        n for n in keep.all()
        if not getattr(n, "trashed", False) and not getattr(n, "archived", False)
    ]

    if not (index_dir / LEDGER).exists():
        # First contact: record what already exists, ingest nothing.
        # Keyed on the ledger FILE, not on an empty set — a first contact with
        # zero active notes must still initialize (append_ledger creates the
        # file), or every later run re-primes and swallows the first real note.
        append_ledger(index_dir, [n.id for n in notes])
        return {"baseline": len(notes)}

    # New notes (never seen) + recapture candidates (seen but modified).
    new_notes = [n for n in notes if n.id not in seen]
    recapture_notes = [
        n for n in notes
        if n.id in seen and _needs_recapture(index_dir, n)
    ]
    to_process = new_notes + recapture_notes

    report: dict[str, Any] = {"new": 0, "images": 0, "ocr_missing": 0, "media_failed": 0}
    for note in to_process:
        body = note.text or ""
        if note.title:
            body = f"{note.title}\n\n{body}".strip()

        blobs = list(getattr(note, "images", []) or [])
        note_failed = False
        for blob in blobs:
            media_url = _safe_get_media_link(keep, blob)
            if not media_url:
                report["media_failed"] += 1
                note_failed = True
                break
            try:
                data = _download_bytes(media_url)
            except OSError:
                report["media_failed"] += 1
                note_failed = True
                break
            sha = hashlib.sha256(data).hexdigest()
            ext = _guess_ext(media_url, data)
            media_dir.mkdir(parents=True, exist_ok=True)
            dest = media_dir / f"{sha}{ext}"
            if not dest.exists():
                dest.write_bytes(data)
            body += "\n\n" + _attachment_link(dest)
            text = extract_text(dest)
            if text is None:
                report["ocr_missing"] += 1
            elif text:
                body += f"\n\n{text}"
            report["images"] += 1

        # If any attachment link/download failed, skip the entire note:
        # no capture, no completion row, no ledger entry — left retryable.
        if note_failed:
            continue

        if not body.strip():
            body = "(empty keep note)"

        keep_created = _iso_or_none(getattr(note, "timestamps", None))
        pinned = bool(getattr(note, "pinned", False))
        extra: dict[str, str] = {"keep_id": note.id}
        if keep_created:
            extra["keep_created_at"] = keep_created
        if pinned:
            extra["pinned"] = "true"
        write_capture(body, vault, source="keep", extra=extra)
        # Record into the durable store BEFORE the flat ledger so a crash
        # between the two leaves the completion recoverable from SQLite.
        # INSERT OR REPLACE refreshes metadata on recapture.
        record_completed(
            index_dir,
            note.id,
            source="live",
            keep_created_at=keep_created,
            pinned=pinned,
        )
        # Only append to the flat ledger for genuinely new notes; recaptured
        # notes are already present.
        if note.id not in ledger:
            append_ledger(index_dir, [note.id])
        report["new"] += 1
    return report


def _needs_recapture(index_dir: Path, note: Any) -> bool:
    """Return True if a previously completed note has been modified since
    its last completion was recorded."""
    meta = _completion_meta(index_dir, note.id)
    if meta is None:
        return False
    completed_at_iso = meta.get("completed_at")
    if not completed_at_iso:
        return False
    mod_iso = _note_latest_mod_iso(note)
    if not mod_iso:
        return False
    mod_dt = _to_aware_dt(mod_iso)
    completed_dt = _to_aware_dt(completed_at_iso)
    if mod_dt is None or completed_dt is None:
        return False
    return mod_dt > completed_dt


def render_report(report: dict[str, Any]) -> str:
    """One quiet, honest line (§4) — the CLI prints it dim."""
    if report.get("setup_needed"):
        return "keep isn't connected yet — docs/keep-setup.md has the one-time setup (~5 min)"
    if "baseline" in report:
        return (
            f"keep connected ✓ — {report['baseline']} existing notes stay in Keep; "
            "new ones flow in from here"
        )
    bits = []
    if report["new"]:
        bits.append(f"{report['new']} keep note{'s' if report['new'] != 1 else ''} in")
    if report["images"]:
        bits.append(f"{report['images']} image{'s' if report['images'] != 1 else ''} read")
    if report["ocr_missing"]:
        bits.append(
            f"{report['ocr_missing']} image{'s' if report['ocr_missing'] != 1 else ''} "
            "saved unread (tesseract missing)"
        )
    if report["media_failed"]:
        bits.append(
            f"{report['media_failed']} image download{'s' if report['media_failed'] != 1 else ''} "
            "failed — they stay in Keep"
        )
    return " · ".join(bits) if bits else "keep: nothing new"


# --- destructive sweep ---


def _load_sweep_state(index_dir: Path) -> dict[str, Any]:
    p = index_dir / SWEEP_STATE
    if not p.exists():
        return {"swept": {}}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except ValueError:
        return {"swept": {}}


def _save_sweep_state(index_dir: Path, state: dict[str, Any]) -> None:
    index_dir.mkdir(parents=True, exist_ok=True)
    (index_dir / SWEEP_STATE).write_text(json.dumps(state, indent=2), encoding="utf-8")


def _parse_keep_created(iso: str | None) -> datetime | None:
    if not iso:
        return None
    return _to_aware_dt(iso)


def _completion_meta(index_dir: Path, note_id: str) -> dict[str, Any] | None:
    conn = _db_connect(index_dir)
    try:
        row = conn.execute(
            "SELECT keep_created_at, pinned, completed_at FROM keep_completed WHERE id = ?",
            (note_id,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    return {"keep_created_at": row[0], "pinned": bool(row[1]), "completed_at": row[2]}


def sweep_old_unpinned(
    keep: Any,
    index_dir: Path,
    *,
    age_days: int = 30,
    dry_run: bool = True,
) -> dict[str, Any]:
    """Delete (or report on) Keep notes that are:
    - in keep_completed (captured into vault) — this is the "delete ONLY
      after import" gate; a note is in keep_completed only AFTER
      write_capture has succeeded. Notes that exist in Keep but have
      never been captured into the vault are always skipped
      (`skipped_uncaptured`) — this is the load-bearing safety property
      of the sweep. Tested by `test_sweep_skips_uncaptured_notes` and
      `test_apply_never_deletes_uncaptured_note`.
    - older than `age_days` (per their original Keep created_at),
    - not pinned (per the live snapshot),
    - not already trashed/archived (live check).

    The keep_completed table is the durable proof of "imported" — it is
    written by record_completed() inside both the Takeout path and the
    gkeepapi live path, AFTER write_capture returns successfully. A wipe
    of the vault (without wiping .index/) leaves the import record intact;
    a wipe of .index/ (without wiping vault/) means the sweep has no
    memory of imports and will skip everything as uncaptured. Both are
    safe — uncaptured is always skipped.

    `dry_run=True` (default): scan and report only; do not call gkeepapi's
    delete. The user must explicitly opt in to destructive deletion by
    passing `dry_run=False` (CLI flag: --apply).

    In apply mode, every eligible note is trashed via `note.trash()` (which
    is local-only in gkeepapi), and then `keep.sync()` is called EXACTLY ONCE
    for the whole batch. Only after that sync succeeds are the swept state and
    `deleted` count recorded. On sync failure nothing is recorded as deleted
    and every note stays retryable on the next run.
    """
    state = _load_sweep_state(index_dir)
    swept = state.setdefault("swept", {})

    report: dict[str, Any] = {
        "scanned": 0,
        "eligible": 0,
        "deleted": 0,
        "skipped_pinned": 0,
        "skipped_recent": 0,
        "skipped_uncaptured": 0,
        "skipped_grandfathered": 0,
        "skipped_trashed": 0,
        "skipped_archived": 0,
        "errors": [],
        "dry_run": dry_run,
        "age_days": age_days,
        "eligible_ids": [],
    }

    notes = list(keep.all())
    report["scanned"] = len(notes)
    completed = completed_keep_ids(index_dir)
    now = datetime.now(UTC)
    trashed: list[tuple[str, int]] = []  # (note_id, age) — recorded only after the batch sync

    for note in notes:
        note_id = getattr(note, "id", None)
        if not note_id:
            continue
        if getattr(note, "trashed", False):
            report["skipped_trashed"] += 1
            continue
        if getattr(note, "archived", False):
            report["skipped_archived"] += 1
            continue
        if getattr(note, "pinned", False):
            report["skipped_pinned"] += 1
            continue
        if note_id not in completed:
            report["skipped_uncaptured"] += 1
            continue

        meta = _completion_meta(index_dir, note_id)
        if meta is None:
            report["skipped_uncaptured"] += 1
            continue
        keep_created_iso = meta.get("keep_created_at")
        created_dt = _parse_keep_created(keep_created_iso)
        if created_dt is None:
            # No age data - grandfather clause: never delete on age alone.
            report["skipped_grandfathered"] += 1
            continue
        age = (now - created_dt).days
        if age < age_days:
            report["skipped_recent"] += 1
            continue

        report["eligible"] += 1
        report["eligible_ids"].append(note_id)

        if dry_run:
            continue

        try:
            note.trash()  # gkeepapi: local-only; the batch sync below persists it
        except Exception as e:  # noqa: BLE001
            report["errors"].append(f"{note_id}: {e}")
            continue
        trashed.append((note_id, age))

    if not dry_run:
        if trashed:
            # ONE sync for the whole batch. gkeepapi's sync() flushes EVERY dirty
            # node, not just the current one, so a per-note sync would let a later
            # note's success silently push an earlier note's trash to the server
            # while that earlier note was reported as an error — a real deletion
            # hidden behind a failure. All-or-nothing keeps the report honest.
            try:
                keep.sync()
            except Exception as e:  # noqa: BLE001
                report["errors"].append(f"sync failed — nothing recorded as deleted: {e}")
                trashed = []
            for swept_id, swept_age in trashed:
                swept[swept_id] = {
                    "deleted_at": _now_iso(),
                    "age_days_at_delete": swept_age,
                }
                report["deleted"] += 1
        _save_sweep_state(index_dir, state)
    return report


def render_sweep_report(report: dict[str, Any]) -> str:
    """One quiet, honest line for the destructive sweep."""
    bits: list[str] = []
    if report["dry_run"]:
        bits.append("DRY RUN")
    bits.append(f"scanned {report['scanned']}")
    bits.append(f"eligible {report['eligible']} (≥{report['age_days']}d, unpinned, captured)")
    if not report["dry_run"] and report["deleted"]:
        bits.append(f"deleted {report['deleted']}")
    if report["skipped_grandfathered"]:
        bits.append(f"grandfathered (no age data) {report['skipped_grandfathered']}")
    if report["skipped_pinned"]:
        bits.append(f"pinned {report['skipped_pinned']}")
    if report["skipped_recent"]:
        bits.append(f"too recent {report['skipped_recent']}")
    if report["skipped_trashed"]:
        bits.append(f"already trashed {report['skipped_trashed']}")
    if report["skipped_archived"]:
        bits.append(f"archived {report['skipped_archived']}")
    if report["skipped_uncaptured"]:
        bits.append(f"not in vault {report['skipped_uncaptured']}")
    if report["errors"]:
        bits.append(f"errors {len(report['errors'])}")
    return " · ".join(bits)
