"""Task extraction from note bodies."""

from pkms.tasks import extract_tasks


def test_open_and_done():
    tasks = extract_tasks("- [ ] write tests\n- [x] fix bug")
    assert tasks == [
        {"done": False, "text": "write tests", "line": 1},
        {"done": True, "text": "fix bug", "line": 2},
    ]


def test_line_numbers_count_from_one():
    content = "# Heading\n\nintro\n- [ ] the task"
    assert extract_tasks(content)[0]["line"] == 4


def test_non_task_checkboxes_ignored():
    # only top-level '- [ ]' lines count: indented subtasks, '*' bullets,
    # and uppercase X are outside the current grammar
    content = "  - [ ] indented\n* [ ] star bullet\n- [X] uppercase\n-[ ] no space"
    assert extract_tasks(content) == []


def test_text_is_stripped():
    assert extract_tasks("- [ ] padded   ")[0]["text"] == "padded"
