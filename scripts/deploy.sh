#!/bin/sh
# Build, push to GHCR, and deploy to Docker Swarm.
#
# Single-command deploy:
#   1. Bumps the version (dotconfig + package.json + server/package.json)
#   2. Commits the version files, tags v<version>, pushes
#   3. Creates an isolated git worktree at the new tag
#   4. Builds the image, pushes to GHCR, deploys the stack, runs migrations
#
# Only the version files are staged for the bump commit — any other
# uncommitted changes in the working tree are left untouched and will NOT
# ship (the build runs from the tagged commit in an isolated worktree).
# A dirty-tree warning is printed up front so you can ctrl-C if needed.
#
# Usage: ./scripts/deploy.sh
#
# Requires: .env with PROD_DOCKER_CONTEXT, GITHUB_TOKEN
set -e

REPO_ROOT=$(pwd)

# --- Load production environment ---
DEPLOY_ENV=".env.deploy"
dotconfig load prod --output "$DEPLOY_ENV"
set -a
. "./$DEPLOY_ENV"
set +a

IMAGE="ghcr.io/league-infrastructure/inventory-server"

# --- Pre-flight sanity ---

if [ "$APP_DOMAIN" != "inventory.jointheleague.org" ]; then
  echo "ERROR: APP_DOMAIN is '$APP_DOMAIN' — expected 'inventory.jointheleague.org'." >&2
  echo "  Check config/prod/public.env is sourced correctly." >&2
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "master" ] && [ "$BRANCH" != "main" ]; then
  echo "ERROR: Must be on master/main to deploy (currently on $BRANCH)." >&2
  exit 1
fi

# Warn (don't block) about uncommitted changes — they won't ship.
DIRTY=$(git status --porcelain | grep -v "^?? " || true)
if [ -n "$DIRTY" ]; then
  echo "WARNING: uncommitted changes in working tree will NOT be deployed:"
  echo "$DIRTY" | sed 's/^/  /'
  echo "         (build runs from the tagged commit in an isolated worktree)"
  echo ""
fi

# --- Bump version ---

OLD_VERSION=$(dotconfig version)
echo "==> Bumping version (was $OLD_VERSION)"
dotconfig version bump >/dev/null
VERSION=$(dotconfig version)
TAG="v$VERSION"
echo "==> New version: $VERSION"

# Sync server/package.json so it doesn't drift from root.
node -e "const f='server/package.json'; const p=JSON.parse(require('fs').readFileSync(f)); p.version='$VERSION'; require('fs').writeFileSync(f, JSON.stringify(p, null, 2)+'\n')"

# Stage ONLY version files. Anything else dirty stays untouched.
git add config/dotconfig.yaml package.json server/package.json
[ -f pyproject.toml ] && git add pyproject.toml

if git diff --cached --quiet; then
  echo "ERROR: dotconfig version bump produced no changes — aborting." >&2
  exit 1
fi

git commit -m "chore: bump version to $VERSION" >/dev/null
git tag "$TAG"
echo "==> Pushing commit and tag $TAG"
git push --follow-tags

TAG_COMMIT=$(git rev-parse "$TAG^{commit}")
echo "==> Deploying $TAG ($TAG_COMMIT)"

# --- Isolated worktree ---
# Build from a pristine checkout of the new tag so local IDE/hook
# edits don't leak into the image.
WORKTREE_DIR=$(mktemp -d -t inventory-deploy-XXXXXX)

cleanup() {
  cd "$REPO_ROOT" || true
  git worktree remove --force "$WORKTREE_DIR" 2>/dev/null || rm -rf "$WORKTREE_DIR"
  rm -f "$REPO_ROOT/$DEPLOY_ENV"
}
trap cleanup EXIT

echo "==> Creating worktree at $WORKTREE_DIR"
git worktree add --detach "$WORKTREE_DIR" "$TAG"
cd "$WORKTREE_DIR"

# --- Build & push ---

echo "==> Building $IMAGE:$VERSION"
docker build --platform linux/amd64 -f docker/Dockerfile.server -t "$IMAGE:$VERSION" -t "$IMAGE:latest" .

echo "==> Pushing to GHCR"
echo "$GITHUB_TOKEN" | docker login ghcr.io --username league-infrastructure --password-stdin
docker push "$IMAGE:$VERSION"
docker push "$IMAGE:latest"

# --- Deploy ---

echo "==> Logging into GHCR on swarm manager"
DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" sh -c \
  'echo "$GITHUB_TOKEN" | docker login ghcr.io --username league-infrastructure --password-stdin'

echo "==> Deploying stack to $PROD_DOCKER_CONTEXT"
TAG="$VERSION" DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker stack deploy \
  --with-registry-auth -c docker-compose.yml inventory

echo "==> Forcing service update"
DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker service update \
  --with-registry-auth --image "$IMAGE:$VERSION" --force inventory_server

# --- Run migrations ---
# One-shot swarm service that can access the database_url secret.
# --restart-condition=none ensures it runs once and stops.
echo "==> Running database migrations"
DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker service rm inventory_migrate >/dev/null 2>&1 || true
DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker service create \
  --detach \
  --name inventory_migrate \
  --restart-condition=none \
  --constraint 'node.hostname==swarm2' \
  --with-registry-auth \
  --network inventory_default \
  --secret database_url \
  --entrypoint sh \
  "$IMAGE:$VERSION" \
  -c 'export DATABASE_URL=$(cat /run/secrets/database_url) && npx prisma migrate deploy --schema prisma/schema.prisma'

echo "==> Waiting for migrations to finish"
while true; do
  STATE=$(DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker service ps inventory_migrate \
    --format '{{.CurrentState}}' --no-trunc 2>/dev/null | head -1)
  case "$STATE" in
    Complete*) echo "==> Migrations completed successfully"; break ;;
    Failed*|Rejected*)
               echo "ERROR: Migration failed" >&2
               DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker service logs inventory_migrate >&2
               DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker service rm inventory_migrate >/dev/null 2>&1
               exit 1 ;;
    *)         sleep 3 ;;
  esac
done
DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker service rm inventory_migrate >/dev/null 2>&1

echo "==> Done — deployed $IMAGE:$VERSION"
