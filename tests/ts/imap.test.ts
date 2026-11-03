import { describe, expect, test } from "bun:test";
import {
  GMAIL_IMAP,
  LITERAL,
  imapDate,
  imapEndpoint,
  parseFetch,
  parseInternalDate,
} from "../../src/pkms/imap.ts";

describe("imap client helpers", () => {
  test("endpoint defaults to Gmail over TLS and accepts a loopback plaintext fake", () => {
    expect(imapEndpoint({})).toEqual(GMAIL_IMAP);
    expect(
      imapEndpoint({ PKMS_IMAP_HOST: "127.0.0.1", PKMS_IMAP_PORT: "1993", PKMS_IMAP_TLS: "0" }),
    ).toEqual({ host: "127.0.0.1", port: 1993, tls: false });
  });

  test("endpoint refuses plaintext beyond loopback and bad ports", () => {
    expect(() => imapEndpoint({ PKMS_IMAP_HOST: "imap.example.com", PKMS_IMAP_TLS: "0" })).toThrow(
      /loopback/,
    );

    expect(() => imapEndpoint({ PKMS_IMAP_PORT: "99999" })).toThrow(/TCP port/);
  });

  test("parseFetch reads Gmail items in any order, with quoted labels and a literal body", () => {
    const body = new TextEncoder().encode("Subject: hi\r\n\r\nbody");

    const items = parseFetch({
      text: `* 3 FETCH (X-GM-MSGID 1790000000000000001 X-GM-LABELS (\\Inbox "\\\\Important" "khaos/noise" "with space") UID 42 BODY[] ${LITERAL})`,
      literals: [body],
    });

    expect(items?.get("UID")).toEqual({ kind: "atom", value: "42" });
    expect(items?.get("X-GM-MSGID")).toEqual({ kind: "atom", value: "1790000000000000001" });
    expect(items?.get("BODY[]")).toEqual({ kind: "literal", bytes: body });
    expect(items?.get("X-GM-LABELS")).toEqual({
      kind: "list",
      items: [
        { kind: "atom", value: "\\Inbox" },
        { kind: "atom", value: "\\Important" },
        { kind: "atom", value: "khaos/noise" },
        { kind: "atom", value: "with space" },
      ],
    });
  });

  test("INTERNALDATE and SEARCH dates round-trip through UTC", () => {
    expect(parseInternalDate(" 7-Oct-2026 12:30:05 +0200")?.toISOString()).toBe(
      "2026-10-07T10:30:05.000Z",
    );

    expect(parseInternalDate("nonsense")).toBeNull();
    expect(imapDate(new Date("2026-01-05T23:00:00Z"))).toBe("5-Jan-2026");
  });
});
