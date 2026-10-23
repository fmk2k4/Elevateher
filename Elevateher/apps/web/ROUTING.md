# ElevateHer Routing Architecture

## Frontend (`apps/web`)

The user-facing portal is powered by **React Router v7** with **Vite** and an integrated **Hono** SSR server runtime:

- `/` (Landing Page): High-performance mission landing page highlighting SDG 4, 5, and 8.
- `/account/signin`, `/account/signup`: Authenticated credentials and OAuth onboarding flows.
- `/onboarding/[role]`: Multi-step career interest and profile completion wizard for mentees and mentors.
- `/mentee/dashboard`: Active mentorship tracker, career milestone progress, and mentor discovery.
- `/mentor/dashboard`: Mentor cohort management, session scheduling, and mentee check-ins.
- `/session/[id]`: Real-time session messaging surface with Server-Sent Events (SSE).
- `/ussd-simulator`: Interactive web simulator for testing low-bandwidth offline USSD (`*384#`) flows.

### Server Route Handlers (`apps/web/src/app/api`)
- React Router / Hono server handlers securely proxy client requests to the FastAPI backend (`http://api:8000` inside Docker).
- `GET /api/sessions/[id]/stream`: Proxies SSE streams from Redis Pub/Sub directly to browser clients.

## Dashboard (`apps/dashboard`)
- Institutional dashboard running on a separate Next.js instance, accessible via subdomains (e.g. `[subdomain].elevateher.org`).
- Includes a layout with global `sonner` Toaster for real-time risk alerts.

## Backend (`services/api`)
- Powered by FastAPI.
- Routes grouped by domain: `auth`, `users`, `mentees`, `matches`, `sessions`, `safety`, `dashboard`, `ai`.
- `GET /sessions/{session_id}/stream`: Subscribes to Redis PubSub for real-time messaging.
