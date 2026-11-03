import { z } from "zod";
import { appendDid } from "./daily.ts";
import { readEvents, emit } from "./events.ts";
import { listPlans, setPlan, streakState } from "./engagement.ts";
import { loadTuning } from "./route_rules.ts";
import { search } from "./search.ts";

const SEARCH_LIMIT = 5;

export interface CommandResult {
  reply: string;
  command: string | null;
}

export function isCommand(text: string): boolean {
  return text.startsWith("!") && text.slice(1, 2).match(/[a-zA-Z]/) !== null;
}

export function handleCommand(
  root: string,
  vault: string,
  indexDir: string,
  text: string,
  now: Date = new Date(),
): CommandResult {
  const content = text.slice(1).trim();
  const [verb = "", ...rest] = content.split(/\s+/);
  const argument = rest.join(" ").trim();

  const done = (reply: string, command = verb): CommandResult => {
    emit(root, "agent_tool_called", { source: "discord", ref: command, payload: { command } });

    return { reply, command };
  };

  switch ((verb ?? "").toLowerCase()) {
    case "help":
      return done(
        [
          "!today — today's due line",
          "!search <q> — top 5 hits",
          "!did <thing> — count a done thing",
          "!plan <thing> — set an if-then plan",
          "!streak — streak + freezes",
          "plain text is still just a capture",
        ].join("\n"),
      );

    case "today": {
      const tuning = loadTuning(root).engagement;
      const events = readEvents(root, { limit: -1 });
      const streak = streakState(events, tuning, now);
      const lines = [`streak: ${streak.days} day${streak.days === 1 ? "" : "s"}`];

      const due = tuning.if_then.enabled
        ? listPlans(vault).filter(
            (p) =>
              p.state === "open" && p.when && Date.parse(p.when) <= now.getTime() + 6 * 3_600_000,
          )
        : [];

      for (const p of due.slice(0, 3)) lines.push(`due: ${p.thing}`);

      if (lines.length === 1 && streak.days === 0) {
        return done("nothing waiting — capture a thought when one sparks.");
      }

      return done(lines.join("\n"));
    }

    case "search": {
      if (!argument) return done("usage: !search <query>", "search");
      const hits = search(argument, indexDir).slice(0, SEARCH_LIMIT);

      if (!hits.length) return done(`no hits for "${argument}".`, "search");

      return done(
        hits
          .map(
            (h: { title?: string; path?: string }, i: number) =>
              `${i + 1}. ${h.title || ""}\n   ${h.path || ""}`,
          )
          .join("\n"),
        "search",
      );
    }

    case "did": {
      if (!argument) return done("usage: !did <thing>", "did");
      appendDid(vault, argument, now);

      return done("counted — it shows in the today view.", "did");
    }

    case "plan": {
      if (!argument) return done("usage: !plan <thing>", "plan");
      const plan = setPlan(vault, argument, { source: "discord", now });
      const ifThen = loadTuning(root).engagement.if_then;

      if (ifThen.enabled && ifThen.ask_on_plan) {
        emit(root, "prompt_shown", {
          source: "discord",
          ref: plan.path,
          payload: { mechanic: "if_then" },
        });

        return done(
          `saved ${plan.path}\nwhen? (reply: this afternoon / tonight / tomorrow morning / <iso> / skip)`,
          "plan",
        );
      }

      return done(`saved ${plan.path}`, "plan");
    }

    case "streak": {
      const tuning = loadTuning(root).engagement;
      const s = streakState(readEvents(root, { limit: -1 }), tuning, now);

      return done(
        s.days === 0
          ? "no streak yet — one !did today starts it."
          : `${s.days} day${s.days === 1 ? "" : "s"} - ${s.freezesLeft} freeze${s.freezesLeft === 1 ? "" : "s"} left this month`,
        "streak",
      );
    }

    default:
      return { reply: "", command: null };
  }
}

export async function sendDm(
  apiBase: string,
  botToken: string,
  userId: string,
  text: string,
): Promise<string | null> {
  const headers = {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };

  const channelResponse = await fetch(`${apiBase}/users/@me/channels`, {
    method: "POST",
    headers,
    body: JSON.stringify({ recipient_id: userId }),
  });

  if (!channelResponse.ok) return null;

  const ChannelWire = z.object({ id: z.string() }).catchall(z.json());
  const channel = ChannelWire.parse(await channelResponse.json());

  const messageResponse = await fetch(`${apiBase}/channels/${channel.id}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content: text }),
  });

  if (!messageResponse.ok) return null;

  const message = ChannelWire.parse(await messageResponse.json());

  return message.id;
}
