"""Publication safety checker behavior."""

import importlib.util
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check_publication_safety.py"
spec = importlib.util.spec_from_file_location("check_publication_safety", SCRIPT)
assert spec is not None and spec.loader is not None
safety = importlib.util.module_from_spec(spec)
sys.modules["check_publication_safety"] = safety
spec.loader.exec_module(safety)

BUILD_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_public_mirror.py"
build_spec = importlib.util.spec_from_file_location("build_public_mirror", BUILD_SCRIPT)
assert build_spec is not None and build_spec.loader is not None
builder = importlib.util.module_from_spec(build_spec)
sys.modules["build_public_mirror"] = builder
build_spec.loader.exec_module(builder)


def test_private_denylist_catches_generated_and_personal_vault_paths():
    assert safety.is_denylisted(".index/pkms.db")
    assert safety.is_denylisted(".secrets/capture-token")
    assert safety.is_denylisted("vault/daily/2026-06-30.md")
    assert safety.is_denylisted("vault/inbox/capture.md")
    assert safety.is_denylisted("vault/media/screenshot.png")
    assert safety.is_denylisted("vault/resources/research.zip")
    assert safety.is_denylisted("exports/phase2-reading-bundle.md")


def test_public_allowlist_is_opt_in_not_all_vault():
    assert safety.is_allowlisted("src/pkms/cli.py")
    assert safety.is_allowlisted("scripts/check_publication_safety.py")
    assert safety.is_allowlisted("scripts/build_public_mirror.py")
    assert safety.is_allowlisted("docs/publication-safety.md")
    assert safety.is_allowlisted("vault/resources/research/10-synthesis.md")
    assert not safety.is_allowlisted("vault/daily/2026-06-30.md")
    assert not safety.is_allowlisted("vault/resources/reading/private-note.md")


def test_mirror_manifest_includes_allowlisted_paths_only():
    paths = [
        "README.md",
        "src/pkms/cli.py",
        "vault/resources/research/10-synthesis.md",
        "vault/daily/2026-06-30.md",
        ".secrets/capture-token",
        "exports/phase2-reading-bundle.md",
    ]
    assert safety.mirror_manifest(paths) == [
        "README.md",
        "src/pkms/cli.py",
        "vault/resources/research/10-synthesis.md",
    ]


def test_content_risks_flag_realistic_publication_hazards():
    text = """
    cd K:\\Projects\\PKMS
    database: K:/Projects/content-hoarder/data/app.db
    contact me at real.person@example.invalid
    REDDIT_CLIENT_SECRET=abc123abc123abc123
    """
    risks = safety.content_risks("docs/example.md", text)
    assert any("local path: K:\\Projects\\PKMS" in risk for risk in risks)
    assert any("local path: K:/Projects/content-hoarder/data/app.db" in risk for risk in risks)
    assert any("raw email address: real.person@example.invalid" in risk for risk in risks)
    assert any("credential-shaped assignment" in risk for risk in risks)


def test_content_risks_allow_documentation_placeholders():
    text = """
    Set-Content .secrets/keep-email "you@example.com"
    TOKEN = "test-token-123"
    url = "http://localhost:8765/web/?token=YOUR_TOKEN"
    "reddit": {"env": {"REDDIT_CLIENT_SECRET": "<secret>"}}
    default = Path(r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe")
    """
    assert safety.content_risks("docs/example.md", text) == []


def test_history_risk_paths_include_private_archives_and_secret_names():
    risks = safety.history_risk_paths(
        [
            "vault/resources/research.zip",
            "src/pkms/cli.py",
            "docs/capture-token-notes.md",
        ]
    )
    assert risks == ["docs/capture-token-notes.md", "vault/resources/research.zip"]


def test_public_mirror_scrubs_machine_local_paths_from_text():
    text = "See K:\\Projects\\PKMS and C:/Users/Kenja/agent-hub/AGENTS.md."
    scrubbed = builder.scrub_text(text)
    assert "K:\\" not in scrubbed
    assert "C:/Users" not in scrubbed
    assert "/path/to/PKMS" in scrubbed
    assert "/path/to/agent-hub/AGENTS.md" in scrubbed


def test_public_mirror_does_not_scrub_python_source_by_suffix():
    assert not builder.should_scrub(Path("tests/test_promote.py"))
    assert not builder.should_scrub(Path("src/pkms/promote.py"))
    assert builder.should_scrub(Path("README.md"))
    assert builder.should_scrub(Path("src/pkms/web_ext/options/options.html"))
