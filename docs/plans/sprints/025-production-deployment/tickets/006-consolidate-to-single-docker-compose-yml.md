---
id: "006"
title: "Consolidate to single docker-compose.yml"
status: todo
use-cases: []
depends-on:
  - "001"
---

# Consolidate to single docker-compose.yml

## Description

Replace the two-file setup (`docker-compose.yml` + `docker-compose.prod.yml`)
with a single `docker-compose.yml` that serves both purposes:

- **Local dev**: `docker compose up db` — just the database with port
  mapping and healthcheck, same as today
- **Production deploy**: `docker stack deploy -c docker-compose.yml inventory`
  — full stack with secrets, server build, Caddy labels

Changes:

1. Merge `docker-compose.prod.yml` into `docker-compose.yml`:
   - Keep the production server/db/secrets config
   - Add DB port mapping (`${DB_PORT:-5433}:5432`) and healthcheck from
     the old dev file
2. Delete `docker-compose.prod.yml`
3. Remove dev-docker services (server, client with dev Dockerfiles) —
   not used; local dev runs natively
4. Update npm scripts in `package.json`:
   - Remove `-f docker-compose.prod.yml` from `build:docker` and `deploy`
   - Remove `dev:docker`, `dev:docker:down`, `dev:docker:migrate` scripts
5. Update `docs/deployment.md` references
6. Delete `docker/Dockerfile.server.dev` and `docker/Dockerfile.client.dev`
   if no longer referenced

## Acceptance Criteria

- [ ] Only one `docker-compose.yml` exists (no `.prod.yml`)
- [ ] `docker compose up db` starts Postgres with port mapping and healthcheck
- [ ] `npm run deploy` works without `-f` flag
- [ ] `npm run dev` still works (DB comes up, server/client run natively)
- [ ] Dev-docker scripts and Dockerfiles removed

## Testing

- **Verification**: `docker compose up db` starts and is reachable on port 5433
- **Verification**: `docker compose config` parses without errors
- **Verification**: `npm run dev` starts successfully
