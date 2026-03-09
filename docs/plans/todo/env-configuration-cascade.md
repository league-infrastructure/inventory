# Environment Configuration Cascade

## Context

The project currently mashes all config into a single `.env` file —
`scripts/install.sh` concatenates `.env.template` (non-secret defaults)
with decrypted `secrets/dev.env` (SOPS-encrypted secrets). This makes it
impossible to:

- Separate non-secret config from secrets
- Have per-developer overrides (QR_DOMAIN, DOCKER_CONTEXT, SOPS key path)
- Support multiple environments beyond dev/prod (test, CI, staging)
- Manage config without SOPS access

The new design keeps a **single `.env` file** (for tool compatibility) with
**marked sections** that map back to source files in a `config/` directory.
Two scripts — **load** and **save** — move config between `config/` and `.env`.

---

## New Directory Structure

```
config/
  dev.env                    # Public common config for "dev"
  prod.env                   # Public common config for "prod"
  test.env                   # Public common config for "test" (etc.)
  local/
    ericbusboom.env          # Public local overrides for Eric
    otherdeveloper.env       # Another developer's overrides
  secrets/
    dev.env                  # SOPS-encrypted secrets for "dev"
    prod.env                 # SOPS-encrypted secrets for "prod"
    dev.env.example          # Plaintext template showing required secret keys
    prod.env.example         # Plaintext template for prod secrets
    local/
      ericbusboom.env        # SOPS-encrypted local secrets (optional, rare)
```

The old top-level `secrets/` directory is retired. Everything lives under `config/`.

## Generated `.env` Format

```bash
# CONFIG_COMMON=dev
# CONFIG_LOCAL=ericbusboom

# --- public (dev) ---
APP_DOMAIN=inventory.jtlapp.net
NODE_ENV=development
PORT=3000
DEPLOYMENT=dev
DATABASE_URL=postgresql://app:devpassword@localhost:5433/app
DO_SPACES_ENDPOINT=https://sfo3.digitaloceanspaces.com
DO_SPACES_BUCKET=jtl-inventory
DO_SPACES_REGION=sfo3

# --- secrets (dev) ---
SESSION_SECRET=abc123...
GITHUB_CLIENT_ID=...
GOOGLE_CLIENT_ID=...

# --- public-local (ericbusboom) ---
DEV_DOCKER_CONTEXT=orbstack
PROD_DOCKER_CONTEXT=swarm1
QR_DOMAIN=http://192.168.1.40:5173/
SOPS_AGE_KEY_FILE=/Users/ericbusboom/.config/sops/age/keys.txt

# --- secrets-local (ericbusboom) ---
```

Later sections override earlier ones (standard shell sourcing: last assignment wins).
The two metadata comments (`CONFIG_COMMON`, `CONFIG_LOCAL`) tell the save script
where to write each section back.

## Two NPM Scripts

```bash
npm run config:load -- dev ericbusboom   # Load dev + Eric's local into .env
npm run config:load -- prod              # Load prod, no local overrides
npm run config:save                      # Save .env sections back to config/
```

---

## Implementation Steps

### 1. Create `config/` directory tree and populate files

**New files to create:**

- `config/dev.env` — populated from current `.env.template` non-secret values
- `config/prod.env` — production equivalents
- `config/local/ericbusboom.env` — Eric's current per-developer overrides
- `config/secrets/dev.env` — move from `secrets/dev.env` (already SOPS-encrypted)
- `config/secrets/prod.env` — move from `secrets/prod.env`
- `config/secrets/dev.env.example` — move from `secrets/dev.env.example`
- `config/secrets/prod.env.example` — move from `secrets/prod.env.example`
- `config/secrets/local/` — empty dir (for optional local secrets)

**Content split — what moves where:**

| Current location | Variable | New location |
|---|---|---|
| `.env.template` | APP_DOMAIN, DATABASE_URL, DO_SPACES_ENDPOINT/BUCKET/REGION, PORT | `config/dev.env` |
| `.env.template` | DEV_DOCKER_CONTEXT, PROD_DOCKER_CONTEXT | `config/local/ericbusboom.env` |
| `.env.template` | QR_DOMAIN, SOPS_AGE_KEY_FILE | `config/local/ericbusboom.env` |
| `secrets/dev.env` | DEPLOYMENT | `config/dev.env` (not a secret) |
| `secrets/dev.env` | DO_SPACES_ENDPOINT/BUCKET/REGION | `config/dev.env` (not secrets) |
| `secrets/dev.env` | SESSION_SECRET, OAuth keys, API keys, DO_SPACES_KEY/SECRET | `config/secrets/dev.env` |

### 2. Update `.sops.yaml`

Change the path regex from `secrets/` to `config/secrets/`:

```yaml
creation_rules:
  - path_regex: config/secrets/[^/]+\.(?:env|json|yaml|yml|txt|conf)$
    age: >-
      age1v3f2rn...,age1h02a69...
```

**File:** `.sops.yaml`

### 3. Create `scripts/config-load.sh`

New script. Usage: `./scripts/config-load.sh <common_name> [local_name]`

Logic:
1. Validate `config/{common_name}.env` exists
2. Write metadata header: `# CONFIG_COMMON={common_name}` and optionally `# CONFIG_LOCAL={local_name}`
3. Write `# --- public ({common_name}) ---` section from `config/{common_name}.env`
4. Write `# --- secrets ({common_name}) ---` section by decrypting `config/secrets/{common_name}.env` via SOPS (skip gracefully if SOPS unavailable or file missing)
5. If local_name given:
   - Write `# --- public-local ({local_name}) ---` from `config/local/{local_name}.env` (warn if missing)
   - Write `# --- secrets-local ({local_name}) ---` from decrypting `config/secrets/local/{local_name}.env` (skip if missing)
