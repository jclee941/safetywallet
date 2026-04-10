# CI/CD Automation Debugging Guide

Debugging GitHub Actions CI/CD pipelines for SafetyWallet.

## Pipeline Overview

The `.github/workflows/ci.yml` workflow runs these jobs on push to `master` and on pull requests:

```
┌────┐   ┌────────┐   ┌────────────┐   ┌───────┐   ┌───────┐   ┌─────┐   ┌─────────┐   ┌──────────┐
│ ci │ → │ guards │ → │ code-quality│ → │ tests │ → │ build │ → │ e2e │ → │ d1-migrate│ → │ validate │
└────┘   └────────┘   └────────────┘   └───────┘   └───────┘   └─────┘   └─────────┘   └──────────┘
  │ lint       │ legacy name  │ anti-patterns   │ unit-test   │ worker    │ smoke    │ remote   │ aggregate
  │ typecheck  │ wrangler sync│ naming          │ security    │ admin     │          │ migrate  │ + notify
                                                │ sast        │ api       │          │          │
                                                │ d1-dryrun   │           │          │          │
```

Deployment is handled separately by **Cloudflare Git Integration** — Cloudflare auto-deploys on every push to `master` without needing a `wrangler deploy` step in CI.

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

### GitHub Actions Local Runner

Use [`act`](https://github.com/nektos/act) to run GitHub Actions workflows locally:

```bash
# Install act (macOS: brew install act, Linux: see act README)
brew install act   # macOS
# or curl -fsSL https://raw.githubusercontent.com/nektos/act/master/install.sh | bash

# Run the entire CI workflow
act push

# Run a specific job
act -j unit-test
act -j build

# Use a smaller runner image (recommended)
act -j ci --container-architecture linux/amd64 -P ubuntu-latest=catthehacker/ubuntu:act-latest
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

Jobs: `ci` (lint + typecheck), `guards`, `code-quality`

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

Jobs: `build` (matrix over worker, admin, api)

```bash
# Full build
npm run build

# Static export aggregation
npm run build:static

# Build a single matrix target
npm run build --workspace=apps/worker
```

### E2E Stage

Jobs: `e2e-smoke`

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

| Variable                | Purpose                  | Local Equivalent             |
| ----------------------- | ------------------------ | ---------------------------- |
| `CI`                    | Indicates CI environment | N/A (set automatically)      |
| `GITHUB_EVENT_NAME`     | Trigger type             | `push`, `pull_request`       |
| `GITHUB_REF_NAME`       | Branch name              | `git branch --show-current`  |
| `GITHUB_SHA`            | Commit SHA               | `git rev-parse HEAD`         |
| `NODE_VERSION`          | Node version             | Pinned in workflow (20)      |
| `CLOUDFLARE_API_TOKEN`  | CF deploys / d1-migrate  | `op read "op://.../token"`   |
| `CLOUDFLARE_ACCOUNT_ID` | CF account               | `op read "op://.../account"` |
| `SLACK_WEBHOOK_URL`     | Notify job               | Optional; notify is skipped  |

Secrets are configured in **Repo Settings → Secrets and variables → Actions**.

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

GitHub Actions caches:

- `actions/cache@<sha>` stores `.turbo` keyed on `hashFiles('**/package-lock.json')`
- `actions/setup-node@<sha>` with `cache: "npm"` caches `~/.npm`

Invalidate by bumping `package-lock.json` or changing the cache key suffix.

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
# Via GitHub CLI
gh run list --workflow=ci.yml --limit 5
gh run view <run-id>
gh run download <run-id>

# Via GitHub UI
# Repo → Actions → Workflow run → Artifacts section
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

The `sast` job uses `gitleaks/gitleaks-action` pinned to a SHA.

```bash
# Run gitleaks locally
docker run --rm -v $(pwd):/code zricethezav/gitleaks:latest detect --verbose --source /code

# Or install locally
brew install gitleaks
gitleaks detect --verbose
```

## Debugging Pipeline Triggers

### Rules Evaluation

CI jobs run on:

- `push` to `master`
- `pull_request` targeting `master`

Some jobs have additional `if:` conditions:

- `d1-dryrun`: `if: github.event_name == 'pull_request'`
- `d1-migrate`: `if: github.event_name == 'push' && github.ref == 'refs/heads/master'`

Simulate locally:

```bash
# Check current branch
git branch --show-current

# Simulate PR pipeline with act
act pull_request

# Simulate push to master
act push --eventpath <(printf '{"ref":"refs/heads/master"}')
```

## Pipeline Logs

### Access Logs

1. GitHub UI: Repo → Actions → Workflow run → Job → Step logs
2. GitHub CLI: `gh run view <run-id> --log` or `gh run view <run-id> --log-failed`
3. Download raw logs: `gh run download <run-id>` or from the UI "Download log archive"
4. Search for `::error::`, `::warning::`, or `FAIL`

### Common Log Patterns

| Pattern                   | Meaning               | Action                           |
| ------------------------- | --------------------- | -------------------------------- |
| `::error::`               | GitHub Actions error  | Check previous lines for context |
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

- Check `needs:` dependencies in `.github/workflows/ci.yml`
- Check `matrix.fail-fast` setting on the `build` job
- Use `concurrency.cancel-in-progress` to avoid duplicate runs on rapid pushes

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
   - `gh run list --workflow=ci.yml --limit 5`
   - `gh run view <run-id> --log-failed`

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
   git push -u origin fix/ci-issue
   gh pr create
   ```

5. **Verify fix:**
   - Create PR
   - Wait for CI to pass
   - Squash merge to master

### Rollback Pipeline

If deployment failed, see `docs/cloudflare-operations.md` for rollback procedures. Cloudflare Git Integration allows rolling back to previous deployments directly from the Cloudflare Dashboard.

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [act — Run GitHub Actions Locally](https://github.com/nektos/act)
- [SafetyWallet Operations Runbook](cloudflare-operations.md)
