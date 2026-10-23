# ElevateHer Setup Script for Windows
# Run from repository root: powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

Write-Host "ElevateHer Setup - Installing dependencies..." -ForegroundColor Cyan

# Check if Python is available
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "ERROR: Python not found. Please install Python 3.11+ from python.org" -ForegroundColor Red
    exit 1
}

# Install Python dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
python -m pip install -r services/api/requirements.txt --quiet

# Create virtual environment for API services
if (-not (Test-Path "services/api/.venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv services/api/.venv
}

# Install Node.js dependencies for web app
Write-Host "Installing web app dependencies..." -ForegroundColor Yellow
Push-Location apps/web
npm install --silent
Pop-Location

# Install Node.js dependencies for dashboard
Write-Host "Installing dashboard dependencies..." -ForegroundColor Yellow
Push-Location apps/dashboard
npm install --silent
Pop-Location

Write-Host "Setup complete! Next steps:" -ForegroundColor Green
Write-Host "  1. Copy .env.example to .env and fill in values" -ForegroundColor Gray
Write-Host "  2. Install Docker Desktop for PostgreSQL/Redis" -ForegroundColor Gray
Write-Host "  3. Run: docker compose up --build -d" -ForegroundColor Gray
Write-Host "  4. Run: docker exec elevateher_api python scripts/apply_migrations.py" -ForegroundColor Gray
Write-Host "  5. Run: docker exec elevateher_api python scripts/seed_demo_data.py" -ForegroundColor Gray