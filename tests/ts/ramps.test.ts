import { describe, expect, test } from "bun:test";
import { RAMPS, findRamp, rampNames } from "../../src/pkms/ramps/index.ts";
import { emailRamp } from "../../src/pkms/ramps/email.ts";
import { keepRamp } from "../../src/pkms/ramps/keep.ts";
import { keepTakeoutRamp } from "../../src/pkms/ramps/keep-takeout.ts";
import { whatsappRamp } from "../../src/pkms/ramps/whatsapp.ts";

describe("ramp registry", () => {
  test("every registered ramp satisfies the InputRamp contract", () => {
    for (const ramp of RAMPS) {
      expect(ramp.name.length).toBeGreaterThan(0);
      expect(ramp.description.length).toBeGreaterThan(0);
      expect(ramp.setupDoc.startsWith("docs/")).toBe(true);
      expect(ramp.secrets.length).toBeGreaterThanOrEqual(0);
      expect(ramp.pull).toBeInstanceOf(Function);
    }
  });

  test("ramp names are unique", () => {
    const names = RAMPS.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("the built-in ramps are registered", () => {
    expect(RAMPS).toContain(emailRamp);
    expect(RAMPS).toContain(keepRamp);
    expect(RAMPS).toContain(keepTakeoutRamp);
    expect(RAMPS).toContain(whatsappRamp);
  });

  test("findRamp resolves a registered ramp by name", () => {
    expect(findRamp("whatsapp")).toBe(whatsappRamp);
    expect(findRamp("email")).toBe(emailRamp);
    expect(findRamp("keep")).toBe(keepRamp);
    expect(findRamp("keep-takeout")).toBe(keepTakeoutRamp);
  });

  test("findRamp returns null for an unknown ramp", () => {
    expect(findRamp("does-not-exist")).toBeNull();
  });

  test("rampNames lists every ramp", () => {
    const names = rampNames();

    for (const ramp of RAMPS) {
      expect(names).toContain(ramp.name);
    }
  });
});

describe("ramp metadata", () => {
  test("every ramp points at a setup doc under docs/", () => {
    for (const ramp of RAMPS) {
      expect(ramp.setupDoc.startsWith("docs/")).toBe(true);
    }
  });

  test("the whatsapp ramp declares only the Instinct chat as a secret", () => {
    expect(whatsappRamp.secrets).toEqual(["whatsapp-instinct-jid"]);
  });

  test("the keep ramp declares its destructive sweep", () => {
    expect(keepRamp.sweep).toBeInstanceOf(Function);
  });

  test("the email and whatsapp ramps have no sweep", () => {
    expect(emailRamp.sweep).toBeUndefined();
    expect(whatsappRamp.sweep).toBeUndefined();
  });
});
