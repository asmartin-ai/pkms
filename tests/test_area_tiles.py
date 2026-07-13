"""Oracle — P4 (agent half): area tiles — life-domain tiles for the today-view.

RED tests for the tile data source + token-gated endpoint behind the
today-view's area-tile row (delegation-roadmap P4). Tiles are dim desk
objects (Lamplight rule): each tile is exactly ONE next action plus a quiet
"last touched" line — no counts, no urgency cues, ever.

Data source:
  pkms.today.area_tiles(vault, index_dir) -> list[JsonDict]
    - Area notes are vault/areas/*.md (top level only). Missing or empty
      areas/ -> [] (nothing renders until Kenja authors his areas — the
      agent never invents his life structure).
    - Each tile has EXACTLY the keys: title, path, next_action,
      last_touched. No counts anywhere in the payload.
    - title: frontmatter title, else file stem.
    - path: vault-relative POSIX path, literally "areas/career.md".
    - next_action: display text of the note's single next action (reuses
      tasks.next_action_per_note + the today._display_text convention);
      None when the note has no open task or the index db is missing.
    - last_touched: file mtime as an ISO-8601 UTC timestamp (same
      convention as today.recent_notes).
    - Sorted by path ascending (calm and stable — no priority ranking),
      capped at 8.
    - Read-only, side-effect-free: never writes the vault or the index.
    - A malformed area note is skipped, never a 500.

Endpoint:
  GET /api/area-tiles — token-gated (403 without), returns the same JSON.
"""

import json
import threading
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

import pytest

from pkms.capture_service import make_server
from pkms.today import area_tiles
from tests.conftest import write_note

TOKEN = "test-token-123"


def _index(vault, index_dir):
    from pkms.indexer import index_vault

    index_vault(vault, index_dir)


def _make_areas(vault: Path) -> None:
    """Two area notes: career has an open task, health has only a done one."""
    _ = write_note(
        vault / "areas" / "career.md",
        """\
        Career area note.

        - [ ] update the resume header
        - [ ] second task that must not surface
        """,
        title="Career",
    )
    _ = write_note(
        vault / "areas" / "health.md",
        """\
        Health area note.

        - [x] booked the checkup
        """,
        title="Health",
    )


@pytest.fixture
def service(vault, index_dir):
    """Vault with two area notes, indexed, plus a live server."""
    _make_areas(vault)
    _index(vault, index_dir)
    server = make_server(vault, index_dir, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://{server.server_address[0]}:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _json(url):
    with urlopen(url, timeout=5) as r:  # noqa: S310 — loopback only
        return r.status, json.loads(r.read().decode("utf-8")), r.headers.get("Content-Type", "")


# ---------------------------------------------------------------- data source


def test_missing_areas_dir_returns_empty(vault, index_dir):
    _index(vault, index_dir)
    assert area_tiles(vault, index_dir) == []


def test_empty_areas_dir_returns_empty(vault, index_dir):
    (vault / "areas").mkdir(parents=True)
    _index(vault, index_dir)
    assert area_tiles(vault, index_dir) == []


def test_tile_shape_is_exact_no_counts(vault, index_dir):
    _make_areas(vault)
    _index(vault, index_dir)
    tiles = area_tiles(vault, index_dir)
    assert len(tiles) == 2
    for tile in tiles:
        # Lamplight/no-pile guard: exactly these keys, nothing countable.
        assert set(tile) == {"title", "path", "next_action", "last_touched"}


def test_tiles_sorted_by_path_with_posix_paths(vault, index_dir):
    _make_areas(vault)
    _index(vault, index_dir)
    tiles = area_tiles(vault, index_dir)
    assert [t["path"] for t in tiles] == ["areas/career.md", "areas/health.md"]


def test_next_action_is_single_open_task(vault, index_dir):
    _make_areas(vault)
    _index(vault, index_dir)
    tiles = {t["path"]: t for t in area_tiles(vault, index_dir)}
    career = tiles["areas/career.md"]
    assert career["title"] == "Career"
    assert "update the resume header" in career["next_action"]
    assert "second task" not in career["next_action"]


def test_area_without_open_task_has_none_next_action(vault, index_dir):
    _make_areas(vault)
    _index(vault, index_dir)
    tiles = {t["path"]: t for t in area_tiles(vault, index_dir)}
    assert tiles["areas/health.md"]["next_action"] is None


def test_missing_db_yields_tiles_with_none_actions(vault, index_dir):
    # Areas exist on disk but the index was never built: tiles still render
    # (title + last_touched from disk), next_action just stays None.
    _make_areas(vault)
    tiles = area_tiles(vault, index_dir)
    assert [t["path"] for t in tiles] == ["areas/career.md", "areas/health.md"]
    assert all(t["next_action"] is None for t in tiles)


def test_last_touched_is_iso_utc(vault, index_dir):
    _make_areas(vault)
    _index(vault, index_dir)
    tiles = area_tiles(vault, index_dir)
    for tile in tiles:
        # Same convention as recent_notes: ISO-8601 with a UTC offset.
        assert "T" in tile["last_touched"]
        assert tile["last_touched"].endswith("+00:00")


def test_malformed_area_note_is_skipped(vault, index_dir):
    # Index first, THEN drop the broken file: area_tiles lists areas/ from
    # disk, so the bad note exercises its skip path directly. (The indexer
    # itself crashes on non-UTF8 vault files — pre-existing, tracked
    # separately; this oracle is about the tile surface, not the indexer.)
    _make_areas(vault)
    _index(vault, index_dir)
    bad = vault / "areas" / "broken.md"
    _ = bad.write_bytes(b"---\ntitle: [unclosed\n---\n\xff\xfe garbage")
    tiles = area_tiles(vault, index_dir)
    assert [t["path"] for t in tiles] == ["areas/career.md", "areas/health.md"]


def test_capped_at_eight(vault, index_dir):
    for i in range(10):
        _ = write_note(vault / "areas" / f"a{i:02d}.md", "note body\n", title=f"A{i}")
    _index(vault, index_dir)
    assert len(area_tiles(vault, index_dir)) == 8


def test_stem_fallback_when_no_title(vault, index_dir):
    plain = vault / "areas" / "money.md"
    plain.parent.mkdir(parents=True, exist_ok=True)
    _ = plain.write_text("No frontmatter here at all.", encoding="utf-8")
    _index(vault, index_dir)
    tiles = {t["path"]: t for t in area_tiles(vault, index_dir)}
    assert tiles["areas/money.md"]["title"] == "money"


# ------------------------------------------------------------------- endpoint


def test_endpoint_is_token_gated(service):
    with pytest.raises(HTTPError) as exc:
        _json(service + "/api/area-tiles")
    assert exc.value.code == 403


def test_endpoint_returns_tiles_json(service):
    status, body, ctype = _json(f"{service}/api/area-tiles?token={TOKEN}")
    assert status == 200
    assert ctype.startswith("application/json")
    assert [t["path"] for t in body] == ["areas/career.md", "areas/health.md"]
    assert "update the resume header" in body[0]["next_action"]


def test_endpoint_empty_vault_returns_empty_list(tmp_path):
    vault = tmp_path / "v"
    vault.mkdir()
    index_dir = tmp_path / "idx"
    index_dir.mkdir()
    server = make_server(vault, index_dir, "127.0.0.1", 0, TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = f"http://{server.server_address[0]}:{server.server_address[1]}"
        status, body, _ = _json(f"{base}/api/area-tiles?token={TOKEN}")
        assert status == 200
        assert body == []
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
