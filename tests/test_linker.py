"""Wikilink extraction and resolution."""

import os

from pkms.linker import extract_links, resolve_link


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


def test_resolve_exact_and_case_insensitive(vault):
    assert str(resolve_link("beta", vault)) == os.path.join("resources", "beta.md")
    assert str(resolve_link("BETA", vault)) == os.path.join("resources", "beta.md")
    assert resolve_link("missing", vault) is None
