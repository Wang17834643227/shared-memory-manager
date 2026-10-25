@echo off
REM Shared Memory Manager — daily maintenance wrapper (07:00 scheduled task)
set GIT_TERMINAL_PROMPT=0
cd /d "C:\Users\1\Documents\Qoder\2026-10-25\2ecfdadd\shared-memory-manager"
if not exist "logs" mkdir "logs"
"C:\Program Files\nodejs\node.exe" "scripts\daily-maintenance.js" >> "logs\scheduler-run.log" 2>&1
exit /b %ERRORLEVEL%
