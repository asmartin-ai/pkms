"""F-batch oracle F2 — paused tasks expose their reactivation condition as a field.

A `[p]` paused task carries its written reactivation condition in the line text
(decision G4 / tasks.py docstring): e.g.
`- [p] paused thing (wake: after slice 6 ships)`. The `wake:` parenthetical is
the only recovery path for a paused task — `pkms tasks --stash` prints the line
as-is, but the parsed `extract_tasks()` result has no structured handle on the
condition. Code that wants to *show* the reactivation condition (the agent layer
offering to wake a paused task, a future `--wake` flag) has to re-parse the raw
text every time.

This RED test pins the contract: `extract_tasks()` on a `[p]` line whose text
contains a `(wake: <condition>)` parenthetical yields a task dict with a
`wake` field holding the condition text (the inside of the parens, stripped).
Tasks without a `wake:` parenthetical (any other state, or a paused task
without one) get `wake=None` — consistent with the `size`/`first_action`/
`done_when` None-when-absent precedent (test_missing_metadata_is_none_not_absent).

Goes green once `tasks._split_meta` (or a sibling parser) extracts the `wake:`
condition. Scope: `src/pkms/tasks.py` only (the parser); no CLI or DB change.
"""

from pkms.tasks import extract_tasks


def test_paused_task_with_wake_yields_wake_field():
    ts = extract_tasks("- [p] paused thing (wake: after slice 6 ships)\n")
    assert len(ts) == 1
    t = ts[0]
    assert t["state"] == "paused"
    assert t["wake"] == "after slice 6 ships", (
        f"paused task with (wake: …) must surface the condition as a field; got {t!r}"
    )
    # text stays the full line — the wake condition is part of the user's words,
    # not metadata to strip (unlike ⏱▶✓ which are pure markup).
    assert t["text"] == "paused thing (wake: after slice 6 ships)"


def test_paused_task_without_wake_is_none_not_absent():
    t = extract_tasks("- [p] paused without a condition\n")[0]
    assert t["state"] == "paused"
    assert "wake" in t, "wake field must always be present (None when absent)"
    assert t["wake"] is None


def test_non_paused_states_have_wake_none_even_with_wake_parenthetical():
    # The wake condition is a paused-task convention; other states don't react
    # to it (a [~] not-now task is silent-decay, not condition-wakeable).
    for marker in (" ", "x", "?", "~", "i"):
        t = extract_tasks(f"- [{marker}] task (wake: never) text\n")[0]
        assert t["wake"] is None, f"state {t['state']!r} must not parse a wake condition; got {t!r}"


def test_wake_field_absent_on_open_task_without_parenthetical():
    t = extract_tasks("- [ ] plain open task\n")[0]
    assert t["state"] == "open"
    assert "wake" in t
    assert t["wake"] is None
