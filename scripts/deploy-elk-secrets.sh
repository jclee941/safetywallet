#!/bin/bash
#
# ELK Production Deployment Script for SafetyWallet
# Usage: ./scripts/deploy-elk-secrets.sh
#

set -e

echo "=========================================="
echo "SafetyWallet ELK Production Deployment"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Verify Cloudflare authentication${NC}"
echo "Make sure you're logged in to wrangler:"
echo "  npx wrangler login"
echo ""
read -p "Press Enter when ready to continue..."
echo ""

echo -e "${YELLOW}Step 2: Set ELASTICSEARCH_URL secret${NC}"
echo "This will prompt you to enter the Elasticsearch URL."
echo "Value: http://192.168.50.109:9200"
echo ""
npx wrangler secret put ELASTICSEARCH_URL
echo ""

echo -e "${YELLOW}Step 3: Set ELASTICSEARCH_API_KEY secret${NC}"
echo "This will prompt you to enter the Elasticsearch API Key."
echo "Value from 1Password: [Retrieve from 1Password > 'SafetyWallet ELK' > 'API Key']"
echo ""
npx wrangler secret put ELASTICSEARCH_API_KEY
echo ""

echo -e "${YELLOW}Step 4: Verify secrets are set${NC}"
npx wrangler secret list
echo ""

echo -e "${YELLOW}Step 5: Deploy the Worker${NC}"
echo "Deploying to production..."
npx wrangler deploy
echo ""

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Trigger a test warning log to verify ELK connectivity"
echo "2. Check Kibana (http://192.168.50.109:5601) for 'safetywallet-logs-*' indices"
echo "3. Verify logs are appearing in the Discover tab"
echo ""
echo "To test locally with dev environment:"
echo "  cd apps/api"
  echo 'ELASTICSEARCH_API_KEY=[Retrieve from 1Password]' >> .dev.vars
echo "  npm run dev"
