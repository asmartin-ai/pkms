"""Google Takeout -> PKMS vault import (one-shot bulk).

Google Takeout is the official export of a user's Google account data. For
Keep, it's a ZIP with one JSON file per note plus an `attachments/` directory.
This is the safe starting point: no auth beyond owning your own data, and it
captures ALL existing notes regardless of how old they are — unlike the
gkeepapi live path which baselines-on-first-run to avoid building a
look-at-later pile (see keep_ingest.py).

Output: each note -> one capture in `vault/inbox/`, with frontmatter that
records the synthetic takeout id, the original Keep created/updated time, the
pin/archive state, and any labels. Attachments are mirrored to the configured
media directory (default `K:\\MediaMirror\\keep\\` per Spec 10) and
referenced from the capture via `file://` markdown image links.

The takeout id is `takeout:<sha256-of-source-json>`, not Google's internal
note id (which Takeout doesn't include in older exports). The gkeepapi live
path, when it later pulls the same physical note, will create a separate
capture with its own gkeepapi id — known limitation, disclosed in the docs.
The two ledgers (takeout, live) stay separate so re-running either doesn't
double-import within its own path.

Safety: this module is read-only against the Takeout ZIP. It never writes
to Google Keep. Destructive sweep of old+unpinned notes is in keep_ingest.py
and is dry-run by default.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import zipfile
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path
from typing import Any

from .capture import write_capture
from .keep_ingest import (
    append_ledger,
    completed_keep_ids,
    load_ledger,
    record_completed,
)

TAKEOUT_LEDGER = "keep-takeout-ledger.txt"

DEFAULT_MEDIA_DIR = Path(r"K:\MediaMirror\keep")


def _media_dir_from_env() -> Path:
    """Honor PKMS_KEEP_MEDIA_DIR if set; else the Spec 10 default."""
    env = os.environ.get("PKMS_KEEP_MEDIA_DIR")
    return Path(env) if env else DEFAULT_MEDIA_DIR


def _parse_keep_timestamp(raw: Any) -> str | None:
    """Takeout gives us microsecond-epoch integers in `timestamps.*`; newer
    exports also use ISO 8601 strings. Accept both, return ISO 8601."""
    if raw is None:
        return None
    if isinstance(raw, str):
        return raw
    if isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(raw / 1_000_000).isoformat()
        except (OSError, ValueError, OverflowError):
            return None
    return None


def _render_checklist(list_content: Any) -> str | None:
    """Keep checklists: listContent: [{text, checked}, ...]. Render as a
    markdown task list so PKMS's task parser picks them up."""
    if not list_content:
        return None
    rows = []
    for item in list_content:
        text = (item.get("text") or "").strip()
        if not text:
            continue
        checked = bool(item.get("checked"))
        rows.append(f"- [{'x' if checked else ' '}] {text}")
    return "\n".join(rows) if rows else None


def _extract_note_text(payload: dict[str, Any]) -> tuple[str, str | None]:
    """Return (body_text, title). Body is textContent or the rendered
    checklist. Title is the separate title field if present."""
    title = (payload.get("title") or "").strip() or None
    text = (payload.get("textContent") or "").strip()
    checklist = _render_checklist(payload.get("listContent"))
    if checklist and text:
        body = f"{text}\n\n{checklist}"
    elif checklist:
        body = checklist
    else:
        body = text
    return body, title


def _extract_attachments(payload: dict[str, Any]) -> list[dict[str, str]]:
    """Pull the per-note attachment list. Takeout shapes:
    - annotations: [{mimeType, filename, ...}]   (modern exports)
    - attachments: [{filePath, mimetype, ...}]   (older)
    Returns a list of dicts with name + optional zip_path for lookup.
    """
    out: list[dict[str, str]] = []
    for ann in payload.get("annotations") or []:
        name = ann.get("filename") or ann.get("name") or ""
        if not name:
            continue
        out.append({"name": name, "mime_type": ann.get("mimeType") or ann.get("mimetype") or ""})
    for att in payload.get("attachments") or []:
        path = att.get("filePath") or att.get("filename") or att.get("name") or ""
        if not path:
            continue
        out.append(
            {
                "name": Path(path).name,
                "zip_path": path,
                "mime_type": att.get("mimetype") or att.get("mimeType") or "",
            }
        )
    return out


