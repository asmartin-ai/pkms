"""Shared fixtures: a temp vault with known notes, links, and tasks."""

import textwrap
from collections.abc import Sequence
from pathlib import Path

import pytest


def write_note(
    path: Path,
    body: str,
    *,
    title: str | None = None,
    tags: Sequence[str] | None = None,
    created: str = "2026-06-01",
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    fm_lines: list[str] = []
    if title is not None:
        fm_lines.append(f"title: {title}")
    fm_lines.append(f"created: {created}")
    if tags is not None:
        fm_lines.append(f"tags: [{', '.join(tags)}]")
    fm = "\n".join(fm_lines)
    _ = path.write_text(f"---\n{fm}\n---\n\n{textwrap.dedent(body)}", encoding="utf-8")
    return path


@pytest.fixture
def vault(tmp_path: Path) -> Path:
    """Vault with 3 notes: 2 wikilinks and 3 tasks (2 open, 1 done) total."""
    root = tmp_path / "vault"

    _ = write_note(
        root / "projects" / "alpha.md",
        """\
        Alpha references [[beta]] and [[gamma|the gamma note]].

        - [ ] open task one
        - [x] finished task
        """,
        title="Alpha Project",
        tags=["project", "active"],
    )

    _ = write_note(
        root / "resources" / "beta.md",
        """\
        Beta covers the FTS5 external-content table pattern.

        - [ ] open task two
        """,
        title="Beta Note",
    )

    # No frontmatter title — indexer must fall back to the file stem.
    note = root / "daily" / "2026-06-01.md"
    note.parent.mkdir(parents=True, exist_ok=True)
    _ = note.write_text("Plain daily note, no frontmatter at all.", encoding="utf-8")

    return root


@pytest.fixture
def index_dir(tmp_path: Path) -> Path:
    return tmp_path / ".index"
