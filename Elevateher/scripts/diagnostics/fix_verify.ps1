$ErrorActionPreference = "Stop"
$rand = Get-Random -Minimum 1000 -Maximum 999999
$menteeEmail = "fix_test_m$rand@demo.app"
$mentorEmail = "fix_test_mt$rand@demo.app"

Write-Output "--- Fix Verification ---"

# Register mentee
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$menteeEmail;password="Test1234!";role="mentee";age=22;country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 10
Write-Output "[1] Register mentee: $($r.user_id) - OK"

# Login
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body (@{identifier=$menteeEmail;password="Test1234!"} | ConvertTo-Json -Compress) -TimeoutSec 10
if (!$r.access_token) { Write-Output "[2] LOGIN FAILED: $($r | ConvertTo-Json)" ; exit 1 }
$mt = $r.access_token
Write-Output "[2] Login OK: $($mt.Substring(0,20))..."

# Auth /me (was 404)
try {
    $me = Invoke-RestMethod -Uri "http://localhost:8000/auth/me" -Method GET -Headers @{Authorization="Bearer $mt"} -TimeoutSec 10
    Write-Output "[3] /auth/me OK: $($me.email)"
} catch { Write-Output "[3] /auth/me FAIL: $($_.Exception.Message.Substring(0,150))" }

# Mentee profile (was internal_error)
try {
    $mp = Invoke-RestMethod -Uri "http://localhost:8000/mentee/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $mt"} -Body (@{full_name="Fix Test";bio="Test";track="STEM";career_goals=@("Eng");languages=@("en");availability="any";country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 10
    Write-Output "[4] POST /mentee/profile OK: $($mp | ConvertTo-Json -Compress)"
} catch { Write-Output "[4] POST /mentee/profile FAIL: $($_.Exception.Message.Substring(0,200))" }

# Register mentor
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$mentorEmail;password="Test1234!";role="mentor";age=28;country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 10
Write-Output "[5] Register mentor: $($r.user_id) - OK"

# Login mentor
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body (@{identifier=$mentorEmail;password="Test1234!"} | ConvertTo-Json -Compress) -TimeoutSec 10
if (!$r.access_token) { Write-Output "[6] LOGIN FAILED" ; exit 1 }
$mot = $r.access_token
Write-Output "[6] Login mentor OK"

# Mentor profile create
try {
    $mprof = Invoke-RestMethod -Uri "http://localhost:8000/mentor/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $mot"} -Body (@{full_name="Dr. Fix";title="Engineer";bio="Test";expertise_areas=@("STEM");years_experience=5;max_mentees=3;availability="any";country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 10
    Write-Output "[7] POST /mentor/profile OK: $($mprof.id)"
} catch { Write-Output "[7] POST /mentor/profile FAIL: $($_.Exception.Message.Substring(0,200))" }

# List mentors (was "Method Not Allowed")
try {
    $lm = Invoke-RestMethod -Uri "http://localhost:8000/mentor/profile?limit=3" -Method GET -TimeoutSec 10
    Write-Output "[8] GET /mentor/profile OK: $($lm.mentors.Count) mentors"
} catch { Write-Output "[8] GET /mentor/profile FAIL: $($_.Exception.Message.Substring(0,150))" }

# USSD callback (form fields, not JSON)
try {
    $body = "sessionId=test-fix-001&serviceCode=*384%23&phoneNumber=%2B60198877665&text="
    $ussd = Invoke-RestMethod -Uri "http://localhost:8000/ussd/callback" -Method POST -ContentType "application/x-www-form-urlencoded" -Body $body -TimeoutSec 10
    Write-Output "[9] USSD callback OK: $($ussd.Content.Substring(0,80))"
} catch { Write-Output "[9] USSD FAIL: $($_.Exception.Message.Substring(0,150))" }

Write-Output "--- All done ---"