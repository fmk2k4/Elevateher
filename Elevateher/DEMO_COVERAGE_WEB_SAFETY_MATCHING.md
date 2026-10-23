# Demo Coverage Addendum: Web App, Bio Scanner, and Matching Service

Date: 2026-07-04

## Purpose

This addendum is a second, narrower audit focused on increasing demo coverage for the parts judges are most likely to care about:

- the public web app and end-to-end user journey
- the bio scanner / safety system
- the matching service and mentor recommendation story

The goal is not to add more features. The goal is to make the existing demo path more deterministic, more visible, and harder to break during judging.

## Coverage Verdict

Current demo coverage is **too smoke-test heavy**. The repo has impressive surfaces, but the tests mostly prove that pages return a body, not that the product story works.

Recommended target for demo readiness:

- one deterministic seeded judge path
- one live bio scanner proof
- one live matching proof
- one safety-blocked message proof
- one institution dashboard proof with known seeded data

## Priority 0: What Judges Must See

The demo should be constrained to this path:

1. Landing page: offline-first mentorship and SDG mission
2. USSD simulator: feature-phone access without internet
3. Mentee onboarding: profile, career goals, language, track
4. Matching: safe mentors filtered and ranked with clear rationale
5. Bio scanner: clean bio passes, unsafe bio goes to review
6. Session safety: risky message gets blocked or flagged
7. Institution dashboard: safety, matches, and impact visible from seeded data

Everything else should either be hidden, clearly marked as demo-only, or avoided during judging.

## Web App Demo Coverage

## What Is Demoable Today

### Landing page

The landing page already contains strong hackathon storytelling:

- offline-first access
- `*384#` USSD hook
- AI matching
- safety framing
- SDG alignment
- partner institutions

Primary file:

- `apps/web/src/app/page.jsx`

Demo value:

- this is the best opening screen
- it explains why the product matters before showing mechanics

Coverage gap:

- existing tests mostly check that the page loads
- tests should assert the actual pitch copy and CTAs

### USSD simulator

The USSD simulator is one of the strongest differentiators because it proves the product is not just another web dashboard.

Primary files:

- `apps/web/src/app/ussd-simulator/page.jsx`
- `apps/web/src/app/api/ussd/callback/route.js`

Demo value:

- judges can see feature-phone access
- backend unavailable fallback can still preserve demo flow

Coverage gap:

- current Playwright coverage does not assert real menu progression, language paths, final states, or backend fallback copy

### Onboarding and role routing

Primary files:

- `apps/web/src/app/onboarding/page.jsx`
- `apps/web/src/app/dashboard/page.jsx`

Demo value:

- shows personalized mentorship setup
- routes users into the right dashboard

Coverage gap:

- needs seeded users for new mentee, existing mentee, mentor, and admin states

### Mentee mentor discovery

Primary files:

- `apps/web/src/app/mentee/candidates/page.jsx`
- `apps/web/src/app/api/mentor/list/route.js`
- `apps/web/src/app/api/matches/route.js`

Demo value:

- this is where the AI matching story becomes tangible

Coverage gap:

- visible match scores/rationale need deterministic data
- random fallback values weaken trust if noticed

### Session safety flow

Primary files:

- `apps/web/src/app/session/[id]/page.jsx`
- `apps/web/src/app/api/sessions/[id]/messages/route.js`
- `apps/web/src/app/api/safety/reports/route.js`

Demo value:

- demonstrates safety in context instead of as a static claim

Coverage gap:

- session metadata is incomplete
- tests should prove safe message, blocked message, report submission, and AI summary behavior

## Web App Test Coverage To Add

### 1. `web-landing-content.spec.ts`

Purpose:

- prove the landing page communicates the winning story

Assertions:

- page contains ElevateHer name
- page contains offline/USSD framing
- page contains `*384#`
- page contains AI matching step
- page contains safety step
- page contains SDG section
- page links to sign up, sign in, and USSD simulator

Files covered:

- `apps/web/src/app/page.jsx`

### 2. `web-ussd-demo-flow.spec.ts`

Purpose:

- prove offline-first demo path is functional

Assertions:

- simulator loads
- keypad is visible
- quick path for English works
- quick path for Malay works
- quick path for Indonesian works
- returning user path works
- backend-unavailable fallback displays useful copy instead of crashing

Files covered:

- `apps/web/src/app/ussd-simulator/page.jsx`
- `apps/web/src/app/api/ussd/callback/route.js`

