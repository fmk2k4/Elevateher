$ErrorActionPreference = "Continue"
$rand = Get-Random -Minimum 10000 -Maximum 99999
$me = "e2e$rand@demo.app"
$mt = "e2emt$rand@demo.app"
$pass = "Test1234!"

Write-Output "========================================="
Write-Output "ElevateHer E2E Test - $(Get-Date -Format 'HH:mm:ss')"
Write-Output "========================================="

# 1. Register mentee
$reg = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$me;password=$pass;role="mentee";age=20;country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 15
if ($reg.user_id) { Write-Output "[1] Register Mentee   OK: $($reg.user_id.Substring(0,8))..." } else { Write-Output "[1] Register Mentee   FAIL: $($reg | ConvertTo-Json)" }

# 2. Login mentee
$login = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body (@{identifier=$me;password=$pass} | ConvertTo-Json -Compress) -TimeoutSec 15
if ($login.access_token) {
    $mtToken = $login.access_token
    Write-Output "[2] Login Mentee      OK: $($mtToken.Substring(0,15))..."
} else { Write-Output "[2] Login Mentee      FAIL"; return }

# 3. /auth/me
$me2 = Invoke-RestMethod -Uri "http://localhost:8000/auth/me" -Method GET -Headers @{Authorization="Bearer $mtToken"} -TimeoutSec 10
if ($me2.email) { Write-Output "[3] /auth/me          OK: $($me2.email) ($($me2.role))" } else { Write-Output "[3] /auth/me          FAIL" }

# 4. Create mentee profile
$mp = $null
$mpBody = (@{
    full_name="Aisha Bt Test"
    display_name="AishaT"
    career_goals=@("Software Engineer")
    sdg_track="STEM"
    current_education="Universiti Malaya"
    education_level="degree"
    preferred_languages=@("en","ms")
    challenges=@("Confidence")
    bio_short="CS student passionate about AI"
} | ConvertTo-Json -Compress)
try {
    $mp = Invoke-RestMethod -Uri "http://localhost:8000/mentee/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $mtToken"} -Body $mpBody -TimeoutSec 15
    if ($mp.id) { Write-Output "[4] POST /mentee       OK: id=$($mp.id.Substring(0,8))..." } else { Write-Output "[4] POST /mentee       FAIL: no id in response" }
} catch {
    $errBody = ""
    if ($_.Exception.Response) {
        $sr = $_.Exception.Response.GetResponseStream()
        $sr.Position = 0; $br = New-Object System.IO.BinaryReader($sr)
        $errBody = [System.Text.Encoding]::UTF8.GetString($br.ReadBytes($sr.Length))
    }
    Write-Output "[4] POST /mentee       FAIL: $($errBody.Substring(0,[Math]::Min(100,$errBody.Length)))"
}

# 5. Register mentor
$reg2 = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$mt;password=$pass;role="mentor";age=28;country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 15
if ($reg2.user_id) { Write-Output "[5] Register Mentor   OK: $($reg2.user_id.Substring(0,8))..." } else { Write-Output "[5] Register Mentor   FAIL" }

# 6. Login mentor
$login2 = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body (@{identifier=$mt;password=$pass} | ConvertTo-Json -Compress) -TimeoutSec 15
if ($login2.access_token) {
    $motToken = $login2.access_token
    Write-Output "[6] Login Mentor      OK"
} else { Write-Output "[6] Login Mentor      FAIL"; return }

