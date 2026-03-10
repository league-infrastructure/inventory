---
status: pending
---

# Admin backup button fails with 500 in local development

## Description

The backup button on the admin Import/Export page returns a 500 error
in local development. The `BackupService.createBackup()` method now has
a `docker compose exec` fallback for when `pg_dump` isn't installed on
the host, but something in that path is failing.

Possible causes to investigate:

- The `docker compose -f docker-compose.dev.yml exec -T db pg_dump ...`
  command may not find the db container (project name mismatch, container
  not running, wrong compose file path).
- The new adhoc naming calls `nextAdhocSeq()` which queries S3 — this
  may fail first if S3 credentials aren't configured in the dev
  environment.
- The `createBackup()` method calls `uploadToS3()` after the dump, which
  will also fail without S3 credentials.

The backup feature worked before the docker exec fallback and naming
changes were added. Need to trace the actual error and fix at the
correct layer.
