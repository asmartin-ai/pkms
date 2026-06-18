"""Google Keep ingest (build-plan slice 4): Keep dumps land in the inbox,
searchable, images included.

Route: gkeepapi (unofficial mobile API) + a master token in `.secrets/` — the
one-time token dance is docs/keep-setup.md. Behavior rules:

- **First run primes a baseline** instead of ingesting years of Keep history —
  automation must not grow a look-at-later pile (§9); the cap is disclosed.
- **Ledger in `.index/keep-ledger.txt`** (one id per line, append-only) makes
  dedupe invisible (§1). Wiping `.index` re-primes the baseline — notes created
  between the wipe and the next run would be skipped; disclosed in the docs.
- **Images are OCR'd at ingest** (ocr.py) and the text lands inside the capture
  file — no deferred backlog of unsearchable images (§1). Media files live
  permanently in `vault/media/keep/` (the indexer only reads *.md).
- **Quiet disclosure** (§4): the report says what happened, including anything
  skipped or unreadable — silence about actions erodes trust, loudness
  rebuilds guilt.
"""

import urllib.request
from pathlib import Path

from .capture import write_capture
from .ocr import extract_text

LEDGER = "keep-ledger.txt"
STATE = "keep-state.json"


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


# --- keep client (seam: tests inject a fake) ---

def make_keep(email: str, token: str, index_dir: Path):
    import gkeepapi
    keep = gkeepapi.Keep()
    state = None
    state_path = index_dir / STATE
    if state_path.exists():
        import json
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
        except ValueError:
            state = None  # corrupt cache: resync from scratch
    keep.authenticate(email, token, state=state)
    try:
        import json
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(json.dumps(keep.dump()), encoding="utf-8")
    except OSError:
        pass  # cache is an optimization, never load-bearing
    return keep


def _download(url: str, dest: Path) -> None:
    with urllib.request.urlopen(url) as resp:
        dest.write_bytes(resp.read())


# --- ingest ---

def ingest_keep(vault: Path, index_dir: Path, root: Path, *, keep=None) -> dict:
    """Pull new Keep notes into vault/inbox/. Returns a report dict the CLI
    renders as one quiet line. Inject `keep` in tests."""
    email = read_secret(root, "keep-email")
    token = read_secret(root, "keep-master-token")
    if keep is None and (not email or not token):
        return {"setup_needed": True}

    if keep is None:
        keep = make_keep(email, token, index_dir)

    ledger = load_ledger(index_dir)
    notes = [n for n in keep.all() if not n.trashed]

    if not ledger:
        # First contact: record what already exists, ingest nothing.
        append_ledger(index_dir, [n.id for n in notes])
        return {"baseline": len(notes)}

    new_notes = [n for n in notes if n.id not in ledger]
    media_dir = vault / "media" / "keep"
    report = {"new": 0, "images": 0, "ocr_missing": 0, "media_failed": 0}
    for note in new_notes:
        body = note.text or ""
        if note.title:
            body = f"{note.title}\n\n{body}".strip()

        blobs = list(getattr(note, "images", []) or [])
        for i, blob in enumerate(blobs):
            fname = f"{note.id}_{i}.jpg"
            media_dir.mkdir(parents=True, exist_ok=True)
            try:
                _download(keep.getMediaLink(blob), media_dir / fname)
            except OSError:
                report["media_failed"] += 1
                continue
            body += f"\n\n![keep image](../media/keep/{fname})"
            text = extract_text(media_dir / fname)
            if text is None:
                report["ocr_missing"] += 1
            elif text:
                body += f"\n\n{text}"
            report["images"] += 1

        if not body.strip():
            body = "(empty keep note)"
        write_capture(body, vault, source="keep", extra={"keep_id": note.id})
        append_ledger(index_dir, [note.id])
        report["new"] += 1
    return report


def render_report(report: dict) -> str:
    """One quiet, honest line (§4) — the CLI prints it dim."""
    if report.get("setup_needed"):
        return "keep isn't connected yet — docs/keep-setup.md has the one-time setup (~5 min)"
    if "baseline" in report:
        return (f"keep connected ✓ — {report['baseline']} existing notes stay in Keep; "
                "new ones flow in from here")
    bits = []
    if report["new"]:
        bits.append(f"{report['new']} keep note{'s' if report['new'] != 1 else ''} in")
    if report["images"]:
        bits.append(f"{report['images']} image{'s' if report['images'] != 1 else ''} read")
    if report["ocr_missing"]:
        bits.append(f"{report['ocr_missing']} image{'s' if report['ocr_missing'] != 1 else ''} "
                    "saved unread (tesseract missing)")
    if report["media_failed"]:
        bits.append(f"{report['media_failed']} image download{'s' if report['media_failed'] != 1 else ''} "
                    "failed — they stay in Keep")
    return " · ".join(bits) if bits else "keep: nothing new"
