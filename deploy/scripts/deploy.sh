#!/bin/bash
set -euo pipefail

# ─── TaskFlow AWS EC2 Deployment Script ───────────────────────────────────────
# Usage: ./deploy.sh [environment]
# Environments: staging, production

ENVIRONMENT="${1:-staging}"
APP_NAME="taskflow"
DEPLOY_USER="deploy"
DEPLOY_DIR="/opt/$APP_NAME"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TaskFlow Deployment - $ENVIRONMENT                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ─── Validate Environment ─────────────────────────────────────────────────────
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "Error: Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

# ─── Load Environment Variables ───────────────────────────────────────────────
ENV_FILE="$DEPLOY_DIR/.env.$ENVIRONMENT"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

echo "→ Pulling latest images..."
if [ -n "$DOCKER_REGISTRY" ]; then
    docker pull "$DOCKER_REGISTRY/$APP_NAME:$IMAGE_TAG"
    docker tag "$DOCKER_REGISTRY/$APP_NAME:$IMAGE_TAG" "$APP_NAME:latest"
fi

echo "→ Running database migrations..."
docker compose -f "$DEPLOY_DIR/docker-compose.yml" run --rm app \
    npx prisma migrate deploy

echo "→ Starting services..."
docker compose -f "$DEPLOY_DIR/docker-compose.yml" \
    --env-file "$ENV_FILE" \
    up -d --remove-orphans

echo "→ Waiting for health check..."
RETRIES=30
until curl -sf http://localhost:3000/health > /dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -eq 0 ]; then
        echo "Error: Health check failed after 30 attempts"
        echo "→ Rolling back..."
        docker compose -f "$DEPLOY_DIR/docker-compose.yml" down
        docker compose -f "$DEPLOY_DIR/docker-compose.yml" \
            --env-file "$ENV_FILE" \
            up -d --remove-orphans
        exit 1
    fi
    sleep 2
done

echo "→ Cleaning up old images..."
docker image prune -f

echo "→ Deployment complete!"
echo "  Environment: $ENVIRONMENT"
echo "  Health: http://localhost:3000/health"
echo "  Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
