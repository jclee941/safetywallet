# CI/CD Automation Debugging Guide

Debugging GitLab CI/CD pipelines for SafetyWallet.

## Pipeline Overview

```
┌─────────┐   ┌──────────┐   ┌───────┐   ┌───────┐   ┌─────┐   ┌────────┐
│ prepare │ → │ validate │ → │  test │ → │ build │ → │ e2e │ → │ deploy │
└─────────┘   └──────────┘   └───────┘   └───────┘   └─────┘   └────────┘
                │ lint       │ unit-test   │ apps      │       │
                │ typecheck  │ security    │ packages  │       │
                │ guards     │ sast        │           │       │
                │ code-quality│ d1-dryrun  │           │       │
```

## Quick Debugging Commands

### Local Pipeline Simulation

```bash
# Run the full validation suite locally (matches CI validate stage)
npm run lint
npm run typecheck
npm run verify

# Run tests (matches CI test stage)
npm test

# Run build (matches CI build stage)
npm run build
```

### GitLab CI Local Runner

```bash
# Install GitLab Runner locally
sudo curl -L --output /usr/local/bin/gitlab-runner https://gitlab-runner-downloads.s3.amazonaws.com/latest/binaries/gitlab-runner-linux-amd64
sudo chmod +x /usr/local/bin/gitlab-runner

# Run a specific job locally (requires GitLab credentials)
gitlab-runner exec docker unit-test
```

## Common CI/CD Failures

### 1. Lint Failures

**Error:**

```
ERROR: Linting failed
src/components/button.tsx:15:3 - error ESLint: 'React' is defined but never used.
```

**Debug locally:**

```bash
# Run linter with auto-fix
npm run lint -- --fix

# Or manually check specific files
npx eslint apps/admin/src/components/button.tsx
```

### 2. TypeCheck Failures

**Error:**

```
error TS2322: Type 'string' is not assignable to type 'number'.
```

**Debug locally:**

```bash
# Run typecheck
npm run typecheck

# Check specific workspace
npm run typecheck --workspace=apps/admin
```

### 3. Guard Failures (Naming/Patterns)

**Error:**

```
ERROR: Legacy runtime naming detected.
```

**Debug locally:**

```bash
# Run the same guard checks as CI
go run scripts/check-anti-patterns.go
npm run lint:naming
node scripts/check-wrangler-sync.js
```

### 4. Test Failures

**Error:**

```
FAIL src/components/__tests__/button.test.tsx
  Button component
    × renders correctly (50ms)
```

**Debug locally:**

```bash
# Run all tests
npm test

# Run tests for specific workspace
npm test --workspace=apps/admin

# Run with coverage
npm run test:coverage

# Debug specific test file
npx vitest run apps/admin/src/components/__tests__/button.test.tsx
```

### 5. Build Failures

**Error:**

```
Failed to compile.
Module not found: Can't resolve '@/components/ui'
```

**Debug locally:**

```bash
# Run full build
npm run build

# Build specific app
npm run build --workspace=apps/admin

# Clean and rebuild
npm run clean && npm run build
```

### 6. Wrangler Sync Failures

**Error:**

```
ERROR: wrangler.toml configs are out of sync
```

**Debug locally:**

```bash
# Check wrangler sync
node scripts/check-wrangler-sync.js

# Compare root and app configs
diff wrangler.toml apps/api/wrangler.toml
```

## Pipeline Stage Debugging

### Validate Stage

Jobs: `lint`, `typecheck`, `guards`, `code-quality`

```bash
# Run entire validate stage locally
npm run lint && npm run typecheck && npm run verify
```

### Test Stage

Jobs: `unit-test`, `security`, `sast`, `d1-dryrun`

```bash
# Run tests
npm test

# Security audit
npm audit --audit-level=critical

# D1 dry run (requires wrangler auth)
cd apps/api && wrangler d1 migrations apply safetywallet-db --local --dry-run
```

### Build Stage

Jobs: `build`

```bash
# Full build
npm run build

# Static export aggregation
npm run build:static
```

### E2E Stage

Jobs: `e2e-test`

```bash
# Requires 1Password credentials
op run --env-file=.env.e2e -- npx playwright test

# Run specific test
op run --env-file=.env.e2e -- npx playwright test auth.spec.ts

# Run in headed mode for debugging
op run --env-file=.env.e2e -- npx playwright test --headed
```

## Environment Variables

CI/CD uses these environment variables:

| Variable             | Purpose                  | Local Equivalent            |
| -------------------- | ------------------------ | --------------------------- |
| `CI`                 | Indicates CI environment | N/A (set automatically)     |
| `CI_PIPELINE_SOURCE` | Trigger type             | N/A                         |
| `CI_COMMIT_BRANCH`   | Branch name              | `git branch --show-current` |
| `NPM_CONFIG_CACHE`   | npm cache dir            | `~/.npm`                    |
| `TURBO_CACHE_DIR`    | Turbo cache dir          | `node_modules/.cache/turbo` |

