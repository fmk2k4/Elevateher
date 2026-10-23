$ErrorActionPreference = "Continue"
$token = ""

# E2E 1: Register Mentee
Write-Output "[1/8] Register Mentee..."
$randEmail = "e2e_$(Get-Random -Minimum 1000 -Maximum 999999)@demo.app"
try {
    $body = @{email=$randEmail;password="Test1234!";role="mentee";age=22;country="MY";language="en"} | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    if ($r.access_token) {
        Write-Output "  PASS - user_id: $($r.user_id)"
        $token = $r.access_token
    } else { Write-Output "  FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# E2E 2: Login
Write-Output "[2/8] Login..."
try {
    $body = @{identifier=$randEmail;password="Test1234!"} | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    if ($r.access_token) { Write-Output "  PASS" } else { Write-Output "  FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# E2E 3: Get me
Write-Output "[3/8] Get /auth/me..."
try {
    $r = Invoke-RestMethod -Uri "http://localhost:8000/auth/me" -Method GET -Headers @{Authorization="Bearer $token"} -TimeoutSec 10
    if ($r.id) { Write-Output "  PASS - $($r.email) role=$($r.role)" } else { Write-Output "  FAIL" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# E2E 4: Create mentee profile
Write-Output "[4/8] Create mentee profile..."
try {
    $body = @{full_name="E2E Test Mentee";bio="CS student";track="STEM";career_goals=@("Engineer");languages=@("en");availability="weekends";country="MY"} | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/mentee/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body $body -TimeoutSec 10
    if ($r.id) { Write-Output "  PASS - profile_id: $($r.id)" } else { Write-Output "  FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# E2E 5: Register mentor
Write-Output "[5/8] Register mentor..."
$randEmail2 = "e2e_mtor_$(Get-Random -Minimum 1000 -Maximum 999999)@demo.app"
$mentorEmail = $randEmail2
try {
    $body = @{email=$randEmail2;password="Test1234!";role="mentor";age=28;country="MY";language="en"} | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    if ($r.access_token) { Write-Output "  PASS - user_id: $($r.user_id)" ; $mentorToken = $r.access_token } else { Write-Output "  FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# E2E 6: Create mentor profile
Write-Output "[6/8] Create mentor profile..."
try {
    $body = @{full_name="Dr. E2E Mentor";title="Senior Engineer";bio="10 years tech";expertise_areas=@("STEM");years_experience=10;max_mentees=5;availability="evenings";country="MY";institution_name="Tech Corp"} | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/mentor/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $mentorToken"} -Body $body -TimeoutSec 10
    if ($r.id) { Write-Output "  PASS - mentor_id: $($r.id)" } else { Write-Output "  FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# E2E 7: Get mentors list
Write-Output "[7/8] List mentors..."
try {
    $r = Invoke-RestMethod -Uri "http://localhost:8000/mentor/profile?limit=5" -Method GET -TimeoutSec 10
    if ($r) { Write-Output "  PASS - $($r.mentors.Count) mentors" } else { Write-Output "  FAIL" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# E2E 8: USSD callback
Write-Output "[8/8] USSD callback..."
try {
    $body = @{phone_number="+60198765432";session_id="test-001";text="";network="CELCOM"} | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/ussd/callback" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    if ($r) { Write-Output "  PASS - $($r | ConvertTo-Json -Compress)" } else { Write-Output "  FAIL" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

Write-Output "=== DONE ==="
