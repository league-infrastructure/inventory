# Secrets Management

## Overview

This project uses **dotconfig** to manage environment configuration and
**SOPS + age** to encrypt secrets at rest.

```
config/
  ├── sops.yaml              ← SOPS encryption policy (age public keys)
  ├── dev/
  │   ├── public.env          ← non-secret dev config (committed)
  │   └── secrets.env         ← SOPS-encrypted dev secrets (committed)
  ├── prod/
  │   ├── public.env          ← non-secret prod config (committed)
  │   └── secrets.env         ← SOPS-encrypted prod secrets (committed)
  └── local/<developer>/
      ├── public.env          ← developer-specific overrides (committed)
      └── secrets.env         ← developer-specific secrets (gitignored)
```

dotconfig assembles `.env` by cascading these layers:

```
dotconfig load dev eric
  → config/dev/public.env        (base public config)
  → config/dev/secrets.env       (SOPS-decrypted secrets)
  → config/local/eric/public.env (local overrides)
  → config/local/eric/secrets.env(local secrets, if any)
  → .env                         (assembled output, gitignored)
```

At runtime in production, Docker Swarm secrets are file-mounted and
`docker/entrypoint.sh` converts them to environment variables.

## File Inventory

| File | Committed | Purpose |
|------|-----------|---------|
| `config/sops.yaml` | Yes | Lists authorized age public keys |
| `config/dev/public.env` | Yes | Non-secret development config |
| `config/dev/secrets.env` | Yes | SOPS-encrypted development secrets |
| `config/prod/public.env` | Yes | Non-secret production config |
| `config/prod/secrets.env` | Yes | SOPS-encrypted production secrets |
| `config/local/<dev>/public.env` | Yes | Developer-specific overrides |
| `config/local/<dev>/secrets.env` | No (gitignored) | Developer-specific secrets |
| `.env` | No (gitignored) | Assembled environment (output of dotconfig) |
| `*.agekey` | No (gitignored) | Private keys |

## Required Secrets

| Secret | Used By | Description |
|--------|---------|-------------|
| `session_secret` | server | Express session signing key |
| `github_client_id` | server | GitHub OAuth app client ID |
| `github_client_secret` | server | GitHub OAuth app client secret |
| `google_client_id` | server | Google OAuth client ID |
| `google_client_secret` | server | Google OAuth client secret |
| `pike13_access_token` | server | Pike 13 API access token (pre-obtained) |

All OAuth secrets are optional. The app starts cleanly without them —
unconfigured integrations return 501 with setup instructions. See
[`docs/api-integrations.md`](api-integrations.md) for credential setup.

## Codespaces Key Setup

Codespaces environments are ephemeral — your age private key is not present
by default. Store it as a GitHub Codespaces secret and the devcontainer will
install it automatically on every new Codespace.

### 1. Find your age private key

If you don't have a keypair yet, generate one first (see
[Onboarding a New Developer](#onboarding-a-new-developer)), then have a
teammate add your public key to `config/sops.yaml` and re-encrypt the secrets.

On your local machine:

```bash
cat ~/.config/sops/age/keys.txt
```

Copy the full output (the comment lines and the `AGE-SECRET-KEY-1...` line).

### 2. Store it as a Codespaces secret

1. Go to [GitHub → Settings → Codespaces → New secret](https://github.com/settings/codespaces)
2. Name: `AGE_PRIVATE_KEY`
3. Value: paste the full key contents
4. Under **Repository access**, authorize this repository

### 3. Use the key in a new Codespace

When you next create (or rebuild) a Codespace, `post-create.sh` reads
`$AGE_PRIVATE_KEY` and writes it to `~/.config/sops/age/keys.txt`
automatically. `dotconfig load dev` will work immediately.

> **Note:** The secret is user-scoped. Each developer must add their own
> `AGE_PRIVATE_KEY` and have their public key onboarded to `config/sops.yaml`.

---

## Onboarding a New Developer

**Prerequisites:** `sops`, `age`, and `dotconfig` must be installed.

- **macOS (local):** `brew install sops age` and `pipx install git+https://github.com/ericbusboom/dotconfig.git`
- **Linux (local):** see [SOPS releases](https://github.com/getsops/sops/releases) and [age releases](https://github.com/FiloSottile/age/releases)
- **Windows (local):** `winget install Mozilla.SOPS FiloSottile.age` or use WSL. You should almost certainly be using WSL.

### 1. New developer: generate an age keypair

Run this on your own machine:

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
cat ~/.config/sops/age/keys.txt
```

This prints your public key (starts with `age1...`). Share it with the team.

### 2. Teammate with access: add the key and re-encrypt

Add the new public key to `config/sops.yaml`, then re-encrypt:

```bash
cd config
sops updatekeys dev/secrets.env
sops updatekeys prod/secrets.env
```

Commit and push the updated `config/sops.yaml` and re-encrypted files.

### 3. Assemble .env for local development

```bash
dotconfig load dev <your-name>
```

This decrypts secrets via SOPS and assembles `.env` from all config layers.

## Editing Secrets

Edit secrets in place — SOPS decrypts to an editor buffer and re-encrypts
on save:

```bash
cd config
sops dev/secrets.env
sops prod/secrets.env
```

After editing, reassemble your local `.env`:

```bash
dotconfig load dev <your-name>
```

## Adding a New Secret

1. Edit the encrypted secrets file: `cd config && sops dev/secrets.env`
2. Reassemble locally: `dotconfig load dev <your-name>`
3. If the secret is used in production, also edit `cd config && sops prod/secrets.env`
4. Add it to the `secrets:` block in `docker-compose.prod.yml` if needed:
   ```yaml
   secrets:
     db_password:
       external: true
     new_secret_name:
       external: true
   ```
5. Reference it in the server's `secrets:` list in the same file
6. Load it to the swarm (see Loading Secrets below)
7. Re-deploy

The `docker/entrypoint.sh` script automatically converts any file under
`/run/secrets/` to an uppercase environment variable. No code changes
needed for the entrypoint.

## Loading Secrets to Docker Swarm

```bash
# Decrypt and load secrets to swarm
cd config
sops -d prod/secrets.env | while IFS='=' read -r key value; do
  echo "$value" | docker secret create "$(echo "$key" | tr '[:upper:]' '[:lower:]')" -
done
```

## Security Rules

- Never hardcode secrets in source code
- Never commit `.env` (it's gitignored)
- Never commit `*.agekey` private keys (gitignored)
- Secrets flow through `entrypoint.sh` — app code reads `process.env`
- Use `sops` to edit encrypted files — never decrypt to a file other
  than `.env`
