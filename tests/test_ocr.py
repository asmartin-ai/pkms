"""Oracle for B3 (also closes sweep-item I2: test_ocr.py was missing).

`extract_text()` must distinguish, for the OCR-disclosure UX:
    None -> no engine available (caller discloses "OCR unavailable")
    ""   -> engine ran, found no readable text

B3 bug: extract_text() calls subprocess.run() with no try/except. When the
tesseract binary is missing/stale, subprocess.run raises FileNotFoundError
(an OSError), which propagates and aborts the whole Keep pull. A launch
failure is functionally "no engine available", so it must collapse to None,
not raise.

These tests are deterministic: subprocess.run / shutil.which are monkeypatched;
no real tesseract, no network, no image files are read.
"""

import subprocess
from pathlib import Path
from types import SimpleNamespace

from pkms import ocr


# A path we hand in via the exe= injection point so find_tesseract() is bypassed
# and we land directly on subprocess.run for the run-behavior cases.
FAKE_EXE = Path(r"C:\fake\tesseract.exe")
IMAGE = Path("nonexistent.png")


def _fake_completed(returncode, stdout=""):
    """Stand-in for subprocess.CompletedProcess with just the attrs used."""
    return SimpleNamespace(returncode=returncode, stdout=stdout, stderr="")


def test_launch_failure_returns_none_not_raise(monkeypatch):
    """RED: subprocess.run raising FileNotFoundError (binary missing/stale)
    must make extract_text return None, NOT propagate the OSError.

    Today extract_text has no try/except, so the FileNotFoundError escapes
    and this assertion is never reached -> the test errors red here."""

    def boom(*args, **kwargs):
        raise FileNotFoundError(2, "The system cannot find the file specified")

    monkeypatch.setattr(subprocess, "run", boom)

    result = ocr.extract_text(IMAGE, exe=FAKE_EXE)
    assert result is None


def test_nonzero_returncode_returns_empty_string(monkeypatch):
    """Engine ran but failed (returncode != 0) -> "" (ran, nothing readable)."""
    monkeypatch.setattr(
        subprocess, "run", lambda *a, **k: _fake_completed(1, stdout="garbage")
    )

    result = ocr.extract_text(IMAGE, exe=FAKE_EXE)
    assert result == ""


def test_success_returns_stripped_text(monkeypatch):
    """Engine succeeded (returncode == 0) -> stripped stdout text."""
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *a, **k: _fake_completed(0, stdout="  hello world \n"),
    )

    result = ocr.extract_text(IMAGE, exe=FAKE_EXE)
    assert result == "hello world"


def test_no_engine_found_returns_none(monkeypatch):
    """No exe injected and nothing discoverable (which misses, no candidate
    exists) -> None, and subprocess.run is never reached."""
    monkeypatch.setattr(ocr.shutil, "which", lambda name: None)
    # Force every hard-coded candidate path to report missing.
    monkeypatch.setattr(Path, "exists", lambda self: False)

    def fail_if_called(*a, **k):  # pragma: no cover - must not run
        raise AssertionError("subprocess.run called when no engine is available")

    monkeypatch.setattr(subprocess, "run", fail_if_called)

    result = ocr.extract_text(IMAGE)
    assert result is None
