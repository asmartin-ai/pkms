"""Token-required HTTP capture endpoint + desktop today-view, writing to vault/inbox/.
Stdlib only; meant to run resident (startup shortcut) and be reached over
the tailnet (HTTP Shortcuts tile on the phone — see docs/pixel-capture-setup.md).

Surfaces (the static shell is open; all data routes are token-gated):
  GET  /              302 redirect → /web/ (the new-tab poster front door)
  GET  /web/*         static assets — OPEN (no token; browsers fetch sub-resources
                      without ?token=, and the shell holds no vault data)
  GET  /api/today     today_view() as JSON — token-gated (the app's only data source)
  GET  /capture-page  the original minimal capture form (kept as a side door)
  POST /capture       append a capture to vault/inbox/ (phone tile, web box)
  POST /api/open-note open a vault markdown note locally — token-gated
  GET  /health        liveness, no token

Why /web/* is open: the shell (index.html, app.js, styles.css, sw.js) contains
zero vault content. Every datum flows through /api/today, which stays gated —
and app.js shows its own "token required" banner when that fetch 403s. Token-
gating the shell broke browser sub-resource loads (no ?token= on <script>/<link>).

A token is ALWAYS required — the service refuses to start without one.
Resolution order: explicit --token / PKMS_CAPTURE_TOKEN env, else
.secrets/capture-token (generated on first run, gitignored).
"""

import json
import os
import secrets
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import cast, override
from urllib.parse import parse_qs, urlparse

from .capture import write_capture
from .db import connect
from .resurface import dismiss as resurface_dismiss
from .resurface import let_go as resurface_let_go

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

# The desktop today-view now lives as static assets in src/pkms/web/ — graduated
# from the spike/newtab-firefox/ mockup. Served at /web/ (the new-tab poster,
# slice 7's ambient front door). The inline TODAY_APP string is retired; the
# page fetches /api/today and builds the DOM with textContent, so vault content
# can never break layout or inject markup. Vanilla JS, no deps, no build (§9).
# Design-language bindings are annotated inline in the assets — keep them.
WEB_DIR = Path(__file__).resolve().parent / "web"

# Content-type by extension for the static /web/* route.
_STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
}


def resolve_token(root: Path, token: str | None = None) -> str:
    """Explicit token wins; otherwise read or create .secrets/capture-token."""
    if token:
        return token
    token_file = root / ".secrets" / "capture-token"
    if token_file.exists():
        return token_file.read_text(encoding="utf-8").strip()
    token_file.parent.mkdir(parents=True, exist_ok=True)
    generated = secrets.token_urlsafe(24)
    _ = token_file.write_text(generated, encoding="utf-8")
    return generated


def _safe_vault_file(vault: Path, path_key: object) -> Path | None:
    """Resolve a vault-relative markdown path without allowing traversal."""
    if not path_key:
        return None
    rel = Path(str(path_key))
    if rel.is_absolute() or ".." in rel.parts:
        return None
    target = (vault / rel).resolve()
    vault_root = vault.resolve()
    if not target.is_relative_to(vault_root) or not target.is_file() or target.suffix != ".md":
        return None
    return target


def _open_note_file(path: Path) -> None:
    """Open a note in the user's default markdown app/editor."""
    if os.name == "nt":
        os.startfile(path)  # type: ignore[attr-defined]  # noqa: S606 — local user action
        return

    editor = os.environ.get("EDITOR")
    if editor:
        _ = subprocess.Popen([editor, str(path)])  # noqa: S603 — explicit editor + local path
    elif open_cmd := os.environ.get("PKMS_OPEN_COMMAND"):
        _ = subprocess.Popen([open_cmd, str(path)])  # noqa: S603 — user-provided local opener
    else:
        _ = subprocess.Popen(["xdg-open", str(path)])  # noqa: S603,S607 — local desktop opener


