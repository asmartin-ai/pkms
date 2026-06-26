# DATA CONTRACT — new-tab pivot

The mockup uses the **exact** `/api/today` field names (verified against
`src/pkms/today.py:172-184`), so it maps to reality without a schema change.
The additional read-only payloads are the same ones the daily-edition proposed
(they derive from already-indexed data); they're restated here for
self-containment. **No change to the capture path or underlying files** — those
are sacred/regenerable.

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

## Existing (unwired) — `GET /api/recognition-cards`

Shape from `today.py:120-169`. Round-robin of reading + resurface, capped at k=3:

```json
[
  {"kind": "reading",    "title": "…", "why": "next in your reading queue", "minutes": 12, "promoted": "2026-06-18"},
  {"kind": "resurface",  "title": "…", "why": "short · cited in 4 of your recent notes"},
  {"kind": "reading",    "title": "…", "why": "…", "minutes": 18, "promoted": "2026-06-15"}
]
```

## Proposed (read-only)

### `GET /api/reading-queue`
Promoted long-reads awaiting consumption.
- **Derivation:** `vault/resources/reading/*.md` where frontmatter `reading == "queued"`,
  ordered oldest-promoted first.
- **Shape:**
```json
[
  {"title": "…", "minutes": 12, "promoted": "2026-06-18", "why": "next up · shortest in the queue", "path": "resources/reading/….md"}
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

## New-tab-specific (build-time, not a vault change)

The extension needs no new vault data. The only new question is *delivery* of the
above to the new-tab page — see RATIONALE.md G-N2 (bundled vs redirector). Under
the redirector option, the page calls the existing `/api/*` endpoints unchanged;
under the bundled option, data freshness is solved at the extension layer
(storage sync or a localhost fetch with a host permission), still reading the
same endpoints. Either way, **no new endpoints and no vault/file changes**.
