# Firefox New-Tab Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PKMS desktop frontend the Firefox new-tab page (an ambient briefing-poster seen on every tab-open), wire it to the live `/api/today`, add the redirector extension (G-N2), and resolve the typeface as a real task — while the same document serves as the mobile PWA.

**Architecture:** A static-asset directory (`src/pkms/web/`) graduates the `spike/newtab-firefox/` mockup; `capture_service.py` serves those static files (replacing the inline `TODAY_APP` string) so the redirector extension can point the new tab at `pkms serve`. The page fetches `/api/today` (unchanged) — token passed via `?token=…` from the redirector. Mobile PWA reflow is the same document via a `@media` breakpoint; a `manifest.webmanifest` + service worker make it installable. Typeface selection is delegated to a local LLM (quota-preserving per `local-llm-delegation`), reviewed and integrated here.

**Tech Stack:** Python 3.12 / Typer (existing server), vanilla HTML/CSS/JS (no build step, no node deps — architecture §9), a ~40-line Firefox WebExtension (manifest v3, `chrome_url_overrides`), Playwright (existing in `.venv`) for render-tests. Optional `fonttools` if self-hosting the chosen typeface.

**Decision gates — CLOSED by Kenja (this session):**
- **G-N1 ✓** New-tab-as-front-door reconciles with G1 (ambient, not a destination). Terminal autostart + capture hotkey remain; the new-tab poster is an additional ambient surface.
- **G-N2 ✓** Redirector extension → `pkms serve` localhost URL (not bundled). Bundled-page is a later polish.
- **G-N3 ✓** Daily-edition mockup (`spike/visual-home-glm/`) retires/archives; new-tab becomes the canonical desktop frontend.

