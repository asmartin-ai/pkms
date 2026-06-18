"""Wikilink extraction and resolution."""

from pkms.linker import extract_links


def test_plain_link():
    assert extract_links("see [[beta]]") == ["beta"]


def test_aliased_link_returns_target():
    assert extract_links("see [[gamma|the gamma note]]") == ["gamma"]


def test_heading_link_returns_note_only():
    assert extract_links("see [[beta#Setup]]") == ["beta"]


def test_multiple_links_in_order():
    content = "[[a]] then [[b|alias]] then [[c#h]]"
    assert extract_links(content) == ["a", "b", "c"]


def test_no_links():
    assert extract_links("plain text [not a link] [[]]") == []
