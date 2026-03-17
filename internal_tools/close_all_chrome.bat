@echo off
setlocal

echo Menutup semua proses Chrome/Edge yang terkait Playwright...

tasklist /FI "IMAGENAME eq chrome.exe" 2>nul | find /I "chrome.exe" >nul
if %errorlevel% equ 0 (
  echo Matikan Chrome...
  taskkill /F /IM chrome.exe >nul 2>nul
  echo Chrome ditutup.
) else (
  echo Chrome tidak berjalan.
)

tasklist /FI "IMAGENAME eq msedge.exe" 2>nul | find /I "msedge.exe" >nul
if %errorlevel% equ 0 (
  echo Matikan Edge...
  taskkill /F /IM msedge.exe >nul 2>nul
  echo Edge ditutup.
) else (
  echo Edge tidak berjalan.
)

tasklist /FI "IMAGENAME eq chromedriver.exe" 2>nul | find /I "chromedriver.exe" >nul
if %errorlevel% equ 0 (
  echo Matikan ChromeDriver...
  taskkill /F /IM chromedriver.exe >nul 2>nul
  echo ChromeDriver ditutup.
) else (
  echo ChromeDriver tidak berjalan.
)

timeout /t 2 /nobreak >nul
echo Selesai. Silakan jalankan codegen kembali.
exit /b 0