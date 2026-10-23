# ElevateHer — E2E Test Suite

Playwright DOM tests covering the Dashboard, Web app, USSD simulator, and FastAPI health.

## Prerequisites

- Node.js 20+
- For the live tests: Docker compose running with all services healthy
- Playwright browsers: `cd playwright && npx playwright install chromium`

## Layout

| Spec                          | Project   | Requires                       | What it covers |
|-------------------------------|-----------|---------------------------------|----------------|
| 01-health                     | health    | `RUN_E2E=1` + API @ :8000       | `/health` + `/ussd/callback` |
| 02-dashboard-overview         | dashboard | `RUN_E2E=1` + :3001             | Cohort Overview renders |
| 03-dashboard-mentors          | dashboard | ditto                          | Mentors list |
| 04-dashboard-mentees          | dashboard | ditto                          | Mentees list |
| 05-dashboard-matches          | dashboard | ditto                          | Matches list |
| 06-dashboard-impacts          | dashboard | ditto                          | Impact + SDG cards |
| 07-web-app-landing            | web       | `RUN_E2E=1` + :3000             | Landing `/` + `/ussd-simulator` |
| 08-web-app-ussd-simulator     | web       | ditto                          | In-app USSD simulator |
| 09-simulator-standalone       | simulator | none (file://)                  | `scratch/ussd_simulator.html` DOM |
| 10-error-pages                | dashboard+web | none                       | 404 fallback; runs in both projects |
| 11-signin-pages               | dashboard+web | `RUN_E2E=1` + :3001/:3000    | /account/signin + signup |

Note: spec `10` and `11` are matched by both `dashboard` and `web` project testMatch regexes, so each runs twice (once per project, against the relevant baseURL). This is intentional — each spec verifies the same beacon against both runtimes.

## Run

```bash
cd playwright
npm install
npx playwright install chromium

# Standalone tests only (no running services required)
npm test

# All tests + live services
RUN_E2E=1 npm test

# Per-project shortcuts
RUN_E2E=1 npm run test:health       # API health
RUN_E2E=1 npm run test:dashboard    # Dashboard pages
RUN_E2E=1 npm run test:web          # Web app
npm run test:simulator              # USSD simulator (no services needed)

# Headed for debugging
RUN_E2E=1 npx playwright test --headed
```

## Tolerant assertions

All 02-08 specs are intentionally tolerant: any non-5xx response with a non-empty body is considered pass. This keeps tests stable across the demo-day build state where seed data may vary.

## Adding tests

Add new `.spec.ts` files matching the `NN-name.spec.ts` pattern; place into the relevant project via the `testMatch` regex in `playwright.config.ts`.
