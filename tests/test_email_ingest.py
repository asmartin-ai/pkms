"""Slice 8 oracle — email-in ramp (pkms.email_ingest).

Contract: poll a Gmail label over IMAP, each new mail becomes one inbox
capture file (source: email, subject = first line), deduped by Message-ID
against an append-only ledger in .index/email-ledger.txt. The IMAP fetch is
injectable so tests never touch the network.
"""

from email.message import EmailMessage
from pathlib import Path

from pkms.email_ingest import (
    append_email_ledger,
    capture_text_from,
    ingest_email,
    load_email_ledger,
)


def _raw(subject: str, body: str, msg_id: str | None) -> bytes:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = "kenja@example.com"
    msg["To"] = "aaronmartin638+pkms@gmail.com"
    if msg_id is not None:
        msg["Message-ID"] = msg_id
    msg.set_content(body)
    return msg.as_bytes()


def test_ledger_roundtrip(index_dir: Path):
    assert load_email_ledger(index_dir) == set()
    append_email_ledger(index_dir, ["a@x", "b@y"])
    append_email_ledger(index_dir, ["c@z"])
    assert load_email_ledger(index_dir) == {"a@x", "b@y", "c@z"}


def test_capture_text_subject_is_first_line():
    import email

    msg = email.message_from_bytes(_raw("Buy milk", "and eggs\n", "<m1@x>"))
    text = capture_text_from(msg)
    assert text.splitlines()[0] == "Buy milk"
    assert "and eggs" in text


def test_capture_text_prefers_plain_over_html():
    msg = EmailMessage()
    msg["Subject"] = "Mixed"
    msg.set_content("plain wins")
    msg.add_alternative("<p>html loses</p>", subtype="html")
    import email

    parsed = email.message_from_bytes(msg.as_bytes())
    text = capture_text_from(parsed)
    assert "plain wins" in text
    assert "<p>" not in text


def test_ingest_writes_captures_and_is_idempotent(vault: Path, index_dir: Path):
    raws = [
        _raw("First thought", "body one", "<one@mail>"),
        _raw("Second thought", "body two", "<two@mail>"),
    ]
    report = ingest_email(vault, index_dir, fetch=lambda: raws)
    assert report["captured"] == 2
    assert report["skipped"] == 0

    files = sorted((vault / "inbox").glob("*.md"))
    assert len(files) == 2
    joined = "\n".join(f.read_text(encoding="utf-8") for f in files)
    assert "source: email" in joined
    assert "First thought" in joined
    assert "body two" in joined
    # Message-IDs (angle brackets stripped) are ledgered
    assert load_email_ledger(index_dir) == {"one@mail", "two@mail"}

    # Second run: same fetch, nothing new
    report2 = ingest_email(vault, index_dir, fetch=lambda: raws)
    assert report2["captured"] == 0
    assert report2["skipped"] == 2
    assert len(list((vault / "inbox").glob("*.md"))) == 2


def test_ingest_missing_message_id_gets_deterministic_id(vault: Path, index_dir: Path):
    raws = [_raw("No id here", "still captured", None)]
    r1 = ingest_email(vault, index_dir, fetch=lambda: raws)
    assert r1["captured"] == 1
    r2 = ingest_email(vault, index_dir, fetch=lambda: raws)
    assert r2["captured"] == 0
    assert r2["skipped"] == 1
    assert len(list((vault / "inbox").glob("*.md"))) == 1
