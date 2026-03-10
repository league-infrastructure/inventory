#!/bin/sh
# Build, push to GHCR, and deploy to Docker Swarm.
#
# Pre-flight checks:
#   1. Working tree is clean (no uncommitted changes)
#   2. Current branch is master
#   3. Version tag from package.json exists on HEAD
#
# Usage: ./scripts/deploy.sh
#
# Requires: .env with PROD_DOCKER_CONTEXT, GITHUB_TOKEN
set -e

# Load environment
set -a
. ./.env
set +a

IMAGE="ghcr.io/league-infrastructure/inventory-server"

# --- Pre-flight checks ---

# 1. Working tree must be clean
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree is not clean. Commit or stash changes first." >&2
  git status --short >&2
  exit 1
fi

# 2. Must be on master
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "master" ]; then
  echo "ERROR: Must be on master to deploy (currently on $BRANCH)." >&2
  exit 1
fi

# 3. Read version from package.json and verify tag exists on HEAD
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

HEAD=$(git rev-parse HEAD)
TAG_COMMIT=$(git rev-parse "$TAG^{commit}" 2>/dev/null || true)

if [ -z "$TAG_COMMIT" ]; then
  echo "ERROR: Tag $TAG does not exist. Tag HEAD first:" >&2
  echo "  git tag $TAG" >&2
  exit 1
fi

if [ "$HEAD" != "$TAG_COMMIT" ]; then
  echo "ERROR: Tag $TAG points to a different commit than HEAD." >&2
  echo "  Tag:  $TAG_COMMIT" >&2
  echo "  HEAD: $HEAD" >&2
  exit 1
fi

echo "==> Deploying $TAG ($HEAD)"

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
  --with-registry-auth \
  --network inventory_default \
  --secret database_url \
  --entrypoint sh \
  "$IMAGE:$VERSION" \
  -c 'export DATABASE_URL=$(cat /run/secrets/database_url) && npx prisma migrate deploy --schema prisma/schema.prisma'

# Wait for the migration task to complete
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
