"""G-batch oracle G2 — linker cross-reference orphans are detected."""

from pkms.indexer import index_vault


def test_orphan_wikilinks_are_reported_with_sources(vault, index_dir):
    # Fixture: alpha references [[beta]] (resolves to resources/beta.md) and
    # [[gamma|the gamma note]] (resolves to nothing — gamma.md does not exist).
    index_vault(vault, index_dir)

    # The orphan-detection contract: a function on the linker module that walks
    # the index and returns wikilink targets that resolve to no indexed note.
    find_orphans = getattr(
        __import__("pkms.linker", fromlist=["find_orphans"]), "find_orphans", None
    )
    assert find_orphans is not None, (
        "find_orphans(index_dir) must exist so callers can surface wikilinks "
        "whose targets resolve to no indexed note"
    )

    orphans = find_orphans(index_dir)

    assert isinstance(orphans, list)
    assert orphans, "at least one orphan reference must be detected"

    # Each orphan entry names the missing target and the notes that reference it.
    targets = {o["target"] for o in orphans}
    assert "gamma" in targets, "gamma has no target note in the vault — it is an orphan"

    gamma_entry = next(o for o in orphans if o["target"] == "gamma")
    assert "projects/alpha.md" in gamma_entry["sources"], (
        "the orphan's sources must list every note that references the missing target"
    )

    # A resolved link is NOT an orphan.
    assert "beta" not in targets, (
        "beta resolves to resources/beta.md — it must not appear among the orphans"
    )
