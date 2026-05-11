@echo off
echo ============================================================
echo  Starting Entropy RFP Platform - Dev Services
echo ============================================================

REM ── 1. Start Docker infrastructure ──────────────────────────
echo.
echo [1/4] Starting Docker services (Redis, Qdrant, MinIO)...
docker compose -f docker-compose.dev.yml up -d
if %errorlevel% neq 0 (
    echo ERROR: Docker failed. Make sure Docker Desktop is running.
    pause
    exit /b 1
)
echo       Done. Waiting 5s for services to be ready...
timeout /t 5 /nobreak >nul

REM ── 2. Install Python deps ───────────────────────────────────
echo.
echo [2/4] Installing Python dependencies...
cd apps\api
pip install -r requirements.txt -q
if %errorlevel% neq 0 (
    echo ERROR: pip install failed.
    pause
    exit /b 1
)

REM ── 3. Seed the database (creates admin user) ────────────────
echo.
echo [3/4] Seeding database...
python seed.py

REM ── 4. Start Celery worker in a new window ───────────────────
echo.
echo [4/4] Starting Celery worker...
start "Entropy - Celery Worker" cmd /k "cd /d %~dp0apps\api && celery -A core.celery_app worker --loglevel=info --concurrency=2 --pool=solo"

REM ── 5. Start FastAPI server ──────────────────────────────────
echo.
echo ============================================================
echo  Starting FastAPI on http://localhost:8000
echo  API docs: http://localhost:8000/docs
echo  Press Ctrl+C to stop.
echo ============================================================
echo.
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
