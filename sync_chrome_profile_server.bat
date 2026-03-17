@echo off
setlocal

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "SOURCE_DIR=%BASE_DIR%\chrome_profile"
set "SSH_KEY=C:\Users\admin\Desktop\New folder (4)\sparse-kuiper\ssh-key-2026-03-16 (3).key"
set "REMOTE_HOST=ubuntu@168.110.210.101"
set "REMOTE_APP_DIR=/opt/sparse-kuiper"
set "REMOTE_TMP_ARCHIVE=/tmp/chrome_profile_sync.tar.gz"
set "LOCAL_ARCHIVE=%TEMP%\chrome_profile_sync_%RANDOM%.tar.gz"

if not exist "%SOURCE_DIR%" (
  echo Folder chrome_profile tidak ditemukan: "%SOURCE_DIR%"
  exit /b 1
)

where tar >nul 2>nul
if errorlevel 1 (
  echo tar tidak ditemukan. Pastikan Windows bsdtar tersedia.
  exit /b 1
)

where scp >nul 2>nul
if errorlevel 1 (
  echo scp tidak ditemukan. Pastikan OpenSSH Client terinstall.
  exit /b 1
)

where ssh >nul 2>nul
if errorlevel 1 (
  echo ssh tidak ditemukan. Pastikan OpenSSH Client terinstall.
  exit /b 1
)

echo Membuat archive selective...
pushd "%BASE_DIR%"
tar -czf "%LOCAL_ARCHIVE%" ^
  --exclude="chrome_profile/*/Cache/*" ^
  --exclude="chrome_profile/*/Code Cache/*" ^
  --exclude="chrome_profile/*/GPUCache/*" ^
  --exclude="chrome_profile/*/ShaderCache/*" ^
  --exclude="chrome_profile/*/GrShaderCache/*" ^
  --exclude="chrome_profile/*/DawnCache/*" ^
  --exclude="chrome_profile/*/Crashpad/*" ^
  --exclude="chrome_profile/*/Service Worker/CacheStorage/*" ^
  "chrome_profile"
popd
if errorlevel 1 (
  echo Gagal membuat archive.
  exit /b 1
)

echo Upload archive ke server...
scp -i "%SSH_KEY%" "%LOCAL_ARCHIVE%" %REMOTE_HOST%:%REMOTE_TMP_ARCHIVE%
if errorlevel 1 (
  echo Upload gagal.
  del /f /q "%LOCAL_ARCHIVE%" >nul 2>nul
  exit /b 1
)

echo Extract archive di server...
ssh -i "%SSH_KEY%" %REMOTE_HOST% "mkdir -p %REMOTE_APP_DIR% && tar -xzf %REMOTE_TMP_ARCHIVE% -C %REMOTE_APP_DIR% && rm -f %REMOTE_TMP_ARCHIVE%"
if errorlevel 1 (
  echo Extract di server gagal.
  del /f /q "%LOCAL_ARCHIVE%" >nul 2>nul
  exit /b 1
)

del /f /q "%LOCAL_ARCHIVE%" >nul 2>nul
echo Selesai. chrome_profile tersinkron ke server.
exit /b 0