### 3. `web-onboarding-routing.spec.ts`

Purpose:

- prove users can move from account state into the right product surface

Assertions:

- new mentee reaches onboarding
- completed mentee routes to mentee dashboard
- mentor routes to mentor dashboard
- admin/institution user routes to institution surface

Files covered:

- `apps/web/src/app/onboarding/page.jsx`
- `apps/web/src/app/dashboard/page.jsx`

### 4. `web-mentee-matching.spec.ts`

Purpose:

- prove the core value prop: a mentee finds a safe, relevant mentor

Assertions:

- seeded mentee sees approved mentors
- unsafe mentor is absent
- suspended mentor is absent
- full-capacity mentor is absent
- STEM/Malay filters return the expected named mentor
- request mentor creates a pending match state

Files covered:

- `apps/web/src/app/mentee/candidates/page.jsx`
- `apps/web/src/app/api/mentor/list/route.js`
- `apps/web/src/app/api/matches/route.js`

### 5. `web-session-safety.spec.ts`

Purpose:

- prove safety is active during conversations

Assertions:

- active session opens with named mentor and mentee
- safe message sends successfully
- off-platform solicitation is blocked or flagged
- report modal submits a safety report
- AI summary renders after messages exist

Files covered:

- `apps/web/src/app/session/[id]/page.jsx`
- `apps/web/src/app/api/sessions/[id]/messages/route.js`
- `apps/web/src/app/api/safety/reports/route.js`

### 6. `web-impact-proof.spec.ts`

Purpose:

- prove the product tracks outcomes, not just conversations

Assertions:

- seeded mentee opens impact page
- logs a certification or job-offer event
- SDG counter changes
- event appears in timeline

Files covered:

- `apps/web/src/app/mentee/impact/page.jsx`
- `apps/web/src/app/api/impact-events/route.js`

## Bio Scanner Demo Coverage

## What Is Demoable Today

The backend bio scanner exists and is meaningful.

Primary files:

- `services/safety/bio_classifier.py`
- `services/api/services/safety_service.py`
- `services/api/routers/safety.py`
- `services/api/routers/mentor.py`

Capabilities already present:

- flags very short bios
- flags off-platform contact requests such as WhatsApp, Telegram, private number, and similar language
- flags intimacy escalation language such as secrets or isolation
- supports Malay/Indonesian patterns
- falls back to deterministic pattern scanning when the neural model is unavailable
- mentor onboarding attempts to queue a scan task and falls back to manual review when queueing fails

## Current Bio Scanner Gap

The scanner is backend-capable but not demo-visible enough.

Main issue:

- there is no obvious live UI where a judge can paste a mentor bio and see pass/fail, score, flags, and review status

Secondary issue:

- model fallback behavior is useful for a hackathon, but it is not explicitly shown as a trustworthy demo mode

## Bio Scanner Demo UI To Add

Add a simple live scanner panel to either:

- `apps/dashboard/app/[subdomain]/safety/page.tsx`, or
- `apps/web/src/app/admin/page.jsx`

Recommended UI section:

```text
Live Bio Safety Scanner
- textarea: mentor bio
- demo examples: Safe Bio, WhatsApp Solicitation, Secret/Isolation Language, Too Short
- button: Scan Bio
- output: approved, safe_score, requires_human_review, flags, matched patterns if available
```

Demo examples to include:

1. Safe bio:

```text
I am a senior data scientist at Grab with 9 years of experience. I mentor girls interested in Python, data analysis, and ethical AI careers through structured weekly sessions on ElevateHer.
```

Expected:

- approved true
- high safe score
- no flags

2. Off-platform solicitation:

```text
I can help you privately. Add me on WhatsApp and do not tell anyone, this will be only between us.
```

Expected:

- approved false
- flags include off-platform or grooming-related signal
- human review true

3. Malay/Indonesian private contact:

```text
Bagi nomor pribadi kamu, jangan beritahu sesiapa. Rahsia kita sahaja.
```

Expected:

- approved false
- flags include off-platform/intimacy escalation
- human review true

4. Too short:

```text
I help girls.
```

Expected:

- approved false
- bio_too_short

## Bio Scanner Tests To Add

### Unit tests for `scan_bio`

Add tests under `services/api/tests/unit/` or the existing safety test area.

Required cases:

