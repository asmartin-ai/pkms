"""Token-required HTTP capture endpoint + desktop today-view, writing to vault/inbox/.

Graduated from spike/capture_server.py after the Pixel ramp validated G2.
Stdlib only; meant to run resident (startup shortcut) and be reached over
the tailnet (HTTP Shortcuts tile on the phone — see docs/pixel-capture-setup.md).

Surfaces (all token-gated except /health):
  GET  /              desktop today-view web app (the main UI, slice 7)
  GET  /api/today     today_view() as JSON — the app's only data source
  GET  /capture-page  the original minimal capture form (kept as a side door)
  POST /capture       append a capture to vault/inbox/ (phone tile, web box)
  GET  /health        liveness, no token

A token is ALWAYS required — the service refuses to start without one.
Resolution order: explicit --token / PKMS_CAPTURE_TOKEN env, else
.secrets/capture-token (generated on first run, gitignored).
"""

import json
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .capture import write_capture

CAPTURE_PAGE = """<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>pkms capture</title>
<style>body{font-family:sans-serif;max-width:30em;margin:2em auto;padding:0 1em}
textarea{width:100%;height:6em;font-size:1.1em}button{font-size:1.2em;padding:.5em 2em;margin-top:.5em}
#ok{color:green;font-weight:bold}</style></head>
<body><form onsubmit="event.preventDefault();
fetch('/capture'+location.search,{method:'POST',body:document.getElementById('t').value})
.then(r=>r.text()).then(x=>{document.getElementById('ok').textContent=x;document.getElementById('t').value='';document.getElementById('t').focus();})">
<textarea id="t" autofocus placeholder="dump a thought"></textarea><br>
<button>save</button> <span id="ok"></span></form></body></html>"""

