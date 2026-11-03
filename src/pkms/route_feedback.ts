import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { eventTs, readEvents } from "./events.ts";
import { senderAddress, type Tuning } from "./route_rules.ts";
import { readSource } from "./sources.ts";
import { appendText } from "./textio.ts";

export interface LearningOutcome {
  tuning: Tuning;
  changes: TuningChange[];
  cursor: number;
  previousCursor: number;
}

export interface TuningChange {
  key: "email.route_senders" | "email.noise_senders";
  value: string[];
  because: string;
}

const CursorSchema = z.coerce.number().int().nonnegative();

export function computeLearning(root: string, vault: string, initial: Tuning): LearningOutcome {
  const cursorPath = join(root, ".ledger", "route-feedback.cursor");

  const previousCursor = existsSync(cursorPath)
    ? CursorSchema.parse(readFileSync(cursorPath, "utf8").trim())
    : 0;

  const tuning = structuredClone(initial);
  const changes: TuningChange[] = [];

  const events = [
    ...readEvents(root, { kind: "dismissed", limit: -1 }),
    ...readEvents(root, { kind: "dug_out", limit: -1 }),
  ].sort((a, b) => a.id - b.id);

  const dismissed = new Map<string, Set<string>>();
  const seenDismissals = new Set<string>();
  const senders = new Map<string, string>();
  let cursor = previousCursor;

  function moveSender(
    sender: string,
    destination: "route_senders" | "noise_senders",
    because: string,
  ) {
    const opposite = destination === "route_senders" ? "noise_senders" : "route_senders";

    if (tuning.email[opposite].includes(sender)) {
      tuning.email[opposite] = tuning.email[opposite].filter((address) => address !== sender);
      changes.push({ key: `email.${opposite}`, value: [...tuning.email[opposite]], because });
    }

    if (!tuning.email[destination].includes(sender)) {
      tuning.email[destination].push(sender);
      tuning.email[destination].sort();
      changes.push({ key: `email.${destination}`, value: [...tuning.email[destination]], because });
    }
  }

  for (const event of events) {
    cursor = Math.max(cursor, event.id);

    if (event.source !== "email") continue;
    let sender = senders.get(event.ref);

    if (sender === undefined) {
      try {
        const source = readSource(vault, event.ref);
        sender = source.data.source === "email" ? senderAddress(source.data.from ?? "") : "";
      } catch {
        sender = "";
      }

      senders.set(event.ref, sender);
    }

    if (!sender) continue;

    if (event.kind === "dug_out") {
      if (event.payload.route !== "noise") continue;
      dismissed.delete(sender);

      if (event.id > previousCursor) {
        moveSender(sender, "route_senders", `opened noise source from search: ${event.ref}`);
      }

      continue;
    }

    if (seenDismissals.has(event.ref)) continue;
    seenDismissals.add(event.ref);
    let notes = dismissed.get(sender);

    if (!notes) {
      notes = new Set();
      dismissed.set(sender, notes);
    }

    notes.add(event.ref);

    if (event.id > previousCursor && notes.size >= tuning.email.dismiss_threshold) {
      moveSender(
        sender,
        "noise_senders",
        `dismissed ${notes.size} distinct emails from ${sender}; latest: ${event.ref}`,
      );
    }
  }

  return { tuning, changes, cursor, previousCursor };
}

export function persistLearning(root: string, learning: LearningOutcome, now: Date): void {
  if (learning.cursor === learning.previousCursor) return;
  const ledger = join(root, ".ledger");
  mkdirSync(ledger, { recursive: true });

  if (learning.changes.length > 0) {
    appendText(
      join(ledger, "tuning-changes.jsonl"),
      learning.changes.map((change) => JSON.stringify({ ts: eventTs(now), ...change })).join("\n") +
        "\n",
    );
  }

  const writes: [string, string][] = [];

  if (learning.changes.length > 0)
    writes.push([join(root, "tuning.json"), `${JSON.stringify(learning.tuning, null, 2)}\n`]);
  writes.push([join(ledger, "route-feedback.cursor"), `${learning.cursor}\n`]);

  for (const [path, content] of writes) {
    const temporary = `${path}.${randomUUID()}.tmp`;

    try {
      writeFileSync(temporary, content, { flag: "wx", mode: 0o600 });
      renameSync(temporary, path);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
}
