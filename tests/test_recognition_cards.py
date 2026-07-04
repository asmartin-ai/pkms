"""Bakeoff oracle — T4 (PKMS-F1): the recognition card row (data contract).

The today-view is gaining a curated "recognition card row" (build-plan F1): a SMALL
set of visual cards drawn from multiple sources — the promoted reading queue and the
resurfacing candidate set (and, in the full feature, OCR'd image captures) — each with
a one-line "why this" and, where relevant, a consume-cost pill.

Per the design language this is recognition-first and **curated**: NEVER the raw pile
(§3/§6 — at most a few cards), and assembling it must be **side-effect-free to read**
(§5 — the same rule B1 fixed for the lone resurface card; a poll/refresh must not burn
the rationed surface).

This file pins the OBJECTIVE, testable DATA CONTRACT of F1. The visual design — exact
thumbnails, layout, copy, ordering — is intentionally open (a blind second-design take
is iceboxed) and is deliberately NOT pinned here: that is the judgment shell. So F1 is a
hybrid — a testable assembly core wrapped in an un-oracle-able visual surface.

RED until `pkms.today.recognition_cards(vault, index_dir)` exists and satisfies the
contract below. Source of truth: vault/projects/pkms-design/sweep-findings-2026-06-17.md (F1).
"""

from pkms.db import connect
from pkms.indexer import index_vault
from tests.conftest import write_note


def _vault(tmp_path):
    """A vault with MORE than 3 surfaceable items across two sources, so curation
    (cap) and multi-source assembly are both exercised:
      - 2 queued reading threads (consume-cost = reading_minutes)
      - 4 dormant notes that qualify as resurface candidates
    """
    vault = tmp_path / "vault"
    reading = vault / "resources" / "reading"
    reading.mkdir(parents=True, exist_ok=True)
    for i, mins in enumerate((12, 30)):
        (reading / f"thread-{i}.md").write_text(
            f"---\ntitle: Reading {i}\ncreated: 2026-06-1{i}\nreading: queued\n"
            f"reading_minutes: {mins}\npromoted: 2026-06-0{i + 1}\n---\n\nbody {i}\n",
            encoding="utf-8",
        )
    # dormant, unlinked notes (old enough to resurface; age score alone qualifies them)
    for i in range(4):
        write_note(
            vault / "resources" / f"old-{i}.md",
            f"An old idea {i} worth revisiting one day.\n",
            title=f"Old Idea {i}",
            created="2026-01-01",
        )
    index_dir = tmp_path / ".index"
    index_vault(vault, index_dir)
    return vault, index_dir


def _offer_count_total(index_dir):
    """Total recorded resurface offers (0 if the table was never created)."""
    conn = connect(index_dir)
    try:
        row = conn.execute(
            "SELECT COALESCE(SUM(offer_count), 0) AS s FROM resurface_offers"
        ).fetchone()
        return row["s"] if row else 0
    except Exception:
        return 0
    finally:
        conn.close()


def test_recognition_cards_is_a_curated_row_not_the_raw_pile(tmp_path):
    from pkms.today import recognition_cards

    vault, index_dir = _vault(tmp_path)
    cards = recognition_cards(vault, index_dir)

    assert isinstance(cards, list)
    # curated, never the raw pile (§3/§6): at most 3, even though >3 items exist
    assert 1 <= len(cards) <= 3, f"expected a curated 1-3 card row, got {len(cards)}"
    # every card carries the recognition essentials: a kind, a title, a 'why this'
    for c in cards:
        assert c.get("kind") in {"reading", "resurface", "capture"}, c
        assert isinstance(c.get("title"), str) and c["title"], c
        assert isinstance(c.get("why"), str) and c["why"], c


def test_recognition_cards_span_multiple_sources_with_consume_cost(tmp_path):
    from pkms.today import recognition_cards

    vault, index_dir = _vault(tmp_path)
    cards = recognition_cards(vault, index_dir)
    kinds = {c["kind"] for c in cards}

    # the row is multi-source: both the reading queue AND the resurface set are represented
    assert "reading" in kinds, "a queued reading thread should surface as a card"
    assert "resurface" in kinds, "a resurfacing candidate should surface as a card"
    # reading cards expose their consume-cost (the ⏱ minutes pill)
    reading = [c for c in cards if c["kind"] == "reading"]
    assert reading and any(c.get("minutes") for c in reading), (
        "reading cards must carry their consume-cost (reading_minutes)"
    )


def test_assembling_recognition_cards_is_side_effect_free(tmp_path):
    from pkms.today import recognition_cards

    vault, index_dir = _vault(tmp_path)
    before = _offer_count_total(index_dir)
    recognition_cards(vault, index_dir)
    recognition_cards(vault, index_dir)  # a second poll/refresh, as the web app does
    after = _offer_count_total(index_dir)

    # reads are side-effect-free (§5, the same invariant B1 enforced): no offer recorded
    assert after == before == 0, (
        "assembling the recognition card row recorded a resurface offer "
        "(reads must not mutate the rationed surface)"
    )
