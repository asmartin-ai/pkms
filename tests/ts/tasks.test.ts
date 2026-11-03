import { describe, expect, test } from "bun:test";
import { extractTasks, taskHash } from "../../src/pkms/tasks.ts";

describe("extract_tasks (ports src/pkms/tasks.py)", () => {
  test("test_open_and_done", () => {
    const ts = extractTasks("- [ ] do the thing\n- [x] did the thing\n");
    expect(ts.map((t) => t.state)).toEqual(["open", "done"]);
    expect(ts.map((t) => t.done)).toEqual([false, true]);
  });

  test("test_all_six_states_parse", () => {
    const content =
      "- [ ] open one\n- [x] done one\n- [?] stuck one\n" +
      "- [~] not now one\n- [p] paused one (wake: after slice 6)\n- [i] iced one\n";

    expect(extractTasks(content).map((t) => t.state)).toEqual([
      "open",
      "done",
      "stuck",
      "not-now",
      "paused",
      "iceboxed",
    ]);
  });

  test("test_metadata_tokens_any_order", () => {
    const t = extractTasks("- [ ] call dentist ✓ appointment booked ⏱10m ▶ find the number\n")[0]!;

    expect(t.text).toBe("call dentist");
    expect(t.size).toBe("10m");
    expect(t.first_action).toBe("find the number");
    expect(t.done_when).toBe("appointment booked");
  });

  test("test_missing_metadata_is_none_not_absent", () => {
    const t = extractTasks("- [ ] bare task\n")[0]!;
    expect(t.size).toBeNull();
    expect(t.first_action).toBeNull();
    expect(t.done_when).toBeNull();
  });

  test("test_line_numbers_count_from_one", () => {
    const ts = extractTasks("intro\n- [ ] first\ntext\n- [x] second\n");
    expect(ts.map((t) => t.line)).toEqual([2, 4]);
  });

  test("test_non_task_checkboxes_ignored", () => {
    expect(extractTasks("  - [ ] indented\n-[ ] no space\n- [z] bad marker\n")).toEqual([]);
  });

  test("test_hash_changes_on_edit_and_state_flip", () => {
    const base = extractTasks("- [ ] same words\n")[0]!.hash;
    expect(extractTasks("- [ ] same words\n")[0]!.hash).toBe(base);
    expect(extractTasks("- [ ] same words!\n")[0]!.hash).not.toBe(base);
    expect(extractTasks("- [~] same words\n")[0]!.hash).not.toBe(base);
  });

  test("test_text_is_stripped", () => {
    expect(extractTasks("- [ ]   padded   \n")[0]!.text).toBe("padded");
  });
});

describe("wake field (ports tests/test_f2_task_paused_wake_field.py)", () => {
  test("test_paused_task_with_wake_yields_wake_field", () => {
    const ts = extractTasks("- [p] paused thing (wake: after slice 6 ships)\n");
    expect(ts.length).toBe(1);
    const t = ts[0]!;
    expect(t.state).toBe("paused");
    expect(t.wake).toBe("after slice 6 ships");
    expect(t.text).toBe("paused thing (wake: after slice 6 ships)");
  });

  test("test_paused_task_without_wake_is_none_not_absent", () => {
    const t = extractTasks("- [p] paused without a condition\n")[0]!;
    expect(t.state).toBe("paused");
    expect("wake" in t).toBe(true);
    expect(t.wake).toBeNull();
  });

  test("test_non_paused_states_have_wake_none_even_with_wake_parenthetical", () => {
    for (const marker of [" ", "x", "?", "~", "i"]) {
      const t = extractTasks(`- [${marker}] task (wake: never) text\n`)[0]!;
      expect(t.wake).toBeNull();
    }
  });

  test("test_wake_field_absent_on_open_task_without_parenthetical", () => {
    const t = extractTasks("- [ ] plain open task\n")[0]!;
    expect(t.state).toBe("open");
    expect("wake" in t).toBe(true);
    expect(t.wake).toBeNull();
  });
});

describe("CRLF parity (ports tests/test_line_endings.py)", () => {
  test("test_crlf_task_text_has_no_trailing_cr", () => {
    const content = "- [ ] call the dentist\r\n- [x] done\r\n";
    const tasks = extractTasks(content);
    expect(tasks.map((t) => t.state)).toEqual(["open", "done"]);
    expect(tasks[0]!.text).toBe("call the dentist");
    expect(tasks[1]!.text).toBe("done");
    expect(tasks.every((t) => !t.text.includes("\r"))).toBe(true);
  });

  test("test_crlf_task_hash_matches_lf_form", () => {
    const crlf = "- [ ] call the dentist\r\n";
    const lf = "- [ ] call the dentist\n";
    expect(taskHash(crlf)).toBe(taskHash(lf));
  });

  test("test_lf_task_unchanged", () => {
    const tasks = extractTasks("- [ ] plain task\n");
    expect(tasks[0]!.text).toBe("plain task");
    expect(tasks[0]!.state).toBe("open");
  });
});
