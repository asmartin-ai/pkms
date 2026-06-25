"""The redirector Firefox extension: valid manifest, sane redirector (G-N2)."""
import json
from pathlib import Path

EXT = Path(__file__).resolve().parents[1] / "src" / "pkms" / "web_ext"


def test_manifest_is_valid_mv3_with_newtab_override():
    m = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
    assert m["manifest_version"] == 3
    assert m["chrome_url_overrides"]["newtab"] == "newtab.html"
    assert "name" in m and "version" in m


def test_newtab_html_loads_redirector_script():
    """newtab.html is a minimal shell that loads newtab.js (the redirector logic)."""
    html = (EXT / "newtab.html").read_text(encoding="utf-8")
    assert "newtab.js" in html


def test_newtab_redirector_uses_storage():
    """newtab.js redirects to a URL read from extension storage, not hardcoded."""
    js = (EXT / "newtab.js").read_text(encoding="utf-8")
    assert "location.replace" in js
    assert "storage.local" in js


def test_ext_readme_documents_install():
    """The README must explain load-unpacked install + setting the URL."""
    readme = (EXT / "README.md").read_text(encoding="utf-8")
    assert "load" in readme.lower() and "unpacked" in readme.lower()
    assert "storage" in readme.lower() or "url" in readme.lower()
