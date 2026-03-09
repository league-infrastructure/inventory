---
id: "002"
title: "Populate production secrets and create swarm secrets"
status: done
use-cases:
  - SUC-025-001
depends-on:
  - "001"
---

# Populate production secrets and create swarm secrets

## Description

Populate `config/prod/secrets.env` with production credential values:
- Generate strong `DB_PASSWORD` and `SESSION_SECRET`
- Set `ADMIN_PASSWORD`
- Add Google OAuth `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Add DO Spaces `DO_SPACES_KEY` and `DO_SPACES_SECRET`

SOPS-encrypt the file: `cd config && sops -e -i prod/secrets.env`

Then create Docker Swarm secrets on swarm1:
```bash
cd config
sops -d prod/secrets.env | while IFS='=' read -r key value; do
  echo "$value" | DOCKER_CONTEXT=swarm1 docker secret create "$(echo "$key" | tr '[:upper:]' '[:lower:]')" -
done
```

## Acceptance Criteria

- [x] `config/prod/secrets.env` is SOPS-encrypted with all required values
- [x] Swarm secrets are created on swarm1
- [x] `DOCKER_CONTEXT=swarm1 docker secret ls` shows all expected secrets

## Testing

- **Verification**: `sops -d config/prod/secrets.env` decrypts successfully
- **Verification**: `DOCKER_CONTEXT=swarm1 docker secret ls` lists all secrets