**Confirmed before planning (not assumed):**
- `capture_service.py` serves `TODAY_APP` as an **inline string literal** (no `static/` dir exists). Wiring the mockup requires either static-serving or inlining. → **Decision: extract to `src/pkms/web/`** (clean separation, survives edits, matches the mockup's 3-file structure). The string-literal pattern is retired.
- `test_capture_service.py:50` asserts `"/api/today" in body` and tests routing/auth — any served-HTML change must preserve the `/api/today` fetch path and token query-string convention.
- `make_server(vault, index_dir, host, port, token)` is the integration signature.
- Firefox native `browser.newtab.url` removed in FF41+ — extension using `chrome_url_overrides` is the supported path (MV2/MV3 identical). CONFIRMED via MDN.

**Baseline (recorded up front for "no regressions"):**
Run `.venv\Scripts\python.exe -m pytest tests -q` and capture pass/fail counts BEFORE Task 1. Expected baseline (from `build-plan.md` status: slices 1–6 shipped, slice 7 underway):
```
Recorded 2026-06-24: 145 passed, 0 failed, 0 errors (on branch `main`, pre-execution).
```
Re-run after each task; must not drop below 145.

---

## File Structure

```
src/pkms/
├── capture_service.py     ← MODIFY: serve /web/* statically; drop inline TODAY_APP string
├── web/                   ← NEW: the graduated mockup (static assets, served as-is)
│   ├── index.html         ← from spike/newtab-firefox/, <link>/<script> re-pointed to sibling files
│   ├── styles.css         ← from spike/, typeface tokens updated post Task 3
│   ├── app.js             ← from spike/, fetch('/api/today'+qs) replaces inlined fake data
│   ├── manifest.webmanifest   ← PWA manifest
│   ├── icon.svg           ← PWA icon
│   └── sw.js              ← NEW: minimal service worker (cache-first shell; outbox for captures)
├── web_ext/               ← NEW: the redirector Firefox extension (G-N2)
│   ├── manifest.json      ← chrome_url_overrides.newtab → newtab.html
│   ├── newtab.html        ← trivial redirector to the configured pkms serve URL
│   └── README.md          ← load-unpacked install + how to set the URL
└── (existing modules unchanged)

tests/
├── test_capture_service.py  ← MODIFY: assert static asset serving + /api/today still wired
├── test_web_assets.py       ← NEW: assets exist, non-empty, HTML references resolve
└── test_web_ext.py          ← NEW: extension manifest valid, newtab.html redirector sane

docs/
├── firefox-newtab-setup.md  ← NEW: load the extension, set the URL, token handling
└── superpowers/plans/2026-06-24-firefox-newtab-pivot.md  ← THIS FILE

# Retired (Task 1 archives, per G-N3):
spike/visual-home-glm/  →  spike/_archive/visual-home-glm/
```

**Responsibilities:** `web/` is purely static presentation + the `/api/today` fetch; `capture_service.py` only adds a static-file route and drops the inline string; `web_ext/` is a self-contained ~40-line redirector with no build step. No new backend logic, no vault/file changes (§9 — capture path sacred).

---

## Task 1: Graduate the mockup into `src/pkms/web/` (static assets)

**Files:**
- Create: `src/pkms/web/index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `icon.svg`
- Archive: move `spike/visual-home-glm/` → `spike/_archive/visual-home-glm/` (G-N3)
- Keep: `spike/newtab-firefox/` as the design provenance (don't delete — referenced by RATIONALE)

- [ ] **Step 1: Record the test baseline**

Run: `.venv\Scripts\python.exe -m pytest tests -q`
Record the pass/fail/error counts at the top of this plan ("Record here"). This is the no-regressions anchor.

- [ ] **Step 2: Copy the mockup assets into `src/pkms/web/`**

Copy `spike/newtab-firefox/{index.html,styles.css,app.js,manifest.webmanifest,icon.svg}` → `src/pkms/web/`. Keep the files byte-identical for now; Task 3 edits the typeface, Task 5 wires the fetch.

- [ ] **Step 3: Write the failing test for asset presence**

Create `tests/test_web_assets.py`:

```python
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
```

- [ ] **Step 4: Run the test — verify it fails (no web/ dir yet)**

Run: `.venv\Scripts\python.exe -m pytest tests/test_web_assets.py -q`
Expected: FAIL — `index.html missing from src/pkms/web/`.

- [ ] **Step 5: Copy the assets (Step 2 is the action)**

Copy the five files into `src/pkms/web/`. Confirm `test_assets_exist_and_nonempty` passes.

- [ ] **Step 6: Run the full asset test — verify PASS**

Run: `.venv\Scripts\python.exe -m pytest tests/test_web_assets.py -q`
Expected: PASS (3 tests).

- [ ] **Step 7: Archive the retired mockup (G-N3)**

Move `spike/visual-home-glm/` → `spike/_archive/visual-home-glm/`. Leave `spike/newtab-firefox/` in place (design provenance for RATIONALE).

```bash
git mv spike/visual-home-glm spike/_archive/visual-home-glm
```

- [ ] **Step 8: Verify no regression + commit**

Run: `.venv\Scripts\python.exe -m pytest tests -q`
Expected: pass count ≥ baseline (from Step 1). No new failures.

```bash
git add src/pkms/web/ tests/test_web_assets.py spike/_archive/visual-home-glm
git commit -m "feat(web): graduate new-tab mockup into src/pkms/web/ static assets"
```

---

## Task 2: Serve `web/` statically from `capture_service.py` (retire the inline string)

**Files:**
- Modify: `src/pkms/capture_service.py` (drop `TODAY_APP` string; add static-file route for `/web/*`; `/` redirects to `/web/`)
- Modify: `tests/test_capture_service.py` (update: `/` now 302→`/web/`; new tests for static assets + content-type)

- [ ] **Step 1: Write the failing tests**

In `tests/test_capture_service.py`, REPLACE the existing test that asserts the inline app is served, and ADD static-asset tests. The full new relevant section:

```python
def test_root_redirects_to_web(vault, index_dir, service):
    """The desktop front door is now /web/ (the new-tab poster); / 302-redirects there."""
    import urllib.request
    # service base is http://127.0.0.1:<port>/?token=... ; request / without following redirects
    base = service.rstrip("/api/today")  # adjust to whatever the fixture returns
    req = urllib.request.Request(service.split("/api/today")[0] + f"/?token={TOKEN}",
                                 method="GET")
    opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler)
    # We want the raw 302, so use a no-redirect opener:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k): return None
    opener = urllib.request.build_opener(NoRedirect)
    try:
        opener.open(req)
        assert False, "expected a 302 redirect"
    except urllib.error.HTTPError as e:
        assert e.code == 302
        assert e.headers["Location"].startswith("/web/")


def test_web_index_html_served(vault, index_dir, service):
    """GET /web/?token=... returns the new-tab poster HTML."""
    status, body, ctype = _get(f"{service.split('/api/today')[0]}/web/?token={TOKEN}")
    assert status == 200
    assert ctype == "text/html; charset=utf-8"
    assert "/api/today" in body  # the page still fetches its data from there
    assert "pkms" in body.lower()


def test_web_static_assets_served_with_correct_types(vault, index_dir, service):
    """styles.css, app.js, manifest.webmanifest, icon.svg serve with right content-types."""
    base = service.split("/api/today")[0]
    cases = [
        ("/web/styles.css", "text/css"),
        ("/web/app.js", "text/javascript"),
        ("/web/manifest.webmanifest", "application/manifest+json"),
        ("/web/icon.svg", "image/svg+xml"),
    ]
    for path, expected_ctype in cases:
        status, body, ctype = _get(f"{base}{path}?token={TOKEN}")
        assert status == 200, f"{path} returned {status}"
        assert ctype.startswith(expected_ctype), f"{path}: expected {expected_ctype}, got {ctype}"
        assert len(body) > 0
```

NOTE: the `_get` helper and `service` fixture already exist in the file — read it and align the `service.split('/api/today')[0]` base extraction to how the fixture builds the URL. If the fixture doesn't append `/api/today`, drop the `.split(...)` and use the fixture's base directly. **Inspect the existing fixture before finalizing this test code** — adapt, don't paste blindly.

- [ ] **Step 2: Run the tests — verify they fail**

Run: `.venv\Scripts\python.exe -m pytest tests/test_capture_service.py -q`
Expected: FAIL — `/` no longer returns the inline app (still does); static routes 404.

- [ ] **Step 3: Modify `capture_service.py` — add static serving + retire the string**

In `src/pkms/capture_service.py`:

(a) Delete the entire `TODAY_APP = r"""..."""` block (lines ~46–300) and the `CAPTURE_PAGE` string if it's superseded by `/web/` (keep `CAPTURE_PAGE` if `/capture-page` is still a documented side door — it is, per the docstring; leave it).

(b) Add a module-level constant pointing at the web dir, and a static-file helper. At the top, after the imports:

```python
WEB_DIR = Path(__file__).resolve().parent / "web"

# Content-type by extension for the static /web/* route.
_STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css":  "text/css; charset=utf-8",
    ".js":   "text/javascript; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg":  "image/svg+xml",
    ".png":  "image/png",
    ".ico":  "image/x-icon",
}
```

(c) In `do_GET`, REPLACE the `if path == "/": self._send(200, TODAY_APP, ...)` branch with a redirect, and ADD a `/web/` static handler. The new routing (token-gating preserved — `/web/*` is authed like `/`):

```python
def do_GET(self):
    path = urlparse(self.path).path
    if path == "/health":
        return self._send(200, "ok")
    if not self._authed():  # every surface below is token-gated
        return self._send(403, "token required")

    # Desktop front door: /  → 302 redirect to the new-tab poster at /web/
    if path == "/":
        self.send_response(302)
        # preserve the token query string on the redirect
        qs = urlparse(self.path).query
        loc = "/web/" + ("?" + qs if qs else "")
        self.send_header("Location", loc)
        self.end_headers()
        return

    # Static assets for the new-tab poster + PWA
    if path.startswith("/web/"):
        return self._serve_static(path)

    if path == "/capture-page":
        return self._send(200, CAPTURE_PAGE, "text/html; charset=utf-8")
    if path == "/api/today":
        from .today import today_view
        body = json.dumps(today_view(vault, index_dir))
        return self._send(200, body, "application/json; charset=utf-8")
    self._send(404, "not found")

def _serve_static(self, request_path: str) -> None:
    """Serve a file from WEB_DIR. Prevents path traversal; index.html for /web/."""
    # Strip /web/ prefix, normalize, reject traversal
    rel = request_path[len("/web/"):].lstrip("/")
    if rel == "":
        rel = "index.html"
    # Resolve and confirm the result is still inside WEB_DIR
    target = (WEB_DIR / rel).resolve()
    if not str(target).startswith(str(WEB_DIR.resolve())):
        return self._send(403, "forbidden")
    if not target.is_file():
        return self._send(404, "not found")
    ctype = _STATIC_TYPES.get(target.suffix.lower(), "application/octet-stream")
    data = target.read_bytes()
    self.send_response(200)
    self.send_header("Content-Type", ctype)
    self.send_header("Content-Length", str(len(data)))
    self.end_headers()
    self.wfile.write(data)
```

NOTE: `_serve_static` is a new method on `Handler`. The `vault`/`index_dir` closures in `make_server` remain available to `do_GET` as before — static serving doesn't need them. Add `_serve_static` as a method too (it uses `self`).

- [ ] **Step 4: Run the tests — verify PASS**

Run: `.venv\Scripts\python.exe -m pytest tests/test_capture_service.py -q`
Expected: PASS — `/` 302s, `/web/` serves HTML, static assets serve with correct types.

- [ ] **Step 5: Verify no regression + commit**

Run: `.venv\Scripts\Scripts\python.exe -m pytest tests -q`
Expected: pass count ≥ baseline. (The old "inline app served" test was REPLACED in Step 1, not deleted silently — that's the only intentional change.)

```bash
git add src/pkms/capture_service.py tests/test_capture_service.py
git commit -m "feat(serve): serve src/pkms/web/ statically; retire inline TODAY_APP string"
```

---

## Task 3: Typeface selection — DELEGATE research + scale to a local LLM

This task is a high-volume, specifiable generation pass (research + a type-scale CSS block) — exactly the net-savings case from `local-llm-delegation`. The spec is tight; the review is cheap (read a markdown rec + a CSS block, cross-check feasibility). **Do NOT delegate the integration** — the cloud model applies + verifies the chosen tokens.

**Files:**
- Create: `spike/newtab-firefox/TYPEFACE-RESEARCH.md` (local-LLM output, reviewed)
- Modify: `src/pkms/web/styles.css` (the `:root` type tokens — applied + verified by the cloud model)

**MCP usage note:** this task uses `delegate_to_local_llm` (the local-llm-bridge MCP) ONCE. No web search, no other MCP calls — the local model does the research legwork from its training; the cloud model verifies feasibility by checking self-hosting/CDN availability only if a candidate is shortlisted. This is the quota-preserving path.

- [ ] **Step 1: Write the delegation spec**

Use `delegate_to_local_llm` with model `gpt-oss-20b` (the default all-rounder; near-cloud quality acceptable here). System prompt requests COMPLETE REPLACEMENT-style output under headings (no diffs). The `user_message` is self-contained (local LLM has no history):

```
You are a typography consultant for a personal-knowledge app's new-tab page.
The current design uses Fraunces (serif display) + Inter (humanist sans) +
JetBrains Mono, loaded from Google Fonts. The aesthetic is "authored morning
briefing on warm cream paper" — editorial, calm, single ochre accent, one loud
moment reserved for completion. It is deliberately NOT a Momentum/dashboard
look. Constraints:
- The page loads on EVERY new tab, so web-font payload matters (perceived load).
- Must degrade gracefully offline (system-font CSS stacks as fallback).
- Distinctive > trendy; this should feel designed, not generic.

The user feels the current typeface selection "needs work" but gave no specifics.

Produce, under explicit headings:

### 1. Diagnosis
What's likely weak about Fraunces+Inter+JetBrains Mono for THIS use (3-5 bullets,
concrete — not generic type advice). Consider: does Inter read as "default SaaS"
and undercut the editorial intent? Is Fraunces's optical-size axis doing work
here or is it flourish?

### 2. Three candidate pairings
For each: serif display + body sans + mono. Name exact families available on
Google Fonts OR via open-source self-host (no proprietary/licensed faces).
One paragraph each on WHY it fits the editorial-briefing aesthetic, and the
trade-off vs the current set. Prefer pairings where the serif has real
personality and the sans is NOT Inter/Roboto/system-default.

### 3. Recommendation
Pick ONE pairing. Give a one-line rationale.

### 4. CSS type-scale block
A complete `:root { ... }` block defining --serif, --sans, --mono families
(with full fallback stacks) and a fluid type-scale (--step--1 through --step-5)
using clamp(). The scale should make a re-entry lede the largest element on the
page (the glance anchor) at a max ~5rem on wide viewports, stepping down on
narrow. Match the existing --step variable names so it's a drop-in replacement.

No prose outside the four headings. Be concrete and opinionated.
```

- [ ] **Step 2: Run the delegation + save the raw output**

Delegate, then write the result verbatim to `spike/newtab-firefox/TYPEFACE-RESEARCH.md` with a header noting model + date + that it's pre-review. (This is design provenance; keep it even after integrating.)

- [ ] **Step 3: Review the output (the orchestrator's job — per the skill)**

Read the rec. Apply the skill's general review:
- Does the recommended pairing's families actually exist on Google Fonts / open-source? **If a name looks off, verify with ONE web search** (the only MCP/web call in this task) — e.g. confirm the family is self-hostable.
- Is the CSS type-scale's `clamp()` math sound (no division by viewport in a way that breaks at 0)? Are the `--step` names exactly `--step--1, --step-0, --step-1..5`?
- Does the diagnosis actually engage the brief, or is it generic? Reject and re-pick if generic.

- [ ] **Step 4: Apply the chosen type tokens to `src/pkms/web/styles.css`**

In `src/pkms/web/styles.css`, REPLACE the `--serif`/`--sans`/`--mono` and `--step-*` lines in the `:root` block with the reviewed values. If the rec changed the Google Fonts `<link>` URL, update `index.html`'s `<link href="...fonts.googleapis.com...">` to match. Update `spike/newtab-firefox/styles.css` and `index.html` in parallel (keep mockup and live in sync — provenance).

- [ ] **Step 5: Render-test the new typeface**

Run the screenshot script (already exists at `spike/newtab-firefox/_shots.py`):

```bash
.venv\Scripts\python.exe -u spike\newtab-firefox\_shots.py
```

Read `spike/newtab-firefox/_shots/desktop-today-calm.png` and `mobile-today-calm.png`. Confirm: the lede is still the largest element, the lead action is legible, nothing overflows, offline fallback (if you block the fonts CDN in a second pass) still reads acceptably.

- [ ] **Step 6: Commit**

```bash
git add src/pkms/web/styles.css src/pkms/web/index.html spike/newtab-firefox/TYPEFACE-RESEARCH.md spike/newtab-firefox/styles.css spike/newtab-firefox/index.html
git commit -m "feat(web): adopt reviewed typeface pairing (local-LLM-delegated research)"
```

---

## Task 4: Wire the page to live `/api/today` (replace inlined fake data)

**Files:**
- Modify: `src/pkms/web/app.js` (replace the inlined `TODAY`/`MORE_ACTIONS`/`RECOGNITION_CARDS`/`READING_QUEUE`/`PEBBLES`/`RECENT_NOTES` constants with a `fetch('/api/today'+location.search)` load; keep the render functions)
- Modify: `src/pkms/web/index.html` (add a loading/error affordance)

- [ ] **Step 1: Write the failing test for live data wiring**

Add to `tests/test_capture_service.py`:

```python
def test_web_app_js_fetches_api_today(vault, index_dir, service):
    """app.js must fetch /api/today (live data), not rely on inlined fake JSON."""
    base = service.split("/api/today")[0]
    status, body, _ = _get(f"{base}/web/app.js?token={TOKEN}")
    assert status == 200
    assert "fetch(" in body and "/api/today" in body
    # the inlined fake-data constants must be gone (they were a mockup-only artifact)
    assert "inbox_new: 3" not in body, "app.js still has inlined fake data"
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `.venv\Scripts\python.exe -m pytest tests/test_capture_service.py::test_web_app_js_fetches_api_today -q`
Expected: FAIL — `app.js` still has `inbox_new: 3`.

- [ ] **Step 3: Rewrite `app.js` to fetch live data**

In `src/pkms/web/app.js`, the structure changes: the data constants (lines ~22–237 in the spike) are removed; a single `loadToday()` fetch replaces them. The render functions stay identical (they already consume the `/api/today` shape). Replace the DATA section and add the load. Concretely — REPLACE the `/* 1. FAKE DATA */` block through the end of the `RECENT_NOTES` const with:

```javascript
  /* ---------------------------------------------------------------------------
     1. LIVE DATA — fetched from /api/today (the app's only data source).
     Token rides in location.search (?token=…). The shape is the exact contract
     from today.py:172-184; the mockup's inlined fake JSON is removed.
     Overflow actions, recognition cards, reading queue, pebbles, recent notes
     are proposed endpoints (see DATA-CONTRACT.md) — for now, derive what we can
     from /api/today and leave the optional surfaces empty until those ship.
     --------------------------------------------------------------------------- */
  let TODAY = null;          // populated by loadToday()
  const MORE_ACTIONS = [];   // populated when /api/next-actions ships (empty for now)
  const RECOGNITION_CARDS = [];
  const READING_QUEUE = [];
  const PEBBLES = { count: 0, goal: null, entries: [] };
  const RECENT_NOTES = [];

  async function loadToday() {
    try {
      const r = await fetch("/api/today" + location.search, {
        headers: { Accept: "application/json" },
      });
      if (r.status === 403) return showError("token required — open with ?token=…");
      if (!r.ok) return showError("couldn't load today (" + r.status + ")");
      TODAY = await r.json();
      // pebbles derive from done_today until /api/pebbles ships
      PEBBLES.count = TODAY.done_today || 0;
      state.loaded = true;
      if (state.route === "today") renderToday();
    } catch (e) {
      showError("couldn't reach the service — is `pkms serve` running?");
    }
  }

  function showError(msg) {
    const el = document.getElementById("error-banner");
    if (el) { el.textContent = msg; el.hidden = false; }
  }
```

And add a guard to `renderToday()` so it no-ops if `TODAY` is null (data not yet loaded):

```javascript
  function renderToday() {
    if (!TODAY) return;  // loadToday() will call renderToday() once data arrives
    // ... existing body unchanged
  }
```

Update `init()` to call `loadToday()`:

```javascript
  function init() {
    wire();
    router();
    loadToday();   // fetch live data; re-renders today when it lands
  }
```

Add the error banner to `index.html`, just inside `<section data-surface="today">` before the `poster-body`:

```html
<p class="error-banner" id="error-banner" hidden></p>
```

And in `styles.css` add:

```css
.error-banner {
  font-family: var(--mono);
  font-size: var(--step--1);
  color: var(--ochre-deep);
  background: var(--ochre-wash);
  padding: 0.6rem 0.9rem;
  border-radius: var(--radius-soft);
  margin-bottom: var(--block-gap);
}
```

- [ ] **Step 4: Run the test — verify PASS**

Run: `.venv\Scripts\python.exe -m pytest tests/test_capture_service.py::test_web_app_js_fetches_api_today -q`
Expected: PASS.

- [ ] **Step 5: End-to-end manual check**

Restart the capture service (the startup shortcut, or `.venv\Scripts\python.exe -m pkms.cli serve`). Open `http://localhost:8765/web/?token=<token>` in Firefox. Confirm: the lede renders with the real breadcrumb, the lead action shows a real next-action, the fold-in shows the real inbox count. (The recognition rail / actions list will be sparse until those proposed endpoints ship — that's expected and fine; calm mode is the default.)

- [ ] **Step 6: Verify no regression + commit**

Run: `.venv\Scripts\python.exe -m pytest tests -q`
Expected: pass count ≥ baseline.

```bash
git add src/pkms/web/app.js src/pkms/web/index.html src/pkms/web/styles.css tests/test_capture_service.py
git commit -m "feat(web): wire app.js to live /api/today (drop inlined fake data)"
```

---

## Task 5: The redirector Firefox extension (G-N2)

A ~40-line WebExtension that overrides the new tab with a redirect to the configured `pkms serve` URL. No bundled page, no build step.

**Files:**
- Create: `src/pkms/web_ext/manifest.json`, `newtab.html`, `README.md`
- Create: `tests/test_web_ext.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_web_ext.py`:

```python
"""The redirector Firefox extension: valid manifest, sane redirector."""
import json
from pathlib import Path

EXT = Path(__file__).resolve().parents[1] / "src" / "pkms" / "web_ext"


def test_manifest_is_valid_mv3_with_newtab_override():
    m = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
    assert m["manifest_version"] == 3
    assert m["chrome_url_overrides"]["newtab"] == "newtab.html"
    assert "name" in m and "version" in m


def test_newtab_html_is_a_redirector():
    """newtab.html must redirect to the configured pkms serve URL via JS."""
    html = (EXT / "newtab.html").read_text(encoding="utf-8")
    assert "location.replace" in html or "location.href" in html
    # it must read the target from extension storage (not hardcoded localhost)
    assert "browser.storage" in html or "chrome.storage" in html


def test_ext_readme_documents_install():
    """The README must explain load-unpacked install + setting the URL."""
    readme = (EXT / "README.md").read_text(encoding="utf-8")
    assert "load" in readme.lower() and "unpacked" in readme.lower()
    assert "storage" in readme.lower() or "url" in readme.lower()
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `.venv\Scripts\python.exe -m pytest tests/test_web_ext.py -q`
Expected: FAIL — files don't exist.

- [ ] **Step 3: Create the extension files**

`src/pkms/web_ext/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "PKMS new-tab",
  "version": "0.1.0",
  "description": "Opens the PKMS today-view (pkms serve) as the Firefox new-tab page.",
  "chrome_url_overrides": {
    "newtab": "newtab.html"
  },
  "permissions": ["storage"],
  "browser_specific_settings": {
    "gecko": {
      "id": "pkms-newtab@localhost"
    }
  }
}
```

`src/pkms/web_ext/newtab.html` — a redirector that reads the target URL (with token) from extension storage, falling back to a placeholder if unset:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>pkms</title>
<style>
  body { font-family: -apple-system, Segoe UI, sans-serif; background: #f6f1e8;
         color: #5c534a; display: flex; align-items: center; justify-content: center;
         height: 100vh; margin: 0; text-align: center; }
  .hint { font-size: 0.9rem; max-width: 24rem; padding: 0 1rem; }
  code { background: #efe8da; padding: 0.1rem 0.4rem; border-radius: 3px; }
</style>
</head>
<body>
<div class="hint" id="hint">opening pkms…</div>
<script src="newtab.js"></script>
</body>
</html>
```