## Caching Issues

### Problem: Cache not hitting

**Symptoms:**

- Builds take longer than expected
- "cache miss" in logs

**Debug:**

```bash
# Clear local caches
rm -rf node_modules/.cache
rm -rf .turbo
npm run clean

# Reinstall and rebuild
npm ci
npm run build
```

### Problem: Stale cache

**Symptoms:**

- Old dependencies being used
- Type errors after package updates

**Debug:**

```bash
# Clear all caches
rm -rf node_modules
rm -rf .turbo
rm -rf .npm
npm cache clean --force

# Fresh install
npm ci
```

## Artifact Debugging

### Download CI Artifacts

```bash
# Via GitLab UI
# Project → CI/CD → Pipelines → Select pipeline → Jobs → Download artifacts

# Via GitLab CLI
gl pipeline get --project-id=<id> --id=<pipeline-id>
gl job artifact download --project-id=<id> --job-id=<job-id>
```

### Examine Test Reports

JUnit reports are generated in:

- `junit-*.xml` (root)
- `apps/*/junit.xml`
- `packages/*/junit.xml`

View with:

```bash
# Convert to readable format
cat junit-admin.xml | xq
```

## Troubleshooting Specific Jobs

### D1 Dry Run

```bash
# Requires Cloudflare authentication
cd apps/api

# Check auth status
wrangler whoami

# Run migrations locally
wrangler d1 migrations apply safetywallet-db --local

# Dry run (simulates without applying)
wrangler d1 migrations apply safetywallet-db --local --dry-run
```

### SAST (Secret Detection)

```bash
# Run gitleaks locally
docker run --rm -v $(pwd):/code zricethezav/gitleaks:latest detect --verbose --source /code

# Or install locally
brew install gitleaks
gitleaks detect --verbose
```

## Debugging Pipeline Triggers

### Rules Evaluation

CI jobs have rules based on:

- `CI_PIPELINE_SOURCE == "merge_request_event"`
- `CI_COMMIT_BRANCH == "master"`

Simulate locally:

```bash
# Check current branch
git branch --show-current

# Simulate MR pipeline
CI_PIPELINE_SOURCE=merge_request_event CI_COMMIT_BRANCH=$(git branch --show-current) gitlab-runner exec docker lint
```

## Pipeline Logs

### Access Logs

1. GitLab UI: Project → CI/CD → Pipelines → Job → Job logs
2. Download raw logs for analysis
3. Search for "ERROR" or "FAIL"

### Common Log Patterns

| Pattern                   | Meaning               | Action                           |
| ------------------------- | --------------------- | -------------------------------- |
| `ERROR:`                  | Fatal error           | Check previous lines for context |
| `FAIL`                    | Test failure          | Run test locally                 |
| `cache miss`              | Cache not used        | Check cache key configuration    |
| `found 0 vulnerabilities` | Security scan passed  | Normal                           |
| `found X vulnerabilities` | Security issues found | Run `npm audit` locally          |

## CI/CD Performance Debugging

### Slow Pipeline Diagnosis

```bash
# Time each script locally
time npm run lint
time npm run typecheck
time npm test
time npm run build

# Check Turbo cache hit rate
TURBO_DEBUG=1 npm run build
```

### Parallel Job Issues

If jobs are failing due to resource contention:

- Check `parallel:` settings in `.gitlab-ci.yml`
- Review job dependencies (`needs:`)
- Adjust resource limits

## Pre-Commit Validation

Run the same checks as CI before committing:

```bash
# Install pre-commit hook
npm run prepare

# Or run manually
go run scripts/git-preflight.go
```

## Emergency Procedures

### Pipeline is Broken on Master

1. **Check recent commits:**

   ```bash
   git log --oneline -10
   ```

2. **Identify failing job:**
   - Check GitLab pipeline status
   - Read job logs

3. **Reproduce locally:**

   ```bash
   # Checkout the failing commit
   git checkout <commit-hash>
   npm ci
   npm run verify  # Runs full validation
   ```

4. **Fix and push:**

   ```bash
   git checkout -b fix/ci-issue
   # Make fixes
   git commit -m "fix: resolve CI failure"
   git push
   ```

5. **Verify fix:**
   - Create MR
   - Wait for CI to pass
   - Merge to master

### Rollback Pipeline

If deployment failed:

```bash
# Rollback to previous version
# See docs/cloudflare-operations.md for rollback procedures
```

## Resources

- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [GitLab Runner Documentation](https://docs.gitlab.com/runner/)
- [SafetyWallet Operations Runbook](cloudflare-operations.md)
