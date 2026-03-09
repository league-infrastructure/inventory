---
id: '025'
title: Production Deployment
status: done
branch: sprint/025-production-deployment
use-cases:
- SUC-025-001
- SUC-025-002
- SUC-025-003
---

# Sprint 025: Production Deployment

## Goals

Get the inventory application deployed and running in production on
the Docker Swarm at `inventory.jtlapp.net`. This includes fixing the
production Docker Compose configuration, setting up swarm secrets,
deploying the stack, running migrations, and verifying the app works
end to end including OAuth login, image uploads, and QR code scanning.

## Problem

The app has been developed and tested locally but has never been deployed
to production. The `docker-compose.prod.yml` has template placeholder
values (hardcoded passwords, `myapp` references, missing secrets for
OAuth and DO Spaces). The production config needs to be completed and
the full deployment pipeline exercised.

## Solution

1. Update `docker-compose.prod.yml` with all required secrets and
   correct configuration for the inventory app.
2. Populate `config/prod/secrets.env` with production credentials.
3. Create Docker Swarm secrets on the production host.
4. Build and deploy the stack to `swarm1`.
5. Run Prisma migrations against the production database.
6. Configure OAuth callback URLs for the production domain.
7. Verify the full app works: login, browse kits, QR codes, images.

## Success Criteria

- App is accessible at `https://inventory.jtlapp.net`
- Google OAuth login works with production callback URL
- Image uploads to DO Spaces work in production
- QR codes generate with the production domain
- Database migrations run cleanly
- App survives a `docker service update` (rolling restart)

## Scope

### In Scope

- Fix `docker-compose.prod.yml` (secrets, env vars, labels, volumes)
- Populate production secrets (`config/prod/secrets.env`)
- Create swarm secrets and deploy the stack
- Run database migrations in production
- Update OAuth callback URLs for production domain
- Verify end-to-end functionality
- Set up production `QR_DOMAIN` and `APP_DOMAIN`

### Out of Scope

- CI/CD pipeline (manual deploy is fine for now)
- Monitoring, alerting, or logging infrastructure
- Database backups automation
- Multiple replicas / high availability tuning
- SSL certificate management (Caddy handles this)

## Test Strategy

This sprint is primarily operational — testing is manual verification:

- Hit the health endpoint after deploy
- Log in via Google OAuth from a browser
- Browse kits, view images, scan a QR code
- Check that QR codes use the production domain
- Verify rolling restart doesn't drop requests

## Architecture Notes

- Single combined image: server + client static files served by Express
- Caddy reads Docker Swarm labels for automatic HTTPS routing
- `docker/entrypoint.sh` converts swarm secret files to env vars
- Database runs as a swarm service with a named volume for persistence
- dotconfig manages secrets via `config/prod/secrets.env` (SOPS-encrypted)

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

1. **001** — Fix docker-compose.prod.yml and production config
2. **002** — Populate production secrets and create swarm secrets
3. **003** — Build, deploy, and seed production database
4. **004** — Configure Google OAuth for production and verify end-to-end
