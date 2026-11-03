import { describe, expect, test } from "bun:test";
import {
  decide,
  senderAddress,
  TuningSchema,
  type RouteContext,
} from "../../src/pkms/route_rules.ts";
import { SourceSchema, type SourceRecord, type SourceMetadata } from "../../src/pkms/sources.ts";

function item(extra: Partial<SourceMetadata> = {}): SourceRecord {
  return {
    path: "/synthetic/vault/sources/email/message.md",
    relativePath: "sources/email/message.md",
    body: "Synthetic source content",
    data: SourceSchema.parse({
      source: "email",
      source_id: "message",
      received_at: "2026-10-07T00:00:00Z",
      route: "pending",
      from: "Alex <alex@example.com>",
      ...extra,
    }),
  };
}

function context(): RouteContext {
  return {
    tuning: TuningSchema.parse({}),
    now: new Date("2026-10-07T12:00:00Z"),
  };
}

describe("ordered email route rules", () => {
  test("allowlisted address wins over noise list, calendar and bulk signals", () => {
    const ctx = context();
    ctx.tuning.email.route_senders = ["alex@example.com"];
    ctx.tuning.email.noise_senders = ["@example.com"];
    expect(
      decide(item({ has_calendar: "true", list_unsubscribe: "<mailto:leave@example.com>" }), ctx),
    ).toEqual({
      decision: "route",
      reason: "sender selected for routing",
      rule: "email.route-sender",
    });
  });

  test("allowlisted domain is exact and mailbox comparison is case-insensitive", () => {
    const ctx = context();
    ctx.tuning.email.route_senders = ["@example.test"];
    expect(decide(item({ from: "Name <ALEX@EXAMPLE.TEST>", list_id: "list" }), ctx).rule).toBe(
      "email.route-sender",
    );
    expect(decide(item({ from: "alex@notexample.test", list_id: "list" }), ctx).decision).toBe(
      "noise",
    );
  });

  test("noise sender wins over calendar invite", () => {
    const ctx = context();
    ctx.tuning.email.noise_senders = ["alex@example.com"];
    expect(decide(item({ has_calendar: "true" }), ctx).rule).toBe("email.noise-sender");
  });

  test("calendar invite wins over automated sender and list headers", () => {
    expect(
      decide(
        item({ from: "no-reply@example.com", has_calendar: "true", list_id: "calendar" }),
        context(),
      ),
    ).toEqual({ decision: "route", reason: "calendar invite", rule: "email.calendar" });
  });

  test.each([
    { list_unsubscribe: "" },
    { list_id: "list.example.com" },
    { precedence: "bulk" },
    { precedence: " LIST " },
    { precedence: "junk" },
    { auto_submitted: "auto-replied" },
    { auto_submitted: "" },
  ])("bulk header signals are noise, including present empty headers: %j", (headers) => {
    expect(decide(item(headers), context()).rule).toBe("email.bulk");
  });

  test.each([
    "noreply",
    "no-reply",
    "donotreply",
    "notification",
    "notifications",
    "newsletter",
    "news",
    "mailer-daemon",
    "marketing",
    "promo",
    "update",
    "updates",
    "info",
    "hello",
    "team",
    "notifications+digest",
    "alex.team",
    "updates_alerts",
    "work-news",
    "name+info",
  ])("automated local part %s is noise", (local) => {
    expect(decide(item({ from: `${local}@example.com` }), context()).decision).toBe("noise");
  });

  test.each(["newsome", "kateamos", "rinfo"])(
    "person local part %s is not a bulk substring match",
    (local) => {
      expect(decide(item({ from: `${local}@example.com` }), context()).rule).toBe("email.person");
    },
  );

  test.each([
    "no.reply.alerts@bank.example",
    "ACMEbuyerservice@shop.example",
    "invoice+statements@billing.example",
  ])("transactional sender %s is noise", (from) => {
    expect(decide(item({ from }), context()).rule).toBe("email.bulk");
  });

  test.each([
    "bank@notification.bank.example",
    "Broker.Investments@mail.broker.example",
    "resort@travel2.resortvacations.example",
    "PostInformeddelivery@email.informeddelivery.post.example",
  ])("sending-subdomain-only sender %s now routes as a person", (from) => {
    expect(decide(item({ from }), context()).rule).toBe("email.person");
  });

  test("a Feedback-ID header marks bulk mail even from a plain address", () => {
    expect(decide(item({ feedback_id: "" }), context()).rule).toBe("email.bulk");
  });

  test.each(["alex@cs.example.org", "sam.lee@mail.example.com", "jordan@company.example"])(
    "person address %s still routes",
    (from) => {
      expect(decide(item({ from }), context()).rule).toBe("email.person");
    },
  );

  test.each([
    ["ann@mail.mycompany.example", "email.person"],
    ["jane@mail.example.org", "email.person"],
    ["bob@info.example.com", "email.person"],
    ["sam@alerts.example.net", "email.person"],
  ])("sending subdomain alone is not bulk (WO-007 D6): %s is %s", (from, rule) => {
    expect(decide(item({ from }), context()).rule).toBe(rule);
  });

  test("a spoofed display name does not rename the sender", () => {
    expect(senderAddress('"<boss@corp.example>" <spam@evil.example>')).toBe("spam@evil.example");
    expect(senderAddress("Plain Name <real@example.com>")).toBe("real@example.com");
    expect(senderAddress("real@example.com")).toBe("real@example.com");
  });
  test("a trailing parenthesised comment cannot rename the sender", () => {
    expect(senderAddress("Spam <spam@evil.example> (<boss@corp.example>)")).toBe(
      "spam@evil.example",
    );
    expect(senderAddress("Spam <spam@evil.example> (note: <boss@corp.example>)")).toBe(
      "spam@evil.example",
    );
    expect(senderAddress("Spam <spam@evil.example>")).toBe("spam@evil.example");
  });

  test("otherwise route a person, including Auto-Submitted:no", () => {
    expect(decide(item({ auto_submitted: "no" }), context())).toEqual({
      decision: "route",
      reason: "from a person",
      rule: "email.person",
    });
    expect(senderAddress('"Team update" <alex@example.com>')).toBe("alex@example.com");
    expect(senderAddress("not a mailbox")).toBe("");
  });
});

