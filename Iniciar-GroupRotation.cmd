@echo off
cd /d "%~dp0"
node scripts/launch-v05.mjs 
if errorlevel 1 pause
