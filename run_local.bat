@echo off
echo ==========================================
echo RUNNING SPARSE-KUIPER (LOCAL VERSION)
echo ==========================================

set MODE=%1
set LAN_IP=%2

if "%MODE%"=="" set MODE=local

set FRONTEND_HOST=localhost
set API_BASE=http://localhost:8000/api/v1

if /I "%MODE%"=="lan" (
    set FRONTEND_HOST=0.0.0.0
    if "%LAN_IP%"=="" (
        echo.
        echo LAN mode but no IP provided.
        echo Usage: run_local.bat lan 192.168.1.10
        echo.
        set API_BASE=http://localhost:8000/api/v1
    ) else (
        set API_BASE=http://%LAN_IP%:8000/api/v1
    )
)

:: Menjalankan Backend di terminal baru
echo Starting Backend (FastAPI)...
start cmd /k "cd backend && call venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Menjalankan Frontend di terminal baru
echo Starting Frontend (Next.js)...
start cmd /k "cd frontend && set NEXT_PUBLIC_API_URL=%API_BASE% && npm run dev -- --hostname %FRONTEND_HOST% --port 3000"

echo.
echo ==========================================
echo APLIKASI SEDANG BERJALAN!
echo Backend: http://localhost:8000/docs
echo Frontend: http://localhost:3000
if /I "%MODE%"=="lan" (
    echo.
    echo LAN: buka dari device lain: http://%LAN_IP%:3000
    echo API Base (frontend): %API_BASE%
)
echo ==========================================
echo Tekan sembarang tombol untuk keluar (terminal aplikasi akan tetap berjalan).
pause
