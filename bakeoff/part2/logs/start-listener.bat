@echo off
cd /d K:\Projects\PKMS
set NTFY_START_UNIX=1783232050
set PYTHONUNBUFFERED=1
start "ntfy-listener" /B "K:\Projects\PKMS\.venv\Scripts\python.exe" -u "K:\Projects\PKMS\bakeoff\part2\logs\ntfy_listener.py" > "K:\Projects\PKMS\bakeoff\part2\logs\ntfy-listener.stdout" 2>&1
