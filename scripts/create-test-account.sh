#!/usr/bin/env bash
# Create a test account via the register API
# Usage: ./scripts/create-test-account.sh [base_url]

set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"

EMAIL="test@example.com"
NAME="Test User"
PASSWORD="testpass123"

echo "Creating test account at ${BASE_URL}/auth/register ..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${EMAIL}\", \"name\": \"${NAME}\", \"password\": \"${PASSWORD}\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo "Account created successfully!"
  echo ""
  echo "Credentials:"
  echo "  Email:    ${EMAIL}"
  echo "  Password: ${PASSWORD}"
  echo ""
  echo "Response:"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" -eq 409 ]; then
  echo "Account already exists (${EMAIL}). Logging in instead..."
  LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${EMAIL}\", \"password\": \"${PASSWORD}\"}")
  echo ""
  echo "Credentials:"
  echo "  Email:    ${EMAIL}"
  echo "  Password: ${PASSWORD}"
  echo ""
  echo "Login response:"
  echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
else
  echo "Failed with status ${HTTP_CODE}"
  echo "$BODY"
  exit 1
fi
