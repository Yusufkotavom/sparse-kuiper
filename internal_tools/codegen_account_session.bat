@echo off
setlocal

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
for %%I in ("%BASE_DIR%\..") do set "ROOT_DIR=%%~fI"

set "ACCOUNT_ID=%~1"
if "%ACCOUNT_ID%"=="" (
  echo Usage: codegen_account_session.bat ^<account_id^> [url]
  exit /b 1
)

set "PROFILE_DIR=%ROOT_DIR%\data\sessions\%ACCOUNT_ID%\chrome_profile"
if not exist "%PROFILE_DIR%" (
  echo Session profile tidak ditemukan: "%PROFILE_DIR%"
  exit /b 1
)

python -m playwright --version >nul 2>nul
if errorlevel 1 (
  echo Playwright belum terinstall untuk python aktif.
  exit /b 1
)

set "TARGET_URL=%~2"
if "%TARGET_URL%"=="" set "TARGET_URL=https://www.youtube.com/upload"

echo Menjalankan Playwright codegen...
echo Account: %ACCOUNT_ID%
echo Profile: "%PROFILE_DIR%"
echo URL: %TARGET_URL%
python -m playwright codegen --browser chromium --channel chrome --user-data-dir "%PROFILE_DIR%" "%TARGET_URL%"
exit /b %errorlevel%
