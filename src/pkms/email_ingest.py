"""Slice 8 — email-in ramp. Polls a Gmail label over IMAP, each new mail lands
as one inbox capture file (source: email, subject = first line), deduped by
Message-ID against an append-only ledger in .index/email-ledger.txt. The IMAP
fetch is injected in tests so nothing here ever touches the network in CI.
"""

from __future__ import annotations

import email
import hashlib
import imaplib
from collections.abc import Callable
from email.message import Message
from pathlib import Path

from .capture import write_capture

EMAIL_LEDGER = "email-ledger.txt"


# --- ledger ---


def load_email_ledger(index_dir: Path) -> set[str]:
    p = index_dir / EMAIL_LEDGER
    if not p.exists():
        return set()
    return {ln.strip() for ln in p.read_text(encoding="utf-8").splitlines() if ln.strip()}


def append_email_ledger(index_dir: Path, ids: list[str]) -> None:
    index_dir.mkdir(parents=True, exist_ok=True)
    with (index_dir / EMAIL_LEDGER).open("a", encoding="utf-8") as f:
        for mid in ids:
            f.write(mid + "\n")


# --- body extraction ---


def capture_text_from(msg: Message) -> str:
    subject = (msg.get("Subject") or "").strip()
    body = _decode_body(msg).strip()
    if not subject:
        return body
    return f"{subject}\n\n{body}".strip()


def _decode_body(msg: Message) -> str:
    if not msg.is_multipart():
        return _decode_part(msg)
    for part in msg.walk():
        if part.get_content_type() == "text/plain" and not part.is_multipart():
            return _decode_part(part)
    for part in msg.walk():
        if part.get_content_type().startswith("text/") and not part.is_multipart():
            return _decode_part(part)
    return ""


def _decode_part(part: Message) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        return ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except (LookupError, UnicodeDecodeError):
        return payload.decode("utf-8", errors="replace")


# --- ingest ---


def _message_id(msg: Message, raw: bytes) -> str:
    mid = (msg.get("Message-ID") or "").strip()
    if mid.startswith("<") and mid.endswith(">"):
        mid = mid[1:-1].strip()
    if mid:
        return mid
    return hashlib.sha256(raw).hexdigest()


def ingest_email(
    vault: Path,
    index_dir: Path,
    *,
    fetch: Callable[[], list[bytes]],
) -> dict[str, int]:
    ledger = load_email_ledger(index_dir)
    captured = 0
    skipped = 0
    for raw in fetch():
        msg = email.message_from_bytes(raw)
        mid = _message_id(msg, raw)
        if mid in ledger:
            skipped += 1
            continue
        write_capture(
            capture_text_from(msg),
            vault,
            source="email",
            extra={"email_id": mid},
        )
        append_email_ledger(index_dir, [mid])
        captured += 1
    return {"captured": captured, "skipped": skipped}


# --- IMAP fetch (production wiring; not under test) ---


def make_imap_fetch(
    address: str,
    password: str,
    label: str = "pkms",
) -> Callable[[], list[bytes]]:
    def fetch() -> list[bytes]:
        try:
            with imaplib.IMAP4_SSL("imap.gmail.com") as imap:
                imap.login(address, password)
                if imap.select(f'"{label}"')[0] != "OK":
                    return []
                typ, data = imap.search(None, "ALL")
                if typ != "OK" or not data or not data[0]:
                    return []
                ids = data[0].split()
                raws: list[bytes] = []
                for num in ids:
                    typ, msg_data = imap.fetch(num, "RFC822")
                    if typ != "OK" or not msg_data or not msg_data[0]:
                        continue
                    raws.append(msg_data[0][1])
                imap.logout()
                return raws
        except (imaplib.IMAP4.error, OSError):
            return []

    return fetch
