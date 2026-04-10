# Deployment Automation Verification Guide

Comprehensive guide for verifying SafetyWallet deployments.

## Overview

SafetyWallet uses **Git-ref driven deployment** via Cloudflare Git Integration:

- Push to `master` → Cloudflare auto-deploys
- CI/CD handles D1 migrations and verification
- No manual deploys allowed (enforced by `deploy:api` script)

## Deployment Pipeline

```
┌──────────┐   ┌──────────┐   ┌───────┐   ┌─────────────┐   ┌─────────────┐
│ validate │ → │   test   │ → │ build │ → │ d1-migrate  │ → │ deploy-verify│
└──────────┘   └──────────┘   └───────┘   └─────────────┘   └─────────────┘
   lint           unit         types        DB migrations     Health checks
   typecheck      security     apps         D1 apply          Smoke tests
   guards         sast         static
   code-quality   e2e-smoke
```

## Quick Verification

### After Deployment

```bash
# 1. Check deployment status
./scripts/deploy-verify

# 2. Check API health
curl https://safetywallet.jclee.me/api/health

# 3. Check system status
curl https://safetywallet.jclee.me/api/system/status

# 4. Check monitoring summary (admin only)
curl -H "Authorization: Bearer $TOKEN" \
  https://safetywallet.jclee.me/api/admin/monitoring/summary
```

## Verification Components

### 1. Health Check Endpoint

**Public Endpoint**: `GET /api/health`

```bash
curl https://safetywallet.jclee.me/api/health
```

Response:

```json
{
  "status": "healthy"
}
```

### 2. Deployment Health Endpoint

**Admin Endpoint**: `GET /api/admin/monitoring/health`

Verifies all critical bindings:

- D1 Database connectivity
- KV Namespace access
- R2 Bucket access

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://safetywallet.jclee.me/api/admin/monitoring/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-28T12:00:00Z",
  "version": "1.0.0",
  "checks": {
    "d1": { "status": "ok", "latency": 45 },
    "kv": { "status": "ok", "latency": 23 },
    "r2": { "status": "ok", "latency": 67 }
  }
}
```

### 3. System Status Endpoint

**Public Endpoint**: `GET /api/system/status`

Checks for system issues (FAS down, maintenance mode):

```bash
curl https://safetywallet.jclee.me/api/system/status
```

Response:

```json
{
  "success": true,
  "data": {
    "notices": [],
    "hasIssues": false
  },
  "timestamp": "2026-03-28T12:00:00Z"
}
```

## Automated Verification

### CI/CD Verification Job

The GitHub Actions workflow includes automatic verification after D1 migration:

```yaml
deploy-verify:
  name: Deploy Verify
  runs-on: ubuntu-latest
  needs: [d1-migrate]
  steps:
    - run: sleep 30 # Wait for deployment propagation
    - run: ./scripts/deploy-verify --api https://safetywallet.jclee.me --retries 5
```

### Verification Script

**Script**: `scripts/deploy-verify`

Features:

- Health endpoint checks with retries
- Smoke tests for critical endpoints
- Static asset verification
- D1 migration status check
- Colored output for easy reading

Usage:

```bash
# Basic verification
./scripts/deploy-verify

# With options
./scripts/deploy-verify --api https://safetywallet.jclee.me --timeout 30 --retries 5
```

## Manual Verification Steps

### 1. Pre-Deployment Checks

Before deploying to master:

```bash
# Run full verification locally
npm run verify

# Run smoke tests
npm run e2e -- --grep @smoke

# Check D1 migrations locally
npm run db:migrate
```

### 2. Post-Deployment Checks

After CI/CD deployment completes:

```bash
# Wait 30-60 seconds for propagation
sleep 30

# Run verification script
./scripts/deploy-verify

# Check Cloudflare Dashboard
# → Workers → safetywallet → Analytics

# Check for errors
npx wrangler tail --format pretty
```

### 3. Monitor for Issues

First 30 minutes after deployment:

```bash
# Stream logs and watch for errors
npx wrangler tail --format=json | jq '.exceptions'

# Check monitoring dashboard
# → https://safetywallet.jclee.me/admin/dashboard

# Verify error rates
# → Admin → Monitoring → Summary
```

## Troubleshooting Failed Deployments

### Scenario 1: Health Check Fails

**Symptoms**:

- `deploy-verify` reports unhealthy
- `/api/health` returns 500 or timeout

**Debug**:

```bash
# Check logs
npx wrangler tail --format pretty

# Check specific binding
curl https://safetywallet.jclee.me/api/admin/monitoring/health

