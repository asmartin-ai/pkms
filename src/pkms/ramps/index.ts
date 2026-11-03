import type { InputRamp } from "../ramp.ts";
import { emailRamp } from "./email.ts";
import { keepRamp } from "./keep.ts";
import { keepTakeoutRamp } from "./keep-takeout.ts";
import { whatsappRamp } from "./whatsapp.ts";

export const RAMPS: readonly InputRamp[] = [
  emailRamp,
  keepRamp,
  keepTakeoutRamp,
  whatsappRamp,
] as const;

export function findRamp(name: string): InputRamp | null {
  return RAMPS.find((r) => r.name === name) ?? null;
}

export function rampNames(): string {
  return RAMPS.map((r) => r.name).join(", ");
}
