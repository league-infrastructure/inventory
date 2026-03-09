---
id: "003"
title: "Build, deploy, and seed production database"
status: done
use-cases:
  - SUC-025-001
depends-on:
  - "001"
  - "002"
---

# Build, deploy, and seed production database

## Description

Build the production Docker image, deploy the stack to swarm1, run
Prisma migrations, and seed the database from the dev backup.

Steps:
1. Build the production image on swarm1 context
2. Deploy the stack: `DOCKER_CONTEXT=swarm1 docker stack deploy -c docker-compose.prod.yml inventory`
3. Wait for services to start
4. Run migrations: `docker exec ... npx prisma migrate deploy`
5. Export dev database: `pg_dump` from local dev
6. Import into production: `pg_restore` or `psql` into the prod db container
7. Verify health endpoint: `curl https://inventory.jointheleague.org/api/health`

## Acceptance Criteria

- [x] Production image builds successfully
- [x] Stack deploys without errors
- [x] Prisma migrations run cleanly
- [x] Dev data is imported into production database
- [x] Health endpoint returns 200
- [x] Frontend loads in browser at https://inventory.jointheleague.org

## Testing

- **Verification**: `curl https://inventory.jointheleague.org/api/health` returns `{"status":"ok"}`
- **Verification**: `DOCKER_CONTEXT=swarm1 docker service ls` shows running services
