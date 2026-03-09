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

echo "==> Deploying stack to $PROD_DOCKER_CONTEXT"
TAG="$VERSION" DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker stack deploy -c docker-compose.yml inventory

echo "==> Forcing service update"
DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker service update --image "$IMAGE:$VERSION" --force inventory_server

echo "==> Done — deployed $IMAGE:$VERSION"
