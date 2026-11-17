@echo off
cd /d "%~dp0"
node scripts/launch-v05.mjs --stop
if errorlevel 1 pause
