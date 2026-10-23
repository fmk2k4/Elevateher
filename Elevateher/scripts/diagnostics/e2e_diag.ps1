$menteeEmail = "e2e_diag_$(Get-Random -Minimum 1000 -Maximum 999999)@demo.app"
$mentorEmail = "e2e_diag_m_$(Get-Random -Minimum 1000 -Maximum 999999)@demo.app"

# Register + Login Mentee
$reg = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$menteeEmail;password="Test1234!";role="mentee";age=22;country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 10
Write-Output "1 Mentee registered: $($reg.user_id)"
$login = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body (@{identifier=$menteeEmail;password="Test1234!"} | ConvertTo-Json -Compress) -TimeoutSec 10
$mt = $login.access_token
Write-Output "2 Mentee logged in: $($mt.Substring(0,20))..."

# Auth /me
$me = Invoke-RestMethod -Uri "http://localhost:8000/auth/me" -Method GET -Headers @{Authorization="Bearer $mt"} -TimeoutSec 10
Write-Output "3 Auth/me: $($me | ConvertTo-Json -Compress)"

# Mentee profile
$profile = Invoke-RestMethod -Uri "http://localhost:8000/mentee/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $mt"} -Body (@{full_name="Diag Mentee";bio="Test";track="STEM";career_goals=@("Engineer");languages=@("en");availability="any";country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 10
Write-Output "4 Mentee profile: $($profile | ConvertTo-Json -Compress)"

# Register + Login Mentor
$reg2 = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$mentorEmail;password="Test1234!";role="mentor";age=28;country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 10
Write-Output "5 Mentor registered: $($reg2.user_id)"
$login2 = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body (@{identifier=$mentorEmail;password="Test1234!"} | ConvertTo-Json -Compress) -TimeoutSec 10
$mot = $login2.access_token
Write-Output "6 Mentor logged in: $($mot.Substring(0,20))..."

# Mentor profile
$mp = Invoke-RestMethod -Uri "http://localhost:8000/mentor/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $mot"} -Body (@{full_name="Dr. Diag Mentor";title="Engineer";bio="Test";expertise_areas=@("STEM");years_experience=5;max_mentees=3;availability="any";country="MY"} | ConvertTo-Json -Compress) -TimeoutSec 10
Write-Output "7 Mentor profile: $($mp | ConvertTo-Json -Compress)"

# List mentors
$lm = Invoke-RestMethod -Uri "http://localhost:8000/mentor/profile?limit=3" -Method GET -TimeoutSec 10
Write-Output "8 List mentors: $($lm | ConvertTo-Json -Compress)"

# List mentees
$lme = Invoke-RestMethod -Uri "http://localhost:8000/mentee/profile" -Method GET -Headers @{Authorization="Bearer $mot"} -TimeoutSec 10
Write-Output "9 List mentees: $($lme | ConvertTo-Json -Compress)"

# USSD callback
$ussd = Invoke-RestMethod -Uri "http://localhost:8000/ussd/callback" -Method POST -ContentType "application/json" -Body (@{phone_number="+60198877665";session_id="diag-001";text="";network="CELCOM"} | ConvertTo-Json -Compress) -TimeoutSec 10
Write-Output "10 USSD: $($ussd | ConvertTo-Json -Compress)"

Write-Output "DONE"