---
id: '001'
title: 'Generated-file storage foundation: GeneratedFile model, FileStorage abstraction,
  GeneratedFileService'
status: done
use-cases:
- SUC-005
- SUC-006
depends-on: []
github-issue: ''
issue: ai-generated-labels-and-exports-downloadable-via-link.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Generated-file storage foundation: GeneratedFile model, FileStorage abstraction, GeneratedFileService

## Description

Foundation ticket for the whole sprint. Nothing in this sprint can store
a file or mint a download link until this exists. Builds, in order:

1. A shared, request-less base-URL helper, extracted from
   `LabelService`'s constructor (which today privately inlines
   `QR_DOMAIN ?? APP_BASE_URL ?? 'http://localhost:9311'`).
2. A `FileStorage` abstraction with two implementations, selected once
   at the composition root by whether `DO_SPACES_KEY`/`DO_SPACES_SECRET`
   are set.
3. A `GeneratedFile` Prisma model + migration (including the seed row
   for ticket 005's cleanup job, so that job's `ScheduledJob` row exists
   from the start even though its handler isn't registered until 005).
4. `GeneratedFileService`, the only thing later tickets call.

See sprint.md Architecture, Step 3 ("Define Subsystems and Modules")
and Step 6 (Design Rationale) for the reasoning behind the two-backend
storage split and why authorization lives in the service, not the route.

## Acceptance Criteria

- [x] `server/src/config/baseUrl.ts` exports a function implementing the
      existing `QR_DOMAIN ?? APP_BASE_URL ?? localhost` fallback chain,
      with no `Request` parameter.
- [x] `LabelService`'s constructor is refactored to call this helper
      instead of inlining the chain; `LabelService`'s existing tests
      pass unchanged (no behavior change).
- [x] `server/src/services/file-storage.ts` exports a `FileStorage`
      interface (`put`, `get`, `delete` by string key, `Buffer` in/out)
      and two implementations:
      - `SpacesFileStorage`: writes to the existing Spaces bucket
        (via `getS3Client()` from `server/src/services/s3.ts`) under a
        `generated-files/` prefix, private (no `ACL: 'public-read'`,
        unlike `ImageService`'s uploads).
      - A dev/test fallback storing bytes in the database (e.g. a
        `data Bytes` column on `GeneratedFile`, or an equivalent
        row-per-key table if that's cleaner given Prisma's handling of
        large `Bytes` columns — implementor's call, document the choice
        in the PR).
      Selection between them happens once, at composition root
      (`ServiceRegistry` or `app.ts`), based on whether
      `DO_SPACES_KEY`/`DO_SPACES_SECRET` are both set.
- [x] A `GeneratedFile` Prisma model exists with: `id`, `ownerId` (FK to
      `User`), `filename`, `mimeType`, `size`, `objectKey`, `tokenHash`
      (`@unique`), `createdAt`, `expiresAt`. The migration also seeds a
      `ScheduledJob` row named `cleanup-generated-files` (daily
      frequency, enabled), following the exact pattern of
      `20260310190000_add_scheduled_job_table`'s `daily-backup`/
      `weekly-backup` seed rows.
- [x] `server/src/services/generated-file.service.ts` exports
      `GeneratedFileService` with at minimum:
      - `store(ownerId, buffer, filename, mimeType, expiresInMs?)` →
        persists via `FileStorage`, creates the `GeneratedFile` row,
        returns `{ token, downloadUrl }`. The raw token is a
        `crypto.randomBytes(32)` hex string; only its sha256 hash
        (`tokenHash`) is ever persisted — matching
        `token.service.ts`'s existing `ApiToken` pattern, so a leaked
        DB row cannot be replayed as a working download link.
        `downloadUrl` is built from the `baseUrl.ts` helper (ticket 002
        mounts the route this points at; this ticket only needs the
        URL to be well-formed, the route need not exist yet for these
        tests).
      - `resolveForDownload(rawToken, requestingUser)` → hashes the raw
        token, looks up the `GeneratedFile` row, and returns one of a
        few distinguishable outcomes: not-found-or-expired, forbidden
        (row exists, requesting user is neither the owner nor
        `hasQMAccess`), or the file's bytes (via `FileStorage.get`) plus
        `filename`/`mimeType`. An expired row must behave identically to
        a nonexistent one to the caller (no timing/existence leak).
      - `deleteExpired()` → finds all rows with `expiresAt` in the past,
        deletes their backing object via `FileStorage.delete`, then
        deletes the rows. Returns a count (ticket 005 wires this to the
        scheduler and needs something to log).
- [x] Default retention is 7 days when `expiresInMs` is omitted.
- [x] No test in this ticket (or anywhere in the sprint) requires real
      `DO_SPACES_KEY`/`DO_SPACES_SECRET` to pass.

## Testing

- **Existing tests to run**: `server/src/services/label.service.ts`'s
  existing test suite (constructor refactor must not change behavior);
  full server test suite per the known-flaky-suite list in the sprint
  context (app, auth, github, pike13, integrations,
  services/issue.service are pre-existing failures, not regressions to
  chase).
- **New tests to write**: unit tests for `FileStorage`'s dev/test
  backend (put/get/delete round trip); unit tests for
  `GeneratedFileService.store`/`resolveForDownload` covering: owner can
  resolve their own file, quartermaster can resolve anyone's, a third
  ordinary user is forbidden, an expired row resolves as not-found,
  `deleteExpired` removes both the row and the backing object.
- **Verification command**: `cd server && npx jest --config
  ../tests/server/jest.config.js src/services/generated-file.service`
  (adjust path to match actual test file location).

## Follow-up fix (reopened)

**Defect**: `ServiceRegistry` (`server/src/services/service.registry.ts`,
commit 74d2960) selected `SpacesFileStorage` whenever
`DO_SPACES_KEY`/`DO_SPACES_SECRET` were present in `process.env` — true
on a developer machine with the project `.env` sourced (needed for
`SESSION_SECRET` by token-auth suites). This caused `labels.test.ts`,
`export-list.test.ts`, and the downloads/scheduler suites to upload 131
real objects into the production DigitalOcean Spaces bucket under
`generated-files/` over the course of the sprint. The bucket has been
cleaned up by the team-lead. This violated this ticket's own acceptance
criterion that no test in the sprint requires or uses real Spaces
credentials.

**Fix**: two independent guards, so no single missed setup step can
reintroduce the defect:

1. `tests/server/jest.setup-env.js`, wired in via jest's `setupFiles`
   (`tests/server/jest.config.js`), deletes `DO_SPACES_KEY`/
   `DO_SPACES_SECRET` from `process.env` before any test file's own
   code runs — this runs regardless of whether a given test file sets
   `NODE_ENV` itself.
2. `ServiceRegistry`'s selection now also requires
   `NODE_ENV !== 'test'` before choosing `SpacesFileStorage`, so the
   guard holds even if a test deliberately re-sets the Spaces env vars
   (as the new regression test below does, to prove the guard).

Production selection (`NODE_ENV` unset/`production` +
real credentials → `SpacesFileStorage`) is unchanged.

**New test**: `tests/server/services/service-registry-file-storage.test.ts`
proves (a) the shell-inherited credentials never reach a test file's
`process.env`, (b) `ServiceRegistry.create()` still selects
`DbFileStorage` and never calls `getS3Client()` even when a test
explicitly re-sets `DO_SPACES_KEY`/`DO_SPACES_SECRET` under
`NODE_ENV=test`, and (c) the production path (`NODE_ENV=production`)
still selects `SpacesFileStorage`, confirming no behavior change there.
Verified this test fails without the fix (reverted both guards
locally, saw both assertions fail with `SpacesFileStorage` selected)
and passes with it.

**Verification run** (no real Spaces/DB credentials):
`cd server && env -u DATABASE_URL SESSION_SECRET=test-session-secret
DO_SPACES_KEY=fake DO_SPACES_SECRET=fake npx jest --config
../tests/server/jest.config.js --runInBand --forceExit
../tests/server/labels.test.ts ../tests/server/export-list.test.ts
../tests/server/downloads.test.ts
../tests/server/services/generated-file.service.test.ts
../tests/server/services/scheduler.service.test.ts
../tests/server/services/service-registry-file-storage.test.ts` — 6
suites, 55 tests, all passing. Full server suite also run: only the
pre-existing known-flaky suites (`app`, `auth`, `github`, `pike13`,
`integrations`, `services/issue.service`) fail, matching this ticket's
documented baseline — no regressions.