def _attachment_link(dest: Path) -> str:
    """Markdown image link via file:// URL. Forward slashes per file:// URI."""
    try:
        rel = dest.resolve().as_posix()
    except OSError:
        rel = dest.as_posix()
    if not rel.startswith("/"):
        rel = "/" + rel
    return f"![keep attachment](file://{rel})"


def _synthetic_id(json_bytes: bytes) -> str:
    return "takeout:" + hashlib.sha256(json_bytes).hexdigest()[:32]


def _find_zip_member(zf: zipfile.ZipFile, name: str) -> str | None:
    """Look up an attachment inside the ZIP, tolerating that Takeout may
    place the attachments/ directory at any depth."""
    if name in zf.namelist():
        return name
    target = Path(name).name
    for member in zf.namelist():
        if Path(member).name == target and "attachment" in member.lower():
            return member
    return None


def _discover_note_members(zf: zipfile.ZipFile) -> list[str]:
    """Return the list of ZIP members that look like Keep note JSONs.

    Supports three layouts:
      - Takeout/Keep/*.json        (modern nested export)
      - */Keep/*.json              (other nested exports)
      - bare top-level *.json      (legacy flat export)
    Excludes anything inside any attachments/ directory at any depth.
    """
    out: list[str] = []
    for n in zf.namelist():
        if not n.endswith(".json"):
            continue
        if "/attachments/" in n or n.startswith("attachments/"):
            continue
        if n.startswith("Takeout/Keep/"):
            out.append(n)
        elif re.search(r"/Keep/[^/]+\.json$", n):
            out.append(n)
        elif n.count("/") <= 1 and not n.endswith("/"):
            out.append(n)
    return out


def _mirror_attachment(zf: zipfile.ZipFile, member: str, media_dir: Path) -> Path | None:
    """Copy one attachment out of the Takeout ZIP into media_dir, named
    by sha256.<ext>. Returns the dest Path, or None if the member is missing."""
    try:
        data = zf.read(member)
    except KeyError:
        return None
    sha = hashlib.sha256(data).hexdigest()
    ext = Path(member).suffix.lower() or ""
    dest = media_dir / f"{sha}{ext}"
    if not dest.exists():
        media_dir.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    return dest


