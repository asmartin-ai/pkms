"""OCR spot-check (build-plan slice 4): 5 rendered text images through tesseract.

Generates images that approximate real capture material (UI-ish text, a list,
small text, light noise, low contrast) and reports per-image accuracy so the
in-sitting engine decision is made on evidence, not vibes.
"""

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")

SAMPLES = {
    "plain": "Buy a new HDMI cable for the desk setup",
    "list": "groceries: eggs, oat milk, frozen berries\ncall the dentist about thursday",
    "small": "the reshape trigger fires at fourteen days untouched",
    "noisy": "promote the reddit thread about task initiation",
    "lowcontrast": "tailscale serve maps port 8765 on the pixel",
}


def render(text: str, variant: str, path: Path) -> None:
    size = 14 if variant == "small" else 24
    try:
        font = ImageFont.truetype("arial.ttf", size)
    except OSError:
        font = ImageFont.load_default()
    fg, bg = ("#666666", "#999999") if variant == "lowcontrast" else ("black", "white")
    img = Image.new("RGB", (760, 90 + 34 * text.count("\n")), bg)
    ImageDraw.Draw(img).multiline_text((20, 20), text, fill=fg, font=font)
    if variant == "noisy":
        img = img.filter(ImageFilter.GaussianBlur(0.8))
    img.save(path)


def words(s: str) -> set[str]:
    return {w.strip(".,:!?").lower() for w in s.split() if w.strip(".,:!?")}


def main() -> int:
    if not TESSERACT.exists():
        print(f"tesseract not found at {TESSERACT}")
        return 1
    tmp = Path(tempfile.mkdtemp(prefix="pkms-ocr-"))
    total_hit = total_want = 0
    for variant, text in SAMPLES.items():
        img = tmp / f"{variant}.png"
        render(text, variant, img)
        out = subprocess.run(  # noqa: S603 — fixed argv, absolute tesseract path
            [str(TESSERACT), str(img), "stdout"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        got, want = words(out.stdout), words(text)
        hit = len(got & want)
        total_hit += hit
        total_want += len(want)
        print(f"{variant:12s} {hit}/{len(want)} words  ({out.stdout.strip()[:60]!r})")
    pct = 100 * total_hit / total_want
    print(f"\noverall: {total_hit}/{total_want} = {pct:.0f}%")
    return 0 if pct >= 85 else 2


if __name__ == "__main__":
    sys.exit(main())
