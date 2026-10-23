$ErrorActionPreference = "Continue"
$menteeEmail = "e2e_full_$(Get-Random -Minimum 1000 -Maximum 999999)@demo.app"
$mentorEmail = "e2e_mtor_full_$(Get-Random -Minimum 1000 -Maximum 999999)@demo.app"
$menteeToken = ""
$mentorToken = ""

Write-Output "=== FULL E2E FLOW ==="

# 1. Register mentee
Write-Output "[1] Register mentee as $menteeEmail..."
try {
    $body = @{email=$menteeEmail;password="Test1234!";role="mentee";age=22;country="MY";language="en"} | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    Write-Output "  REGISTER: user_id=$($r.user_id) next=$($r.onboarding_next)"
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# 2. Login mentee
Write-Output "[2] Login mentee..."
try {
    $body = @{identifier=$menteeEmail;password="Test1234!"} | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    if ($r.access_token) { $menteeToken = $r.access_token ; Write-Output "  LOGIN PASS: token=$($r.access_token.Substring(0,20))..." } else { Write-Output "  LOGIN FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# 3. Get current user
Write-Output "[3] GET /auth/me..."
try {
    $r = Invoke-RestMethod -Uri "http://localhost:8000/auth/me" -Method GET -Headers @{Authorization="Bearer $menteeToken"} -TimeoutSec 10
    if ($r.id) { Write-Output "  PASS: $($r.email) role=$($r.role)" } else { Write-Output "  FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# 4. Create mentee profile
Write-Output "[4] POST /mentee/profile..."
try {
    $body = @{
        full_name="E2E Mentee"
        bio_short="CS student at UM"
        sdg_track="STEM"
        career_goals=@("Software Engineer")
        preferred_languages=@("en","ms")
    } | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/mentee/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $menteeToken"} -Body $body -TimeoutSec 10
    if ($r.id) { Write-Output "  PASS: profile_id=$($r.id)" ; $menteeProfileId = $r.id } else { Write-Output "  FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# 5. Register mentor
Write-Output "[5] Register mentor as $mentorEmail..."
try {
    $body = @{email=$mentorEmail;password="Test1234!";role="mentor";age=28;country="MY";language="en"} | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    if ($r.user_id) { $mentorUserId = $r.user_id }
    Write-Output "  REGISTER: user_id=$($r.user_id) next=$($r.onboarding_next)"
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# 6. Login mentor
Write-Output "[6] Login mentor..."
try {
    $body = @{identifier=$mentorEmail;password="Test1234!"} | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    if ($r.access_token) { $mentorToken = $r.access_token ; Write-Output "  LOGIN PASS: token=$($r.access_token.Substring(0,20))..." } else { Write-Output "  LOGIN FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# 7. Create mentor profile
Write-Output "[7] POST /mentor/profile..."
try {
    $body = @{
        full_name="Dr. E2E Mentor"
        job_title="Senior Engineer"
        employer="TechCorp"
        industry="Technology"
        bio="I have 10 years of experience mentoring students in STEM fields. I am passionate about technology and helping young people achieve their dreams. I have worked in various industries and have a strong background in software engineering. I am looking forward to mentoring the next generation of tech leaders."
        skills=@("STEM","Tech")
        years_exp=10
        languages=@("en")
        availability=@{}
        sdg_track="STEM"
    } | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "http://localhost:8000/mentor/profile" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $mentorToken"} -Body $body -TimeoutSec 10
    if ($r.verification_status) { Write-Output "  PASS: verification_status=$($r.verification_status)" } else { Write-Output "  FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# 8. List mentors
Write-Output "[8] GET /mentor/list..."
try {
    $r = Invoke-RestMethod -Uri "http://localhost:8000/mentor/list?limit=5" -Method GET -Headers @{Authorization="Bearer $menteeToken"} -TimeoutSec 10
    if ($r.mentors) { Write-Output "  PASS: $($r.mentors.Count) mentors, total=$($r.total)" } else { Write-Output "  FAIL: $($r | ConvertTo-Json)" }
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# 9. List mentee profiles (mentor can browse)
Write-Output "[9] GET /mentor/my-mentees (with token)..."
try {
    Write-Output "  -> Approving mentor in DB..."
    docker compose exec -T db psql -U postgres -d elevateher -c "UPDATE mentor_profiles SET is_approved = true, verification_status = 'approved' WHERE user_id = '$mentorUserId'"
    
    $r = Invoke-RestMethod -Uri "http://localhost:8000/mentor/my-mentees?limit=5" -Method GET -Headers @{Authorization="Bearer $mentorToken"} -TimeoutSec 10
    Write-Output "  PASS: $($r.Count) mentees"
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

# 10. USSD callback
Write-Output "[10] POST /ussd/callback..."
try {
    $body = @{
        phone_number="+60198765432"
        session_id="test-e2e-001"
        service_code="*123#"
        text=""
    }
    $r = Invoke-RestMethod -Uri "http://localhost:8000/ussd/callback" -Method POST -Body $body -TimeoutSec 10
    Write-Output "  RESPONSE: $r"
} catch { Write-Output "  ERROR: $($_.Exception.Message)" }

Write-Output "=== COMPLETE ==="
