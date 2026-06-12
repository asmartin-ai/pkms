@echo off
rem Global shim: run pkms from anywhere without activating the venv.
rem K:\Projects\PKMS\bin is on the user PATH (set 2026-06-12, slice 1 follow-up).
set "PKMS_HOME=K:\Projects\PKMS"
"K:\Projects\PKMS\.venv\Scripts\pkms.exe" %*