# The desktop today-view. Static shell (no server-side templating) — it fetches
# /api/today and builds the DOM with textContent, so vault content can never
# break layout or inject markup. Vanilla JS, no deps, no build (architecture §9).
# Copy mirrors the CLI today-view verbatim so the front door reads the same in
# both surfaces; visual tokens are PKMS's own, local. Design-language bindings are
# annotated inline (§N) — keep them when editing.
TODAY_APP = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>pkms · today</title>
<style>
  /* calm, low-arousal palette — never red, no badges (§3). light + dark. */
  :root {
    --bg:#f5f3ee; --surface:#fffdf8; --ink:#2b2926; --dim:#86807a;
    --line:#e7e2d8; --accent:#3f7d78; --accent-soft:#e4efed;
    --good:#4f7a52; --warn:#b07d2b; --shadow:0 1px 2px rgba(40,36,30,.05);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#1c1b19; --surface:#252320; --ink:#e8e4dc; --dim:#928c83;
      --line:#34322e; --accent:#7fc4bd; --accent-soft:#23332f;
      --good:#8fb78f; --warn:#d7a85a; --shadow:0 1px 2px rgba(0,0,0,.2);
    }
  }
  * { box-sizing:border-box; }
  html,body { margin:0; }
  body {
    background:var(--bg); color:var(--ink);
    font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  main { max-width:46rem; margin:0 auto; padding:3.5rem 1.5rem 5rem; }
  .head { display:flex; align-items:baseline; justify-content:space-between;
          gap:1rem; border-bottom:1px solid var(--line); padding-bottom:.6rem; }
  .head h1 { font-size:1.35rem; font-weight:600; margin:0; letter-spacing:.01em; }
  .head .day-rest { color:var(--dim); font-weight:400; }
  .refresh { background:none; border:0; color:var(--dim); cursor:pointer;
             font-size:.95rem; padding:.2rem .4rem; border-radius:.4rem; }
  .refresh:hover { color:var(--accent); background:var(--accent-soft); }

  section { margin-top:1.8rem; }
  .card { background:var(--surface); border:1px solid var(--line);
          border-radius:.7rem; padding:1rem 1.15rem; box-shadow:var(--shadow); }

  /* capture: cursor-ready, instant "saved", never a feed (§1) */
  #capture textarea {
    width:100%; min-height:3.2rem; resize:vertical; border:1px solid var(--line);
    border-radius:.6rem; background:var(--surface); color:var(--ink);
    font:inherit; padding:.7rem .85rem;
  }
  #capture textarea:focus { outline:none; border-color:var(--accent); }
  .cap-row { display:flex; align-items:center; gap:.8rem; margin-top:.55rem; }
  #capture button {
    font:inherit; font-weight:600; color:#fff; background:var(--accent);
    border:0; border-radius:.55rem; padding:.45rem 1.4rem; cursor:pointer;
  }
  #capture button:hover { filter:brightness(1.06); }
  .cap-hint { color:var(--dim); font-size:.85rem; }
  #cap-ok { color:var(--good); font-weight:600; font-size:.9rem; }

  .crumb .label { color:var(--dim); font-size:.85rem; text-transform:lowercase; }
  .crumb p { margin:.25rem 0 0; color:var(--dim); font-style:italic; }

  .status { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem 1.1rem; }
  .pill { display:inline-flex; align-items:center; gap:.5rem; font-size:.95rem; }
  .dot { width:.5rem; height:.5rem; border-radius:50%; background:var(--accent); }
  .pill.clear { color:var(--good); }
  .pebbles { color:var(--good); letter-spacing:.15em; }
  .pebbles + .pebble-label { color:var(--dim); font-size:.85rem; }

  .read .lead, .resurface .lead { color:var(--dim); font-size:.82rem;
        text-transform:lowercase; letter-spacing:.03em; margin-bottom:.3rem; }
  .read .title { font-style:italic; }
  .cost { color:var(--dim); font-size:.85rem; }
  .resurface .q { font-size:1.05rem; }
  .resurface .why { color:var(--dim); font-size:.85rem; margin-top:.35rem; }

  .actions h2 { font-size:.8rem; text-transform:uppercase; letter-spacing:.08em;
                color:var(--dim); font-weight:600; margin:0 0 .7rem; }
  .action { display:grid; grid-template-columns:13rem 1fr; gap:1rem;
            padding:.5rem 0; border-top:1px solid var(--line); }
  .action:first-of-type { border-top:0; }
  .action .who { color:var(--accent); font-weight:600; }
  .action .meta { color:var(--dim); font-size:.82rem; margin-top:.15rem; }
  .more { color:var(--dim); font-size:.88rem; margin-top:.7rem; }
  @media (max-width:34rem) { .action { grid-template-columns:1fr; gap:.1rem; } }

  .invite { color:var(--dim); font-style:italic; margin-top:2.5rem;
            text-align:center; }
  .err { color:var(--warn); }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<main>
  <div class="head">
    <h1 id="date">today</h1>
    <button class="refresh" id="refresh" title="refresh">refresh</button>
  </div>

  <p class="err" id="error" hidden></p>

  <section id="capture" class="card">
    <textarea id="cap-text" placeholder="dump a thought" autofocus></textarea>
    <div class="cap-row">
      <button id="cap-save">save</button>
      <span class="cap-hint">⌘/Ctrl + Enter</span>
      <span id="cap-ok"></span>
    </div>
  </section>

  <section id="crumb" class="card crumb" hidden>
    <div class="label" id="crumb-label"></div>
    <div id="crumb-lines"></div>
  </section>

  <section class="status" id="status"></section>

  <section id="read" class="read" hidden>
    <div class="lead">up next to read</div>
    <div><span class="title" id="read-title"></span> <span class="cost" id="read-cost"></span></div>
  </section>

  <section id="resurface" class="card resurface" hidden>
    <div class="lead">a thought to revisit</div>
    <div class="q" id="resurface-q"></div>
    <div class="why" id="resurface-why"></div>
  </section>

  <section id="actions" class="actions" hidden>
    <h2>next actions</h2>
    <div id="action-list"></div>
    <div class="more" id="more" hidden></div>
  </section>

  <p class="invite">start with whatever pulls you — the rest keeps.</p>
