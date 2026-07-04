# Fable UI/UX Redesign Brief

> Executor = **Fable 5** (the MODEL). You read this, you build.
> This brief written caveman-terse ON PURPOSE. Paths / selectors / tokens /
> commands are VERBATIM — copy exact, no paraphrase.
>
> **Guardrail + NO-TOUCH lines are full English on purpose. Do not compress them.
> Do not "read past" a negation.**

---

## 0. NAMING — read twice, do not confuse

- **"Fable 5" = you, the executor model.** Nobody is deleting you.
- **"Fable" / "Log Book II" = the app's CURRENT visual DESIGN language** (warm
  paper, ochre accent, Cormorant serif). This is the DESIGN you are authorized to
  REINVENT and SUPERSEDE.
- So: "kill Fable" in this doc = **replace the Log Book II look**, NEVER the model.
- This is a **BOLD** redesign. New visual language allowed. New layout allowed.
  New palette / type / motion allowed. You do NOT have to keep the current tokens
  or components.

---

## 1. MISSION

- Boldly redesign PKMS front end. New tab / PWA poster. Reinvent, don't refresh.
- Mobile-FIRST: Chrome on Android, **Pixel-6 viewport**, PWA standalone.
- Result must stay **cohesive, intentional, accessible** — strong point of view,
  NOT defaults, NOT AI-slop.
- **Front end ONLY.** Markup / CSS / JS. Zero backend behavior change.

---

## 2. OUTPUT LANGUAGE — hard rule

- **This brief** = caveman. **YOUR OWN output = normal readable English.**
- Design-direction proposals, working notes, reports, commit messages, PR text:
  **plain professional English. NOT caveman.** No exceptions.

---

## 3. RECON FIRST — read before you touch anything

Read, in order:

1. `DESIGN.md` — current design system + anti-patterns.
2. `PRODUCT.md` — who/why. ADHD-shaped single user (Kenja).
3. `README.md` — app shape, commands, Firefox setup.
4. `AGENTS.md` — repo rules.
5. `K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md` — **the cross-surface
   ADHD design language. Single source of truth. Reference by path, never copy.**
   This governs COPY + BEHAVIOR even when you throw out the visuals.
6. Current front end: `src/pkms/web/index.html`, `src/pkms/web/styles.css`,
   `src/pkms/web/app.js`, `src/pkms/web/sw.js`.

Then **invoke the project skill `frontend-design`** and use it for taste/craft.
Bold ≠ random. Bold = DELIBERATE + cohesive. No generic templated AI look
(no default cream+serif+terracotta, no black+acid-green, no hairline-broadsheet —
unless you *choose* it and justify it against THIS brief).

---

## 4. REALITY CHECK — the tasking had stale paths. Use THESE real ones.

The launching instructions named some paths/harnesses that **DO NOT EXIST in this
repo.** Corrected map (verified on disk):

| Stale (ignore)                        | REAL (use)                                            |
| ------------------------------------- | ----------------------------------------------------- |
| `src/content_hoarder/static/**`       | `src/pkms/web/**`                                     |
| `src/content_hoarder/templates/**`    | (none — no Jinja templates; static HTML shell)        |
| `tests/ui/` + `pytest -m ui` Playwright| (none — no `ui` marker, no Playwright installed)      |
| `static/icons.js`                     | (none — icons = inline unicode glyphs + `icon.svg`)   |

- Front end is **static** (`index.html` + ES-module `app.js` + `styles.css`),
  NOT Flask templates. Flask only serves + provides `/api/*`.
- No build step. No npm. Vanilla JS. Keep it that way.

---

## 5. DESIGN MANDATE — GO BIG, but DIRECTED

**Step A — PROPOSE (before any mass edit):**

- Write **2–3 distinct design directions.** Short. Each: name, one-line thesis,
  palette (4–6 named hex), type pairing (display + body + utility/mono), layout
  concept (1–2 sentences + tiny ASCII wireframe), the ONE signature element.
- Say what makes each NOT the generic AI default.
- **Pick ONE. Justify the pick** against ADHD-single-user + mobile-first + the
  design language. Then build that one.

**Step B — BUILD the chosen direction.** Cohesive. Spend boldness in ONE place
(the signature); keep everything else quiet + disciplined.

You MAY replace: palette, type scale, layout paradigm, motion language, component
shapes, the current tokens (`--ground`, `--ochre`, `--sage`, `--celebrate`,
`--serif`/`--sans`/`--mono`, `--step-*`, etc.). Reinvent freely.

