"""THROWAWAY SPIKE — do not build on this.

Minimal capture endpoint to physically test the one-tap Pixel 6 ramp
(research: vault/resources/research/20-mobile-sync.md MS-08/MS-12/MS-13,
decision gate G2 in vault/projects/pkms-design/decisions.md).

Captures land as one timestamped markdown file each in spike/inbox-test/
(NOT the real vault — this spike pre-commits nothing).

Run:    python spike/capture_server.py          (listens on 0.0.0.0:8765)
Token:  set CAPTURE_TOKEN env var to require X-Capture-Token header / ?token=
Stdlib only — no dependencies.
"""
import json
import os
import re
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PORT = 8765
INBOX = Path(__file__).resolve().parent / "inbox-test"
TOKEN = os.environ.get("CAPTURE_TOKEN", "")

TEST_PAGE = """<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>capture spike</title>
<style>body{font-family:sans-serif;max-width:30em;margin:2em auto;padding:0 1em}
textarea{width:100%;height:6em;font-size:1.1em}button{font-size:1.2em;padding:.5em 2em;margin-top:.5em}
#ok{color:green;font-weight:bold}</style></head>
<body><h2>capture spike (throwaway)</h2>
<form onsubmit="event.preventDefault();fetch('/capture',{method:'POST',body:document.getElementById('t').value})
.then(r=>r.text()).then(x=>{document.getElementById('ok').textContent=x;document.getElementById('t').value='';})">
<textarea id="t" autofocus placeholder="dump a thought"></textarea><br>
<button>save</button> <span id="ok"></span></form></body></html>"""


def authed(handler) -> bool:
    if not TOKEN:
        return True
    q = parse_qs(urlparse(handler.path).query)
    return (
        handler.headers.get("X-Capture-Token", "") == TOKEN
        or q.get("token", [""])[0] == TOKEN
    )


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: str, ctype: str = "text/plain; charset=utf-8"):
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self._send(200, "ok")
        elif path == "/":
            self._send(200, TEST_PAGE, "text/html; charset=utf-8")
        else:
            self._send(404, "not found")

    def do_POST(self):
        if urlparse(self.path).path != "/capture":
            return self._send(404, "not found")
        if not authed(self):
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
        if not text:
            return self._send(400, "empty capture")

        now = datetime.now()
        slug = re.sub(r"[^a-z0-9]+", "-", text[:32].lower()).strip("-") or "capture"
        path = INBOX / f"{now:%Y-%m-%d_%H%M%S}_{slug}.md"
        path.write_text(
            f"---\ncaptured: {now:%Y-%m-%d %H:%M:%S}\nsource: capture-spike\n---\n\n{text}\n",
            encoding="utf-8",
        )
        print(f"  captured -> {path.name}")
        self._send(200, f"saved ({path.name})")

    def log_message(self, *args):  # quiet default request logging
        pass


if __name__ == "__main__":
    INBOX.mkdir(exist_ok=True)
    print(f"capture spike on http://0.0.0.0:{PORT}  (inbox: {INBOX})")
    print(f"token auth: {'ON' if TOKEN else 'off (set CAPTURE_TOKEN to enable)'}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