</main>

<script>
const qs = location.search;                 // carries ?token=… for every call
const $ = id => document.getElementById(id);

function showError(msg) { const e = $("error"); e.textContent = msg; e.hidden = false; }

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  const day = d.toLocaleDateString(undefined, { weekday: "long" });
  const rest = d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return { day, rest };
}

function render(v) {
  $("error").hidden = true;
  const { day, rest } = fmtDate(v.date);
  $("date").textContent = "";
  $("date").append(day, Object.assign(document.createElement("span"),
    { className: "day-rest", textContent: " · " + rest }));

  // breadcrumb — re-entry is first-class (§7)
  const crumb = v.breadcrumb;
  if (crumb && crumb.lines && crumb.lines.length) {
    $("crumb-label").textContent = "last time · " + crumb.name;
    const box = $("crumb-lines"); box.textContent = "";
    crumb.lines.forEach(l => {
      const p = document.createElement("p"); p.textContent = l; box.appendChild(p);
    });
    $("crumb").hidden = false;
  } else { $("crumb").hidden = true; }

  // status: inbox as progress not debt (§3), done pebbles forward-only (§3)
  const status = $("status"); status.textContent = "";
  if (v.inbox_new) {
    const pill = document.createElement("span"); pill.className = "pill";
    pill.append(Object.assign(document.createElement("span"), { className: "dot" }),
      Object.assign(document.createElement("strong"),
        { textContent: v.inbox_new + " new to fold in" }),
      Object.assign(document.createElement("span"),
        { className: "cap-hint", textContent: "— captured, safe" }));
    status.appendChild(pill);
  } else {
    const pill = document.createElement("span"); pill.className = "pill clear";
    pill.textContent = "✓ inbox clear"; status.appendChild(pill);
  }
  if (v.done_today) {
    const wrap = document.createElement("span"); wrap.className = "pill";
    wrap.append(Object.assign(document.createElement("span"),
      { className: "pebbles", textContent: "·".repeat(Math.min(v.done_today, 12)) }),
      Object.assign(document.createElement("span"),
        { className: "pebble-label", textContent: v.done_today + " done today" }));
    status.appendChild(wrap);
  }

  // up next to read — consume-cost pill (§6)
  const nr = v.next_read;
  if (nr) {
    $("read-title").textContent = nr.title;
    $("read-cost").textContent = nr.minutes ? "· ~" + nr.minutes + " min" : "";
    $("read").hidden = false;
  } else { $("read").hidden = true; }

  // resurface — the one rationed curious question + why-line (§5/§9)
  const card = v.resurface;
  if (card) {
    $("resurface-q").textContent = card.question;
    $("resurface-why").textContent = card.why;
    $("resurface").hidden = false;
  } else { $("resurface").hidden = true; }

  // next actions — one per note, never a wall (§6)
  const list = $("action-list"); list.textContent = "";
  (v.next_actions || []).forEach(a => {
    const row = document.createElement("div"); row.className = "action";
    const who = document.createElement("div"); who.className = "who";
    who.textContent = a.title;
    const body = document.createElement("div");
    body.appendChild(document.createTextNode(a.text));
    const bits = [a.size, a.first_action].filter(Boolean);
    if (bits.length) {
      const m = document.createElement("div"); m.className = "meta";
      m.textContent = bits.join(" · "); body.appendChild(m);
    }
    row.append(who, body); list.appendChild(row);
  });
  $("actions").hidden = (v.next_actions || []).length === 0;
  const more = $("more");
  if (v.more_notes) { more.textContent = "everything else: pkms tasks"; more.hidden = false; }
  else more.hidden = true;
}

async function load() {
  try {
    const r = await fetch("/api/today" + qs, { headers: { "Accept": "application/json" } });
    if (r.status === 403) return showError("token required — open with ?token=…");
    if (!r.ok) return showError("couldn't load today (" + r.status + ")");
    render(await r.json());
  } catch (e) { showError("couldn't reach the service — is `pkms serve` running?"); }
}

