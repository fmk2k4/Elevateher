$ErrorActionPreference = "Continue"
$rand = Get-Random -Minimum 100000 -Maximum 999999
$me = "pw$rand@demo.app"
$mt = "pwmt$rand@demo.app"
$pass = "Test1234!"
$ussdSession = "e2e-$rand"

Write-Output "========================================="
Write-Output "ElevateHer Full E2E - $(Get-Date -Format 'HH:mm:ss')"
Write-Output "========================================="

try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    if ($healthCheck.StatusCode -ne 200) {
        Write-Output "[0] Preflight          FAIL: API health returned status $($healthCheck.StatusCode)"
        exit 1
    }

    $healthJson = $healthCheck.Content | ConvertFrom-Json
    Write-Output "[0] Preflight          OK: api=$($healthJson.status) db=$($healthJson.services.database) redis=$($healthJson.services.redis)"
} catch {
    Write-Output "[0] Preflight          FAIL: $($_.Exception.Message)"
    exit 1
}

# 1. Register mentee
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$me;password=$pass;role="mentee";age=20;country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 15
if ($r.user_id) { Write-Output "[1] Register Mentee   OK: $($r.user_id.Substring(0,8))..." } else { Write-Output "[1] FAIL: $($r | ConvertTo-Json)" }

# 2. Login mentee
$login = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body (@{identifier=$me;password=$pass} | ConvertTo-Json -Compress) -TimeoutSec 15
if ($login.access_token) {
    $mtToken = $login.access_token
    Write-Output "[2] Login Mentee      OK: $($mtToken.Substring(0,15))..."
} else { Write-Output "[2] FAIL"; return }

# 3. /auth/me
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/me" -Method GET -Headers @{Authorization="Bearer $mtToken"} -TimeoutSec 10
if ($r.email) { Write-Output "[3] /auth/me          OK: $($r.email) ($($r.role))" } else { Write-Output "[3] FAIL" }

# 4. Create mentee profile (correct fields: sdg_track, degree)
$mpBody = (@{
    full_name="Aisha Bt Test"
    display_name="AishaT"
    career_goals=@("Software Engineer","AI Researcher")
    sdg_track="STEM"
    current_education="Universiti Malaya"
    education_level="degree"
    preferred_languages=@("en","ms")
    challenges=@("Confidence")
    bio_short="CS student passionate about AI"
} | ConvertTo-Json -Compress)
$r = Invoke-RestMethod -Uri "http://localhost:8000/mentee/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $mtToken"} -Body $mpBody -TimeoutSec 15
if ($r.id) { Write-Output "[4] POST /mentee       OK: id=$($r.id.Substring(0,8))..." } else { Write-Output "[4] FAIL: $($r | ConvertTo-Json -Compress)" }

# 5. Register mentor
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$mt;password=$pass;role="mentor";age=28;country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 15
if ($r.user_id) { Write-Output "[5] Register Mentor   OK: $($r.user_id.Substring(0,8))..." } else { Write-Output "[5] FAIL" }

# 6. Login mentor
$login2 = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body (@{identifier=$mt;password=$pass} | ConvertTo-Json -Compress) -TimeoutSec 15
if ($login2.access_token) {
    $motToken = $login2.access_token
    Write-Output "[6] Login Mentor      OK: $($motToken.Substring(0,15))..."
} else { Write-Output "[6] FAIL"; return }

# 7. Create mentor profile (job_title, employer, industry, bio>=100chars, availability as JSON object)
$avail = @{type="recurring";days=@("Mon","Wed");hours="18:00-20:00"} | ConvertTo-Json -Compress
$mprofBody = (@{
    full_name="Dr. Sarah Mentor"
    display_name="SarahM"
    job_title="Senior Data Scientist"
    employer="TechCorp MY"
    industry="Technology"
    years_exp=8
    skills=@("Python","ML","Mentoring")
    languages=@("en","ms")
    bio="I am a passionate data scientist with 8 years of experience in AI and machine learning. I love mentoring the next generation of women in STEM and helping mentees navigate their careers."
    availability=($avail | ConvertFrom-Json).PSObject.Properties | ForEach-Object { @{$_.Name=$_.Value} } | ConvertTo-Json -Compress | ConvertFrom-Json
    sdg_track="STEM"
} | ConvertTo-Json -Compress)
$r = Invoke-RestMethod -Uri "http://localhost:8000/mentor/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $motToken"} -Body $mprofBody -TimeoutSec 15
if ($r.message) { Write-Output "[7] POST /mentor       OK: $($r.message.Substring(0,50))" } else { Write-Output "[7] FAIL: $($r | ConvertTo-Json -Compress)" }

# 8. GET /mentee/candidates (mentee browses mentors via matching engine)
$r = Invoke-RestMethod -Uri "http://localhost:8000/mentee/candidates?limit=3" -Method GET -Headers @{Authorization="Bearer $mtToken"} -TimeoutSec 15
if ($r.candidates) { Write-Output "[8] GET /mentee/candidates OK: $($r.candidates.Count) mentors, total=$($r.total)" } else { Write-Output "[8] FAIL: $($r | ConvertTo-Json -Compress)" }

# 9. Mentor views own mentees
try {
    $r = Invoke-RestMethod -Uri "http://localhost:8000/mentor/my-mentees" -Method GET -Headers @{Authorization="Bearer $motToken"} -TimeoutSec 10
    if ($r) { Write-Output "[9] GET /mentor/my-mentees OK: $($r.Count) mentees" } else { Write-Output "[9] GET /mentor/my-mentees OK: (empty, no matches yet)" }
} catch {
    $detail = $_.ErrorDetails.Message
    if ($detail -and $detail -like '*Mentor account not yet approved*') {
        Write-Output "[9] GET /mentor/my-mentees OK: mentor pending approval (expected in demo registration flow)"
    } else {
        Write-Output "[9] GET /mentor/my-mentees FAIL: $($_.Exception.Message)"
    }
}

# 10. USSD callback (form-encoded)
$body = "sessionId=$ussdSession&serviceCode=%2A384%23&phoneNumber=%2B60123456789&text="
$r = Invoke-WebRequest -Uri "http://localhost:8000/ussd/callback" -Method POST -ContentType "application/x-www-form-urlencoded" -Body $body -UseBasicParsing -TimeoutSec 15
$content = $r.Content.Substring(0, [Math]::Min(120, $r.Content.Length)).Replace("`r","").Replace("`n","|")
if ($r.StatusCode -eq 200 -and ($r.Content.StartsWith("CON") -or $r.Content.StartsWith("END"))) {
    Write-Output "[10] USSD callback     OK: $content"
} else {
    Write-Output "[10] USSD callback     FAIL: $content"
}

# 11. Health check
$h = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5 2>&1
if ($h.StatusCode -eq 200) {
    $j = $h.Content | ConvertFrom-Json
    Write-Output "[11] API Health        OK: db=$($j.services.database) redis=$($j.services.redis)"
} else { Write-Output "[11] FAIL" }

# 12. GET /mentee/profile (get own profile)
$r = Invoke-RestMethod -Uri "http://localhost:8000/mentee/profile" -Method GET -Headers @{Authorization="Bearer $mtToken"} -TimeoutSec 10
if ($r.id) { Write-Output "[12] GET /mentee/profile OK: full_name=$($r.full_name)" } else { Write-Output "[12] FAIL: $($r | ConvertTo-Json)" }

Write-Output "========================================="
Write-Output "Done at $(Get-Date -Format 'HH:mm:ss')"
