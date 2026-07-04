"""Regression guard — B6: a task line ending in CRLF must round-trip clean.

Sweep-findings B6 (2026-06-17) flagged this as a *suspected* leak: `TASK_RE`'s
`.+$` anchor leaves a trailing `\r` attached to the captured group on `\r\n`
input. Investigation 2026-07-04 confirmed the leak exists at the regex level but is
mitigated upstream — `extract_tasks` calls `.strip()` on the captured text and
`task_hash` calls `.strip()` on the raw line, both of which remove `\r`. This test
pins that mitigation so a future refactor (e.g. dropping the `.strip()`, switching
to `rstrip("\n")`) can't silently reintroduce the leak and reset every task's
reshape clock when a daily note is read with `newline=""`.

Not a bakeoff oracle (already green). Kept as a guard.
"""

from pkms.tasks import extract_tasks, task_hash


def test_crlf_task_text_has_no_trailing_cr():
    """The captured `text` must not end with a trailing `\r` from a CRLF source."""
    content = "- [ ] call the dentist\r\n- [x] done\r\n"
    tasks = extract_tasks(content)
    assert [t["state"] for t in tasks] == ["open", "done"]
    assert tasks[0]["text"] == "call the dentist"  # no trailing \r
    assert tasks[1]["text"] == "done"  # no trailing \r
    # Byte-level: never a stray \r in the text field.
    assert all("\r" not in t["text"] for t in tasks), (
        f"trailing \\r leaked into task text: {[t['text'] for t in tasks]}"
    )


def test_crlf_task_hash_matches_lf_form():
    """A task line on `\r\n` must hash identically to the same line on `\n` only.

    The line hash is identity — a state flip is a touch, but a transport-line-ending
    change is not. If `\r` leaks into the hash input, the reshape clock silently
    resets for every task whenever the daily note is read with `newline=""`.
    """
    crlf = "- [ ] call the dentist\r\n"
    lf = "- [ ] call the dentist\n"
    assert task_hash(crlf) == task_hash(lf), (
        f"CRLF and LF forms hash differently — reshape clock would reset spuriously: "
        f"{task_hash(crlf)} != {task_hash(lf)}"
    )


def test_lf_task_unchanged():
    """The fix must not regress the existing LF-only path (the common case)."""
    tasks = extract_tasks("- [ ] plain task\n")
    assert tasks[0]["text"] == "plain task"
    assert tasks[0]["state"] == "open"
