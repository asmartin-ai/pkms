import { z } from "zod";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { File } from "node:buffer";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import nunjucks from "nunjucks";
import { createHash } from "node:crypto";
import { writeCapture, type WriteCaptureOptions } from "./capture.ts";
import { attachmentLink, guessExt, mediaDirFor } from "./keep_ingest.ts";
import { extractText } from "./ocr.ts";
import { connect } from "./db.ts";
import { emit } from "./events.ts";
import { pullKeepIfStale } from "./keep_pull.ts";
import { append, load } from "./ledger.ts";
import { dismiss, letGo } from "./resurface.ts";
import { search } from "./search.ts";
import { readSource } from "./sources.ts";
import { pyStrip } from "./textio.ts";
import { resolveSecret } from "./secrets.ts";
import {
  areaTiles,
  inboxItems,
  readingQueue,
  recognitionCards,
  recentNotes,
  todayView,
} from "./today.ts";
import {
  renderToday,
  renderReadingQueue,
  renderActions,
  renderSearchResults,
  renderRecentNotes,
} from "./web_shell.ts";
import {
  answerPlan,
  completePlan,
  markFreshStartShown,
  readPlan,
  resolveWhen,
  setPlan,
} from "./engagement.ts";
import { loadTuning } from "./route_rules.ts";
import { renderPlanConfirmed, renderPlanPrompt } from "./web_shell.ts";

