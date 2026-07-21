---
status: pending
---

# Server test suite: pre-existing failures and stale test DB configuration

## Description

Three related problems in the server test infrastructure, discovered on
2026-07-21 while validating an unrelated change (verified identical on
clean master, so all are pre-existing):

### 1. Six suites fail on master (18 tests)

Failing suites: `app.test.ts`, `auth.test.ts`, `github.test.ts`,
`pike13.test.ts`, `integrations.test.ts`, `services/issue.service.test.ts`.

Most failures are OAuth-stub tests expecting `501 Not Configured` from
routes like `GET /api/auth/github` when OAuth credentials are absent, but
receiving `404` — the route is not registered at all instead of being
registered as a 501 stub. Either the app no longer mounts the stub routes
when credentials are missing, or the tests' assumptions about route
registration are stale.

### 2. Stale hardcoded test DATABASE_URL fallback

Multiple test files (`tests/server/*.test.ts`, `tests/server/services/setup.ts`)
hardcode a fallback:

```
postgresql://app:devpassword@localhost:5434/app
```

This went stale when the dev database was renamed to user/db `inventory`
(`docker-compose.dev.yml` now uses `POSTGRES_USER: inventory`). With a
fresh dev DB volume the `app` role does not exist, so every DB-backed
test fails with authentication errors — 23 suites / 180 tests. The `app`
role and database had to be manually recreated in the dev container
(`CREATE ROLE app LOGIN PASSWORD 'devpassword' CREATEDB; CREATE DATABASE
app OWNER app;` plus `prisma migrate deploy`) before tests would run.

Fix ideas: centralize the test DB URL in one place (a single setup module
or env file) and have `docker-compose.dev.yml` create the test role/db
automatically via an initdb script, so a fresh volume works out of the box.
As a bonus, these stale `app` credentials retrying against the dev DB are
confusing when debugging real connection problems (they showed up in dev
DB logs during an outage investigation).

### 3. Standalone single-suite jest runs hang

Running one suite directly (e.g. `npx jest --config
../tests/server/jest.config.js ../tests/server/auth.test.ts`) never
exits — likely open handles (server/scheduler left running). Full batch
runs (`npm run test:server`) complete in ~25–40 s. Add proper teardown
or `--forceExit`/`--detectOpenHandles` guidance so single-suite debugging
is possible.
