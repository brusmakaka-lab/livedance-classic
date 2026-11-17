@echo off
cd /d "%~dp0"
node scripts/launch-v05.mjs --capture
if errorlevel 1 pause