def make_server(
    vault: Path, index_dir: Path, host: str, port: int, token: str
) -> ThreadingHTTPServer:
    if not token:
        raise ValueError("capture service requires a token — refusing to start open")

    class Handler(BaseHTTPRequestHandler):
        def _send(self, code: int, body: str, ctype: str = "text/plain; charset=utf-8") -> None:
            data = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            _ = self.wfile.write(data)

        def _authed(self) -> bool:
            query = parse_qs(urlparse(self.path).query)
            return (
                self.headers.get("X-Capture-Token", "") == token
                or query.get("token", [""])[0] == token
            )

        def do_GET(self) -> None:
            path = urlparse(self.path).path
            if path == "/health":
                return self._send(200, "ok")

            # The static shell (/web/*) is served WITHOUT a token. Browsers
            # fetch sub-resources (styles.css, app.js, sw.js) via <script>/<link>
            # which do NOT carry the ?token= query — gating them 403s the
            # sub-resource and the page never runs. The shell holds no vault
            # data (it's all fetched via /api/today, which stays gated below);
            # app.js shows its own "token required" banner when that fetch 403s.
            if path.startswith("/web/"):
                return self._serve_static(path)

            if not self._authed():  # every data surface below is token-gated
                return self._send(403, "token required")

            # Desktop front door: /  → 302 redirect to the new-tab poster at /web/.
            # Preserves the ?token=… query so the authed page loads without re-prompt.
            if path == "/":
                self.send_response(302)
                qs = urlparse(self.path).query
                self.send_header("Location", "/web/" + ("?" + qs if qs else ""))
                self.end_headers()
                return

            if path == "/capture-page":
                self._send(200, CAPTURE_PAGE, "text/html; charset=utf-8")
            elif path == "/api/today":
                from .today import today_view

                body = json.dumps(today_view(vault, index_dir))
                self._send(200, body, "application/json; charset=utf-8")
            elif path == "/api/reading-queue":
                from .today import reading_queue

                body = json.dumps(reading_queue(vault))
                self._send(200, body, "application/json; charset=utf-8")
            elif path == "/api/recognition-cards":
                from .today import recognition_cards

                body = json.dumps(recognition_cards(vault, index_dir))
                self._send(200, body, "application/json; charset=utf-8")
            elif path == "/api/recent-notes":
                from .today import recent_notes

                body = json.dumps(recent_notes(vault, index_dir))
                self._send(200, body, "application/json; charset=utf-8")
            elif path == "/api/search":
                q = parse_qs(urlparse(self.path).query).get("q", [""])[0]
                from .search import search

                # Empty/whitespace query → [] (the picker renders the empty state).
                # search.search() sanitizes to quoted tokens, but an empty query
                # sanitizes to the empty string, which FTS5 rejects with a syntax
                # error. Guard at the route so the endpoint never 500s.
                body = json.dumps(search(q, index_dir) if q.strip() else [])
                self._send(200, body, "application/json; charset=utf-8")
            else:
                self._send(404, "not found")

        def _serve_static(self, request_path: str) -> None:
            """Serve a file from WEB_DIR. Prevents path traversal; index.html for /web/."""
            rel = request_path[len("/web/") :].lstrip("/")
            if rel == "":
                rel = "index.html"
            # Resolve and confirm the result is still inside WEB_DIR (no traversal).
            # is_relative_to (3.9+) avoids the startswith-prefix footgun where a
            # sibling dir named e.g. `web-evil` would pass a str-prefix check.
            target = (WEB_DIR / rel).resolve()
            if not target.is_relative_to(WEB_DIR.resolve()):
                return self._send(403, "forbidden")
            if not target.is_file():
                return self._send(404, "not found")
            ctype = _STATIC_TYPES.get(target.suffix.lower(), "application/octet-stream")
            data = target.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            _ = self.wfile.write(data)

        def do_POST(self) -> None:
            path_val = urlparse(self.path).path
            if path_val == "/capture":
                if not self._authed():
                    return self._send(403, "bad token")
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length).decode("utf-8", errors="replace").strip()
                # accept raw text, form-encoded 'text=', or JSON {"text": ...}
                text = raw
                ctype = self.headers.get("Content-Type", "")
                if "json" in ctype:
                    try:
                        capture_payload = cast(object, json.loads(raw))
                        if isinstance(capture_payload, dict):
                            payload = cast(dict[str, object], capture_payload)
                            text = str(payload.get("text", raw))
                    except json.JSONDecodeError:
                        pass
                elif "form-urlencoded" in ctype:
                    text = parse_qs(raw).get("text", [raw])[0]
                if not text.strip():
                    return self._send(400, "empty capture")

                query = parse_qs(urlparse(self.path).query)
                source = query.get("source", ["web"])[0]
                saved = write_capture(text, vault, source=source)
                self._send(200, f"saved ✓ {saved.name}")
            elif path_val == "/api/resurface":
                if not self._authed():
                    return self._send(403, "bad token")
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length).decode("utf-8", errors="replace").strip()
                try:
                    resurface_payload = cast(object, json.loads(raw))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    return self._send(400, "invalid json")
                if not isinstance(resurface_payload, dict):
                    return self._send(400, "invalid json")
                payload = cast(dict[str, object], resurface_payload)
                path_key = payload.get("path")
                action = payload.get("action")
                if not path_key or not action:
                    return self._send(400, "missing path or action")
                if action not in {"not-now", "let-go"}:
                    return self._send(400, "unknown action")

                target = _safe_vault_file(vault, path_key)
                if target is None:
                    return self._send(404, "not found")
                safe_path = target.relative_to(vault.resolve()).as_posix()

                if action == "not-now":
                    conn = connect(index_dir)
                    resurface_dismiss(conn, safe_path)
                    conn.close()
                else:
                    _ = resurface_let_go(vault, safe_path)
                body = json.dumps({"ok": True, "action": action, "path": safe_path})
                self._send(200, body, "application/json; charset=utf-8")
            elif path_val == "/api/open-note":
                if not self._authed():
                    return self._send(403, "bad token")
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length).decode("utf-8", errors="replace").strip()
                try:
                    open_note_payload = cast(object, json.loads(raw))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    return self._send(400, "invalid json")
                if not isinstance(open_note_payload, dict):
                    return self._send(400, "invalid json")
                payload = cast(dict[str, object], open_note_payload)
                target = _safe_vault_file(vault, payload.get("path"))
                if target is None:
                    return self._send(404, "not found")

                _open_note_file(target)
                safe_path = target.relative_to(vault.resolve()).as_posix()
                body = json.dumps({"ok": True, "path": safe_path})
                self._send(200, body, "application/json; charset=utf-8")
            else:
                return self._send(404, "not found")

        @override
        def log_message(self, format: str, *args: object) -> None:  # quiet default request logging
            pass

    return ThreadingHTTPServer((host, port), Handler)


def run(
    vault: Path, root: Path, *, host: str = "0.0.0.0", port: int = 8765, token: str | None = None
) -> None:
    token = resolve_token(root, token)
    server = make_server(vault, root / ".index", host, port, token)
    print(f"pkms capture service on http://{host}:{port}  (inbox: {vault / 'inbox'})")
    print(f"today-view:  http://{host}:{port}/web/?token={token}")
    print("token: required (X-Capture-Token header or ?token=)")
    server.serve_forever()
