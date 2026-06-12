"""Daily-note template: section anchors for the agent layer (slice 3)."""

from datetime import date

from pkms.daily import (
    BREADCRUMB_HEADING,
    FOLDED_HEADING,
    daily_path,
    ensure_daily,
    section_lines,
)


def test_template_carries_section_anchors(tmp_path):
    path, created = ensure_daily(tmp_path / "vault", date(2026, 6, 12))
    assert created
    text = path.read_text(encoding="utf-8")
    assert text.startswith("---\ntitle: 2026-06-12\n")
    assert "tags: [daily]" in text
    assert BREADCRUMB_HEADING in text
    assert FOLDED_HEADING in text
    assert "## notes" in text


def test_ensure_daily_never_overwrites(tmp_path):
    vault = tmp_path / "vault"
    path, _ = ensure_daily(vault, date(2026, 6, 12))
    path.write_text("user wrote this", encoding="utf-8")
    again, created = ensure_daily(vault, date(2026, 6, 12))
    assert again == path and not created
    assert path.read_text(encoding="utf-8") == "user wrote this"


def test_daily_path_uses_iso_date(tmp_path):
    assert daily_path(tmp_path, date(2026, 6, 12)).name == "2026-06-12.md"


def test_section_lines_extracts_content_drops_comments():
    text = (
        "# 2026-06-12\n\n## breadcrumb\n<!-- where you left off -->\n"
        "stopped mid-refactor of today.py\n▶ rerun the today tests\n\n"
        "## folded today\n- folded a thing\n"
    )
    assert section_lines(text, BREADCRUMB_HEADING) == [
        "stopped mid-refactor of today.py",
        "▶ rerun the today tests",
    ]
    assert section_lines(text, FOLDED_HEADING) == ["- folded a thing"]


def test_section_lines_empty_or_absent_section_is_empty():
    templated = "## breadcrumb\n<!-- placeholder -->\n\n## notes\n"
    assert section_lines(templated, BREADCRUMB_HEADING) == []
    assert section_lines("no sections here", BREADCRUMB_HEADING) == []
