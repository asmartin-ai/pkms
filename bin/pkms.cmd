@echo off
rem Global shim: run pkms from anywhere without activating the venv.
rem /path/to/PKMS\bin is on the user PATH (set 2026-06-12, slice 1 follow-up).
set "PKMS_HOME=/path/to/PKMS"
"/path/to/PKMS\.venv\Scripts\pkms.exe" %*
