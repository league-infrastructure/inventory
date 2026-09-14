---
id: '005'
title: Scheduled cleanup of expired generated files
status: done
use-cases:
- SUC-006
depends-on:
- '001'
github-issue: ''
issue: ai-generated-labels-and-exports-downloadable-via-link.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Scheduled cleanup of expired generated files

## Description

Generated files (labels PDFs, list exports) must not accumulate
forever in Spaces and the database. Ticket 001's migration already
seeds a `cleanup-generated-files` `ScheduledJob` row (daily, matching
the existing `daily-backup`/`weekly-backup` seed pattern) and
`GeneratedFileService.deleteExpired()` already does the deletion work
— this ticket only wires the two together, following the exact
registration pattern `server/src/app.ts` already uses for
`daily-backup`/`weekly-backup`.

## Acceptance Criteria

- [x] `server/src/app.ts` registers a `cleanup-generated-files` handler
      on the existing `schedulerService` instance
      (`schedulerService.registerHandler('cleanup-generated-files', ()
      => generatedFileService.deleteExpired())`), same call shape as
      the two existing `registerHandler` calls.
- [x] Running the scheduler's `tick()` when a `GeneratedFile` row's
      `expiresAt` is in the past: the row is deleted, its backing
      object is deleted via `FileStorage.delete`, and
      `ScheduledJob.lastRunAt`/`lastError` are updated exactly as they
      are for the existing backup jobs (no special-casing needed if
      `deleteExpired()` just returns/throws normally — `SchedulerService.tick()`
      already handles success/failure bookkeeping generically).
- [x] A `GeneratedFile` row not yet past `expiresAt` is left untouched
      by a `tick()` call.
- [x] After cleanup, resolving that file's (now-deleted) token via
      `GeneratedFileService.resolveForDownload` or `GET
      /api/downloads/:token` behaves as not-found, same as an
      already-expired-but-not-yet-cleaned-up row (ticket 001/002 already
      guarantee expired-but-uncleaned rows read as not-found; this
      ticket just confirms cleanup doesn't change that user-visible
      behavior, only reclaims storage).

## Testing

- **Existing tests to run**: `SchedulerService`'s existing tests and
  the existing `daily-backup`/`weekly-backup` handler tests must be
  unaffected by the new registration.
- **New tests to write**: a test seeding an expired `GeneratedFile` +
  backing object, running `schedulerService.tick()` (with the
  `cleanup-generated-files` `ScheduledJob.nextRunAt` due), and asserting
  both the DB row and the backing object are gone; a test confirming a
  non-expired row survives a `tick()`.
- **Verification command**: `cd server && npx jest --config
  ../tests/server/jest.config.js src/services/scheduler.service`.
