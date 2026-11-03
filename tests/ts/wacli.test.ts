import { describe, expect, test } from "bun:test";
import {
  assertAuthenticated,
  doctor,
  listChats,
  listMessages,
  searchMessages,
  WacliCommandError,
  WacliNotAuthenticatedError,
  WacliNotInstalledError,
} from "../../src/pkms/wacli.ts";
import type { WacliRunner, WacliSpawnResult } from "../../src/pkms/wacli.ts";

const DOCTOR_UNPAIRED_JSON =
  '{"success":true,"data":{"store_dir":"/var/lib/wacli","lock_held":false,' +
  '"authenticated":false,"session_revoked":false,"connected":false,' +
  '"connection_state":"disconnected","fts_enabled":true,' +
  '"store":{"messages":0,"chats":0,"contacts":0,"groups":0}},"error":null}';

const DOCTOR_PAIRED_JSON = JSON.stringify({
  success: true,
  data: {
    store_dir: "/var/lib/wacli",
    lock_held: false,
    authenticated: true,
    session_revoked: false,
    linked_jid: "15550001111@s.whatsapp.net",
    connected: true,
    connection_state: "connected",
    fts_enabled: true,
    store: { messages: 128, chats: 4, contacts: 33, groups: 2 },
  },
  error: null,
});

const MESSAGE_ROW = {
  ChatJID: "15550001111@s.whatsapp.net",
  ChatName: "Alex ↔ Alex",
  MsgID: "3EB0C431D26B7F4B0E9F",
  SenderJID: "15550001111@s.whatsapp.net",
  SenderName: "Alex",
  Timestamp: "2026-10-07T09:05:00Z",
  FromMe: true,
  Text: "buy oat milk",
  DisplayText: "buy oat milk",
  ReactionToID: "",
  MediaType: "",
  MediaCaption: "",
  Filename: "",
  Revoked: false,
  DeletedForMe: false,
};

const MEDIA_MESSAGE_ROW = {
  ...MESSAGE_ROW,
  MsgID: "3EB0C431D26B7F4B0EA0",
  FromMe: false,
  Text: "",
  DisplayText: "shelf photo",
  MediaType: "image",
  MediaCaption: "shelf photo",
};

const CHAT_ROW = {
  jid: "15550001111@s.whatsapp.net",
  kind: "dm",
  name: "Alex ↔ Alex",
  last_message_ts: "2026-10-07T09:05:00Z",
  archived: false,
  pinned: true,
  muted_until: "0001-01-01T00:00:00Z",
  unread: true,
  unread_count: 3,
};

const EMPTY_MESSAGES_JSON = JSON.stringify({
  success: true,
  data: { messages: null, fts: true },
  error: null,
});

const EMPTY_CHATS_JSON = JSON.stringify({ success: true, data: null, error: null });

function stdoutRunner(stdout: string, extra: Partial<WacliSpawnResult> = {}): WacliRunner {
  return async () => ({ exitCode: 0, stdout, stderr: "", ...extra });
}

interface RecordingRunner {
  runner: WacliRunner;
  calls: string[][];
}

function recordingRunner(answer: (argv: readonly string[]) => WacliSpawnResult): RecordingRunner {
  const calls: string[][] = [];

  const runner: WacliRunner = async (argv) => {
    calls.push([...argv]);

    return answer(argv);
  };

  return { runner, calls };
}

