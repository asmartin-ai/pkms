import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export function projectRoot(cwd: string = process.cwd()): string {
  const env = process.env.PKMS_HOME;

  if (env) return env;
  let dir = cwd;

  for (;;) {
    if (existsSync(join(dir, "vault"))) break;
    const parent = dirname(dir);

    if (parent === dir) {
      throw new Error(
        "No vault/ found in current directory or its parents. " +
          "Set PKMS_HOME or cd into the PKMS project.",
      );
    }

    dir = parent;
  }

  return dir;
}

let ROOT: string | null = null;

export function root(): string {
  ROOT ??= projectRoot();

  return ROOT!;
}

export function VAULT(): string {
  return join(root(), "vault");
}

export function INDEX(): string {
  return join(root(), ".index");
}

export function setRoot(r: string | null): void {
  ROOT = r;
}