export const CAPTURE_PAGE_TEMPLATE = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>pkms capture</title>
<style>
body{font-family:sans-serif;max-width:30em;margin:2em auto;padding:0 1em}
textarea{width:100%;height:6em;font-size:1.1em}
button{font-size:1.2em;padding:.5em 2em;margin-top:.5em}
#ok{color:green;font-weight:bold}
</style></head>
<body><form onsubmit="event.preventDefault();
fetch('/capture'+location.search,{method:'POST',body:document.getElementById('t').value})
.then(r=>r.text()).then(x=>{document.getElementById('ok').textContent=x;document.getElementById('t').value='';document.getElementById('t').focus();})">
<textarea id="t" autofocus placeholder="dump a thought"></textarea><br>
<button>save</button> <span id="ok"></span></form></body></html>`;

const njkEnv = new nunjucks.Environment(null, { autoescape: true });

export function renderCapturePage(): string {
  return njkEnv.renderString(CAPTURE_PAGE_TEMPLATE, {});
}

export const WEB_DIR = resolve(import.meta.dir, "web");

export const MAX_SHARE_FILES = 10;

export const MAX_SHARE_FILE_BYTES = 20 * 1024 * 1024;

function staticContentType(extension: string): string {
  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

export const CH_PROMOTE_LEDGER = "ch-promote-ledger.txt";

const JsonValueSchema = z.json();

type JsonValue = z.infer<typeof JsonValueSchema>;

const StringSchema = z.string();

const NumberSchema = z.number();

const ContextEnvelopeSchema = z
  .object({
    device: z.string().optional(),
    app: z.string().optional(),
  })
  .passthrough();

const ENVELOPE_FIELDS = [
  "source_account_id",
  "raw_ref",
  "ch_origin_ref",
  "ch_captured_at",
] as const;

const EnvelopeSchema = z
  .object({
    text: JsonValueSchema.optional(),
    ch_item_id: JsonValueSchema.optional(),
    source_account_id: JsonValueSchema.optional(),
    raw_ref: JsonValueSchema.optional(),
    ch_origin_ref: JsonValueSchema.optional(),
    ch_captured_at: JsonValueSchema.optional(),
    context: JsonValueSchema.optional(),
  })
  .passthrough();

type CaptureEnvelope = z.infer<typeof EnvelopeSchema>;

const ResurfaceRequestSchema = z
  .object({
    path: z.string().nullable().optional(),
    action: z.string().nullable().optional(),
  })
  .passthrough();

type ResurfaceRequest = z.infer<typeof ResurfaceRequestSchema>;

const OpenNoteRequestSchema = z
  .object({
    path: z.string().nullable().optional(),
    origin: z.enum(["search", "resurface"]).optional(),
  })
  .passthrough();

type OpenNoteRequest = z.infer<typeof OpenNoteRequestSchema>;

let chPromoteTail: Promise<void> = Promise.resolve();

export function withChPromoteLock<T>(fn: () => T): Promise<T> {
  const run = chPromoteTail.then(fn);
  chPromoteTail = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

export function envelopeToFrontmatter(
  payload: CaptureEnvelope,
  chItemId: string,
): NonNullable<WriteCaptureOptions["extra"]> {
  const extra: NonNullable<WriteCaptureOptions["extra"]> = { ch_item_id: chItemId };

  for (const key of ENVELOPE_FIELDS) {
    const parsed = StringSchema.safeParse(payload[key]);

    if (parsed.success && parsed.data) extra[key] = parsed.data;
  }

  const context = ContextEnvelopeSchema.safeParse(payload.context);

  if (context.success) {
    for (const part of ["device", "app"] as const) {
      const val = context.data[part];

      if (val) extra[`context_${part}`] = val;
    }
  }

  return extra;
}

export function findCaptureWithChItem(vault: string, chItemId: string): string | null {
  const marker = `ch_item_id: ${chItemId}`;
  const stack = [vault];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;

    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const p = join(dir, entry.name);

      if (entry.isDirectory()) {
        stack.push(p);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        let head: string;

        try {
          head = readFileSync(p, "utf8").slice(0, 2048);
        } catch {
          continue;
        }

        if (head.includes(marker)) return p;
      }
    }
  }

  return null;
}

export function resolveToken(root: string, token?: string | null): string {
  if (token) return token;

  const resolved = resolveSecret(root, "capture-token");

  if (resolved !== null) return resolved;

  const secretsDir = join(root, ".secrets");
  const tokenFile = join(secretsDir, "capture-token");
  mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
  const generated = randomBytes(24).toString("base64url");
  writeFileSync(tokenFile, generated, { mode: 0o600 });

  return generated;
}

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

function isRelativeTo(target: string, root: string): boolean {
  if (target === root) return true;
  const rel = relative(root, target);

  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

export function safeVaultFile(vault: string, pathKey: string | null): string | null {
  if (!pathKey) return null;
  const rel = pathKey;

  if (isAbsolute(rel)) return null;

  if (rel.split(/[/\\]+/).includes("..")) return null;
  const vaultRoot = resolve(vault);
  const target = resolve(vaultRoot, rel);

  if (!isRelativeTo(target, vaultRoot)) return null;
  let st;

  try {
    st = statSync(target);
  } catch {
    return null;
  }

  if (!st.isFile()) return null;
  let realTarget: string;

  try {
    realTarget = realpathSync(target);
  } catch {
    return null;
  }

  if (!isRelativeTo(realTarget, realpathSync(vaultRoot))) return null;

  if (extname(realTarget) !== ".md") return null;

  return target;
}

export function openNoteFile(path: string): void {
  if (process.platform === "win32") {
    Bun.spawn(["cmd", "/c", "start", "", path], { stdout: "ignore", stderr: "ignore" });

    return;
  }

  const editor = process.env["EDITOR"];

  if (editor) {
    Bun.spawn([editor, path], { stdout: "ignore", stderr: "ignore" });
  } else if (process.env["PKMS_OPEN_COMMAND"]) {
    Bun.spawn([process.env["PKMS_OPEN_COMMAND"], path], { stdout: "ignore", stderr: "ignore" });
  } else {
    Bun.spawn(["xdg-open", path], { stdout: "ignore", stderr: "ignore" });
  }
}

function pyStr(v: JsonValue): string {
  if (v === null) return "None";

  if (v === true) return "True";

  if (v === false) return "False";

  const number = NumberSchema.safeParse(v);

  if (number.success && Number.isInteger(number.data)) return `${number.data}.0`;

  return String(v);
}

export interface MakeServerOptions {
  vault: string;
  indexDir: string;
  host: string;
  port: number;
  token: string;
  openNoteFile?: (path: string) => void;
  pullKeep?: () => Promise<void>;
  shareOcr?: (path: string) => string | null | Promise<string | null>;
}

export function makeServer(opts: MakeServerOptions) {
  if (!opts.token) {
    throw new Error("capture service requires a token — refusing to start open");
  }

  const { vault, indexDir, token } = opts;
  const openNote = opts.openNoteFile ?? openNoteFile;
  const vaultRoot = resolve(vault);
  const root = dirname(vaultRoot);
  const webRoot = resolve(WEB_DIR);

  const send = (status: number, body: string, ctype = "text/plain; charset=utf-8") =>
    new Response(body, { status, headers: { "Content-Type": ctype } });

  const sendJson = <T>(obj: T) => send(200, JSON.stringify(obj), "application/json; charset=utf-8");

  const authed = (req: Request, url: URL) =>
    tokenMatches(req.headers.get("x-capture-token") ?? "", token) ||
    tokenMatches(url.searchParams.get("token") ?? "", token);

  const sameOrigin = (req: Request, url: URL): boolean => {
    const origin = req.headers.get("origin");

    if (origin === null || origin === "null") return true;

    return new URL(origin).origin === url.origin;
  };

  const isHtmx = (req: Request) => req.headers.get("hx-request") === "true";

  const sendHtmxRefresh = () =>
    new Response("", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "HX-Trigger": "pkms:refresh" },
    });

  const serveStatic = (requestPath: string): Response => {
    let rel = requestPath.slice("/web/".length).replace(/^\/+/, "");

    if (rel === "") rel = "index.html";
    const target = resolve(webRoot, rel);

    if (!isRelativeTo(target, webRoot)) return send(403, "forbidden");
    let st;

    try {
      st = statSync(target);
    } catch {
      return send(404, "not found");
    }

    if (!st.isFile()) return send(404, "not found");
    let realTarget: string;

    try {
      realTarget = realpathSync(target);
    } catch {
      return send(404, "not found");
    }

    if (!isRelativeTo(realTarget, realpathSync(webRoot))) return send(403, "forbidden");
    const ctype = staticContentType(extname(target).toLowerCase());

    return new Response(readFileSync(target), { status: 200, headers: { "Content-Type": ctype } });
  };

  const handleCapture = async (req: Request, url: URL): Promise<Response> => {
    if (!authed(req, url)) return send(403, "bad token");
    const raw = pyStrip(await req.text());
    let text = raw;
    let payload: CaptureEnvelope | null = null;
    const ctype = req.headers.get("content-type") ?? "";

    if (ctype.includes("json")) {
      try {
        const result = EnvelopeSchema.safeParse(JSON.parse(raw));

        if (result.success) {
          payload = result.data;
          text = payload.text === undefined ? raw : pyStr(payload.text);
        }
      } catch {}
    } else if (ctype.includes("form-urlencoded")) {
      text = new URLSearchParams(raw).getAll("text").find((v) => v !== "") ?? raw;
    }

    if (!pyStrip(text)) return send(400, "empty capture");
    const source = url.searchParams.getAll("source").find((v) => v !== "") ?? "web";
    const parsedChItemId = StringSchema.safeParse(payload?.ch_item_id);
    const chItemId = parsedChItemId.success ? parsedChItemId.data.trim() : "";

    if (chItemId) {
      return withChPromoteLock(() => {
        if (load(indexDir, CH_PROMOTE_LEDGER).has(chItemId)) {
          const existing = findCaptureWithChItem(vault, chItemId);
          const name = existing ? basename(existing) : "";

          if (isHtmx(req)) return sendHtmxRefresh();

          return send(200, pyStrip(`already saved ✓ ${name}`));
        }

        const extra = payload !== null ? envelopeToFrontmatter(payload, chItemId) : {};
        const saved = writeCapture(text, vault, { source, extra });
        append(indexDir, CH_PROMOTE_LEDGER, [chItemId]);

        if (isHtmx(req)) return sendHtmxRefresh();

        return send(200, `saved ✓ ${basename(saved)}`);
      });
    }

    const saved = writeCapture(text, vault, { source, extra: {} });

    if (isHtmx(req)) return sendHtmxRefresh();

    return send(200, `saved ✓ ${basename(saved)}`);
  };

  const handleShare = async (req: Request, url: URL): Promise<Response> => {
    if (!sameOrigin(req, url)) return send(403, "cross-origin share rejected");

    if (!authed(req, url)) {
      return send(
        403,
        "<html><body><p>Share once after opening the PKMS app — its service worker stores the token.</p></body></html>",
        "text/html; charset=utf-8",
      );
    }

    const form = await req.formData();

    const title = String(form.get("title") ?? "")
      .replace(/\r\n/g, "\n")
      .trim();

    const text = String(form.get("text") ?? "")
      .replace(/\r\n/g, "\n")
      .trim();

    const sharedUrl = String(form.get("url") ?? "")
      .replace(/\r\n/g, "\n")
      .trim();

    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

    if (files.length > MAX_SHARE_FILES) {
      return send(413, `too many files — a share carries at most ${MAX_SHARE_FILES} images`);
    }

    const oversized = files.find((f) => f.size > MAX_SHARE_FILE_BYTES);

    if (oversized) {
      return send(
        413,
        `image too large — ${oversized.name || "share"} is ${oversized.size} bytes; ` +
          `the per-image cap is ${MAX_SHARE_FILE_BYTES} bytes`,
      );
    }

    const lines: string[] = [];

    if (title && !text.includes(title)) lines.push(title);

    if (text) lines.push(text);

    if (sharedUrl && !text.includes(sharedUrl) && sharedUrl !== title) lines.push(sharedUrl);

    let body = lines.join("\n\n");
    const mediaDir = mediaDirFor(root);

    for (const file of files) {
      const data = new Uint8Array(await file.arrayBuffer());
      const sha = createHash("sha256").update(data).digest("hex");
      const ext = guessExt(file.name || "", data) || "";
      mkdirSync(mediaDir, { recursive: true });
      const dest = join(mediaDir, `${sha}${ext}`);

      if (!existsSync(dest)) writeFileSync(dest, data);
      body += `\n\n${attachmentLink(dest)}`;
      const ocr = await (opts.shareOcr ?? extractText)(dest);

      if (ocr === null) body += "\n\n(OCR unavailable)";
      else if (ocr) body += `\n\n${ocr}`;
    }

    if (!body.trim()) body = "(empty share)";
    writeCapture(body, vault, { source: "share" });

    const token = req.headers.get("x-capture-token") || url.searchParams.get("token") || "";

    return new Response(null, {
      status: 303,
      headers: { Location: `/web/?token=${encodeURIComponent(token)}&saved=share` },
    });
  };

  const readJsonPayload = async <T>(req: Request, schema: z.ZodType<T>): Promise<T | null> => {
    const raw = pyStrip(await req.text());
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    const result = schema.safeParse(parsed);

    return result.success ? result.data : null;
  };

  const handleResurface = async (req: Request, url: URL): Promise<Response> => {
    if (!authed(req, url)) return send(403, "bad token");
    const payload: ResurfaceRequest | null = await readJsonPayload(req, ResurfaceRequestSchema);

    if (payload === null) return send(400, "invalid json");
    const pathKey = payload.path;
    const action = payload.action;

    if (!pathKey || !action) return send(400, "missing path or action");

    if (action !== "not-now" && action !== "let-go") return send(400, "unknown action");

    const target = safeVaultFile(vault, pathKey);

    if (target === null) return send(404, "not found");
    const safePath = relative(vaultRoot, target).split("\\").join("/");

    if (action === "not-now") {
      const conn = connect(indexDir);
      dismiss(conn, safePath);
      conn.close();
      emit(root, "resurface_not_now", {
        source: "pkms",
        ref: safePath,
        payload: { path: safePath, action: "not-now" },
      });
    } else {
      letGo(vault, safePath);
      emit(root, "resurface_let_go", {
        source: "pkms",
        ref: safePath,
        payload: { path: safePath, action: "let-go" },
      });
    }

    if (isHtmx(req)) return sendHtmxRefresh();

    return sendJson({ ok: true, action, path: safePath });
  };

  const handlePlan = async (req: Request, url: URL): Promise<Response> => {
    if (!authed(req, url)) return send(403, "bad token");

    const payload: { thing: string | null } | null = await readJsonPayload(
      req,
      z.object({ thing: z.string().trim().min(1) }),
    );

    if (payload === null || !payload.thing) return send(400, "invalid json");
    const plan = setPlan(vault, payload.thing, { source: "web" });
    markFreshStartShown(root);

    const ifThen = loadTuning(root).engagement.if_then;

    if (ifThen.enabled && ifThen.ask_on_plan) {
      emit(root, "prompt_shown", {
        source: "web",
        ref: plan.path,
        payload: { mechanic: "if_then" },
      });

      return send(200, renderPlanPrompt(plan.path), "text/html; charset=utf-8");
    }

    return send(200, renderPlanConfirmed(false), "text/html; charset=utf-8");
  };

  const handlePlanAnswer = async (req: Request, url: URL): Promise<Response> => {
    if (!authed(req, url)) return send(403, "bad token");

    const schema = z.object({
      path: z.string().trim().min(1),
      when: z.string().trim().optional(),
      cue: z.string().trim().optional(),
      skipped: z.boolean().optional(),
      done: z.boolean().optional(),
    });

    const payload: z.infer<typeof schema> | null = await readJsonPayload(req, schema);

    if (payload === null || !payload.path) return send(400, "invalid json");
    const target = safeVaultFile(vault, payload.path);

    if (target === null) return send(404, "not found");
    const rel = relative(vaultRoot, target).split("\\").join("/");

    if (readPlan(vault, rel) === null) return send(404, "not a plan note");

    if (payload.done) {
      completePlan(vault, rel);

      return send(200, renderPlanConfirmed(false), "text/html; charset=utf-8");
    }

    let when: string | undefined;

    if (payload.when) {
      const resolved = resolveWhen(payload.when);

      if (resolved === null) return send(400, "unknown when");

      when = resolved;
    }

    answerPlan(vault, rel, { when, cue: payload.cue, skipped: payload.skipped });

    return send(200, renderPlanConfirmed(payload.skipped === true), "text/html; charset=utf-8");
  };

  const handleOpenNote = async (req: Request, url: URL): Promise<Response> => {
    if (!authed(req, url)) return send(403, "bad token");
    const payload: OpenNoteRequest | null = await readJsonPayload(req, OpenNoteRequestSchema);

    if (payload === null) return send(400, "invalid json");
    const target = safeVaultFile(vault, payload.path ?? null);

    if (target === null) return send(404, "not found");
    openNote(target);
    const safePath = relative(vaultRoot, target).split("\\").join("/");
    const dugOut = payload.origin === "search" && safePath.startsWith("sources/");

    emit(root, "note_opened", {
      source: "pkms",
      ref: safePath,
      payload: { path: safePath, dug_out: dugOut },
    });

    if (payload.origin === "resurface") {
      emit(root, "resurface_act", { source: "pkms", ref: safePath, payload: { path: safePath } });
    }

    if (dugOut) {
      try {
        const rec = readSource(vault, safePath);
        emit(root, "dug_out", {
          source: rec.data.source,
          ref: safePath,
          payload: { source_note: safePath, route: rec.data.route },
        });
      } catch (error) {
        console.error(
          `[ledger] source open: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (isHtmx(req)) return sendHtmxRefresh();

    return sendJson({ ok: true, path: safePath });
  };

  const fetchHandler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "GET") {
      if (path === "/health") return send(200, "ok");

      if (path.startsWith("/web/")) return serveStatic(path);

      if (!authed(req, url)) return send(403, "token required");

      if (path === "/") {
        return new Response(null, { status: 302, headers: { Location: "/web/" + url.search } });
      }

      if (path === "/capture-page") {
        return send(200, renderCapturePage(), "text/html; charset=utf-8");
      }

      if (path === "/api/today") {
        pullKeepIfStale(root, opts.pullKeep);
        emit(root, "today_opened", { source: "pkms", ref: "today", payload: { surface: "json" } });

        return sendJson(todayView(vault, indexDir));
      }

      if (path === "/api/reading-queue") return sendJson(readingQueue(vault));

      if (path === "/api/recognition-cards") return sendJson(recognitionCards(vault, indexDir));

      if (path === "/api/recent-notes") return sendJson(recentNotes(vault, indexDir));

      if (path === "/api/search") {
        const q = url.searchParams.get("q") ?? "";
        const trimmed = q.trim();

        const results = trimmed ? search(trimmed, indexDir) : [];

        return sendJson(results);
      }

      if (path === "/api/inbox-items") return sendJson(inboxItems(vault));

      if (path === "/api/area-tiles") return sendJson(areaTiles(vault, indexDir));

      if (path === "/partial/today") {
        pullKeepIfStale(root, opts.pullKeep);
        emit(root, "today_opened", { source: "pkms", ref: "today", payload: { surface: "htmx" } });

        return send(200, renderToday(vault, indexDir), "text/html; charset=utf-8");
      }

      if (path === "/partial/reading-queue") {
        return send(200, renderReadingQueue(vault), "text/html; charset=utf-8");
      }

      if (path === "/partial/actions") {
        return send(200, renderActions(vault, indexDir), "text/html; charset=utf-8");
      }

      if (path === "/partial/recent-notes") {
        return send(200, renderRecentNotes(vault, indexDir), "text/html; charset=utf-8");
      }

      if (path === "/partial/search") {
        const q = url.searchParams.get("q") ?? "";

        return send(200, renderSearchResults(q, indexDir), "text/html; charset=utf-8");
      }

      return send(404, "not found");
    }

    if (req.method === "POST") {
      if (path === "/web/share") return handleShare(req, url);

      if (path === "/capture") return handleCapture(req, url);

      if (path === "/api/resurface") return handleResurface(req, url);

      if (path === "/api/open-note") return handleOpenNote(req, url);

      if (path === "/api/plan") return handlePlan(req, url);

      if (path === "/api/plan-answer") return handlePlanAnswer(req, url);

      return send(404, "not found");
    }

    return send(501, "unsupported method");
  };

  return Bun.serve({ hostname: opts.host, port: opts.port, fetch: fetchHandler });
}

export function run(
  vault: string,
  root: string,
  opts: { host?: string; port?: number; token?: string } = {},
) {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 8765;
  const token = resolveToken(root, opts.token ?? null);
  const server = makeServer({ vault, indexDir: join(root, ".index"), host, port, token });
  console.log(`pkms capture service on http://${host}:${port}  (inbox: ${join(vault, "inbox")})`);
  console.log(`today-view:  http://${host}:${port}/web/?token=<.secrets/capture-token>`);
  console.log("token: required (X-Capture-Token header or ?token=)");

  return server;
}
