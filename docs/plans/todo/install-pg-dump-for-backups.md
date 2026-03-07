---
type: todo
status: pending
priority: medium
---

# Install pg_dump in server Docker container for backups

## Problem

The backup endpoint (`POST /api/admin/backups`) spawns `pg_dump` but
the server Docker container doesn't include Postgres client tools.
Running natively also fails if `pg_dump` isn't installed on the host.

Error: `spawn pg_dump ENOENT`

## Solution

Add the `postgresql16-client` package (Alpine) to the server Dockerfile
so `pg_dump` and `pg_restore` are available inside the container.

For `docker/Dockerfile.server` and `docker/Dockerfile.server.dev`, add:

```dockerfile
RUN apk add --no-cache postgresql16-client
```

This gives the container `pg_dump` and `pg_restore` without installing
the full Postgres server.

## Notes

For native dev, developers can install `brew install libpq` and add it
to their PATH, or the backup code could fall back to
`docker exec <db-container> pg_dump` when the local binary isn't found.