# Verify D1 migrations
npx wrangler d1 migrations list safetywallet-db --remote
```

**Resolution**:

Follow rollback procedures in [`docs/cloudflare-operations.md`](./cloudflare-operations.md).

### Scenario 2: D1 Migration Failed

**Symptoms**:

- `d1-migrate` job failed in CI
- Database schema mismatch errors

**Debug**:

```bash
# Check migration status
cd apps/api
npx wrangler d1 migrations list safetywallet-db --remote

# View migration files
ls -la migrations/
```

**Resolution**:

```bash
# Dry-run first
npx wrangler d1 migrations apply safetywallet-db --remote --dry-run

# Apply with verbose output
npx wrangler d1 migrations apply safetywallet-db --remote

# If needed, create new migration
npx wrangler d1 migrations create safetywallet-db "fix_schema"
```

### Scenario 3: Static Assets Not Loading

**Symptoms**:

- Worker app shows blank page
- Admin app returns 404

**Debug**:

```bash
# Check static asset serving
curl -I https://safetywallet.jclee.me/
curl -I https://admin.safetywallet.jclee.me/

# Verify ASSETS binding in wrangler.toml
grep -A5 "\[assets\]" wrangler.toml
```

**Resolution**:

```bash
# Rebuild static assets
npm run build

# Verify dist/ folder exists
ls -la dist/

# Re-deploy will happen automatically on next master push
```

## Monitoring & Alerting

### Cloudflare Analytics

Check these metrics after deployment:

| Metric     | Healthy Threshold | Check Location                 |
| ---------- | ----------------- | ------------------------------ |
| Error Rate | < 1%              | Cloudflare Dashboard → Workers |
| CPU Time   | < 50ms avg        | Cloudflare Dashboard → Workers |
| Requests   | Normal pattern    | Cloudflare Dashboard → Workers |
| D1 Latency | < 100ms           | Cloudflare Dashboard → D1      |

### Admin Monitoring Endpoints

Use these for detailed monitoring:

```bash
# Summary (last hour)
curl -H "Authorization: Bearer $TOKEN" \
  "https://safetywallet.jclee.me/api/admin/monitoring/summary?minutes=60"

# Top errors
curl -H "Authorization: Bearer $TOKEN" \
  "https://safetywallet.jclee.me/api/admin/monitoring/top-errors?limit=10"

# Detailed metrics
curl -H "Authorization: Bearer $TOKEN" \
  "https://safetywallet.jclee.me/api/admin/monitoring/metrics?from=2026-03-28T10:00&to=2026-03-28T12:00"
```

### Slack Notifications

CI/CD sends notifications to Slack on completion:

- ✅ Pipeline passed
- ❌ Pipeline failed

Configure with `SLACK_WEBHOOK_URL` environment variable.

## Best Practices

### 1. Always Verify After Deploy

Never skip verification:

```bash
./scripts/deploy-verify || exit 1
```

### 2. Monitor First 30 Minutes

Watch for:

- Error rate spikes
- Latency increases
- Failed requests

### 3. Use Gradual Rollouts (via Git)

For major changes, use feature flags or branch-based deployments:

```bash
# Option 1: Feature flags in code
# Deploy to master with new code behind a flag
# Enable flag gradually via admin dashboard

# Option 2: Staging branch
# Push to staging branch first
# Verify on staging environment
# Merge to master for production
```

### 4. Keep Verification Script Updated

When adding new critical endpoints:

- Update `scripts/deploy-verify`
- Add new smoke tests
- Document in this guide

### 5. Version Your Deployments

Use version tags for tracking:

```bash
# Tag release
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3

# Deploy happens automatically via CI
```

## CI/CD Integration

### GitHub Actions Pipeline

The `.github/workflows/ci.yml` includes these verification jobs:

```yaml
jobs:
  ci: # lint, typecheck
  guards: # config guards
  code-quality: # naming, anti-patterns
  unit-test: # vitest
  security: # npm audit
  sast: # gitleaks secret scan
  d1-dryrun: # D1 migration dry-run (PR only)
  build: # matrix build (worker, admin, api)
  e2e-smoke: # playwright smoke tests
  d1-migrate: # D1 migrate (master push)
  validate: # aggregate status
  notify: # slack notification
```

### Required Environment Variables

| Variable                | Purpose       | Required For            |
| ----------------------- | ------------- | ----------------------- |
| `CLOUDFLARE_API_TOKEN`  | API access    | D1 migrations, rollback |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID    | D1 migrations           |
| `SLACK_WEBHOOK_URL`     | Notifications | Slack alerts            |

## References

- [Cloudflare Workers Deployment](https://developers.cloudflare.com/workers/ci-cd/)
- [Cloudflare Rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)
- [D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [SafetyWallet Operations Runbook](cloudflare-operations.md)