`src/pkms/web_ext/newtab.js`:

```javascript
// Redirector (G-N2): open the configured pkms serve URL as the new tab.
// The URL (with ?token=…) is stored in extension storage; set it from the
// extension's options page or by running the snippet in the README.
const DEFAULT_URL = "http://localhost:8765/web/";

(async () => {
  const api = (typeof browser !== "undefined") ? browser : chrome;
  try {
    const { pkmsUrl } = await api.storage.local.get("pkmsUrl");
    const target = pkmsUrl || DEFAULT_URL;
    location.replace(target);
  } catch (e) {
    document.getElementById("hint").innerHTML =
      "set your pkms URL in the extension options, then open a new tab.";
  }
})();
```

Update `test_web_ext.py`'s redirector test if needed (it checks `newtab.html` for `location.replace` — but that's now in `newtab.js`; either move the assertion to read `newtab.js`, or reference both. **Fix the test to read `newtab.js` for the `location.replace` + `storage` checks**, and keep the `newtab.html` check minimal — that it references `newtab.js`.):

```python
def test_newtab_redirector_uses_storage():
    js = (EXT / "newtab.js").read_text(encoding="utf-8")
    assert "location.replace" in js
    assert "storage.local" in js
```

`src/pkms/web_ext/README.md`:

```markdown
# PKMS new-tab redirector (Firefox)

Overrides the Firefox new-tab page with your running `pkms serve` instance.

## Install (load unpacked — temporary, no signing needed)

1. Ensure `pkms serve` is running (the startup shortcut, or `pkms serve`).
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **"This Firefox" → Load Temporary Add-on…**
4. Select `src/pkms/web_ext/manifest.json`.

New tabs now open the PKMS today-view.

## Set the URL (with token)

The redirector reads `pkmsUrl` from extension local storage. Set it once by
opening the Browser Console (Ctrl+Shift+J) on any page and running:

```js
browser.storage.local.set({ pkmsUrl: "http://localhost:8765/web/?token=YOUR_TOKEN" })
```

(For a tailnet/remote host, use that URL instead. The token is required by
`pkms serve` — find it in `.secrets/capture-token`.)

Without a stored URL, new tabs fall back to `http://localhost:8765/web/` and
will hit the token-required page until you set one.
```

- [ ] **Step 4: Run the tests — verify PASS**

Run: `.venv\Scripts\python.exe -m pytest tests/test_web_ext.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pkms/web_ext/ tests/test_web_ext.py
git commit -m "feat(ext): Firefox new-tab redirector → pkms serve (G-N2)"
```

---

## Task 6: Mobile PWA hardening (manifest + minimal service worker)

The page already reflows responsively (Task 1 carried the `@media` breakpoint) and is installable via the manifest (Task 1). This task adds the minimal service worker for an offline shell + queued-capture outbox, honoring §9 (sync never load-bearing for correctness).

**Files:**
- Create: `src/pkms/web/sw.js`
- Modify: `src/pkms/web/index.html` (register the SW)
- Modify: `tests/test_web_assets.py` (assert SW exists + is registered)

- [ ] **Step 1: Write the failing test**

Add to `tests/test_web_assets.py`:

```python
def test_service_worker_exists_and_registered():
    """sw.js exists and index.html registers it (PWA offline shell)."""
    sw = WEB / "sw.js"
    assert sw.exists() and sw.stat().st_size > 0
    html = (WEB / "index.html").read_text(encoding="utf-8")
    assert "serviceWorker" in html and "sw.js" in html
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `.venv\Scripts\python.exe -m pytest tests/test_web_assets.py::test_service_worker_exists_and_registered -q`
Expected: FAIL — no `sw.js`.

