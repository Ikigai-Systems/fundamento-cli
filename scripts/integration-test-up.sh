#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.test.yml"

BASE_URL="${FUNDAMENTO_TEST_URL:-http://localhost:3333}"

echo "Starting Fundamento test stack..."
docker compose -f "$COMPOSE_FILE" up -d

echo "Waiting for Fundamento to be ready..."
MAX_ATTEMPTS=60
ATTEMPT=0
until curl -sf "$BASE_URL" > /dev/null 2>&1; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "ERROR: Fundamento did not become ready after ${MAX_ATTEMPTS}s"
    echo "Logs:"
    docker compose -f "$COMPOSE_FILE" logs website --tail=50
    exit 1
  fi
  sleep 1
done

echo "Fundamento is ready at $BASE_URL"

echo "Creating API token..."
API_KEY=$(docker compose -f "$COMPOSE_FILE" exec -T website bin/rails runner "
  user = User.find_by!(email: 'test@fundamento.test')
  org = Organization.find_by!(name: 'CLI Test Org')
  om = OrganizationMembership.find_by!(user: user, organization: org)
  token = om.api_tokens.find_or_create_by!(title: 'CLI Integration Test') do |t|
    t.organization = org
  end
  print token.encrypted_token
")

if [ -z "$API_KEY" ]; then
  echo "ERROR: Failed to create API token"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.test"
cat > "$ENV_FILE" <<EOF
FUNDAMENTO_TEST_URL=$BASE_URL
FUNDAMENTO_TEST_API_KEY=$API_KEY
EOF

echo "API token saved to .env.test"
echo "Run tests with: npm run test:integration"
