$ErrorActionPreference = "Continue"
Write-Output "=== Frontend Check ==="

try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Output "[1] Web app port 3000: HTTP $($r.StatusCode) - OK"
} catch { Write-Output "[1] FAIL: $($_.Exception.Message.Substring(0,80))" }

try {
    $r = Invoke-WebRequest -Uri "http://localhost:3001" -UseBasicParsing -TimeoutSec 5
    Write-Output "[2] Dashboard port 3001: HTTP $($r.StatusCode) - OK"
} catch { Write-Output "[2] FAIL: $($_.Exception.Message.Substring(0,80))" }

try {
    $r = Invoke-WebRequest -Uri "http://localhost:3001/inti/overview" -UseBasicParsing -TimeoutSec 10
    Write-Output "[3] Dashboard subdomain: HTTP $($r.StatusCode) - OK"
} catch { Write-Output "[3] FAIL: $($_.Exception.Message.Substring(0,80))" }

try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/docs" -UseBasicParsing -TimeoutSec 5
    Write-Output "[4] API docs: HTTP $($r.StatusCode) - OK"
} catch { Write-Output "[4] FAIL: $($_.Exception.Message.Substring(0,80))" }

try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/ussd-simulator" -UseBasicParsing -TimeoutSec 5
    Write-Output "[5] USSD Simulator: HTTP $($r.StatusCode) - OK"
} catch { Write-Output "[5] FAIL: $($_.Exception.Message.Substring(0,80))" }

Write-Output "=== Done ==="
