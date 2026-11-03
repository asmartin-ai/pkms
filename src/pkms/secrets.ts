import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function secretEnvName(name: string): string {
  return `PKMS_SECRET_${name.replaceAll("-", "_").toUpperCase()}`;
}

export function resolveSecret(root: string, name: string): string | null {
  const credsDir = process.env.CREDENTIALS_DIRECTORY;

  if (credsDir) {
    const value = readSecretFile(join(credsDir, name));

    if (value !== null) return value;
  }

  const env = process.env[secretEnvName(name)];

  if (env !== undefined && env.trim()) return env.trim();

  return readSecretFile(join(root, ".secrets", name));
}

export function hasSecret(root: string, name: string): boolean {
  return resolveSecret(root, name) !== null;
}

function readSecretFile(path: string): string | null {
  if (!existsSync(path)) return null;

  return readFileSync(path, "utf8").trim() || null;
}