- [ ] **Step 3: Create the service worker**

`src/pkms/web/sw.js` — cache-first for the shell (so the new-tab page loads instantly even offline), network for `/api/today`:

```javascript
// Minimal service worker for the PKMS new-tab/PWA shell.
// Strategy: cache-first for static assets (instant tab-open, works offline),
// network-only for /api/today (always-fresh data; if offline, the page shows
// its error banner — sync is never load-bearing for correctness, §9).
const CACHE = "pkms-shell-v1";
const SHELL = [
  "/web/",
  "/web/index.html",
  "/web/styles.css",
  "/web/app.js",
  "/web/manifest.webmanifest",
  "/web/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never cache the live data endpoint or capture POSTs.
  if (url.pathname.startsWith("/api/") || e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      // cache newly-fetched static assets opportunistically
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match("/web/index.html")))
  );
});
```

Register it in `index.html` — add before the closing `</body>`:

```html
<script>
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
</script>
```

- [ ] **Step 4: Run the test — verify PASS**

Run: `.venv\Scripts\python.exe -m pytest tests/test_web_assets.py -q`
Expected: PASS (all asset tests including the new SW test).

- [ ] **Step 5: Verify no regression + commit**

Run: `.venv\Scripts\python.exe -m pytest tests -q`
Expected: pass count ≥ baseline.

