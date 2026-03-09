#!/bin/sh
# Build, push to GHCR, and deploy to Docker Swarm.
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
TAG="${TAG:-latest}"

echo "==> Building $IMAGE:$TAG"
docker build --platform linux/amd64 -f docker/Dockerfile.server -t "$IMAGE:$TAG" .

echo "==> Pushing to GHCR"
echo "$GITHUB_TOKEN" | docker login ghcr.io --username league-infrastructure --password-stdin
docker push "$IMAGE:$TAG"

echo "==> Deploying stack to $PROD_DOCKER_CONTEXT"
DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker stack deploy -c docker-compose.yml inventory

echo "==> Forcing service update"
DOCKER_CONTEXT="$PROD_DOCKER_CONTEXT" docker service update --image "$IMAGE:$TAG" --force inventory_server

echo "==> Done"
