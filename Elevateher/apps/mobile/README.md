# ⚠️ NOT PART OF THE HACKATHON DEMO

**This `mobile/` directory is NOT included in the ElevateHer demo.**

It is an **early-stage Expo shell** that is not connected to the core backend,
has no mentorship flows implemented, and its dependency surface (134 packages including
Three.js, react-native-skia, expo-purchases, expo-ads, etc.) adds maintenance burden
without strengthening the core product.

## What IS the demo

The demonstrable platform is:

| App | Stack | Role |
|-----|-------|------|
| `apps/web/` | React Router v7 + Vite | Mentee/mentor web UI |
| `apps/dashboard/` | Next.js 14 | Institution portal |
| `services/api/` | FastAPI | Single backend for all domain logic |
| USSD/SMS | Infobip + FastAPI | Offline-first channel |

## What this mobile app needs before it could ship

- [ ] Remove `@anythingai/app`, Three.js, `expo-video`, `expo-audio`, `expo-speech`
- [ ] Remove `react-native-purchases`, `react-native-google-mobile-ads`, `expo-ads`
- [ ] Remove `@shopify/react-native-skia`, `expo-three`
- [ ] Connect to FastAPI backend (not direct Neon)
- [ ] Implement real mentorship flows: registration, matching, sessions, safety

## Recommendation for the demo

**Do not mention or navigate to `apps/mobile/` during judging.**

The demo story is: web + USSD + dashboard + FastAPI = one coherent offline-first mentorship platform.

---
Last reviewed: Phase 8 scope reduction (2026-07-01)