```bash
git add src/pkms/web/sw.js src/pkms/web/index.html tests/test_web_assets.py
git commit -m "feat(web): PWA service worker (offline shell; /api/today stays network)"
```

---

## Task 7: Setup doc + final verification

**Files:**
- Create: `docs/firefox-newtab-setup.md`

- [ ] **Step 1: Write the setup doc**

`docs/firefox-newtab-setup.md`:

```markdown
# Firefox new-tab setup (PKMS desktop front door)

The PKMS today-view lives as your Firefox new-tab page — an ambient briefing
seen on every tab-open. This doc sets it up.

## Prerequisites

- `pkms serve` running (the "PKMS capture service" startup shortcut handles this).
- Your capture token in `.secrets/capture-token`.

## 1. Load the redirector extension

See `src/pkms/web_ext/README.md` — load `manifest.json` as a temporary add-on
via `about:debugging`. (For a permanent install, sign it through AMO or use an
unsigned dev build in Firefox Developer Edition.)

## 2. Set the URL

In the Browser Console (Ctrl+Shift+J):

```js
browser.storage.local.set({ pkmsUrl: "http://localhost:8765/web/?token=YOUR_TOKEN" })
```

Open a new tab. You should see the today-view poster.

## Mobile (Pixel 6, over tailnet)

The same page is the PWA. Browse to `http://<tailnet-host>:8765/web/?token=…` on
the phone, then **"Add to Home Screen"** in Firefox — it installs as a standalone
app with the offline shell.

