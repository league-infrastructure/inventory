---
id: "004"
title: "BackupService Filename Parameter and BackupRotationService"
status: done
use-cases: [SUC-003]
depends-on: ["002"]
---

# BackupService Filename Parameter and BackupRotationService

## Description

Modify `BackupService.createBackup()` to accept an optional filename, then
create `BackupRotationService` with daily and weekly rotation logic. Wire
the rotation handlers into SchedulerService's dispatch map.

### BackupService change (`server/src/services/backup.service.ts`)

Add optional `filename?: string` parameter to `createBackup()`. When
provided, use it instead of the auto-generated `backup-<timestamp>.dump`.
When omitted, behavior is unchanged (backward compatible).

### BackupRotationService (`server/src/services/backupRotation.service.ts`)

- `runDaily()`:
  1. Compute filename: `daily-<dow>-<YYYY-MM-DD>.dump` (dow = getDay()).
  2. Delete any existing S3 object matching `backups/daily-<dow>-*`
     (same day-of-week overwrite).
  3. Call `backupService.createBackup(filename)`.
- `runWeekly()`:
  1. Compute filename: `weekly-<YYYY-MM-DD>.dump`.
  2. Call `backupService.createBackup(filename)`.
  3. List all `weekly-*` objects in S3, delete oldest if more than 4.
- Both methods use the existing BackupService for pg_dump and S3 upload.
- Manual backups (`backup-*` prefix) are never touched.

### Wiring

Register handlers in SchedulerService dispatch map:
- `'daily-backup'` → `backupRotation.runDaily()`
- `'weekly-backup'` → `backupRotation.runWeekly()`

## Acceptance Criteria

- [x] BackupService.createBackup() accepts optional filename parameter
- [x] Existing manual backup behavior unchanged when filename omitted
- [x] BackupRotationService.runDaily() creates daily-<dow>-<date>.dump
- [x] runDaily() deletes existing backup with same day-of-week
- [x] BackupRotationService.runWeekly() creates weekly-<date>.dump
- [x] runWeekly() trims to 4 weekly backups
- [x] Manual backups (backup-* prefix) are never deleted by rotation
- [x] Handlers registered in SchedulerService dispatch map

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Test filename parameter passthrough, daily naming
  convention, weekly retention trim logic, manual backup protection
- **Verification command**: `npm run test:server`