---

## 6. KEEP — these constraints survive the redesign (design language, not style)

These are NOT the "Log Book II look." They are ADHD-design-language bindings.
Bold visuals must still honor them:

- **NO red for normal task/backlog/overdue states.** Red only for a true
  destructive/error state. Self-imposed tasks never get urgency-red.
- **No backlog shame:** no raw unread counts, no overdue badges, no streaks, no
  "you haven't…" copy. Counts (if any) are curated + framed as progress. Empty
  states are rewards, not failures.
- **One next action** surfaced, not a task wall. **Recognition over recall.**
- **Capture is sacred:** fast, focused, feed-free, zero filing decisions,
  instant confirmation.
- **One ambient prompt at a time** (one resurface question max).
- **Calm is default; density is opt-in** (the one sanctioned personalization).
- Copy: plain, humane, sentence case, active voice, welcomes lapses. No
  motivational-productivity theater. No Momentum idioms (hero clock / greeting /
  focus word / photo bg).
- **NO AI-generated art or icons. This constraint STAYS.** Human-made assets only,
  credited. **Tabler Icons (MIT) allowed.** Keep an app icon at `icon.svg`.
- Accessibility floor: **WCAG AA contrast** for body + controls; visible keyboard
  focus; large tap targets; **honor `prefers-reduced-motion`**; **no color-only
  state**; keyboard-reachable capture + nav.

---

## 7. WRITE SCOPE — you may edit ONLY these

```
src/pkms/web/**          # source shell: index.html, styles.css, app.js, sw.js,
                         #   manifest.webmanifest, icon.svg
src/pkms/web_ext/**      # packaged Firefox extension copy (see §9 sync rule):
                         #   newtab.html, styles.css, app.js, icon.svg,
                         #   manifest.json, options/**
tests/test_web_*.py      # + tests/test_recognition_cards.py — update string-coupled
                         #   assertions to the NEW DOM (see §11). Preserve each
                         #   test's underlying contract; do NOT delete a test to
                         #   make it pass.
docs/redesign/**         # your proposals / notes / report
```

Nothing else. Markup / CSS / JS only.

---

## 8. NO-TOUCH — never modify, never point a command at, never print secret values

**Full English. Absolute.**

- `data/app.db`, `data/media/`, `data/*.backup-*.db`, `data/*audit*.jsonl` — do
  not read-dump, edit, move, or delete. (Note: this repo actually keeps state in
  `vault/` + `.index/pkms.db` + `.secrets/`. Treat ALL of those as NO-TOUCH too:
  `vault/**`, `.index/**`, `.secrets/**`.)
- `.env`, `nsfw_rules.json`, `.venv/` — do not modify. Do not print secret values.
- **Backend is off-limits:** do NOT change backend behavior, DB schema, API
  routes/contracts, connectors, `pipeline.py`, or CLI semantics. Specifically do
  not edit `src/pkms/*.py` (e.g. `today.py`, `capture_service.py`, `cli.py`,
  `db.py`, `indexer.py`). Front-end files only.
- If a redesign seems to *need* a backend change — **STOP and ask.** Do not
  quietly widen scope.

---

## 9. web ↔ web_ext SYNC — exact, do not improvise

`src/pkms/web/` is the SOURCE. `src/pkms/web_ext/` is a PACKAGED COPY. Verified
current relationship (keep it byte-exact):

- `web_ext/app.js`   is **byte-identical** to `web/app.js`.
- `web_ext/styles.css` is **byte-identical** to `web/styles.css`.
- `web_ext/icon.svg`  matches `web/icon.svg`.
- `web_ext/newtab.html` = `web/index.html` **MINUS two blocks only**:
  1. the `<link rel="manifest" href="manifest.webmanifest">` line, and
  2. the inline `<script>…navigator.serviceWorker.register("sw.js")…</script>`.
  Everything else identical.
- `web_ext/` extra files you do NOT delete: `manifest.json` (MV3),
  `options/options.html`, `options/options.js`, `options/options.css`,
  `README.md`.

**After every front-end edit:** re-copy `app.js` + `styles.css` + `icon.svg`
verbatim into `web_ext/`, and regenerate `newtab.html` from `index.html` minus the
two blocks above. Test `tests/test_web_ext.py` enforces MV3 + token behavior —
keep it green.

---

## 10. CONTRACTS — restyle freely, but DO NOT rename/break these

The DOM structure changes a lot. These wires underneath must stay:

