@echo off
echo ==========================================
echo SETUP SPARSE-KUIPER (LOCAL VERSION)
echo ==========================================

echo.
echo [1/3] Setting up Backend...
cd backend
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
echo Installing backend dependencies...
call venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium firefox
cd ..

echo.
echo [2/3] Setting up Frontend...
cd frontend
echo Installing frontend dependencies...
call npm install
cd ..

echo.
echo [3/3] Creating data directories...
if not exist projects mkdir projects
if not exist video_projects mkdir video_projects
if not exist upload_queue mkdir upload_queue

echo.
echo ==========================================
echo SETUP SELESAI!
echo Jalankan run_local.bat untuk memulai aplikasi.
echo Untuk LAN: run_local.bat lan 192.168.1.10
echo ==========================================
pause
