@echo off
rem Global shim: run pkms from anywhere without activating the venv.
set "PKMS_HOME=%~dp0.."
"%PKMS_HOME%\.venv\Scripts\pkms.exe" %*
