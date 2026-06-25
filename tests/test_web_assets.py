"""The web frontend assets exist, are non-empty, and internal references resolve."""
from pathlib import Path
import re

WEB = Path(__file__).resolve().parents[1] / "src" / "pkms" / "web"


def test_assets_exist_and_nonempty():
    for name in ("index.html", "styles.css", "app.js", "manifest.webmanifest", "icon.svg"):
        p = WEB / name
        assert p.exists(), f"{name} missing from src/pkms/web/"
        assert p.stat().st_size > 0, f"{name} is empty"


def test_html_references_resolve():
    """<link href="styles.css"> and <script src="app.js"> point at sibling files that exist."""
    html = (WEB / "index.html").read_text(encoding="utf-8")
    refs = re.findall(r'(?:href|src)="([^"]+\.(?:css|js|webmanifest|svg))"', html)
    assert refs, "no local asset references found in index.html"
    for ref in refs:
        # all references are relative siblings; resolve against WEB
        assert (WEB / ref).exists(), f"index.html references {ref} but it's missing"


def test_manifest_links_icon():
    """The PWA manifest references the icon file."""
    manifest = (WEB / "manifest.webmanifest").read_text(encoding="utf-8")
    assert "icon.svg" in manifest, "manifest.webmanifest must reference icon.svg"
