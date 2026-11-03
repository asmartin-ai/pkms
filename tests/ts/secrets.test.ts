import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveToken } from "../../src/pkms/capture_service.ts";
import { hasSecret, resolveSecret, secretEnvName } from "../../src/pkms/secrets.ts";
import { mkTmp, rmTmp } from "./helpers.ts";

const ENV_NAMES = [
  "CREDENTIALS_DIRECTORY",
  "PKMS_SECRET_CAPTURE_TOKEN",
  "PKMS_SECRET_KEEP_EMAIL",
  "PKMS_SECRET_KEEP_MASTER_TOKEN",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const name of ENV_NAMES) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of ENV_NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

function writeSecretFile(dir: string, name: string, value: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), value, "utf8");
}

describe("resolveSecret (decision 0037)", () => {
  test("credentials directory wins over env and the legacy file", () => {
    const root = mkTmp();
    const creds = mkTmp();

    try {
      process.env.CREDENTIALS_DIRECTORY = creds;
      process.env.PKMS_SECRET_KEEP_EMAIL = "example-keep-email@example.com";
      writeSecretFile(creds, "keep-email", "  creds@example.com\n");
      writeSecretFile(join(root, ".secrets"), "keep-email", "file@example.com");

      expect(resolveSecret(root, "keep-email")).toBe("creds@example.com");
    } finally {
      rmTmp(root, creds);
    }
  });

  test("env wins over the legacy file when no credentials directory is set", () => {
    const root = mkTmp();

    try {
      process.env.PKMS_SECRET_KEEP_MASTER_TOKEN = "env-token";
      writeSecretFile(join(root, ".secrets"), "keep-master-token", "file-token");

      expect(resolveSecret(root, "keep-master-token")).toBe("env-token");
    } finally {
      rmTmp(root);
    }
  });

  test("falls back to the legacy .secrets file, trimmed", () => {
    const root = mkTmp();

    try {
      writeSecretFile(join(root, ".secrets"), "keep-email", "  file@example.com\n");

      expect(resolveSecret(root, "keep-email")).toBe("file@example.com");
    } finally {
      rmTmp(root);
    }
  });

  test("null when no source provides the secret", () => {
    const root = mkTmp();

    try {
      expect(resolveSecret(root, "keep-email")).toBe(null);
      expect(hasSecret(root, "keep-email")).toBe(false);
    } finally {
      rmTmp(root);
    }
  });

  test("an empty credentials file falls through to env", () => {
    const root = mkTmp();
    const creds = mkTmp();

    try {
      process.env.CREDENTIALS_DIRECTORY = creds;
      process.env.PKMS_SECRET_KEEP_EMAIL = "example-keep-email@example.com";
      writeSecretFile(creds, "keep-email", "   \n");

      expect(resolveSecret(root, "keep-email")).toBe("example-keep-email@example.com");
    } finally {
      rmTmp(root, creds);
    }
  });

  test("an empty env var falls through to the legacy file", () => {
    const root = mkTmp();

    try {
      process.env.PKMS_SECRET_KEEP_EMAIL = "   ";
      writeSecretFile(join(root, ".secrets"), "keep-email", "file@example.com");

      expect(resolveSecret(root, "keep-email")).toBe("file@example.com");
    } finally {
      rmTmp(root);
    }
  });

  test("an empty legacy file resolves to null, and hasSecret counts any source", () => {
    const root = mkTmp();

    try {
      writeSecretFile(join(root, ".secrets"), "keep-email", "\n");

      expect(resolveSecret(root, "keep-email")).toBe(null);
      expect(hasSecret(root, "keep-email")).toBe(false);

      process.env.PKMS_SECRET_KEEP_EMAIL = "example-keep-email@example.com";

      expect(hasSecret(root, "keep-email")).toBe(true);
    } finally {
      rmTmp(root);
    }
  });

  test("secretEnvName upper-cases and turns dashes into underscores", () => {
    expect(secretEnvName("keep-master-token")).toBe("PKMS_SECRET_KEEP_MASTER_TOKEN");
    expect(secretEnvName("capture-token")).toBe("PKMS_SECRET_CAPTURE_TOKEN");
  });
});

describe("resolveToken prefers configured sources over file creation", () => {
  test("env token wins and no .secrets dir is created", () => {
    const root = mkTmp();

    try {
      process.env.PKMS_SECRET_CAPTURE_TOKEN = "env-token";

      expect(resolveToken(root)).toBe("env-token");
      expect(existsSync(join(root, ".secrets"))).toBe(false);
    } finally {
      rmTmp(root);
    }
  });

  test("credentials directory token wins over env and no file is created", () => {
    const root = mkTmp();
    const creds = mkTmp();

    try {
      process.env.CREDENTIALS_DIRECTORY = creds;
      process.env.PKMS_SECRET_CAPTURE_TOKEN = "env-token";
      writeSecretFile(creds, "capture-token", "creds-token\n");

      expect(resolveToken(root)).toBe("creds-token");
      expect(existsSync(join(root, ".secrets"))).toBe(false);
    } finally {
      rmTmp(root, creds);
    }
  });

  test("an explicit token still wins over every source", () => {
    const root = mkTmp();

    try {
      process.env.PKMS_SECRET_CAPTURE_TOKEN = "env-token";

      expect(resolveToken(root, "explicit")).toBe("explicit");
      expect(existsSync(join(root, ".secrets"))).toBe(false);
    } finally {
      rmTmp(root);
    }
  });
});
