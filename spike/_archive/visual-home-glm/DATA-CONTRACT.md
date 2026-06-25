# Proposed read-only data contract

The mockup is wired to inlined fake JSON (see `app.js` §1 FAKE DATA), using the
**exact** `/api/today` field names confirmed against `today.py:172-184`. This doc
specifies the additional read-only endpoints the design assumes, each with shape
+ derivation. All are **read-only** — none touch the capture path or the
underlying vault files (those are sacred / regenerable per the brief).

Implementation language is open. Where an existing Python library function
already does the work, I note it — a Python wrap is trivial. A non-Python
implementation would read the same SQLite tables (`.index/pkms.db`, schema in
`db.py`) and/or the same vault frontmatter.

---

## Endpoint priority

| Priority | Endpoint | Status |
|---|---|---|
| 🟢 essential | `GET /api/today` | **already served** (`capture_service.py:347`) |
| 🟢 essential | `GET /api/recognition-cards` | fn exists, **unwired** — trivial wrap |
| 🟡 nice-to-have | `GET /api/reading-queue` | new read path, derives from existing source |
| 🟡 nice-to-have | `GET /api/pebbles?date=` | new, but tiny |
| 🟠 optional | `GET /api/next-actions?state=&limit=` | fn exists (`tasks.next_action_per_note`); wrap |
| 🟠 optional | `GET /api/recent-notes?limit=` | new, simple mtime query |
| 🟠 optional | `GET /api/search?q=` | new — clearly labeled fallback |
| 🔵 edge | `GET /api/breadcrumb?date=` | fn exists (`_breadcrumb`); wrap if "jump to prior day" shipped |

The **essential** tier (today + recognition-cards) is enough to ship the whole
`calm`-density front door as-is. The rest gates the `more` / `everything`
levels and the secondary surfaces.

---

## 1. `GET /api/today` — already served ✅

No change. Confirmed shape (`today.py:172-184`):

```jsonc
{
  "date": "2026-06-22",                       // str, ISO — always present
  "breadcrumb": {                              // dict | null
    "name": "2026-06-21",                      // str — daily-note stem
    "lines": ["…", "…", "…", "…"]              // list[str], ≤4 (or ≤3 fallback)
  },
  "inbox_new": 3,                              // int ≥0
  "done_today": 2,                             // int ≥0
  "next_read": {                               // dict | null
    "title": "…",
    "minutes": 12,                             // int | null
    "promoted": "2026-06-18"                   // str (possibly "")
  },
  "resurface": {                               // dict | null
    "path": "resources/foo.md",                // str — present in JSON, omitted from brief
    "title": "…",
    "question": "Still chewing on X?",
    "why": "short · r/sub you clear often",    // " · "-joined, ≤2 fragments
    "score": 0.83                              // float — present in JSON, omitted from brief
  },
  "next_actions": [                            // list[dict], capped at MAX_NOTES_SHOWN=8
    {
      "note": "projects/alpha.md",             // str — forward-slash, URL-safe (indexer.py:25)
      "title": "Alpha",
      "text": "draft the intro",
      "size": "30m",                           // str | null
      "first_action": "open the outline file"  // str | null
    }
  ],
  "more_notes": 4                              // int ≥0
}
```

The mockup consumes every field except `resurface.score` (unused) and uses
`resurface.path` for the (mockup-only) "would open the note" affordance.

---

## 2. `GET /api/recognition-cards` — fn exists, unwired 🟢

**Wraps:** `recognition_cards()` at `today.py:120-169`. That function is
**library-only today** — no route in `capture_service.py` calls it. Trivially
wrappable:

```python
elif path == "/api/recognition-cards":
    from .today import recognition_cards
    body = json.dumps(recognition_cards(vault, index_dir, k=3))
    self._send(200, body, "application/json; charset=utf-8")
```

**Shape** — round-robin of reading + resurface, hard-capped at `k=3`
(`today.py:158-168`):

