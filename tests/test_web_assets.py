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


def test_service_worker_exists_and_registered():
    """sw.js exists and index.html registers it (PWA offline shell)."""
    sw = WEB / "sw.js"
    assert sw.exists() and sw.stat().st_size > 0
    html = (WEB / "index.html").read_text(encoding="utf-8")
    assert "serviceWorker" in html and "sw.js" in html


def test_app_js_guards_empty_next_actions():
    """Regression: ledeText() must not dereference next_actions[0] when the list
    is empty. /api/today returns next_actions: [] for the design-intended 'win'
    state (fresh install, cleared, weekend). The old code threw a TypeError on
    action.title, leaving the poster half-rendered (stuck on the HTML-comment
    placeholder, no error banner). Source-level guard; the empty-actions branch
    must precede the action.title dereference."""
    js = (WEB / "app.js").read_text(encoding="utf-8")
    # The guard must exist...
    assert "if (!action)" in js, "ledeText must guard the empty-actions case"
    # ...and it must come BEFORE the first action.title dereference (so the
    # guard short-circuits before the throw).
    guard = js.index("if (!action)")
    first_deref = js.index("action.title")
    assert guard < first_deref, "empty-actions guard must precede action.title dereference"
