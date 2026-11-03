export type Spec = Record<string, "bool" | "value">;

export interface ParsedArgs {
  flags: Map<string, string | true>;
  positionals: string[];
}

export function parseArgs(argv: string[], spec: Spec): ParsedArgs {
  const flags = new Map<string, string | true>();
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const eq = a.indexOf("=");
    const name = eq > 2 ? a.slice(0, eq) : a;

    if (spec[name] === undefined) {
      positionals.push(a);
      continue;
    }

    if (spec[name] === "bool") {
      flags.set(name, true);
      continue;
    }

    let value: string | undefined;

    if (eq > 2) value = a.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1]!.startsWith("-")) value = argv[++i];

    if (value === undefined) throw new Error(`missing value for ${name}`);
    flags.set(name, value);
  }

  return { flags, positionals };
}

export function num(flags: Map<string, string | true>, key: string, fallback: number): number {
  const v = flags.get(key);

  if (v === undefined || v === true) return fallback;
  const n = Number(v);

  if (!Number.isFinite(n)) throw new Error(`invalid number for ${key}: ${v}`);

  return n;
}

export function str(flags: Map<string, string | true>, key: string, fallback: string): string {
  const v = flags.get(key);

  return v === true || v === undefined ? fallback : v;
}

export function bool(flags: Map<string, string | true>, ...keys: string[]): boolean {
  return keys.some((k) => flags.get(k) === true);
}
