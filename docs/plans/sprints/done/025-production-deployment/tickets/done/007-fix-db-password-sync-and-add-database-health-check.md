---
id: "007"
title: "Fix db password sync and add database health check"
status: done
use-cases: []
depends-on:
  - "003"
---

# Fix db password sync and add database health check

## Description

Two issues:

1. **DB password mismatch**: The Postgres pgdata volume was initialized
   before the `db_password` swarm secret was mounted, so the stored
   password doesn't match. `POSTGRES_PASSWORD_FILE` only sets the
   password on first init. Fix: add a Postgres init script that runs
   `ALTER USER` on every container start to sync the password from the
   secret file.

2. **Health endpoint doesn't check DB**: `/api/health` returns
   `{"status":"ok"}` without verifying database connectivity. Update it
   to run a simple query so we can detect auth/connection failures.

## Acceptance Criteria

- [x] DB container syncs password from secret on every start
- [x] `/api/health` queries the database and reports db status
- [x] `npm run deploy` + health check passes end-to-end

## Testing

- **Verification**: `curl https://inventory.jointheleague.org/api/health` returns db: ok
