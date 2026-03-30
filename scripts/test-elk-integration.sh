#!/bin/bash
#
# ELK Integration Test Script
# Verifies end-to-end connectivity and log shipping
#

set -e

ELK_HOST="192.168.50.109"
ELASTICSEARCH_URL="http://${ELK_HOST}:9200"
KIBANA_URL="http://${ELK_HOST}:5601"

echo "=========================================="
echo "SafetyWallet ELK Integration Test"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: Elasticsearch connectivity
echo -e "${YELLOW}Test 1: Elasticsearch connectivity${NC}"
if curl -s "${ELASTICSEARCH_URL}/_cluster/health" >/dev/null 2>&1; then
  STATUS=$(curl -s "${ELASTICSEARCH_URL}/_cluster/health" | jq -r '.status')
  echo -e "  ${GREEN}✓${NC} Elasticsearch is reachable (status: $STATUS)"
else
  echo -e "  ${RED}✗${NC} Cannot connect to Elasticsearch at ${ELASTICSEARCH_URL}"
  exit 1
fi
echo ""

# Test 2: Check for safetywallet indices
echo -e "${YELLOW}Test 2: Check for safetywallet indices${NC}"
INDICES=$(curl -s "${ELASTICSEARCH_URL}/_cat/indices/safetywallet*?h=index,docs.count" 2>/dev/null || echo "")
if [ -n "$INDICES" ]; then
  echo -e "  ${GREEN}✓${NC} Found safetywallet indices:"
  echo "$INDICES" | while read line; do
    echo "    - $line"
  done
else
  echo -e "  ${YELLOW}⚠${NC} No safetywallet indices found yet (expected before first log)"
fi
echo ""

# Test 3: Kibana connectivity
echo -e "${YELLOW}Test 3: Kibana connectivity${NC}"
if curl -s "${KIBANA_URL}/api/status" >/dev/null 2>&1; then
  KIBANA_STATUS=$(curl -s "${KIBANA_URL}/api/status" | jq -r '.status.overall.state' 2>/dev/null || echo "unknown")
  echo -e "  ${GREEN}✓${NC} Kibana is reachable (status: $KIBANA_STATUS)"
else
  echo -e "  ${RED}✗${NC} Cannot connect to Kibana at ${KIBANA_URL}"
fi
echo ""

# Test 4: API Key validation (if provided)
echo -e "${YELLOW}Test 4: API Key validation${NC}"
if [ -n "$ELASTICSEARCH_API_KEY" ]; then
  AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: ApiKey $ELASTICSEARCH_API_KEY" "${ELASTICSEARCH_URL}/_cluster/health")
  if [ "$AUTH_RESPONSE" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} API Key is valid"
  else
    echo -e "  ${RED}✗${NC} API Key validation failed (HTTP $AUTH_RESPONSE)"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} ELASTICSEARCH_API_KEY not set, skipping auth test"
  echo "      Set it with: export ELASTICSEARCH_API_KEY=your-api-key"
fi
echo ""

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}ELK Test Complete${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. If all tests passed, trigger a test log from the API"
echo "2. Wait 30-60 seconds for log indexing"
echo "3. Re-run this script to verify indices appear"
echo "4. Open Kibana at ${KIBANA_URL} and create an index pattern for 'safetywallet-logs-*'"
