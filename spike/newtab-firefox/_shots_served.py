"""Render-verify the SERVED new-tab page end-to-end (Task 7, Step 3).

Unlike _shots.py (which renders the spike's static index.html), this stands up
a real `make_server` with a temp vault + index, then screenshots /web/ through
capture_service — proving the static shell serves, /api/today wires, and the
poster renders. Standalone (not pytest); outputs PNGs into _shots_served/.
"""
import sys
import threading
import textwrap
from pathlib import Path
from urllib.request import urlopen  # noqa: S310 — loopback only

# allow `from pkms...` when run from repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from playwright.sync_api import sync_playwright  # noqa: E402

from pkms.capture_service import make_server  # noqa: E402
from pkms.indexer import index_vault  # noqa: E402

TOKEN = "test-token-123"
OUT = Path(__file__).resolve().parent / "_shots_served"
OUT.mkdir(exist_ok=True)

DESKTOP_W, DESKTOP_H = 1280, 900
MOBILE_W, MOBILE_H = 412, 892  # Pixel 6


def write_note(path, body, *, title=None, tags=None, created="2026-06-01"):
    path.parent.mkdir(parents=True, exist_ok=True)
    fm = [f"created: {created}"]
    if title:
        fm.insert(0, f"title: {title}")
    if tags:
        fm.append(f"tags: [{', '.join(tags)}]")
    fm_block = "\n".join(fm)
    path.write_text(f"---\n{fm_block}\n---\n\n{textwrap.dedent(body)}", encoding="utf-8")


def build_vault(tmp: Path) -> Path:
    root = tmp / "vault"
    write_note(
        root / "projects" / "alpha.md",
        """\
        Alpha references [[beta]] and [[gamma|the gamma note]].

        - [ ] open task one
        - [x] finished task
        """,
        title="Alpha Project",
        tags=["project", "active"],
    )
    write_note(
        root / "resources" / "beta.md",
        """\
        Beta covers the FTS5 external-content table pattern.

        - [ ] open task two
        """,
        title="Beta Note",
    )
    (root / "daily" / "2026-06-01.md").parent.mkdir(parents=True, exist_ok=True)
    (root / "daily" / "2026-06-01.md").write_text(
        "Plain daily note, no frontmatter at all.", encoding="utf-8"
    )
    return root


def main():
    import tempfile
    tmp = Path(tempfile.mkdtemp(prefix="pkms-render-"))
    vault = build_vault(tmp)
    index_dir = tmp / ".index"
    index_vault(vault, index_dir)

    server = make_server(vault, index_dir, "127.0.0.1", 0, TOKEN)
    host, port = server.server_address
    base = f"http://{host}:{port}"
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    # sanity: health + /web/ reachable through capture_service
    assert urlopen(f"{base}/health", timeout=5).read().decode() == "ok"  # noqa: S310
    web_html = urlopen(f"{base}/web/?token={TOKEN}", timeout=5).read().decode()  # noqa: S310
    assert "/api/today" in web_html, "served /web/ must fetch /api/today"
    print(f"  ✓ server up on {base}; /web/ serves and references /api/today")

    try:
        with sync_playwright() as p:
            # desktop poster
            print("desktop (1280x900):")
            b = p.chromium.launch()
            ctx = b.new_context(viewport={"width": DESKTOP_W, "height": DESKTOP_H},
                                device_scale_factor=2)
            page = ctx.new_page()
            page.goto(f"{base}/web/?token={TOKEN}")
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(1200)
            page.screenshot(path=str(OUT / "desktop.png"), full_page=True)
            page.close()
            print("  ✓ desktop.png")

            # mobile PWA reflow
            print("mobile (412x892, Pixel 6):")
            ctx2 = b.new_context(viewport={"width": MOBILE_W, "height": MOBILE_H},
                                 device_scale_factor=2, is_mobile=True,
                                 has_touch=True)
            page2 = ctx2.new_page()
            page2.goto(f"{base}/web/?token={TOKEN}")
            page2.evaluate("document.fonts.ready")
            page2.wait_for_timeout(1200)
            page2.screenshot(path=str(OUT / "mobile.png"), full_page=True)
            page2.close()
            print("  ✓ mobile.png")
            b.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print(f"\nDONE — shots in {OUT}")


if __name__ == "__main__":
    main()
