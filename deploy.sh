#!/usr/bin/env bash
set -euo pipefail

# Dochas Times - Phase 1 Deployment Script
# Prerequisites: Update Cloudflare API token to include:
#   - Account > D1: Edit
#   - Account > Workers Scripts: Edit
#   - Account > Cloudflare Pages: Edit
#   - Account > Account Settings: Read

export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

# Set these environment variables before running:
#   export CLOUDFLARE_API_TOKEN="your-token-here"
#   export CLOUDFLARE_ACCOUNT_ID="your-account-id"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set."
    exit 1
fi

echo "=== Step 1: Create D1 database ==="
cd /root/dochas-times/worker
DB_OUTPUT=$(npx wrangler d1 create dochas-times 2>&1)
echo "$DB_OUTPUT"

# Extract database_id and update wrangler.toml
DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[^"]+')
if [ -n "$DB_ID" ]; then
    sed -i "s/database_id = \"PLACEHOLDER\"/database_id = \"$DB_ID\"/" wrangler.toml
    echo "Updated wrangler.toml with database_id: $DB_ID"
else
    echo "ERROR: Could not extract database_id. Update wrangler.toml manually."
    exit 1
fi

echo ""
echo "=== Step 2: Run schema migration ==="
npx wrangler d1 execute dochas-times --file=src/db/schema.sql --remote

echo ""
echo "=== Step 3: Seed data ==="
npx wrangler d1 execute dochas-times --file=src/db/seed.sql --remote

echo ""
echo "=== Step 4: Deploy worker ==="
npx wrangler deploy
WORKER_URL=$(npx wrangler deploy 2>&1 | grep -oP 'https://[^ ]+\.workers\.dev' || echo "")
echo "Worker URL: ${WORKER_URL:-check output above}"

echo ""
echo "=== Step 5: Build frontend ==="
cd /root/dochas-times/frontend
# If worker URL was captured, use it; otherwise use placeholder
VITE_API_URL="${WORKER_URL:-https://dochas-api.ryan-nash43.workers.dev}" npm run build

echo ""
echo "=== Step 6: Deploy frontend ==="
npx wrangler pages project create dochas-times --production-branch main 2>/dev/null || true
npx wrangler pages deploy dist --project-name dochas-times --commit-dirty=true --branch main

echo ""
echo "=== Deployment complete ==="
echo "Update VITE_API_URL if the worker URL differs from what was used."
