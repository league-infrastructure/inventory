---
id: "001"
title: "Fix admin backup 500 error in local development"
status: done
use-cases: []
depends-on: []
---

# Fix admin backup 500 error in local development

## Description

The admin backup button (Import/Export page) returns a 500 error in
local development. `BackupService.createBackup()` has a docker compose
exec fallback for when `pg_dump` isn't on the host, but something in
that path is failing.

Investigate the actual error — possible causes:

- `docker compose exec` can't find the db container (project name
  mismatch, wrong compose file path, container not running)
- The new adhoc naming calls `nextAdhocSeq()` which queries S3 — may
  fail if S3 credentials aren't configured in dev
- `uploadToS3()` after the dump will also fail without S3 credentials
- The S3 upload should be best-effort in dev, not a hard failure

## Acceptance Criteria

- [x] Admin backup button works in local dev
- [x] Backup file is created locally even if S3 is unavailable
- [x] Error messages are clear when S3 is not configured

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: Manual test — click backup button in admin
