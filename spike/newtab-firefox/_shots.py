"""Render-test the newtab-firefox mockup.

Captures desktop (poster) and mobile (PWA reflow) at each density so the
rationale docs can reference what the layout actually looks like. Standalone
script — not pytest. Outputs PNGs into spike/newtab-firefox/_shots/.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

SPIKE = Path(__file__).resolve().parent
URL = (SPIKE / "index.html").as_uri()
OUT = SPIKE / "_shots"
OUT.mkdir(exist_ok=True)

DESKTOP_W, DESKTOP_H = 1280, 900
MOBILE_W, MOBILE_H = 412, 892  # Pixel 6


def grab(ctx, route, density, name):
    page = ctx.new_page()
    page.goto(f"{URL}#{route}")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(900)
    # set density via the knob so we capture all three levels on today
    if density:
        page.click(f'[data-density="{density}"]')
        page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / name), full_page=True)
    page.close()
    print(f"  ✓ {name}")


with sync_playwright() as p:
    # ── Desktop poster ──
    print("desktop (1280×900):")
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": DESKTOP_W, "height": DESKTOP_H},
        device_scale_factor=2,
    )
    grab(ctx, "today", "calm",       "desktop-today-calm.png")
    grab(ctx, "today", "more",       "desktop-today-more.png")
    grab(ctx, "today", "everything", "desktop-today-everything.png")
    grab(ctx, "capture", None,       "desktop-capture.png")
    grab(ctx, "reading", None,       "desktop-reading.png")
    browser.close()

    # ── Mobile PWA reflow (Pixel 6) ──
    print("mobile (412×892, Pixel 6):")
    browser = p.chromium.launch()
    pixel6 = {
        "is_mobile": True,
        "has_touch": True,
        "viewport": {"width": MOBILE_W, "height": MOBILE_H},
        "device_scale_factor": 2.625,
    }
    ctx = browser.new_context(**pixel6)
    grab(ctx, "today", "calm", "mobile-today-calm.png")
    grab(ctx, "today", "more", "mobile-today-more.png")
    grab(ctx, "capture", None, "mobile-capture.png")
    browser.close()

print(f"\nshots in {OUT}")