```jsonc
[
  {
    "kind": "reading",
    "title": "The Cost of Interrupted Work",
    "why": "next in your reading queue",   // fixed string for reading cards
    "minutes": 12,                          // int | null
    "promoted": "2026-06-18"                // str
  },
  {
    "kind": "resurface",
    "title": "Barkley on the performance/knowledge distinction",
    "why": "short · cited in 4 of your recent notes"  // resurface.py:132 shape
    // no minutes / promoted on resurface cards
  }
]
```

**Derivation:**
- **reading cards** — `vault/resources/reading/*.md` frontmatter where
  `reading == "queued"`, sorted by `promoted` (`today.py:124-140`).
- **resurface cards** — `resurface.candidates(conn, k=k)` filtered through
  `filter_never` (drops notes with frontmatter `resurface: never`)
  (`today.py:143-153`).

This is the single highest-leverage endpoint to wire: it unlocks the recognition
rail on the front door with zero new code, just a route.

---

## 3. `GET /api/reading-queue` — new read path, existing source 🟡

**Derives from:** the same `vault/resources/reading/*.md` source as
`recognition_cards()` reading entries, but **unbounded** (not capped at 1) and
without the round-robin interleave.

```jsonc
[
  {
    "title": "The Cost of Interrupted Work: More Faster and Worse",
    "minutes": 12,                          // int | null (null = "long read")
    "promoted": "2026-06-18",               // str, ISO date
    "why": "next up · shortest in the queue", // derived ranking line (see below)
    "path": "resources/reading/cost-of-interrupted-work.md"  // str
  }
]
```

The `why` field follows the design language's transparent-ranking rule (§9):
each item carries a one-line "why this order" — e.g. *"next up · shortest in the
queue"*, *"cited by three notes you've touched this week"*. Derivation: shortest
`minutes` ascending, ties broken by `promoted` ascending.

**No queue-length count is surfaced.** The UI renders this as an editorial list;
the count is deliberately omitted (bound 1, §3).

---

## 4. `GET /api/pebbles?date=YYYY-MM-DD` — new, tiny 🟡

**Derives from:** today's done-log (the same source as `_done_today()` in
`today.py`) plus, optionally, a per-day goal.

```jsonc
{
  "date": "2026-06-22",
  "count": 2,                               // int — today's completions
  "goal": null,                             // int | null — OFF by default (see HONESTY.md)
  "entries": [                              // optional detail; omit if cheap to skip
    { "label": "folded the F6 promote fix", "at": "09:42" }
  ]
}
```

**Forward-only invariant (load-bearing):** pebbles reset daily with no debt. A
goal missed yesterday leaves no trace today (§3, locked 2026-06-11). The API
must never expose a `streak`, `yesterday_goal`, or `debt` field — those are
forbidden shapes.

The `goal` field is **null by default** and is the single place a daily-goal
opt-in could live. See HONESTY.md for why even this is flagged.

---

## 5. `GET /api/next-actions?state=open&limit=N` — fn exists 🟠

**Wraps:** `tasks.next_action_per_note` (`tasks.py:89-100`). Today this is called
internally by `today_view` and capped at `MAX_NOTES_SHOWN=8`. Exposing it
directly lets the `more` / `everything` density levels and the `#actions` surface
fetch the unbounded list.

```jsonc
{
  "actions": [
    {
      "note": "projects/alpha.md",
      "title": "Alpha",
      "text": "draft the intro",
      "size": "30m",                      // str | null
      "first_action": "open the outline file",  // str | null
      "done_when": "the intro is merged"  // str | null — PROPOSED field, see note
    }
  ],
  "total": 12,                           // int — total open across vault
  "shown": 8                             // int — count in actions[]
}
```

