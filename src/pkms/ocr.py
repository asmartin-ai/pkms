"""OCR at ingest (build-plan slice 4): image text is extracted the moment an
image arrives, never deferred — an unsearchable-image backlog must be
structurally impossible (§1).

Engine: tesseract (UB-Mannheim build, installed via winget). Chosen in-sitting
over a local vision model because scheduled pulls must not depend on the LLM
server being up. Spot-check 2026-06-12: 43/43 words across 5 rendered variants
(plain/list/small/blurred/low-contrast) — scripts/ocr_spotcheck.py.
"""

import shutil
import subprocess
from pathlib import Path

_CANDIDATES = (
    Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
    Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
)


def find_tesseract() -> Path | None:
    on_path = shutil.which("tesseract")
    if on_path:
        return Path(on_path)
    for c in _CANDIDATES:
        if c.exists():
            return c
    return None


def extract_text(image: Path, *, exe: Path | None = None) -> str | None:
    """Text found in the image. None = no engine available (caller discloses);
    "" = engine ran and found nothing readable."""
    exe = exe or find_tesseract()
    if exe is None:
        return None
    out = subprocess.run(
        [str(exe), str(image), "stdout"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if out.returncode != 0:
        return ""
    return out.stdout.strip()
