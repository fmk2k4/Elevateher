Write-Host "Starting Elevateher Python Backend (Demo Mode)..." -ForegroundColor Cyan
Set-Location services
if (Test-Path ..\.venv\Scripts\Activate.ps1) {
    . ..\.venv\Scripts\Activate.ps1
}
uvicorn main:app --host 0.0.0.0 --port 8000
