@echo off
set "PKMS_HOME=%~dp0.."
bun "%PKMS_HOME%\src\pkms\cli.ts" %*
