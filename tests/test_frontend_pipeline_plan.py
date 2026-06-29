"""Plan artifact guard for the frontend pipeline."""

from pathlib import Path


def test_pipeline_plan_uses_current_orchestrator_name():
    plan = (
        Path(__file__).resolve().parents[1]
        / "docs"
        / "superpowers"
        / "plans"
        / "2026-06-29-frontend-parallel-pipeline.md"
    )
    text = plan.read_text(encoding="utf-8")
    assert "GPT-5.5" in text
    assert "Claude" not in text