6. Output all to `.env`

**File:** `scripts/config-load.sh` (new)

### 4. Create `scripts/config-save.sh`

New script. Usage: `./scripts/config-save.sh`

Logic:
1. Read `.env`, extract `CONFIG_COMMON` and `CONFIG_LOCAL` from metadata comments
2. Parse into four sections based on `# --- ... ---` markers
3. Write public section → `config/{common_name}.env`
4. Write secrets section → temp file, SOPS encrypt in-place, move to `config/secrets/{common_name}.env`
5. If local name present:
   - Write public-local → `config/local/{local_name}.env`
   - Write secrets-local → SOPS encrypt → `config/secrets/local/{local_name}.env` (if non-empty)
6. Print summary of what was saved

Needs SOPS_AGE_KEY_FILE or SOPS_AGE_KEY from `.env` itself (read before parsing sections).

**File:** `scripts/config-save.sh` (new)

### 5. Update `package.json` — simplify to two config scripts

**Remove** old scripts: `secrets:dev`, `secrets:dev:rm`, `secrets:prod`, `secrets:prod:rm`, `secrets:encrypt`, `secrets:encrypt:dev`, `secrets:encrypt:prod`

**Add:**
```json
"config:load": "./scripts/config-load.sh",
"config:save": "./scripts/config-save.sh"
```

**Update** all scripts that source `.env` — they stay as `set -a && . ./.env && set +a` since it's a single file. No change needed here.

**Keep:** `secrets:add-key` (still useful for SOPS key management)

**File:** `package.json` (lines 5–31)

### 6. `server/src/index.ts` — no change needed

The server already loads a single `.env` via dotenv. The new design keeps
this unchanged.

### 7. Update `.gitignore`

```
# Generated environment file (created by scripts/config-load.sh)
.env
```

Remove `.env.local` and `.env.*.local` (no longer relevant).

**File:** `.gitignore` (lines 8–11)

### 8. Migrate encrypted secrets files

```bash
mkdir -p config/secrets/local
git mv secrets/dev.env config/secrets/dev.env
git mv secrets/prod.env config/secrets/prod.env
git mv secrets/dev.env.example config/secrets/dev.env.example
git mv secrets/prod.env.example config/secrets/prod.env.example
```

Then edit the encrypted dev secrets to remove non-secret values:
```bash
sops config/secrets/dev.env
# Remove: DEPLOYMENT, DO_SPACES_ENDPOINT, DO_SPACES_BUCKET, DO_SPACES_REGION
# Keep: SESSION_SECRET, OAuth keys, API keys, DO_SPACES_KEY/SECRET
```

Update example files to match.

### 9. Update `scripts/install.sh`

Replace section 7 ("Generate .env") with a call to `config-load.sh`:

```bash
./scripts/config-load.sh dev "$CURRENT_USER"
```

Rest of install.sh stays the same (Docker detection, age key setup, npm install).

**File:** `scripts/install.sh` (section 7, lines ~342–409)

### 10. Remove old scripts and files

- Delete `scripts/encrypt-secrets.sh` (replaced by `config-save.sh`)
- Delete `scripts/load-secrets.sh` (functionality absorbed by `config-load.sh` for local dev; Swarm secret loading for production remains via `docker/entrypoint.sh`)
- Delete `.env.template` (superseded by `config/dev.env`)
- Remove old `secrets/` directory (after git mv)

### 11. `docker-compose.yml` — no structural changes

The server service still gets `.env` sourced via npm scripts. Docker dev
still hardcodes `DATABASE_URL` and `NODE_ENV` in the `environment:` block.

### 12. Write `docs/secrets.md` — configuration documentation

Rewrite to describe the new layout:

- **Config directory structure** — what lives where
- **Loading config** — `npm run config:load -- dev ericbusboom`
- **Editing config** — edit `.env` directly, run `npm run config:save`
- **Adding a new environment** — create `config/{name}.env` + `config/secrets/{name}.env`
- **Adding a new developer** — create `config/local/{name}.env`
- **SOPS key management** — unchanged (add-age-key.sh, .sops.yaml)
- **Production deployment** — config:load prod, then swarm secret creation
- **Section marker format** — how the `.env` sections map to files

**File:** `docs/secrets.md`

### 13. Update other documentation

- `docs/setup.md` — first-time setup uses `config:load` instead of manual sops decrypt
- `docs/template-spec.md` — updated repo layout diagram, section 7 rewrite
- `docs/deployment.md` — production workflow uses `config:load prod`

---

## Key Design Decisions

1. **Single `.env` file** — tools (dotenv, Docker, IDEs) read one file. No cascade compatibility issues.
2. **Marked sections** — enable round-tripping between `.env` and `config/` sources.
3. **Open environment names** — not limited to dev/prod. Support test, CI, staging, etc.
4. **Local secrets optional** — `config/secrets/local/` exists but most developers won't use it.
5. **No shell variable expansion in config files** — `DATABASE_URL` uses literal port `5433`. Override in local config if different.
6. **Last-write-wins** — later sections in `.env` override earlier ones when shell-sourced. Local overrides common.

## Verification

1. `npm run config:load -- dev ericbusboom` → `.env` has all four sections with correct markers
2. Edit a value in the public section of `.env`, run `npm run config:save` → `config/dev.env` updated
3. Edit a value in the secrets section, run `npm run config:save` → `config/secrets/dev.env` re-encrypted
4. `npm run dev` → server starts, all env vars loaded correctly
5. `npm run test:server` → tests pass
6. `sops -d config/secrets/dev.env` → only actual secrets, no DEPLOYMENT or DO_SPACES non-secret config
7. A fresh clone: `npm run config:load -- dev newdeveloper` → works with warning about missing local config