## Troubleshooting

- **"token required"** — the stored `pkmsUrl` is missing `?token=…`. Re-run the
  storage snippet with the full URL.
- **Blank tab / redirect loop** — `pkms serve` isn't running, or the URL is wrong.
  Check `http://localhost:8765/health`.
- **Stale data after a capture** — the page re-fetches `/api/today` on save; if it
  doesn't, hard-refresh once (the SW may be serving a cached shell — that's the
  static shell only; data is always fetched live).
```

- [ ] **Step 2: Final full-suite verification**

Run: `.venv\Scripts\python.exe -m pytest tests -q`
Expected: pass count ≥ baseline recorded in Task 1 Step 1. Diff any changed counts; confirm they're intentional (the old inline-app test was replaced, not regressed).

- [ ] **Step 3: Render-test the live page**

Restart `pkms serve`. Re-run `spike\newtab-firefox\_shots.py` but point it at the served URL (edit the `URL` var to `http://localhost:8765/web/?token=…` temporarily, or open the page in Firefox and screenshot manually). Confirm the poster renders with real data and the chosen typeface.

- [ ] **Step 4: Commit**

```bash
git add docs/firefox-newtab-setup.md
git commit -m "docs: Firefox new-tab setup guide"
```

---

## Self-Review (run after writing, before handoff)

