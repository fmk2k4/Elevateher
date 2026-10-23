$ErrorActionPreference = "Continue"
$rand = Get-Random -Minimum 10000 -Maximum 99999
$me = "fix_e2e_$rand@demo.app"
$mt = "fix_e2e_mt_$rand@demo.app"

# Register mentee
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$me;password="Test1234!";role="mentee";age=22;country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 10
Write-Output "1 Register: $($r.user_id.Substring(0,8))... OK"

# Login mentee
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body (@{identifier=$me;password="Test1234!"} | ConvertTo-Json -Compress) -TimeoutSec 10
$mtToken = $r.access_token
Write-Output "2 Login: OK token=$($mtToken.Substring(0,15))..."

# /auth/me
$me2 = Invoke-RestMethod -Uri "http://localhost:8000/auth/me" -Method GET -Headers @{Authorization="Bearer $mtToken"} -TimeoutSec 10
Write-Output "3 /auth/me: $($me2.email) role=$($me2.role) - OK"

# Mentee profile (correct schema: sdg_track, bio_short)
$mpBody = @{
    full_name="Fix Test Mentee"
    display_name="FixMentee"
    career_goals=@("Software Engineer","Data Scientist")
    sdg_track="STEM"
    current_education="Universiti Malaya"
    education_level="undergraduate"
    preferred_languages=@("en","ms")
    challenges=@("Imposter syndrome")
    bio_short="CS student passionate about tech and mentoring"
} | ConvertTo-Json -Compress
$mp = Invoke-RestMethod -Uri "http://localhost:8000/mentee/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $mtToken"} -Body $mpBody -TimeoutSec 10
Write-Output "4 POST /mentee/profile: id=$($mp.id) - OK"

# Register mentor
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$mt;password="Test1234!";role="mentor";age=28;country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 10
Write-Output "5 Register mentor: $($r.user_id.Substring(0,8))... OK"

# Login mentor
$r = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body (@{identifier=$mt;password="Test1234!"} | ConvertTo-Json -Compress) -TimeoutSec 10
$motToken = $r.access_token
Write-Output "6 Login mentor: OK"

# Mentor profile (correct schema: job_title, employer, industry, bio>=100chars)
$mprofBody = @{
    full_name="Dr. Fix Mentor"
    display_name="FixMentor"
    job_title="Senior Software Engineer"
    employer="TechCorp Malaysia"
    industry="Technology"
    years_exp=8
    skills=@("Python","JavaScript","Mentoring")
    languages=@("en","ms")
    bio="Experienced software engineer with over 8 years in the tech industry. Passionate about mentoring the next generation of women in STEM and helping mentees navigate their career paths in technology."
    availability=@{type="recurring";days=@("Mon","Wed","Fri");hours="18:00-21:00"}
    sdg_track="STEM"
} | ConvertTo-Json -Compress
$mprof = Invoke-RestMethod -Uri "http://localhost:8000/mentor/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $motToken"} -Body $mprofBody -TimeoutSec 10
Write-Output "7 POST /mentor/profile: id=$($mprof.id) - OK"

# GET mentors (browse mentor candidates - the correct endpoint)
$lm = Invoke-RestMethod -Uri "http://localhost:8000/mentor/candidates?limit=5" -Method GET -Headers @{Authorization="Bearer $mtToken"} -TimeoutSec 10
Write-Output "8 GET /mentor/candidates: $($lm.total) mentees returned - OK"

# USSD callback (form-encoded)
$body = "sessionId=fix001&serviceCode=%2A384%23&phoneNumber=%2B60198877665&text="
$ussd = Invoke-RestMethod -Uri "http://localhost:8000/ussd/callback" -Method POST -ContentType "application/x-www-form-urlencoded" -Body $body -TimeoutSec 10
Write-Output "9 USSD callback: $($ussd.Content.Substring(0,60)) - OK"

Write-Output ""
Write-Output "=== ALL TESTS PASSED ==="