**Proposed field — `done_when`:** the brief's task anatomy is `⏱ size / ▶
first_action / ✓ done-when`, but `next_action_per_note` does not currently
extract a `done_when` token. The extraction pattern would mirror the existing
`⏱`/`▶` parse at `tasks.py:46-53` (which reads `⏱` and `▶` markers from the
task text). This is a **proposed read-only addition** — flag for review.

**`total` is not surfaced as a count in the UI.** The mockup uses `more_notes`
(the existing overflow field from `today.py:183`) for the "N more one click
away" affordance and never displays `total` as a debt-shaped number. The field
exists in the payload for completeness but the UI deliberately ignores it.

---

## 6. `GET /api/recent-notes?limit=10` — new, simple 🟠

**Derives from:** the existing SQLite index (`.index/pkms.db`), sorted by mtime
descending. Used by the search route's recognition-first picker.

```jsonc
[
  {
    "title": "PKMS design",
    "path": "projects/pkms-design.md",   // str — forward-slash, URL-safe
    "touched": "yesterday"               // str — humanized relative time
  }
]
```

`touched` is a humanized relative string ("yesterday", "3 days ago", "last
week") — not an absolute timestamp. The point is recognition ("oh, that one"),
and relative-time reads faster than ISO dates.

---

## 7. `GET /api/search?q=…` — new, fallback 🟠

**Clearly labeled as the fallback** in the UI (`#search` route). Full-text over
the index. Returns the same shape as `/api/recent-notes` plus a relevance
`why`:

```jsonc
{
  "query": "barkley",
  "results": [
    {
      "title": "Barkley on performance disorders",
      "path": "resources/barkley-performance-disorder.md",
      "touched": "3 days ago",
      "why": "title match · body mentions 'performance disorder' 8×"
    }
  ]
}
```

The `why` follows the transparent-ranking rule (§9). Search results never carry
a count badge or a "showing 1 of N" debt-shape read.

---

## 8. `GET /api/breadcrumb?date=YYYY-MM-DD` — fn exists 🔵

**Wraps:** `_breadcrumb(vault, today_stem)` at `today.py:25-50`. Only needed if
the "jump to a prior day" affordance ships (it is **not** in this mockup — the
brief says re-entry is about *where you left off*, not browsing history). Listed
for completeness.

```jsonc
{
  "name": "2026-06-21",
  "lines": ["…", "…", "…", "…"]
}
```

---

## What this contract deliberately does NOT include

- **No `/api/count` or `/api/stats`.** Raw backlog counts are forbidden in the
  UI (bound 1, §3); exposing them at the API invites future misuse. If a count
  is needed internally (e.g. `inbox_new`), it's a field on an existing object,
  never a standalone endpoint.
- **No `/api/streak` or `/api/overdue`.** Streaks and overdue counters are
  forbidden shapes (bound 2, §3, §7).
- **No `/api/settings` or `/api/preferences`.** Zero settings sprawl (bound 8,
  §8). The agent is the customization interface; the UI exposes only the salience
  knob, which is a client-side toggle (no persistence needed for the mockup).
- **No write endpoints.** The mockup is design-only and does not wire to the
  live app (brief, deliverable 1). Capture saves, done-toggles, and resurface
  dismissals are simulated client-side. A future wiring would use the existing
  `POST /capture` and would need new state-mutation endpoints for done/ dismiss
  — **out of scope for this design pass**, and the capture path itself is sacred.
- **No graph endpoint.** The Obsidian-style vault graph is "the canonical
  abandonment artifact" (brief, §9). No endpoint serves it; no surface renders
  it.

---

## Field-name discipline

All note paths are forward-slash and URL-safe (`indexer.py:25` uses
`.as_posix()`), matching the `next_actions[].note` convention. Any new endpoint
that surfaces paths must use the same format. The mockup's fake data follows
this exactly (e.g. `"projects/pkms-design.md"`, `"resources/reading/…"`).

The token gate (`?token=…` or `X-Capture-Token`, `capture_service.py:330-341`)
applies to all of the above equally; the mockup ignores it per the brief.