**API endpoints (do not rename, do not change request/response field names):**
`/api/today`, `/api/next-actions`, `/api/pebbles`, `/api/reading-queue`,
`/api/recognition-cards`, `/api/open-note`, `/api/resurface`.
`/api/today` is the required core payload (fields verified against `today.py`).
`/api/*` is network-only (never cached).

**Resurface POST (keep exact):** button POSTs to `/api/resurface`,
`method: "POST"`, body `JSON.stringify({ path: card.path, action: kind })`,
BEFORE hiding the card.

**Token mechanism (keep both modes):**
- Served PWA reads token from `location.search` (`?token=…`).
- Extension sends header **`X-Capture-Token`** + reads storage keys
  `pkmsBaseUrl`, `pkmsToken`; options page stores `pkms-url`.
- `app.js` branches on `extensionApi()` — keep that dual path working.

**Lead action semantics (keep):** primary lead action = **open/continue context**
(`openNote(lead.note)`), NOT mark-done. Do not wire it to `toggleDone`.

**Empty-state guard (keep):** `ledeText()` must guard the empty
`next_actions: []` case (`if (!action)`) BEFORE any `action.title` dereference.
`/api/today` legitimately returns `next_actions: []` (fresh install / cleared /
weekend). Half-render regression must not return.

**Auxiliary surfaces must stay LIVE**, not mock arrays: reading + recognition load
from `/api/reading-queue` + `/api/recognition-cards`. Do not reintroduce
`const READING_QUEUE = []` / `const RECOGNITION_CARDS = []` empty stubs.

**Service worker (keep offline shell):** `index.html` still registers `sw.js`.
`/api/` + non-GET stay network-only.

---

## 11. TESTS ARE STRING-COUPLED — update, don't gut

These plain-pytest tests assert **literal strings from the CURRENT DOM/JS.** Your
redesign WILL break them. Rule: **re-point each assertion to the NEW design while
preserving the behavioral contract it guards.** Never delete a test to go green.

Known couplings to fix (non-exhaustive — run the suite, read failures):

- `tests/test_web_assets.py`
  - asserts strings: `"PKMS command desk"`, `class="nav-search"`,
    `"find a note, capture a thought"`, `const navSearch`,
    `location.hash = "#search"`, `"read next"`, `id="next-read"`,
    `function renderNextRead()`, `READING_QUEUE[0] || TODAY.next_read`.
    → If you rename/replace these UI parts, update the assertions to the new names
      **but keep the capability** (a search/command ramp exists; reading shows as
      one glanceable item; etc.).
  - asserts `if (!action)` precedes `action.title` → keep the guard (§10).
  - asserts `/api/reading-queue`, `/api/recognition-cards`, `/api/resurface`,
    exact resurface `JSON.stringify(...)`, `openNote(lead.note)` not `toggleDone`
    → these are CONTRACTS (§10). Do not "fix" by weakening them.
  - asserts assets exist + non-empty + local refs resolve + manifest links
    `icon.svg` + SW registered → keep all true.
- `tests/test_web_ext.py` — MV3 manifest, `newtab.html` loads packaged assets,
  `X-Capture-Token`, `pkmsBaseUrl`/`pkmsToken`, options page. Keep green via §9.
- Also review: `tests/test_web_api_surfaces.py`,
  `tests/test_web_capture_contract.py`, `tests/test_web_resurface_actions.py`,
  `tests/test_recognition_cards.py`. Update UI-string assertions; preserve
  contracts.

**ADD tests** for genuinely new/changed UI behaviors you introduce.

---

## 12. SERVICE-WORKER CACHE BUMP — required so users don't get stale UI

DOM/asset structure changes a lot. In `src/pkms/web/sw.js`:

- Bump the cache version: `const CACHE = "pkms-shell-v1"` → `"pkms-shell-v2"`
  (increment each shippable redesign chunk if assets change again).
- If you rename/add/remove shell asset files, update the `SHELL = [...]` array to
  match the new filenames (currently lists `/web/`, `/web/index.html`,
  `/web/styles.css`, `/web/app.js`, `/web/manifest.webmanifest`, `/web/icon.svg`).
- Keep the strategy: stale-while-revalidate for shell; `/api/` + non-GET stay
  network-only. Do not cache live data.

Wrong/absent bump = users stuck on stale-cached old UI. Get this right.

---

## 13. INTERACTION MODEL — restyle OK, must keep working

