# Ticket 001 Plan — Fix docker-compose.prod.yml and production config

## Approach

Update production deployment files to use swarm secrets instead of
hardcoded passwords, add all required environment variables, and rename
the stack from `myapp` to `inventory`.

## Files to modify

- `docker-compose.prod.yml` — secrets, env vars, domain, stack name
- `docker/entrypoint.sh` — construct DATABASE_URL from DB_PASSWORD
- `package.json` — deploy script stack name
- `docs/deployment.md` — stack name references
- `config/prod/public.env` — already done (correct domain/URLs)

## Testing

- `docker compose -f docker-compose.prod.yml config` parses without errors