describe("ordered Keep route rules", () => {
  test("pinned wins over checklist and recency", () => {
    expect(
      decide(
        item({
          source: "keep",
          pinned: "true",
          has_unchecked: "true",
          keep_edited_at: "2026-10-06T00:00:00Z",
        }),
        context(),
      ).rule,
    ).toBe("keep.pinned");
  });

  test("pinned routes even when already archived in Keep", () => {
    expect(
      decide(item({ source: "keep", pinned: "true", keep_archived: "true" }), context()).rule,
    ).toBe("keep.pinned");
  });

  test("a note already archived in Keep holds even when recently edited with open items", () => {
    expect(
      decide(
        item({
          source: "keep",
          keep_archived: "true",
          has_unchecked: "true",
          keep_edited_at: "2026-10-06T00:00:00Z",
        }),
        context(),
      ),
    ).toEqual({ decision: "hold", reason: "already archived in Keep", rule: "keep.keep-archived" });
  });

  test("open checklist routes within checklist_days and holds when older", () => {
    const ctx = context();
    ctx.tuning.keep.checklist_days = 100;

    const checklist = (edited: string) =>
      decide(item({ source: "keep", has_unchecked: "true", keep_edited_at: edited }), ctx);

    expect(checklist("2026-06-29T12:00:00Z")).toEqual({
      decision: "route",
      reason: "open checklist",
      rule: "keep.open-checklist",
    });
    expect(checklist("2026-06-29T11:59:59Z").rule).toBe("keep.hold");
    expect(checklist("2016-03-23T16:23:59Z").rule).toBe("keep.hold");
  });

  test("recency includes the configured boundary and excludes an older edit", () => {
    const ctx = context();
    ctx.tuning.keep.recent_days = 7;
    expect(decide(item({ source: "keep", keep_edited_at: "2026-09-30T12:00:00Z" }), ctx).rule).toBe(
      "keep.recent",
    );
    expect(
      decide(item({ source: "keep", keep_edited_at: "2026-09-30T11:59:59Z" }), ctx).decision,
    ).toBe("hold");
  });

  test("old, missing, invalid and future edits hold rather than become noise", () => {
    for (const edited of ["2025-01-01T00:00:00Z", "", "invalid", "2099-01-01T00:00:00Z"]) {
      expect(
        decide(
          item({ source: "keep", pinned: "false", has_unchecked: "false", keep_edited_at: edited }),
          context(),
        ),
      ).toEqual({ decision: "hold", reason: "archived for later discovery", rule: "keep.hold" });
    }
  });
});