- safe professional bio passes
- short bio fails
- WhatsApp/private contact fails
- “do not tell anyone” / secret language fails
- Malay/Indonesian private number language fails
- emoji-heavy suspicious formatting is flagged
- model unavailable path still returns deterministic result

Files covered:

- `services/safety/bio_classifier.py`

### API tests for scanner endpoints

Required cases:

- `/safety/bio` requires moderator auth
- `/safety/bio` requires `user_id` or `institution_id`
- `/safety/bio` returns approved/safe_score/flags/requires_human_review
- `/safety/message` works for unsafe message text
- `/safety/text` works as generic scanner

Files covered:

- `services/api/routers/safety.py`
- `services/api/services/safety_service.py`

### Playwright test for live scanner UI

Required cases:

- open Safety page
- choose unsafe sample
- click scan
- assert score/flags/human review visible
- choose safe sample
- assert approved state visible

Files covered:

- `apps/dashboard/app/[subdomain]/safety/page.tsx`

## Safety Dashboard Contract Bug To Fix

The dashboard Safety page currently expects these keys:

- `suspended`
- `risk_mentors`

But the backend report says the admin safety endpoint returns differently named keys:

- `suspended_users`
- `high_risk_mentors`

Likely impact:

- Safety page can render incorrectly or crash once real data loads

Fix options:

1. Map response keys in `apps/dashboard/app/[subdomain]/safety/page.tsx`
2. Rename backend keys in `services/api/routers/admin.py`
3. Support both names defensively in the frontend

Recommended demo-safe fix:

- support both names in the frontend and default missing arrays to `[]`

## Matching Service Demo Coverage

## What Is Demoable Today

Primary files:

- `services/matching/embedder.py`
- `services/matching/matcher.py`
- `services/api/routers/match.py`
- `services/api/services/matching_service.py`
- `apps/web/src/app/mentee/candidates/page.jsx`

Capabilities already present:

- deterministic local fallback embeddings when the model is unavailable
- DB-backed mentor search using pgvector similarity
- filters for approved mentors
- filters inactive mentors
- filters suspended users
- filters mentors below `bio_safety_score >= 0.75`
- filters full-capacity mentors
- returns `model_available` and degraded warning from `/match/mentee/{id}`

## Current Matching Gap

The matching service is strong as a backend concept but weak as a visible demo proof.

The current demo data creates active matches, but it does not clearly prove:

- unsafe mentors are excluded
- suspended mentors are excluded
- full mentors are excluded
- language/track alignment changes recommendations
- model-unavailable fallback is deterministic and acceptable for demo mode

## Matching Demo Scenarios To Seed

Add named demo records for each condition.

### Positive match scenario

Mentee:

- Aisha Binti Ahmad
- STEM
- languages: English, Malay
- goals: software engineer, data scientist

Expected top mentor:

- Priya Krishnamurthy
- Senior Data Scientist at Grab
- languages: English, Malay
- safe bio
- capacity available

### Unsafe mentor exclusion

Mentor:

- name: Demo Unsafe Mentor
- excellent career match
- `bio_safety_score < 0.75`
- includes off-platform solicitation language

Expected:

- absent from recommendations
- visible in Safety page as needing review

### Suspended mentor exclusion

Mentor:

- name: Demo Suspended Mentor
- strong language/track match
- `users.is_suspended = true`

Expected:

- absent from recommendations

### Full-capacity mentor exclusion

Mentor:

- name: Demo Full Capacity Mentor
- `current_mentees = max_mentees`

Expected:

- absent from recommendations

### Degraded model mode

Expected from `/match/mentee/{id}` when embedding model is unavailable:

- `model_available: false`
- `warning: Semantic matching degraded — model unavailable`
- deterministic ordering from stored embeddings or fallback vectors

## Matching Tests To Add

### Unit tests

Add tests for:

- `generate_match_reason()` includes shared languages
- `generate_match_reason()` includes industry/track expertise
- `generate_match_reason()` includes years of experience
- fallback reason works with empty data

Files covered:

- `services/matching/matcher.py`
- `services/api/services/matching_service.py`

### API tests

Add tests for:

- `POST /match` returns score/reason/shared_languages
- `GET /match/mentee/{id}` excludes unsafe mentor
- `GET /match/mentee/{id}` excludes suspended mentor
- `GET /match/mentee/{id}` excludes full-capacity mentor
- `GET /match/mentee/{id}` returns degraded warning when model unavailable
- unauthorized user cannot view another mentee's match recommendations

