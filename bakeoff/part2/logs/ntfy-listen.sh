#!/usr/bin/env bash
# Poll-subscribe to ntfy until a message arrives whose time > START_TIME.
# (Self-test messages posted before arming are ignored via the since parameter.)
TOPIC="kenja-bench-r7k2q9"
LOG="K:/Projects/PKMS/bakeoff/part2/logs/ntfy-listener.log"
MSG="K:/Projects/PKMS/bakeoff/part2/logs/ntfy-message.txt"
START=$(date -u +%s)
echo "[listener] start $(date -Iseconds) topic=$TOPIC pid=$$ start_unix=$START" > "$LOG"
rm -f "$MSG"
while :; do
  echo "[listener] poll $(date -Iseconds) since=$START" >> "$LOG"
  body=$(curl -sS --max-time 12 "https://ntfy.sh/$TOPIC/json?poll=1&since=$START" 2>&1)
  rc=$?
  n_lines=$(printf '%s\n' "$body" | wc -l)
  echo "[listener] curl rc=$rc lines=$n_lines body_head=$(printf '%s' "$body" | head -c 200)" >> "$LOG"
  if [ "$rc" -ne 0 ]; then
    echo "[listener] curl error, sleep+retry" >> "$LOG"
    sleep 10
    continue
  fi
  # Each line is one JSON event. Look for any message event.
  msg=$(printf '%s\n' "$body" | grep '"event":"message"' | head -1)
  if [ -n "$msg" ]; then
    printf '%s\n' "$msg" > "$MSG"
    echo "[listener] MESSAGE captured at $(date -Iseconds): $msg" >> "$LOG"
    exit 0
  fi
  sleep 30
done