Preserve these EXISTING interactions (current build uses click + keyboard +
hash-routing; there are no touch-gesture handlers today):

- Hash-route nav between surfaces: `#today`, `#capture`, `#reading`, `#actions`,
  `#search`.
- Capture save: **Ctrl/Cmd+Enter**. **Esc** clears.
- Density toggle: `body.density-calm`, buttons `data-density="calm|more|
  everything"` with `aria-pressed`; `.block--optional` hidden in calm.
- Undo toast (save / let-go / done-toggle), `aria-live="polite"`.
- Resurface actions cheap + guilt-free (not now / let go / undo).

The tasking mentions a **swipe + long-press** model. It is **not implemented in
`app.js` today.** So: do NOT claim to preserve a gesture layer that isn't there.
IF you add mobile gestures (swipe / long-press), then:
- they must NOT regress the existing click + keyboard paths (those stay fully
  usable), and
- they must respect **Android gesture-nav deadzones** (screen edges) — do not put
  a critical swipe target where the OS back-gesture eats it.

**Do not break:** PWA install/offline behavior; keyboard/desktop action clusters;
capture speed.

---

## 14. NEVER-RUN — destructive / network CLI (full English)

Do **not** run any of these, and do not point a command at NO-TOUCH paths:

`delete`, `reddit-unsave` / `--drain`, `archive-media --apply`,
`scan-media --apply`, `purge-done`, `decay --apply`, `bankruptcy --apply`,
`reddit-sync`, `hn-sync`, `enrich --archives`, `reddit-hydrate*`.

Front-end redesign needs none of them. If you think you need one, you don't — stop
and ask.

---

## 15. GIT

- Work on a **NEW branch**: `feat/uiux-redesign`.
- Reviewable commits, one per coherent chunk. Commit messages = normal English,
  imperative, ≤50-char subject.
- **Never** force-push, rebase, or rewrite history. **Do not merge to main.**

---

## 16. VERIFY — prove it, don't assume it

- **Offline suite green before AND after:** `python -m pytest -q`. Capture the
  baseline first (real numbers), then keep it green (with §11 test updates).
- No Playwright / no `-m ui` marker exists — do not invent one, do not
  `pip install` one (see §17). UI coverage = the `test_web_*.py` string/contract
  tests + any tests you add.
- **Visual check via the preview MCP at Pixel-6 viewport.** Real-browser
  transitions / `prefers-reduced-motion` / focus rings / rAF cannot be judged from
  static file reads — actually render it. Check: calm default, density toggle,
  capture, reading, actions, search, resurface, PAGE CLEARED state.
- Reconcile claims: label **confirmed** (ran it, names the check) vs **inferred**.
  "No regressions" only counts against the captured baseline.

---

## 17. DO NOT INSTALL TOOLING

- No `npm install`, no `pip install`, no new deps. Global pip needs elevation here
  and will fail. Vanilla HTML/CSS/JS only — that's a feature, keep it.

---

## 18. DON'T TOUCH / DON'T BREAK — one-screen recap

**Bold styling must not harm function:**

- ❌ backend `.py`, DB schema, `/api/*` routes + field names, connectors,
  `pipeline.py`, CLI semantics.
- ❌ `vault/**`, `.index/**`, `.secrets/**`, `.env`, `data/**`, `nsfw_rules.json`,
  `.venv/` — no read-dump, no edit, no delete, no secret printing.
- ✅ swipe + long-press: may (re)style; if present/added, must keep working +
  respect gesture-nav deadzones. Existing click + keyboard paths stay usable.
- ✅ PWA install / offline shell: keep `sw.js` registered + cache bumped.
- ✅ keyboard / desktop action clusters: keep reachable + focus-visible.
- ✅ capture speed + feed-free: keep sacred.

---

## 19. DEFINITION OF DONE

1. 2–3 directions proposed (English), one picked + justified.
2. New cohesive design built in `src/pkms/web/**`, propagated to
   `src/pkms/web_ext/**` per §9.
3. `sw.js` cache version bumped + `SHELL` correct.
4. `python -m pytest -q` green; string-coupled tests updated to new DOM with
   contracts preserved; new behaviors have new tests.
5. Preview-MCP visual pass at Pixel-6, key surfaces confirmed.
6. On branch `feat/uiux-redesign`, clean reviewable commits, not merged to main.
7. Short English report: direction chosen + why, what changed, what you verified
   (confirmed vs inferred), any open questions.

Build boldly. Stay kind to the user. Prove it before you call it done.
