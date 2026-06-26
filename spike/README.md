# PKMS visual-home

Web frontend mockups for the PKMS daily "today" view. The original four design
directions are **archived** in `_archive/` as design history. The chosen spine
(aesthetic: editorial serif on warm paper, single ochre accent) was carried
forward into two deliveries:

- **`src/pkms/web/`** — the live today-view PWA, served by `pkms serve`
- **`spike/newtab-firefox/`** — the "ambient poster" new-tab mockup, design provenance

## Archive (`_archive/`)

Four blind independent takes from GLM-5.2, preserved as design history:

| # | Name | Aesthetic |
|---|------|-----------|
| 1 | daily-edition | Editorial serif, warm paper, single ochre accent — **the chosen spine** |
| 2 | workbench | Dark card-stack builder UI, two-pane vise+tray |
| 3 | focus | Zen single-thing, soft lighting, ultra-minimal |
| 4 | bloom | Nature-inspired, growth metaphors, garden layout |

Also preserved: `_inline.cjs` (mobile-packaging script), `_mobile.css` (shared
mobile overrides), `screenshot.py` (Playwright render shots). Paths in those
helper scripts reference the pre-archive layout and are broken — they're kept as
reference for any future mockup work.

## Active mockup

**`spike/newtab-firefox/`** — the "ambient poster" mockup that became the
graduated `src/pkms/web/`. Full-bleed editorial briefing-poster designed for
Firefox new-tab delivery. See its own README.

## Provenance

- Brief: `vault/projects/pkms-design/frontend-design-brief-glm.md`
- Binding design language: `K:\Projects\adhd-design-language\DESIGN-LANGUAGE.md`
- Data contract source: `src/pkms/today.py`, `resurface.py`, `tasks.py`