def import_takeout(
    zip_path: Path,
    vault: Path,
    index_dir: Path,
    *,
    media_dir: Path | None = None,
) -> dict[str, Any]:
    """Import all Keep notes from a Google Takeout ZIP.

    - Read-only against the ZIP.
    - Skips notes whose synthetic id is already in the takeout ledger
      (re-runs are idempotent).
    - Skips notes that are trashed in the export.
    - Skips notes that have no body, no title, AND no attachments.

    Returns a report dict the CLI renders as one quiet line.
    """
    zip_path = Path(zip_path)
    if not zip_path.is_file():
        raise FileNotFoundError(f"takeout zip not found: {zip_path}")

    media_dir = Path(media_dir) if media_dir is not None else _media_dir_from_env()
    ledger = load_ledger(index_dir) if (index_dir / TAKEOUT_LEDGER).exists() else set()

    report: dict[str, Any] = {
        "notes": 0,
        "skipped_already_imported": 0,
        "skipped_trashed": 0,
        "skipped_empty": 0,
        "attachments_mirrored": 0,
        "attachments_skipped": 0,
        "errors": [],
    }

    with zipfile.ZipFile(zip_path) as zf:
        note_members = _discover_note_members(zf)
        for member in note_members:
            try:
                raw = zf.read(member)
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError as e:
                    report["errors"].append(f"{member}: not JSON ({e})")
                    continue

                note_id = _synthetic_id(raw)
                if note_id in ledger or note_id in completed_keep_ids(index_dir):
                    report["skipped_already_imported"] += 1
                    continue

                timestamps = payload.get("timestamps") or {}
                is_trashed = bool(payload.get("isTrashed")) or bool(timestamps.get("trashTime"))
                if is_trashed:
                    report["skipped_trashed"] += 1
                    continue

                body, title = _extract_note_text(payload)
                attachments = _extract_attachments(payload)
                if not body.strip() and not title and not attachments:
                    report["skipped_empty"] += 1
                    continue

                if title and body:
                    full_body = f"{title}\n\n{body}".strip()
                elif title:
                    full_body = title
                elif attachments and not body.strip():
                    full_body = "(note with no text; see attachments)"
                else:
                    full_body = body

                for att in attachments:
                    lookup = att.get("zip_path") or att["name"]
                    actual = _find_zip_member(zf, lookup)
                    if not actual:
                        report["attachments_skipped"] += 1
                        continue
                    dest = _mirror_attachment(zf, actual, media_dir)
                    if not dest:
                        report["attachments_skipped"] += 1
                        continue
                    full_body += "\n\n" + _attachment_link(dest)
                    report["attachments_mirrored"] += 1

                labels = [lab.get("name") for lab in (payload.get("labels") or []) if lab.get("name")]
                color = payload.get("color")
                is_pinned = bool(payload.get("isPinned"))
                is_archived = bool(payload.get("isArchived"))
                keep_created = _parse_keep_timestamp(timestamps.get("createTime")) or _parse_keep_timestamp(
                    payload.get("createdAt")
                )
                keep_updated = _parse_keep_timestamp(timestamps.get("updateTime")) or _parse_keep_timestamp(
                    payload.get("updatedAt")
                )

                extra: dict[str, str] = {"keep_id": note_id, "source_kind": "takeout"}
                if keep_created:
                    extra["keep_created_at"] = keep_created
                if keep_updated:
                    extra["keep_updated_at"] = keep_updated
                if is_pinned:
                    extra["pinned"] = "true"
                if is_archived:
                    extra["archived"] = "true"
                if color:
                    extra["color"] = str(color)
                if labels:
                    extra["labels"] = ",".join(labels)

                write_capture(full_body, vault, source="keep-takeout", extra=extra)
                # Record into both the durable store (so the sweep can find
                # it) and the takeout ledger (so re-runs are idempotent).
                record_completed(
                    index_dir,
                    note_id,
                    source="takeout",
                    keep_created_at=keep_created,
                    pinned=is_pinned,
                )
                _append_takeout_ledger(index_dir, [note_id])
                report["notes"] += 1
            except Exception as e:  # noqa: BLE001 — surface as a report line
                report["errors"].append(f"{member}: {e}")

    report["media_dir"] = str(media_dir)
    return report


def _append_takeout_ledger(index_dir: Path, note_ids: Iterable[str]) -> None:
    index_dir.mkdir(parents=True, exist_ok=True)
    with (index_dir / TAKEOUT_LEDGER).open("a", encoding="utf-8") as f:
        for nid in note_ids:
            f.write(nid + "\n")


def render_takeout_report(report: dict[str, Any]) -> str:
    bits: list[str] = []
    if report["notes"]:
        bits.append(
            f"{report['notes']} keep note{'s' if report['notes'] != 1 else ''} imported from takeout"
        )
    if report["attachments_mirrored"]:
        bits.append(
            f"{report['attachments_mirrored']} attachment{'s' if report['attachments_mirrored'] != 1 else ''} mirrored to {report['media_dir']}"
        )
    if report["skipped_already_imported"]:
        bits.append(f"{report['skipped_already_imported']} already imported")
    if report["skipped_trashed"]:
        bits.append(f"{report['skipped_trashed']} in trash")
    if report["skipped_empty"]:
        bits.append(f"{report['skipped_empty']} empty")
    if report["attachments_skipped"]:
        bits.append(
            f"{report['attachments_skipped']} attachment{'s' if report['attachments_skipped'] != 1 else ''} missing from zip"
        )
    if report["errors"]:
        bits.append(f"{len(report['errors'])} error{'s' if len(report['errors']) != 1 else ''} (see logs)")
    return " · ".join(bits) if bits else "takeout: nothing new"
