# DATA CONTRACT — new-tab pivot

The new-tab frontend uses the **exact** `/api/today` field names from
`src/pkms/today.py`, plus small token-gated companion endpoints served by
`src/pkms/capture_service.py`. The additional read-only payloads derive from
plain vault files / the regenerable index; action routes write through existing
PKMS mechanics. Capture still writes one append-only inbox file — the sacred
zero-decision path is preserved.

## Existing — `GET /api/today` (unchanged)

```json
{
  "date": "2026-06-24",
  "breadcrumb": {"name": "2026-06-21", "lines": ["…up to 4 lines…"]},
  "inbox_new": 3,
  "done_today": 2,
  "next_read": {"title": "…", "minutes": 12, "promoted": "2026-06-18"},
  "resurface": {"title": "…", "question": "Still chewing on X?", "why": "short · …", "path": "resources/foo.md"},
  "next_actions": [
    {"note": "projects/alpha.md", "title": "Alpha", "text": "draft the intro", "size": "30m", "first_action": "open the outline file"}
  ],
  "more_notes": 4
}
```

Note paths are forward-slash and URL-safe. The live app is token-gated
(`?token=…`); the mockup ignores that.

## Existing — `GET /api/recognition-cards`

Shape from `today.py:120-169`. Round-robin of reading + resurface, capped at k=3:

```json
[
  {"kind": "reading",    "title": "…", "why": "next in your reading queue", "minutes": 12, "promoted": "2026-06-18"},
  {"kind": "resurface",  "title": "…", "why": "short · cited in 4 of your recent notes"},
  {"kind": "reading",    "title": "…", "why": "…", "minutes": 18, "promoted": "2026-06-15"}
]
```

## Existing — read-only companion endpoints

### `GET /api/reading-queue`
Promoted long-reads awaiting consumption.
- **Derivation:** `vault/resources/reading/*.md` where frontmatter `reading == "queued"`,
  ordered oldest-promoted first.
- **Shape:**
```json
[
  {"title": "…", "minutes": 12, "promoted": "2026-06-18", "why": "next up in your reading queue", "path": "resources/reading/….md"}
]
```

### `GET /api/pebbles?date=YYYY-MM-DD`
Today's wins. Forward-only; resets at local midnight with no debt.
- **Derivation:** today's `done` task entries + `pkms did` retroactive logs, from
  the daily note's done-log section. `goal` is OFF by default (§8 settings ban).
- **Shape:**
```json
{"date": "2026-06-24", "count": 2, "goal": null, "entries": [{"label": "…", "at": "09:42"}]}
```

### `GET /api/next-actions` (overflow)
The `more_notes` items past `MAX_NOTES_SHOWN` (today.py:15), fetched when the
accordion opens. Same shape as `next_actions[]` in `/api/today`.

### `GET /api/recent-notes?limit=10`
Recognition-first picker candidates for the search surface.
- **Derivation:** index `mtime`, most-recent-first.
- **Shape:**
```json
[{"title": "…", "path": "projects/….md", "touched": "yesterday"}]
```

## Existing — `POST /api/resurface`

Persists the two web resurface actions. Token required.

```json
{"path": "resources/research/foo.md", "action": "not-now"}
```

- `not-now` records the no-renag rest window in the derived index.
- `let-go` writes `resurface: never` into the note frontmatter, matching the CLI
  forever-exit.
- Invalid paths/actions return non-2xx and do not change files.

## Existing — `POST /capture`

The capture surface posts raw text to the existing append-only capture endpoint.
Success means a real inbox file was written; failure preserves the textarea
content and shows an honest not-saved-yet toast.

## New-tab-specific (build-time, not a vault change)

The extension needs no new vault data. Delivery is redirector-only (G-N2): the
new tab points at `pkms serve`, and the page calls the token-gated `/api/*` and
`/capture` routes on that same origin. Bundling the page into the extension would
need an extension-layer freshness/auth design and remains out of scope.
