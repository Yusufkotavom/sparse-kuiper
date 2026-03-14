Get-WmiObject Win32_Process -Filter "Name='python.exe'" | Where-Object { 
    $_.CommandLine -match "uvicorn" -or 
    $_.CommandLine -match "multiprocessing.spawn" -or
    $_.CommandLine -match "youtube_playwright_upload_worker.py" -or
    $_.CommandLine -match "tiktok_upload_worker.py"
} | ForEach-Object {
    Write-Host "Killing Process PID: $($_.ProcessId) - $($_.CommandLine)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Optional: Kill process occupying port 8000 just to be safe .\kill_api.ps1
$portConflics = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($portConflics) {
    foreach ($conn in $portConflics) {
        Write-Host "Killing Process on Port 8000: PID $($conn.OwningProcess)"
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Semua proses API (Uvicorn) dan Worker telah dibersihkan!"
