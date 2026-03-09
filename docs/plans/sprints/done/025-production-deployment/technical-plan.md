---
status: draft
from-architecture-version: null
to-architecture-version: null
---

# Sprint 025 Technical Plan: Production Deployment

## Overview

Deploy the inventory application to the production Docker Swarm at
`inventory.jtlapp.net`. This involves fixing configuration files,
setting up secrets, and running the deployment pipeline end to end.

## Component Changes

### 1. docker-compose.prod.yml

Current issues to fix:
- `POSTGRES_PASSWORD` is hardcoded as `apppassword` — must use a swarm secret
- `DATABASE_URL` has hardcoded password — must match the DB secret
- Missing secrets: OAuth credentials, DO Spaces credentials, admin password
- `REGISTRY` and image naming need to match actual build output
- `APP_DOMAIN` default should be `inventory.jtlapp.net`
- Need `QR_DOMAIN` env var for production QR code generation
- DB password should come from a secret, not be inline

Target secrets list:
- `db_password` — PostgreSQL password
- `session_secret` — Express session signing
- `google_client_id`, `google_client_secret` — Google OAuth
- `github_client_id`, `github_client_secret` — GitHub OAuth
- `do_spaces_key`, `do_spaces_secret` — DigitalOcean Spaces
- `admin_password` — Admin access

### 2. config/prod/secrets.env

Populate with actual production values:
- Generate a strong `SESSION_SECRET`
- Generate a strong `DB_PASSWORD`
- Set up Google OAuth app with production callback URL
  (`https://inventory.jtlapp.net/api/auth/google/callback`)
- Copy DO Spaces credentials (same bucket, different keys if desired)
- Set `ADMIN_PASSWORD`

Then SOPS-encrypt: `cd config && sops -e -i prod/secrets.env`

### 3. config/prod/public.env

Update with production values:
- `APP_DOMAIN=inventory.jtlapp.net`
- `QR_DOMAIN=https://inventory.jtlapp.net`
- `DEPLOYMENT=prod`
- `GOOGLE_CALLBACK_URL=https://inventory.jtlapp.net/api/auth/google/callback`
- `GITHUB_CALLBACK_URL=https://inventory.jtlapp.net/api/auth/github/callback`
- `DO_SPACES_ENDPOINT`, `DO_SPACES_BUCKET`, `DO_SPACES_REGION`

### 4. docker/entrypoint.sh

Verify it correctly converts all required secrets from
`/run/secrets/*` files to environment variables. May need to handle
`DATABASE_URL` construction from the `db_password` secret.

### 5. Dockerfile.server

Verify the multi-stage build works:
- Client build stage produces static files
- Server build stage compiles TypeScript
- Final image combines both with entrypoint

### 6. OAuth Callback URLs

Register production callback URLs in Google Cloud Console:
- `https://inventory.jtlapp.net/api/auth/google/callback`

## Deployment Steps

1. Populate and encrypt `config/prod/secrets.env`
2. Update `config/prod/public.env` with production values
3. Update `docker-compose.prod.yml` with all secrets and correct config
4. Build the production image on swarm1 context
5. Create swarm secrets from decrypted prod secrets
6. Deploy the stack: `docker stack deploy -c docker-compose.prod.yml inventory`
7. Run migrations: `docker exec ... npx prisma migrate deploy`
8. Verify health: `curl https://inventory.jtlapp.net/api/health`
9. Verify OAuth login in browser
10. Verify QR code scanning from phone

## Risks

- Google OAuth may need domain verification before callback works
- DO Spaces CORS may need configuration for the production domain
- Database volume persistence across stack updates
- First migration on empty database — need to seed initial data

## Decisions

1. **Database seeding:** Seed production from a dev database backup.
   Export current dev database with `pg_dump` and import into production
   after migrations run. This brings over all sites, kits, users, and
   images.
2. **OAuth scope:** Google OAuth only for now. Pike 13 and GitHub OAuth
   can be configured in a later sprint. Only `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` need production
   values.