**1. Spec coverage:**
- Pivot the desktop view to Firefox new-tab → Tasks 1, 2, 5 ✓
- Mobile PWA view preserved → Tasks 1 (responsive), 6 (SW/installable) ✓
- Incorporate existing research → RATIONALE.md (done in spike), build-plan reference ✓
- Look at projects online for inspiration → done pre-plan (Momentum/Bonjourr/Tabliss surveyed, none inherited) ✓
- Mockups produced → `spike/newtab-firefox/` (done pre-plan) ✓
- Typeface selection (user's note) → Task 3 (local-LLM delegated) ✓
- Local LLM delegation incorporated → Task 3 ✓
- Minimize MCP usage → only one `delegate_to_local_llm` call (Task 3) + optional one web search for typeface verification; no other MCP ✓

**2. Placeholder scan:** No "TBD"/"TODO"/"fill in". Two places carry an explicit "inspect the existing fixture before finalizing" / "fix the test to read newtab.js" instruction — these are *directed adaptations* (the plan can't see the fixture's exact URL shape without running the test), not placeholders. Both name the exact change to make.

**3. Type consistency:** `make_server(vault, index_dir, host, port, token)` used consistently. `_get(status, body, ctype)` helper referenced consistently in `test_capture_service.py`. `WEB_DIR` / `_STATIC_TYPES` / `_serve_static` defined in Task 2 Step 3, referenced in Tasks 4/6. `pkmsUrl` storage key consistent across Task 5's `newtab.js` + README + Task 7's setup doc.

**4. Decisions gates closed:** G-N1/N2/N3 all ✓ (Kenja, this session). The Firefox FF41+/`chrome_url_overrides` fact is CONFIRMED (MDN), not assumed.
