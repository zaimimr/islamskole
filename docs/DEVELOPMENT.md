# Development

## Run

```bash
npm ci
cp .env.example .env.local
supabase start
npm run dev -- -p 3100
```

Fill `.env.local` from `supabase status -o env` for a local stack. `.env.example` lists every variable the app and scripts read. `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` are set by Vercel.

## Check

| Command | What it runs |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Every `tests/*.test.mjs` with the Node test runner |
| `npm run test:e2e` | Playwright specs in `tests/*.spec.ts` |
| `npm run test:db` | pgTAP suites in `supabase/tests` (needs a running local stack) |
| `npm run build` | Production build, needs no env vars |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, build and pgTAP on every push to `main` and every pull request.

## Migrations

Never apply a migration straight to production.

1. `supabase migration new <name>` and write idempotent SQL. Keep money history append-only.
2. Test it on the local stack (`supabase db reset`, then `npm run test:db`) or on a Supabase branch.
3. Apply to production with `supabase db push`, so the recorded version matches the file name.
4. `npm run db:types` regenerates `src/lib/supabase/types.ts`.
5. `npm run db:drift` compares `supabase/migrations` with the production history. It needs `SUPABASE_ACCESS_TOKEN` and skips without it.

## Admin session for local testing

With the local stack running:

```bash
SERVICE_KEY=<service_role key> ANON_KEY=<anon key> node scripts/mint-local-session.mjs
```

It creates `test-admin@islamskole.no` with the admin role and prints a cookie value. Set it as cookie `sb-127-auth-token` on `localhost` (path `/`, SameSite Lax), then open `http://localhost:3100/no/admin`.
