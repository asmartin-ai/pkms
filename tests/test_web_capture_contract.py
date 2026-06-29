"""Source-level guard for real web capture.

The new-tab capture UI must POST to the existing /capture endpoint. A local-only
"saved" animation is not enough because capture's product is the security
feeling that the thought actually landed in vault/inbox/.
"""

from pathlib import Path

WEB = Path(__file__).resolve().parents[1] / "src" / "pkms" / "web"


def test_web_capture_posts_to_capture_endpoint():
    js = (WEB / "app.js").read_text(encoding="utf-8")
    assert 'fetch("/capture' in js or "fetch('/capture" in js
    assert 'method: "POST"' in js or "method: 'POST'" in js
    assert "loadToday()" in js
