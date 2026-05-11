@echo off

echo ==================================
echo Starting Backend...
echo ==================================

start cmd /k "cd backend && python app.py"

timeout /t 3 > nul

echo Opening Frontend...

start http://127.0.0.1:5500/frontend/html/index.html