# ADEY · አደይ

**Connecting Communities. Growing Businesses.**

Monorepo for the Adey ecosystem — one shared Supabase backend, the iOS/Android app, and the website.

```
apps/mobile      Expo SDK 58 · Expo Router · TypeScript   (React Native app)
apps/web         Next.js 16 · Tailwind v4                 (website + admin console)
packages/shared  generated DB types · Zod schemas · typed API · brand tokens
supabase/        migrations · seed · edge functions · local test harness
docs/            architecture · API · status · testing · deployment
```

## Quick start
```bash
pnpm install
# backend: create a Supabase project, then apply supabase/migrations/*.sql in order and supabase/seed.sql
cp apps/mobile/.env.example apps/mobile/.env && cp apps/web/.env.example apps/web/.env.local   # fill keys
pnpm mobile      # Expo dev server (use a development build for maps/push)
pnpm web         # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test
```

Local database validation (Postgres 16 required): `supabase/tests/apply_local.sh` then `psql -d adey_test -f supabase/tests/acceptance.sql`.

Read `docs/MOBILE_IMPLEMENTATION_STATUS.md` for what's done, what's gated, and the launch blockers.
