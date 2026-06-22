"""
Reusable Playwright screenshot tool for the PKMS mockups.

Usage:
    .venv-pw/Scripts/python.exe screenshot.py                # all 4, desktop + mobile
    .venv-pw/Scripts/python.exe screenshot.py 2 3            # only #2 and #3
    .venv-pw/Scripts/python.exe screenshot.py --desktop      # desktop only
    .venv-pw/Scripts/python.exe screenshot.py --mobile       # mobile only
    .venv-pw/Scripts/python.exe screenshot.py --route capture  # nav to #capture first

Output: spike/_shots/<n>-<name>-<view>.png  (full-page, post-font-load)

Mirrors content-hoarder's device profile: Pixel 6 for mobile (412×892 CSS px).
"""
import sys
import os
import time
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(r"K:\Projects\PKMS\spike")
SHOTS = ROOT / "_shots"
SHOTS.mkdir(exist_ok=True)

# Map number → (file, short_name)
MOCKUPS = {
    "1": ("1-daily-edition-mobile.html", "daily-edition"),
    "2": ("2-workbench-mobile.html",     "workbench"),
    "3": ("3-focus-mobile.html",         "focus"),
    "4": ("4-bloom-mobile.html",         "bloom"),
}

# Desktop: comfortable laptop width. Mobile: Pixel 6 (matches content-hoarder).
DESKTOP_W, DESKTOP_H = 1280, 900
MOBILE_W,  MOBILE_H  = 412, 892   # Pixel 6 CSS px

# Surfaces to capture (hash routes). Default = today (front door).
ROUTES = ["today", "capture", "reading", "actions", "search"]


def capture(page, file_path: Path, route: str, view: str, name: str, out_dir: Path):
    """Navigate to file:// + #route, wait for fonts, screenshot."""
    url = f"file:///{file_path.as_posix()}#{route}"
    page.goto(url, wait_until="domcontentloaded")

    # Wait for web fonts to load (Google Fonts CDN). Max 5s, then proceed.
    try:
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(800)   # let layout settle + any entry animations
    except Exception:
        pass

    # If capture route, focus the textarea
    if route == "capture":
        try:
            page.focus("#capture-field")
            page.wait_for_timeout(200)
        except Exception:
            pass

    out_path = out_dir / f"{name}-{view}-{route}.png"
    page.screenshot(path=str(out_path), full_page=True)
    print(f"  ✓ {view:7} #{route:8} → {out_path.name}  ({out_path.stat().st_size // 1024} KB)")
    return out_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("nums", nargs="*", default=list(MOCKUPS.keys()),
                    help="mockup numbers to shoot (1-4); default all")
    ap.add_argument("--desktop", action="store_true", default=False)
    ap.add_argument("--mobile", action="store_true", default=False)
    ap.add_argument("--routes", nargs="*", default=["today"],
                    help=f"hash routes to capture per mockup. One of: {ROUTES}")
    args = ap.parse_args()

    # If neither flag: both
    do_desktop = args.desktop or (not args.mobile)
    do_mobile  = args.mobile  or (not args.desktop)

    selected = [n for n in args.nums if n in MOCKUPS]
    if not selected:
        print(f"No matching mockups. Valid: {list(MOCKUPS)}"); sys.exit(1)

    send_dir = ROOT / "_send"

    with sync_playwright() as p:
        # ---- DESKTOP ----
        if do_desktop:
            print(f"\n=== DESKTOP ({DESKTOP_W}×{DESKTOP_H}) ===")
            browser = p.chromium.launch()
            ctx = browser.new_context(
                viewport={"width": DESKTOP_W, "height": DESKTOP_H},
                device_scale_factor=2,
            )
            page = ctx.new_page()
            for n in selected:
                fname, name = MOCKUPS[n]
                fpath = send_dir / fname
                if not fpath.exists():
                    print(f"  ✗ #{n} {name}: missing {fpath}"); continue
                print(f"  --- #{n} {name} ---")
                for route in args.routes:
                    capture(page, fpath, route, "desktop", name, SHOTS)
            browser.close()

        # ---- MOBILE (Pixel 6 emulation) ----
        if do_mobile:
            print(f"\n=== MOBILE — Pixel 6 ({MOBILE_W}×{MOBILE_H}) ===")
            browser = p.chromium.launch()
            # Pixel 6-ish: 412×892, DPR 2.625, touch, mobile UA
            iphone = p.devices["iPhone 13 Pro"]
            iphone = {**iphone, "viewport": {"width": MOBILE_W, "height": MOBILE_H}}
            ctx = browser.new_context(**iphone)
            page = ctx.new_page()
            for n in selected:
                fname, name = MOCKUPS[n]
                fpath = send_dir / fname
                if not fpath.exists():
                    print(f"  ✗ #{n} {name}: missing {fpath}"); continue
                print(f"  --- #{n} {name} ---")
                for route in args.routes:
                    capture(page, fpath, route, "mobile", name, SHOTS)
            browser.close()

    print(f"\nDone. Screenshots in: {SHOTS}")


if __name__ == "__main__":
    main()
