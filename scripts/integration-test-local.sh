#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CLOUD_DIR="${FUNDAMENTO_CLOUD_DIR:-$PROJECT_DIR/../fundamento-cloud}"

BASE_URL="${FUNDAMENTO_TEST_URL:-http://localhost:3000}"
EMAIL="${FUNDAMENTO_TEST_EMAIL:-sarah@brightpath.example.com}"

echo "Checking if Fundamento is running at $BASE_URL..."
if ! curl -sf "$BASE_URL" > /dev/null 2>&1; then
  echo "ERROR: Fundamento is not running at $BASE_URL"
  echo "Start it with: cd $CLOUD_DIR && bin/dev"
  exit 1
fi

echo "Creating API token for $EMAIL..."
API_KEY=$(cd "$CLOUD_DIR" && bin/rails runner "
  user = User.find_by!(email: '$EMAIL')
  om = user.organization_memberships.first
  token = om.api_tokens.find_or_create_by!(title: 'CLI Integration Test') do |t|
    t.organization = om.organization
  end
  print token.encrypted_token
" 2>/dev/null)

if [ -z "$API_KEY" ]; then
  echo "ERROR: Failed to create API token"
  echo "Make sure seeds have been run: cd $CLOUD_DIR && bin/rails db:seed"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.test"
cat > "$ENV_FILE" <<EOF
FUNDAMENTO_TEST_URL=$BASE_URL
FUNDAMENTO_TEST_API_KEY=$API_KEY
EOF

echo "API token saved to .env.test"
echo ""
echo "Run tests with: npm run test:integration"
