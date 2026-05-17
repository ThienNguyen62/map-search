@echo off
title Start Metro System
color 0A

:: =========================================
::         METRO SYSTEM LAUNCHER
:: =========================================

setlocal

:: Root directory
set "ROOT_DIR=%~dp0"

:: Paths
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

echo.
echo =========================================
echo       Starting Metro System
echo =========================================
echo.

:: Check Python
where python >nul 2>&1

if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    pause
    exit /b
)

:: Check backend
if not exist "%BACKEND_DIR%\app.py" (
    echo [ERROR] backend\app.py not found.
    pause
    exit /b
)

:: Check frontend
if not exist "%FRONTEND_DIR%\html\index.html" (
    echo [ERROR] frontend\html\index.html not found.
    pause
    exit /b
)

echo Starting backend server...
start "Backend Server" cmd /k cd /d "%BACKEND_DIR%" ^&^& python app.py

echo Starting frontend server...
start "Frontend Server" cmd /k cd /d "%FRONTEND_DIR%" ^&^& python -m http.server 5500

echo.
echo Waiting for servers to initialize...
timeout /t 5 /nobreak > nul

echo Opening browser...
start "" http://127.0.0.1:5500/html/index.html

echo.
echo =========================================
echo Backend : http://127.0.0.1:5000
echo Frontend: http://127.0.0.1:5500/html/index.html
echo =========================================
echo.

pause