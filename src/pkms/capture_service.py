"""Token-required HTTP capture endpoint writing to vault/inbox/.

Graduated from spike/capture_server.py after the Pixel ramp validated G2.
Stdlib only; meant to run resident (startup shortcut) and be reached over
the tailnet (HTTP Shortcuts tile on the phone — see docs/pixel-capture-setup.md).

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


def make_server(vault: Path, host: str, port: int, token: str) -> ThreadingHTTPServer:
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
                self._send(200, "ok")
            elif path == "/":
                if not self._authed():
                    return self._send(403, "token required")
                self._send(200, CAPTURE_PAGE, "text/html; charset=utf-8")
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
    server = make_server(vault, host, port, token)
    print(f"pkms capture service on http://{host}:{port}  (inbox: {vault / 'inbox'})")
    print("token: required (X-Capture-Token header or ?token=)")
    server.serve_forever()
