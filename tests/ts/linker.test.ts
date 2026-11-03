import { describe, expect, test } from "bun:test";
import { extractLinks } from "../../src/pkms/linker.ts";

describe("extract_links (ports src/pkms/linker.py)", () => {
  test("test_plain_link", () => {
    expect(extractLinks("see [[beta]]")).toEqual(["beta"]);
  });

  test("test_aliased_link_returns_target", () => {
    expect(extractLinks("see [[gamma|the gamma note]]")).toEqual(["gamma"]);
  });

  test("test_heading_link_returns_note_only", () => {
    expect(extractLinks("see [[beta#Setup]]")).toEqual(["beta"]);
  });

  test("test_multiple_links_in_order", () => {
    const content = "[[a]] then [[b|alias]] then [[c#h]]";
    expect(extractLinks(content)).toEqual(["a", "b", "c"]);
  });

  test("test_no_links", () => {
    expect(extractLinks("plain text [not a link] [[]]")).toEqual([]);
  });
});
