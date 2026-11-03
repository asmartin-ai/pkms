import type { WriteCaptureOptions } from "./capture.ts";

export interface RampContext {
  root: string;
  vault: string;
  indexDir: string;
  readSecret: (name: string) => string | null;
}

export interface RampCapture {
  text: string;
  extra?: Record<string, string>;
  now?: Date;
}

export interface RampReport {
  captured: number;
  skipped: number;
  line: string;
}

export interface InputRamp {
  readonly name: string;
  readonly description: string;
  readonly setupDoc: string;
  readonly secrets: readonly string[];
  pull(ctx: RampContext): Promise<RampReport>;
  sweep?: (ctx: RampContext, opts: SweepOptions) => Promise<RampReport>;
}

export interface SweepOptions {
  apply: boolean;
  [key: string]: number | string | boolean | undefined;
}

export type { WriteCaptureOptions };