async function save() {
  const ta = $("cap-text"); const text = ta.value.trim();
  if (!text) { ta.focus(); return; }
  const ok = $("cap-ok"); ok.textContent = "saving…";
  try {
    const r = await fetch("/capture" + qs, { method: "POST", body: text });
    ok.textContent = r.ok ? "saved ✓" : "save failed";
    if (r.ok) { ta.value = ""; ta.focus(); load(); }      // refresh inbox-as-progress
  } catch (e) { ok.textContent = "save failed"; }
  setTimeout(() => { ok.textContent = ""; }, 2500);
}

$("cap-save").addEventListener("click", save);
$("cap-text").addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
});
$("refresh").addEventListener("click", load);
load();
</script>
</body>
</html>"""


def resolve_token(root: Path, token: str | None = None) -> str:
    """Explicit token wins; otherwise read or create .secrets/capture-token."""
    if token:
        return token
    token_file = root / ".secrets" / "capture-token"
    if token_file.exists():
        return token_file.read_text(encoding="utf-8").strip()
    token_file.parent.mkdir(parents=True, exist_ok=True)
    generated = secrets.token_urlsafe(24)
    token_file.write_text(generated, encoding="utf-8")
    return generated


def make_server(vault: Path, index_dir: Path, host: str, port: int,
                token: str) -> ThreadingHTTPServer:
    if not token:
        raise ValueError("capture service requires a token — refusing to start open")

    class Handler(BaseHTTPRequestHandler):
        def _send(self, code: int, body: str, ctype: str = "text/plain; charset=utf-8"):
            data = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _authed(self) -> bool:
            query = parse_qs(urlparse(self.path).query)
            return (
                self.headers.get("X-Capture-Token", "") == token
                or query.get("token", [""])[0] == token
            )

        def do_GET(self):
            path = urlparse(self.path).path
            if path == "/health":
                return self._send(200, "ok")
            if not self._authed():  # every surface below is token-gated
                return self._send(403, "token required")
            if path == "/":
                self._send(200, TODAY_APP, "text/html; charset=utf-8")
            elif path == "/capture-page":
                self._send(200, CAPTURE_PAGE, "text/html; charset=utf-8")
            elif path == "/api/today":
                from .today import today_view
                body = json.dumps(today_view(vault, index_dir))
                self._send(200, body, "application/json; charset=utf-8")
            else:
                self._send(404, "not found")

        def do_POST(self):
            if urlparse(self.path).path != "/capture":
                return self._send(404, "not found")
            if not self._authed():
                return self._send(403, "bad token")
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8", errors="replace").strip()
            # accept raw text, form-encoded 'text=', or JSON {"text": ...}
            text = raw
            ctype = self.headers.get("Content-Type", "")
            if "json" in ctype:
                try:
                    text = str(json.loads(raw).get("text", raw))
                except (json.JSONDecodeError, AttributeError):
                    pass
            elif "form-urlencoded" in ctype:
                text = parse_qs(raw).get("text", [raw])[0]
            if not text.strip():
                return self._send(400, "empty capture")

            query = parse_qs(urlparse(self.path).query)
            source = query.get("source", ["web"])[0]
            saved = write_capture(text, vault, source=source)
            self._send(200, f"saved ✓ {saved.name}")

        def log_message(self, *args):  # quiet default request logging
            pass

    return ThreadingHTTPServer((host, port), Handler)


def run(vault: Path, root: Path, *, host: str = "0.0.0.0", port: int = 8765,
        token: str | None = None) -> None:
    token = resolve_token(root, token)
    server = make_server(vault, root / ".index", host, port, token)
    print(f"pkms capture service on http://{host}:{port}  (inbox: {vault / 'inbox'})")
    print(f"today-view:  http://{host}:{port}/?token={token}")
    print("token: required (X-Capture-Token header or ?token=)")
    server.serve_forever()
