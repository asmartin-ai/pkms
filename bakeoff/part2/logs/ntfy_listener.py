"""ntfy subscriber for the PKMS Part 2 bakeoff start signal.

Polls the public ntfy topic `kenja-bench-r7k2q9` for new messages every 30s.
Exits 0 as soon as a message indicating content-hoarder is done with their
bakeoff arrives (so PKMS Phase 1 may begin). Filters out the watchdog's own
keepalive/stall/alive pings so they don't false-trigger the start.

The watchdog posts these message shapes (do NOT trigger on them):
  - title 'Watchdog started' / 'Watchdog hourly' / 'Watchdog ...'
  - title 'Stall: CH ...'
  - message 'watchdog alive, uptime ..., phase ch_running'
The content-hoarder-done signal is expected to be a phase transition or an
explicit completion message. We trigger on any message whose title/message
contains 'done', 'complete', 'finished', 'pkms' (case-insensitive), OR whose
phase field (if present) is not 'ch_running'.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

TOPIC = "kenja-bench-r7k2q9"
HERE = Path(__file__).parent
LOG = HERE / "ntfy-listener.log"
MSG = HERE / "ntfy-message.txt"
POLL_SECONDS = 30
REQUEST_TIMEOUT = 12

# Watchdog pings we ignore (do not trigger the start signal).
_WATCHDOG_TITLE_RE = re.compile(r"^watchdog|^stall:", re.IGNORECASE)
_WATCHDOG_MSG_RE = re.compile(
    r"watchdog alive, uptime|stall:|^overnight bakeoff watchdog", re.IGNORECASE
)

# Signal keywords that indicate content-hoarder is done / PKMS may begin.
_SIGNAL_RE = re.compile(
    r"\b(done|complete|completed|finished|pkms|phase\s*1|begin|start|ready|your turn|go ahead)\b",
    re.IGNORECASE,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_watchdog_ping(evt: dict) -> bool:
    title = str(evt.get("title") or "")
    msg = str(evt.get("message") or "")
    if _WATCHDOG_TITLE_RE.search(title):
        return True
    if _WATCHDOG_MSG_RE.search(msg):
        return True
    # Hourly watchdog alive pings: "watchdog alive, uptime Ns, phase ch_running"
    if "watchdog alive" in msg.lower():
        return True
    return False


def _is_start_signal(evt: dict) -> bool:
    """True if this message indicates content-hoarder is done / PKMS may begin."""
    if _is_watchdog_ping(evt):
        return False
    title = str(evt.get("title") or "")
    msg = str(evt.get("message") or "")
    blob = f"{title} {msg}"
    # Phase transition away from ch_running (e.g. "phase ch_done", "phase pkms_phase1", "phase=ch_done")
    phase_match = re.search(r"phase[\s=]+(\w+)", blob, re.IGNORECASE)
    if phase_match:
        phase = phase_match.group(1).lower()
        if phase not in {"ch_running", "running", "ch_run"}:
            return True
        # If phase is still ch_running, this is not the start signal.
        return False
    # No phase field — fall back to keyword matching.
    return bool(_SIGNAL_RE.search(blob))


def main() -> int:
    start_unix = int(os.environ.get("NTFY_START_UNIX") or time.time())
    LOG.write_text(f"[listener] start {_now_iso()} pid={os.getpid()} start_unix={start_unix}\n")
    MSG.unlink(missing_ok=True)
    while True:
        with LOG.open("a", encoding="utf-8") as f:
            f.write(f"[listener] poll {_now_iso()} since={start_unix}\n")
        url = f"https://ntfy.sh/{TOPIC}/json?poll=1&since={start_unix}"
        try:
            resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
        except Exception as exc:
            with LOG.open("a", encoding="utf-8") as f:
                f.write(f"[listener] request error {_now_iso()}: {exc!r}\n")
            time.sleep(10)
            continue
        body = resp.text
        n_lines = body.count("\n")
        with LOG.open("a", encoding="utf-8") as f:
            f.write(
                f"[listener] ok {_now_iso()} status={resp.status_code} lines={n_lines} body_head={body[:200]!r}\n"
            )
        latest_message_time = start_unix
        captured_signal = None
        for line in body.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                evt = json.loads(line)
            except json.JSONDecodeError:
                continue
            if evt.get("event") != "message":
                continue
            evt_time = int(evt.get("time") or 0)
            if evt_time > latest_message_time:
                latest_message_time = evt_time
            if _is_start_signal(evt):
                captured_signal = evt
                # Keep scanning to capture the latest matching signal, but record all.
        # Advance the since cursor past the latest message we've seen, so we never
        # re-evaluate the same messages on the next poll.
        start_unix = max(start_unix, latest_message_time + 1)
        if captured_signal is not None:
            MSG.write_text(json.dumps(captured_signal, ensure_ascii=False), encoding="utf-8")
            with LOG.open("a", encoding="utf-8") as f:
                f.write(f"[listener] START SIGNAL captured {_now_iso()}: {captured_signal}\n")
            print(f"[listener] START SIGNAL: {captured_signal}", flush=True)
            return 0
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    sys.exit(main())
