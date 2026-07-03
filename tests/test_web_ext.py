"""Firefox new-tab extension: valid manifest, packaged app, sane settings."""

import json
from pathlib import Path
from typing import cast

EXT = Path(__file__).resolve().parents[1] / "src" / "pkms" / "web_ext"


def _manifest() -> dict[str, object]:
    return cast(dict[str, object], json.loads((EXT / "manifest.json").read_text(encoding="utf-8")))


def test_manifest_is_valid_mv3_with_newtab_override():
    m = _manifest()
    assert m["manifest_version"] == 3
    newtab = cast(dict[str, object], m["chrome_url_overrides"])
    options = cast(dict[str, object], m["options_ui"])
    assert newtab["newtab"] == "newtab.html"
    assert options["page"] == "options/options.html"
    assert "name" in m and "version" in m


def test_manifest_can_fetch_local_pkms_service():
    """The packaged extension page fetches localhost APIs instead of redirecting there."""
    m = _manifest()
    host_permissions = cast(list[str], m["host_permissions"])
    assert "http://localhost:8765/*" in host_permissions
    assert "http://127.0.0.1:8765/*" in host_permissions


def test_newtab_html_loads_packaged_app_assets():
    """newtab.html is the app shell itself, so the URL bar stays on the extension page."""
    html = (EXT / "newtab.html").read_text(encoding="utf-8")
    assert "app.js" in html
    assert "styles.css" in html
    assert "newtab.js" not in html
    assert "location.replace" not in html


def test_packaged_app_uses_token_header_not_url_query():
    """The extension app uses X-Capture-Token so the token is not visible in the address bar."""
    js = (EXT / "app.js").read_text(encoding="utf-8")
    assert "X-Capture-Token" in js
    assert "pkmsBaseUrl" in js
    assert "pkmsToken" in js


def test_options_page_saves_pkms_url_parts():
    """The settings page stores both the friendly full URL and parsed fetch config."""
    html = (EXT / "options" / "options.html").read_text(encoding="utf-8")
    js = (EXT / "options" / "options.js").read_text(encoding="utf-8")
    assert "pkms-url" in html
    assert "storage.local.set" in js
    assert "pkmsBaseUrl" in js
    assert "pkmsToken" in js


def test_web_ext_is_exact_packaged_copy():
    """src/pkms/web/ is the source; web_ext/ is a packaged copy. app.js,
    styles.css, and icon.svg are byte-identical, and newtab.html is index.html
    minus exactly two blocks: the manifest <link> and the inline service-worker
    registration <script>. Any other drift means the sync step was skipped."""
    import re

    web = EXT.parent / "web"
    for name in ("app.js", "styles.css", "icon.svg"):
        assert (web / name).read_bytes() == (EXT / name).read_bytes(), (
            f"web_ext/{name} must be byte-identical to web/{name} — re-run the sync"
        )

    index_html = (web / "index.html").read_bytes().decode("utf-8")
    expected, n_manifest = re.subn(r"[ \t]*<link rel=\"manifest\"[^>]*>\r?\n", "", index_html)
    expected, n_sw = re.subn(
        r"[ \t]*<script>\s*//[^\n]*\n(?:[^<]*serviceWorker[^<]*)</script>\r?\n",
        "",
        expected,
        flags=re.DOTALL,
    )
    assert n_manifest == 1 and n_sw == 1, "index.html lost its manifest link or SW block"
    assert (EXT / "newtab.html").read_bytes().decode("utf-8") == expected, (
        "newtab.html must be index.html minus the manifest link + SW registration"
    )


def test_ext_readme_documents_install():
    """The README must explain load-unpacked install + setting the URL."""
    readme = (EXT / "README.md").read_text(encoding="utf-8")
    assert "load" in readme.lower() and "temporary add-on" in readme.lower()
    assert "options" in readme.lower() and "url" in readme.lower()
