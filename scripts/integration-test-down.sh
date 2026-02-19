#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.test.yml"

echo "Stopping Fundamento test stack..."
docker compose -f "$COMPOSE_FILE" down -v

rm -f "$PROJECT_DIR/.env.test"
echo "Done."
