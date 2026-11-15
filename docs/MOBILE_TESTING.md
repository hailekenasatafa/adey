# Adey — Testing

## What runs today (and what ran in this environment)

| Layer | Command | Status in build environment |
|---|---|---|
| Database migrations apply cleanly | `supabase/tests/apply_local.sh` (local Postgres 16 + Supabase shim) | ✅ 12 migrations + seed |
| Acceptance scenarios A–L at the data/authorization layer | `psql -d adey_test -f supabase/tests/acceptance.sql` | ✅ 50 checks pass, incl. K (unauthorized edit blocked) and L (payments blocked in free mode) |
| Shared package typecheck + unit tests | `pnpm --filter @adey/shared typecheck && pnpm --filter @adey/shared test` | ✅ 8 tests |
| Mobile typecheck | `pnpm --filter @adey/mobile typecheck` | ✅ |
| Mobile lint | `pnpm --filter @adey/mobile lint` | ✅ 0 errors |
| Mobile unit/component tests (jest-expo + RNTL) | `pnpm --filter @adey/mobile test` | ✅ 11 tests |
| Mobile Hermes bundle (iOS + Android) | `npx expo export --platform ios --platform android` | ✅ both bundles compile |
| Web typecheck + production build | `pnpm --filter @adey/web typecheck && pnpm --filter @adey/web build` | ✅ 50 routes |
| `expo-doctor` | `npx expo-doctor` | ⚠️ 17/20 — the 3 failures are network checks (Expo API unreachable from the build sandbox), not project issues |

## Could NOT run here (needs your machine / credentials)
- **iOS simulator / Android emulator / physical devices** — no simulators in the sandbox. Run `npx expo run:ios` / `run:android` (dev build is required for maps, push, secure store).
- **Full acceptance suite against the real Supabase project** — `supabase/tests/acceptance.sql` uses psql meta-commands, so it runs through `psql`/CI rather than the hosted SQL runner. On 2026-11-14 the live project (`glxnvkqxedyxxhfhwuwr`) was instead checked two ways: its schema fingerprint (functions, policies, columns, triggers, constraints, indexes, enums, RLS flags, settings, categories, buckets) matched the local validation database exactly, and a rolled-back smoke run covered sign-up → business create/publish → screen → campaign request → counter → accept → booking with 0 commission, plus anonymous-visitor and cross-tenant denial checks. That smoke run found one real defect (draft business creation failed under `INSERT … RETURNING`), fixed in migration 0015 and now covered by acceptance check C.
- **Push delivery end-to-end** — requires EAS project id + a physical device.
- **Email verification / password reset** — requires Supabase Auth email templates + the website deployed at `NEXT_PUBLIC_SITE_URL`.

## Acceptance test matrix (spec §32)
| Test | Layer proven | How to verify on device |
|---|---|---|
| A Discover restaurant in MD | SQL ✅ | Explore → US Market → state MD / search |
| B View products & contact | SQL ✅ | Business → Products/Services → Contact / Request Quote |
| C Owner updates profile | SQL ✅ | Profile → business → Edit |
| D Owner lists TV | SQL ✅ | Dashboard → My screens → Add |
| E Advertiser finds TV & adds to campaign | SQL ✅ | AdConnect → Find screens → Add to Campaign |
| F Multi-business batch requests | SQL ✅ (partial failure reported) | Campaign wizard → Send |
| G Owner notified & counters | SQL ✅ (notification row) | Incoming requests → Counteroffer |
| H Advertiser responds | SQL ✅ | Campaign → request → Accept |
| I Booking consistent app/web | SQL ✅ (same rows, both parties) | Bookings on app + website |
| J Website edit shows in app | SQL ✅ | Edit on web → pull to refresh in app |
| K Unauthorized edit blocked | SQL ✅ | — (RLS) |
| L Payments disabled in free mode | SQL ✅ | Payments page shows Free Launch Mode |

## Manual QA checklist (per release)
1. Fresh install → onboarding → skip → browse without account.
2. Sign up → verify email (link lands on website `/auth/callback`) → sign in on app.
3. Light/dark mode, large font (accessibility) on Home, Business, Campaign wizard.
4. Offline: airplane mode → Home shows cached results + banner; retry works.
5. Push: send a test counteroffer → notification tap opens the request.
6. Uploads: photo (10 MB limit), video (60 s / 200 MB), PDF for verification.

## CI
`.github/workflows/ci.yml` runs migrations + acceptance SQL on a Postgres service, then typecheck/lint/tests for all packages and the web build.