# 7. Create mentor profile (with proper fields)
$availJson = @{type="recurring";days=@("Mon","Wed");hours="18:00-20:00"} | ConvertTo-Json -Compress
$mprofBody = (@{
    full_name="Dr. Sarah Mentor"
    display_name="SarahM"
    job_title="Senior Data Scientist"
    employer="TechCorp MY"
    industry="Technology"
    years_exp=8
    skills=@("Python","ML","Mentoring")
    languages=@("en","ms")
    bio="I am a passionate data scientist with 8 years of experience in AI and machine learning. I love mentoring the next generation of women in STEM."
    linkedin_url=$null
    availability=($availJson | ConvertFrom-Json).PSObject.Properties | ForEach-Object { @{($_.Name)=$_.Value } } | ConvertTo-Json -Compress | ConvertFrom-Json
    sdg_track="STEM"
} | ConvertTo-Json -Compress)
$mprof = $null
try {
    $mprof = Invoke-RestMethod -Uri "http://localhost:8000/mentor/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $motToken"} -Body $mprofBody -TimeoutSec 15
    if ($mprof.id -or $mprof.message) {
        $ok = if ($mprof.id) { "id=$($mprof.id.Substring(0,8))..." } else { $mprof.message }
        Write-Output "[7] POST /mentor       OK: $ok"
    } else { Write-Output "[7] POST /mentor       FAIL: empty response" }
} catch {
    $errBody = ""
    if ($_.Exception.Response) {
        $sr = $_.Exception.Response.GetResponseStream()
        $sr.Position = 0; $br = New-Object System.IO.BinaryReader($sr)
        $errBody = [System.Text.Encoding]::UTF8.GetString($br.ReadBytes($sr.Length))
    }
    Write-Output "[7] POST /mentor       FAIL: $($errBody.Substring(0,[Math]::Min(100,$errBody.Length)))"
}

# 8. GET /mentee/candidates (mentee's view of available mentors)
try {
    $cands = Invoke-RestMethod -Uri "http://localhost:8000/mentee/candidates?limit=3" -Method GET -Headers @{Authorization="Bearer $mtToken"} -TimeoutSec 15
    if ($cands.mentees) { Write-Output "[8] GET /mentee/candidates OK: $($cands.mentees.Count) mentors" }
    elseif ($cands.total) { Write-Output "[8] GET /mentee/candidates OK: total=$($cands.total)" }
    else { Write-Output "[8] GET /mentee/candidates FAIL: $($cands | ConvertTo-Json)" }
} catch {
    $errBody = ""
    if ($_.Exception.Response) {
        $sr = $_.Exception.Response.GetResponseStream()
        $sr.Position = 0; $br = New-Object System.IO.BinaryReader($sr)
        $errBody = [System.Text.Encoding]::UTF8.GetString($br.ReadBytes($sr.Length))
    }
    Write-Output "[8] GET /mentee/candidates FAIL: $($errBody.Substring(0,[Math]::Min(100,$errBody.Length)))"
}

# 9. USSD callback (form-encoded)
try {
    $body = "sessionId=e2e001&serviceCode=%2A384%23&phoneNumber=%2B60123456789&text="
    $ussd = Invoke-RestMethod -Uri "http://localhost:8000/ussd/callback" -Method POST -ContentType "application/x-www-form-urlencoded" -Body $body -TimeoutSec 15
    $content = $ussd.Content
    if ($content) { Write-Output "[9] USSD callback     OK: $($content.Substring(0,50).Replace([char]10,'|'))" }
    else { Write-Output "[9] USSD callback     OK: (plain text response)" }
} catch {
    $errBody = ""
    if ($_.Exception.Response) {
        $sr = $_.Exception.Response.GetResponseStream()
        $sr.Position = 0; $br = New-Object System.IO.BinaryReader($sr)
        $errBody = [System.Text.Encoding]::UTF8.GetString($br.ReadBytes($sr.Length))
    }
    Write-Output "[9] USSD callback     FAIL: $($errBody.Substring(0,[Math]::Min(100,$errBody.Length)))"
}

# 10. Health check
$h = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5 2>&1
if ($h.StatusCode -eq 200) {
    $j = $h.Content | ConvertFrom-Json
    Write-Output "[10] API Health        OK: db=$($j.services.database) redis=$($j.services.redis)"
} else { Write-Output "[10] API Health        FAIL" }

# 11. Check seeded data
try {
    $lm = Invoke-RestMethod -Uri "http://localhost:8000/mentor/list?limit=3" -Method GET -TimeoutSec 10
    if ($lm.mentors) { Write-Output "[11] List seeded mentors OK: $($lm.mentors.Count) mentors (page), total=$($lm.total)" }
    else { Write-Output "[11] List seeded mentors FAIL: $($lm | ConvertTo-Json)" }
} catch { Write-Output "[11] List seeded mentors FAIL: $($_.Exception.Message.Substring(0,80))" }

Write-Output "========================================="
Write-Output "Done at $(Get-Date -Format 'HH:mm:ss')"