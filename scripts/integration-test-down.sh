#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Stopping Fundamento test stack..."
docker compose -p fundamento-cli down -v

rm -f "$PROJECT_DIR/.env.test"
echo "Done."
