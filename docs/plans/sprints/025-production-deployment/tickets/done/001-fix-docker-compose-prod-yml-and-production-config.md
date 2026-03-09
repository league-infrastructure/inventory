---
id: '001'
title: Fix docker-compose.prod.yml and production config
status: done
use-cases:
- SUC-025-001
depends-on: []
---

# Fix docker-compose.prod.yml and production config

## Description

Update `docker-compose.prod.yml` to work for the inventory app:
- Replace hardcoded `apppassword` with a `db_password` swarm secret
- Add all required secrets (Google OAuth, DO Spaces, admin, session)
- Construct `DATABASE_URL` from the db_password secret in entrypoint
- Set correct `APP_DOMAIN` default to `inventory.jtlapp.net`
- Add `QR_DOMAIN` environment variable
- Add DO Spaces env vars for image storage
- Rename stack from `myapp` to `inventory`
- Verify `docker/entrypoint.sh` handles all required secrets

Also update `config/prod/public.env` with production values:
- `APP_DOMAIN=inventory.jtlapp.net`
- `QR_DOMAIN=https://inventory.jtlapp.net`
- Production callback URLs for Google OAuth
- DO Spaces endpoint/bucket/region

## Acceptance Criteria

- [ ] `docker-compose.prod.yml` has all required secrets declared
- [ ] DB password comes from swarm secret, not hardcoded
- [ ] `entrypoint.sh` constructs `DATABASE_URL` from db_password secret
- [ ] `config/prod/public.env` has correct production values
- [ ] Stack name is `inventory` (not `myapp`) in deploy script
- [ ] `npm run deploy` script references correct stack name

## Testing

- **Verification**: `docker compose -f docker-compose.prod.yml config` parses without errors
