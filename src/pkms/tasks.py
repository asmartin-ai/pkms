"""Extract and query tasks (- [ ] / - [x]) from notes."""

import re

TASK_RE = re.compile(r"^- \[( |x)\] (.+)$", re.MULTILINE)


def extract_tasks(content: str) -> list[dict]:
    return [
        {"done": m.group(1) == "x", "text": m.group(2).strip(), "line": content[: m.start()].count("\n") + 1}
        for m in TASK_RE.finditer(content)
    ]