describe("wacli adapter", () => {
  test("every helper runs `wacli --read-only --json …` and never passes `--store`", async () => {
    const { runner, calls } = recordingRunner((argv) => {
      const command = argv.slice(3).join(" ");

      if (command.startsWith("doctor")) {
        return { exitCode: 0, stdout: DOCTOR_UNPAIRED_JSON, stderr: "" };
      }

      return {
        exitCode: 0,
        stdout: argv[3] === "chats" ? EMPTY_CHATS_JSON : EMPTY_MESSAGES_JSON,
        stderr: "",
      };
    });

    await doctor({ runner });
    await listMessages({ chat: "15550001111@s.whatsapp.net" }, { runner });
    await searchMessages("oat milk", 10, { runner });
    await listChats("alex", 5, { runner });

    expect(calls.map((argv) => argv.slice(0, 3))).toEqual([
      ["wacli", "--read-only", "--json"],
      ["wacli", "--read-only", "--json"],
      ["wacli", "--read-only", "--json"],
      ["wacli", "--read-only", "--json"],
    ]);

    for (const argv of calls) {
      expect(argv[0]).toBe("wacli");
      expect(argv.includes("--store")).toBe(false);
    }
  });

  test("doctor flattens the real unpaired payload and leaves linkedJid undefined", async () => {
    const report = await doctor({ runner: stdoutRunner(DOCTOR_UNPAIRED_JSON) });

    expect(report.storeDir).toBe("/var/lib/wacli");
    expect(report.lockHeld).toBe(false);
    expect(report.authenticated).toBe(false);
    expect(report.sessionRevoked).toBe(false);
    expect(report.linkedJid).toBeUndefined();
    expect(report.connected).toBe(false);
    expect(report.connectionState).toBe("disconnected");
    expect(report.ftsEnabled).toBe(true);
    expect(report.storeMessages).toBe(0);
    expect(report.storeChats).toBe(0);
  });

  test("messages list maps PascalCase rows and keeps UTC RFC3339 timestamps", async () => {
    const rows = await listMessages(
      { limit: 20 },
      {
        runner: stdoutRunner(
          JSON.stringify({
            success: true,
            data: { messages: [MESSAGE_ROW, MEDIA_MESSAGE_ROW], fts: true },
            error: null,
          }),
        ),
      },
    );

    expect(rows.map((row) => row.msgId)).toEqual(["3EB0C431D26B7F4B0E9F", "3EB0C431D26B7F4B0EA0"]);
    expect(rows.map((row) => row.timestamp)).toEqual([
      "2026-10-07T09:05:00Z",
      "2026-10-07T09:05:00Z",
    ]);
    expect(rows[0]).toEqual({
      chatJid: "15550001111@s.whatsapp.net",
      chatName: "Alex ↔ Alex",
      msgId: "3EB0C431D26B7F4B0E9F",
      senderJid: "15550001111@s.whatsapp.net",
      senderName: "Alex",
      timestamp: "2026-10-07T09:05:00Z",
      fromMe: true,
      text: "buy oat milk",
      displayText: "buy oat milk",
      reactionToId: "",
      mediaType: "",
      mediaCaption: "",
      filename: "",
      revoked: false,
      deletedForMe: false,
    });
    expect(rows[1]?.displayText).toBe("shelf photo");
    expect(rows[1]?.mediaType).toBe("image");
    expect(rows[1]?.mediaCaption).toBe("shelf photo");
  });

  test("chats list maps snake_case rows and ignores the tags PKMS never reads", async () => {
    const chats = await listChats("alex", 5, {
      runner: stdoutRunner(JSON.stringify({ success: true, data: [CHAT_ROW], error: null })),
    });

    expect(chats).toEqual([
      {
        jid: "15550001111@s.whatsapp.net",
        kind: "dm",
        name: "Alex ↔ Alex",
        lastMessageTs: "2026-10-07T09:05:00Z",
        unread: true,
        unreadCount: 3,
      },
    ]);
  });

  test("a `success:false` envelope raises WacliCommandError carrying wacli's error text", async () => {
    const runner = stdoutRunner(
      JSON.stringify({
        success: false,
        data: null,
        error: "stat /tmp/no-such-store/wacli.db: no such file or directory",
      }),
      { exitCode: 1 },
    );

    await expect(listChats("alex", 5, { runner })).rejects.toBeInstanceOf(WacliCommandError);
    await expect(listChats("alex", 5, { runner })).rejects.toThrow(
      "stat /tmp/no-such-store/wacli.db: no such file or directory",
    );
  });

  test("a non-zero exit without an envelope raises WacliCommandError naming the exit code", async () => {
    const runner = stdoutRunner("", { exitCode: 7, stderr: "wacli: fatal\r\n" });

    await expect(listChats("alex", 5, { runner })).rejects.toBeInstanceOf(WacliCommandError);
    await expect(listChats("alex", 5, { runner })).rejects.toThrow("wacli exited with code 7");
  });

  test("a runner that throws an ENOENT-coded error raises WacliNotInstalledError", async () => {
    const runner: WacliRunner = async () => {
      const failure = new Error("spawn wacli ENOENT");

      Object.assign(failure, { code: "ENOENT" });

      throw failure;
    };

    await expect(doctor({ runner })).rejects.toBeInstanceOf(WacliNotInstalledError);
  });

  test("exit code 127 raises WacliNotInstalledError", async () => {
    const runner = stdoutRunner("", { exitCode: 127, stderr: "sh: 1: wacli: not found" });

    await expect(doctor({ runner })).rejects.toBeInstanceOf(WacliNotInstalledError);
  });

  test("stdout over the byte cap raises WacliCommandError", async () => {
    const call = listChats("alex", 5, {
      runner: stdoutRunner(JSON.stringify({ success: true, data: [CHAT_ROW], error: null })),
      maxOutputBytes: 16,
    });

    await expect(call).rejects.toBeInstanceOf(WacliCommandError);
  });

  test("a runner that only finishes after the timeout is abandoned, not awaited", async () => {
    const gate = Promise.withResolvers<WacliSpawnResult>();
    const call = doctor({ runner: () => gate.promise, timeoutMs: 20 });

    await expect(call).rejects.toBeInstanceOf(WacliCommandError);
    await expect(call).rejects.toThrow("timed out");

    gate.resolve({ exitCode: 0, stdout: DOCTOR_UNPAIRED_JSON, stderr: "" });

    await expect(call).rejects.toBeInstanceOf(WacliCommandError);
  });

  test("helpers build the documented argv and omit unset flags", async () => {
    const { runner, calls } = recordingRunner((argv) => ({
      exitCode: 0,
      stdout: argv[3] === "chats" ? EMPTY_CHATS_JSON : EMPTY_MESSAGES_JSON,
      stderr: "",
    }));

    await listMessages(
      { chat: "15550001111@s.whatsapp.net", after: "2026-10-07T00:00:00Z", limit: 50, asc: true },
      { runner },
    );

    expect(calls[0]).toEqual([
      "wacli",
      "--read-only",
      "--json",
      "messages",
      "list",
      "--chat=15550001111@s.whatsapp.net",
      "--after=2026-10-07T00:00:00Z",
      "--limit=50",
      "--asc",
    ]);

    await listMessages({ after: "2026-10-07T00:00:00Z", limit: 50, asc: false }, { runner });

    expect(calls[1]).toEqual([
      "wacli",
      "--read-only",
      "--json",
      "messages",
      "list",
      "--after=2026-10-07T00:00:00Z",
      "--limit=50",
    ]);

    await searchMessages("oat milk", 10, { runner });

    expect(calls[2]).toEqual([
      "wacli",
      "--read-only",
      "--json",
      "messages",
      "search",
      "--limit=10",
      "--",
      "oat milk",
    ]);

    await listChats("alex", 5, { runner });

    expect(calls[3]).toEqual([
      "wacli",
      "--read-only",
      "--json",
      "chats",
      "list",
      "--query=alex",
      "--limit=5",
    ]);
  });

  test("a query that looks like a wacli flag reaches wacli after the literal `--`", async () => {
    const { runner, calls } = recordingRunner((argv) => ({
      exitCode: 0,
      stdout: argv[3] === "chats" ? EMPTY_CHATS_JSON : EMPTY_MESSAGES_JSON,
      stderr: "",
    }));

    await searchMessages("--store=/x", 10, { runner });

    expect(calls[0]).toEqual([
      "wacli",
      "--read-only",
      "--json",
      "messages",
      "search",
      "--limit=10",
      "--",
      "--store=/x",
    ]);
  });

  test("a query starting with a single dash also lands after the literal `--`", async () => {
    const { runner, calls } = recordingRunner((argv) => ({
      exitCode: 0,
      stdout: argv[3] === "chats" ? EMPTY_CHATS_JSON : EMPTY_MESSAGES_JSON,
      stderr: "",
    }));

    await searchMessages("-h", 20, { runner });

    expect(calls[0]).toEqual([
      "wacli",
      "--read-only",
      "--json",
      "messages",
      "search",
      "--limit=20",
      "--",
      "-h",
    ]);
  });

  test("`--chat`, `--after` and `--query` values starting with a dash never reach wacli", async () => {
    const { runner, calls } = recordingRunner((argv) => ({
      exitCode: 0,
      stdout: argv[3] === "chats" ? EMPTY_CHATS_JSON : EMPTY_MESSAGES_JSON,
      stderr: "",
    }));

    const chatRejection = listMessages({ chat: "--store=/tmp/x" }, { runner });

    await expect(chatRejection).rejects.toBeInstanceOf(WacliCommandError);
    await expect(chatRejection).rejects.toThrow(
      'wacli --chat value must not start with "-": "--store=/tmp/x"',
    );

    await expect(listMessages({ after: "-2026-10-07T00:00:00Z" }, { runner })).rejects.toThrow(
      'wacli --after value must not start with "-": "-2026-10-07T00:00:00Z"',
    );

    await expect(listChats("--store=/tmp/x", 5, { runner })).rejects.toThrow(
      'wacli --query value must not start with "-": "--store=/tmp/x"',
    );

    expect(calls.length).toBe(0);
  });

  test("an empty-string query is a legitimate positional and still reaches wacli", async () => {
    const { runner, calls } = recordingRunner((argv) => ({
      exitCode: 0,
      stdout: argv[3] === "chats" ? EMPTY_CHATS_JSON : EMPTY_MESSAGES_JSON,
      stderr: "",
    }));

    expect(await searchMessages("", 20, { runner })).toEqual([]);

    expect(calls[0]).toEqual([
      "wacli",
      "--read-only",
      "--json",
      "messages",
      "search",
      "--limit=20",
      "--",
      "",
    ]);
  });

  test("assertAuthenticated rejects unpaired and revoked stores, accepts a paired one", async () => {
    const unpaired = await doctor({ runner: stdoutRunner(DOCTOR_UNPAIRED_JSON) });

    expect(() => assertAuthenticated(unpaired)).toThrow(WacliNotAuthenticatedError);

    const revoked = await doctor({
      runner: stdoutRunner(
        JSON.stringify({
          success: true,
          data: {
            store_dir: "/var/lib/wacli",
            lock_held: false,
            authenticated: true,
            session_revoked: true,
            linked_jid: "15550001111@s.whatsapp.net",
            connected: false,
            connection_state: "logged_out",
            fts_enabled: true,
            store: { messages: 12, chats: 2, contacts: 30, groups: 1 },
          },
          error: null,
        }),
      ),
    });

    expect(() => assertAuthenticated(revoked)).toThrow(WacliNotAuthenticatedError);
    expect(() => assertAuthenticated(revoked)).toThrow("wacli auth");

    const paired = await doctor({ runner: stdoutRunner(DOCTOR_PAIRED_JSON) });

    expect(assertAuthenticated(paired)).toBeUndefined();
  });

  test("an empty store answers an empty list for every list helper", async () => {
    const runner: WacliRunner = async (argv) => ({
      exitCode: 0,
      stdout: argv[3] === "chats" ? EMPTY_CHATS_JSON : EMPTY_MESSAGES_JSON,
      stderr: "",
    });

    const messages = await listMessages({}, { runner });

    expect(messages).toEqual([]);

    const found = await searchMessages("oat milk", 10, { runner });

    expect(found).toEqual([]);

    const chats = await listChats("alex", 5, { runner });

    expect(chats).toEqual([]);
  });
});