Files covered:

- `services/api/routers/match.py`
- `services/matching/matcher.py`

### Playwright demo test

Add `web-matching-safety-proof.spec.ts`:

- login as seeded mentee Aisha
- open mentor candidates
- assert Priya appears
- assert Demo Unsafe Mentor does not appear
- assert Demo Suspended Mentor does not appear
- assert Demo Full Capacity Mentor does not appear
- assert visible explanation contains language/track/safety messaging

Files covered:

- `apps/web/src/app/mentee/candidates/page.jsx`

## Seed Data Improvements

Current seed route:

- `apps/web/src/app/api/seed-demo/route.js`

Current strengths:

- creates institutions
- creates approved mentors
- creates mentees
- creates active matches
- creates impact events

Current gaps:

- uses `Math.random()` for mentor ages and match scores
- does not seed unsafe mentor bio state
- does not seed suspended mentor
- does not seed full-capacity mentor
- does not seed pending match requests
- does not seed session messages
- does not seed flagged safety messages
- does not seed safety reports
- does not seed guardian consent states

## Recommended Demo Seed Set

Add or create a new `seed-demo-coverage` route/script with deterministic data.

Required records:

### Users

- `demo.mentee.aisha@elevateher.demo`
- `demo.mentor.priya@elevateher.demo`
- `demo.mentor.unsafe@elevateher.demo`
- `demo.mentor.suspended@elevateher.demo`
- `demo.mentor.full@elevateher.demo`
- `demo.admin.inti@elevateher.demo`

### Mentors

- safe approved mentor
- unsafe pending-review mentor
- suspended mentor
- full-capacity mentor
- mentor awaiting verification

### Matches

- one pending match
- one active match
- one completed match
- one declined match

### Sessions

- one empty session
- one active session with safe messages
- one session with a flagged message
- one completed session with AI summary

### Safety reports

- one medium report
- one critical report
- one resolved report

### Impact events

- one SDG 4.4 skills event
- one SDG 5.5 confidence/leadership event
- one SDG 8.6 internship/job event
- one offline/USSD participation event

## Demo Coverage Definition Of Done

This round is complete when the repo can prove the following in automated or scripted form:

- landing page contains the offline/safety/SDG narrative
- USSD simulator completes at least two language paths
- onboarding routes users correctly
- mentor discovery shows the expected safe mentor
- unsafe, suspended, and full-capacity mentors do not appear in recommendations
- live bio scanner shows safe and unsafe outputs
- session safety blocks or flags an unsafe message
- institution dashboard safety page loads non-empty reports/risk/suspended states
- impact page shows known seeded events

## Recommended Implementation Order

## Step 1: Seed deterministic demo coverage data

Do this first. Without deterministic data, tests will either remain weak or become flaky.

Target:

- extend `apps/web/src/app/api/seed-demo/route.js`, or
- add a backend/scripted seeder specifically for demo coverage

## Step 2: Add live bio scanner UI

Target:

- `apps/dashboard/app/[subdomain]/safety/page.tsx`

Minimum UI:

- sample selector
- textarea
- scan button
- result card with approved, score, flags, review required

## Step 3: Fix Safety page response mapping

Target:

- `apps/dashboard/app/[subdomain]/safety/page.tsx`
- `services/api/routers/admin.py`

Make the frontend resilient to both current and intended backend field names.

## Step 4: Add backend tests for bio scanner and matching filters

Targets:

- `services/safety/bio_classifier.py`
- `services/api/routers/safety.py`
- `services/api/routers/match.py`
- `services/matching/matcher.py`

## Step 5: Add Playwright demo proof tests

Targets:

- `playwright/tests/web-landing-content.spec.ts`
- `playwright/tests/web-ussd-demo-flow.spec.ts`
- `playwright/tests/web-matching-safety-proof.spec.ts`
- `playwright/tests/web-session-safety.spec.ts`
- `playwright/tests/dashboard-safety-scanner.spec.ts`

## Final Recommendation

For the hackathon, prioritize demo coverage over broad production coverage.

The winning story is:

- any phone can access mentorship
- AI finds a relevant mentor
- unsafe mentors and unsafe messages are filtered
- institutions can see impact and risk

The current repo already has most of that logic. What is missing is deterministic proof. Add seeded states, add a visible scanner, and replace smoke tests with assertions against named people, known safety flags, and known match outcomes.
