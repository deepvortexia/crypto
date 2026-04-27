@echo off
setlocal EnableDelayedExpansion
title DeepVortex BTC — Dev Launcher

echo.
echo  =========================================================
echo   DeepVortex BTC Predictor — Local Dev Launcher
echo  =========================================================
echo.

:: ── Resolve project root (directory where this .bat lives) ──────────────────
set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend

:: ── Check Python ─────────────────────────────────────────────────────────────
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found. Install Python 3.11+ and add it to PATH.
    echo         https://www.python.org/downloads/
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  Python : %%v

:: ── Check Node ───────────────────────────────────────────────────────────────
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found. Install Node.js 18+ and add it to PATH.
    echo         https://nodejs.org/
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo  Node   : %%v
for /f "tokens=*" %%v in ('npm --version 2^>^&1')  do echo  npm    : %%v
echo.

:: ── Backend: create venv if missing ──────────────────────────────────────────
echo  [1/4] Setting up Python virtual environment...
if not exist "%BACKEND%\.venv\Scripts\activate.bat" (
    python -m venv "%BACKEND%\.venv"
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause & exit /b 1
    )
    echo        Virtual environment created.
) else (
    echo        Virtual environment already exists, skipping.
)

:: ── Backend: install pip dependencies ────────────────────────────────────────
echo.
echo  [2/4] Installing backend dependencies (this may take a few minutes
echo        on first run — PyTorch is included)...
call "%BACKEND%\.venv\Scripts\activate.bat"
pip install -r "%BACKEND%\requirements.txt" --quiet
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pip install failed. Check your internet connection.
    pause & exit /b 1
)
echo        Backend dependencies ready.

:: ── Backend: create .env if missing ──────────────────────────────────────────
if not exist "%BACKEND%\.env" (
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
    echo.
    echo  [NOTE] Created backend\.env from .env.example.
    echo         Edit it to add your COINGECKO_API_KEY and ADMIN_SECRET.
)

:: ── Frontend: install npm dependencies ───────────────────────────────────────
echo.
echo  [3/4] Installing frontend dependencies...
pushd "%FRONTEND%"
call npm install --prefer-offline --silent
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm install failed.
    popd & pause & exit /b 1
)
popd
echo        Frontend dependencies ready.

:: ── Frontend: create .env if missing ─────────────────────────────────────────
if not exist "%FRONTEND%\.env" (
    echo VITE_API_URL=http://localhost:8000 > "%FRONTEND%\.env"
    echo        Created frontend\.env pointing to http://localhost:8000
)

:: ── Launch servers in separate windows ───────────────────────────────────────
echo.
echo  [4/4] Starting servers...
echo.

:: Backend window
start "DeepVortex — Backend (port 8000)" cmd /k ^
    "title DeepVortex Backend && cd /d "%BACKEND%" && call .venv\Scripts\activate.bat && echo. && echo  Backend starting on http://localhost:8000 && echo  API docs at   http://localhost:8000/docs && echo. && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Small delay so backend window opens first
timeout /t 2 /nobreak >nul

:: Frontend window
start "DeepVortex — Frontend (port 5173)" cmd /k ^
    "title DeepVortex Frontend && cd /d "%FRONTEND%" && echo. && echo  Frontend starting on http://localhost:5173 && echo. && npm run dev"

echo  =========================================================
echo   Both servers are starting in separate windows.
echo.
echo   Backend  : http://localhost:8000
echo   API docs : http://localhost:8000/docs
echo   Frontend : http://localhost:5173
echo.
echo   NOTE: The backend trains ML models on first run.
echo         Prediction cards show a spinner for ~2-5 minutes
echo         until training completes.
echo  =========================================================
echo.
pause
