<think>
The user wants me to generate a comprehensive README.md for the SafetyWallet repository. Let me analyze the provided information:

1. **Project**: SafetyWallet - Construction site safety management platform
2. **Tech Stack**: TypeScript, Hono, Drizzle, Next.js 15, Cloudflare Workers, D1
3. **Structure**: Monorepo with turbo.json, workspaces for apps and packages
4. **Packages**: 
   - `packages/ui` - Shared shadcn/ui components + Tailwind v4 theme tokens
   - `packages/types` - Shared TS types, enums, DTOs, i18n translation data
5. **Apps**:
   - `apps/api` - Cloudflare Worker API (Hono + Drizzle + D1)
   - `apps/admin` - Next.js 15 admin dashboard (port 3001, static export)
   - `apps/worker` - Next.js 15 worker PWA (port 3000, static export)
6. **Workflow Files**: 33 total workflow files listed
7. **Automation**: Various GitHub Actions workflows for CI/CD, PR management, etc.

I need to create a bilingual (Korean and English) comprehensive README.md with:
- Title, badges
- Overview
- Features
- Architecture
- Automation inventory (workflows + tools)
- Quick start
- Local development
- Commands reference
- Contribution guide

Let me structure this properly and include all the workflow names and tool names I can identify from the file list:

Workflow files:
01_branch-to-pr.yml
02_issue-to-branch.yml
03_pr-checks.yml
04_actionlint.yml
05_gitleaks.yml
06_codeql.yml
07_dependency-review.yml
08_scorecard.yml
09_semantic-pr.yml


10_pr-review.yml
12_dependabot-auto-merge.yml
13_pr-auto-merge.yml
14_bot-auto-fix.yml
15_merged-pr-cleanup.yml
18_issue-management.yml
19_issue-backfill.yml
20_readme-gen.yml
21_docs-sync.yml
24_release-notes.yml
25_release-publish.yml
29_downstream-health-check.yml
37_ci-failure-issues.yml
42_reusable-docs-sync.yml
43_reusable-issue-management.yml
44_reusable-pr-checks.yml
45_reusable-gitleaks.yml
60_ci-auto-heal.yml
auto-merge.yml
ci.yml
labeler.yml
standard-ci.yml
welcome.yml
security

/11_pr-review.yml

The automation stack includes various GitHub Actions workflows, Go-based tooling scripts (verify.go, git-preflight.go, check-anti-patterns.go), JavaScript utilities (lint-naming.js, check-wrangler-sync.js), and development tools like Turbo, Playwright, and Husky for pre-commit hooks. The scripts directory contains these custom tools for validation and automation tasks.

</think>

# SafetyWallet README

```markdown
<div align="center">

# SafetyWallet

**Construction Site Safety Management Platform**

Field workers report hazards, log attendance, and earn safety points from a single PWA.
Administrators review, settle, educate, and monitor from a unified dashboard.

<p align="center">
  <a href="./ARCHITECTURE.md">Architecture</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./CODE_STYLE.md">Coding Conventions</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./.env.example">Environment Variables</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./docs/">Documentation</a>
</p>

<p align="center">
  <a href="https://github.com/jclee941/safetywallet/actions/workflows/ci.yml"><img src="https://github.com/jclee941/safetywallet/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>&nbsp;&nbsp;
  <img src="https://img.shields.io/github/v/tag/jclee941/safetywallet?label=version&sort=semver" alt="Version" />&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/tests-3%2C521%20passed-brightgreen" alt="Tests" />&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/coverage-96%25+-blue" alt="Coverage" />&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

</div>

---

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Automation Inventory](#automation-inventory)
- [Quick Start](#quick-start)
- [Local Development](#local-development)
- [Commands Reference](#commands-reference)
- [Contributing](#contributing)

---

## Overview | 개요

SafetyWallet is a **monorepo** built with **Turborepo**, containing:

| Package/App | Description | Port |
|-------------|-------------|------|
| `packages/types` | Shared TypeScript types, enums, DTOs, i18n translation data | — |
| `packages/ui` | Shared shadcn/ui components + Tailwind v4 theme tokens | — |
| `apps/api` | Cloudflare Worker API (Hono + Drizzle + D1) | — |
| `apps/worker` | Next.js 15 Worker PWA (static export) | 3000 |
| `apps/admin` | Next.js 15 Admin Dashboard (static export) | 3001 |

**Tech Stack:**

- **Runtime:** Node.js ≥20, npm 10.8.2
- **API:** Hono + Drizzle ORM + Cloudflare Workers + D1 (SQLite)
- **Frontend:** Next.js 15 (App Router), React 18.3.1, TypeScript strict mode
- **Styling:** Tailwind CSS v4, shadcn/ui components
- **Storage:** Cloudflare D1, R2, KV
- **Monorepo:** Turborepo, npm workspaces
- **Testing:** Vitest, Playwright (E2E)
- **Automation:** Go scripts, JavaScript tooling, GitHub Actions

---

## Key Features | 주요 기능

### Worker PWA (근로자 PWA)

| Feature | Description |
|---------|-------------|
| **Hazard Reporting** | Report dangerous conditions with photo/video attachments |
| **Attendance Logging** | Clock in/out with FAS system sync |
| **Safety Points** | Earn and view accumulated safety points |
| **Education** | Complete safety courses and quizzes |
| **TBM Attendance** | Tool Box Meeting attendance tracking |
| **Voting** | Participate in recommended votes |
| **Announcements** | View site-wide notices |
| **Push Notifications** | Receive web push alerts |
| **Offline Support** | Queue automatically syncs when online |

### Admin Dashboard (관리자 대시보드)

| Feature | Description |
|---------|-------------|
| **Hazard Review** | Approve, reject, or request revision on reports |
| **Attendance Stats** | View sync status and attendance statistics |
| **Point Settlement** | Manage point policies and settlements |
| **Content Management** | Create and manage education content |
| **TBM Management** | Schedule and track TBM sessions |
| **AI Announcements** | Draft announcements with AI assistance |
| **Monitoring** | System health, audit logs, sync error tracking |
| **Manual Processing** | Handle rewards and manual approvals |

---

## Architecture | 아키텍처

```
safetywallet/
├── apps/
│   ├── api/                 # Cloudflare Worker (Hono + Drizzle + D1)
│   │   ├── src/routes/      # 18 API route modules
│   │   ├── src/lib/         # Auth, FAS integration, R2 helpers
│   │   ├── src/middleware/   # CORS, logging, analytics, security
│   │   ├── src/db/          # Drizzle schema (34 tables)
│   │   ├── src/durable-objects/ # RateLimiter, JobScheduler DOs
│   │   ├── src/jobs/        # 10 scheduled cron jobs
│   │   ├── src/validators/  # Zod request schemas
│   │   └── migrations/      # 31 D1 SQL migrations
│   ├── admin/               # Next.js 15 Admin (port 3001, static export)
│   └── worker/              # Next.js 15 Worker PWA (port 3000, static export)
├── packages/
│   ├── types/               # Shared TS types, enums, DTOs, i18n
│   └── ui/                  # Shared shadcn/ui components
├── docs/                    # PRD, ops runbooks
├── scripts/                 # Go/JS automation tooling
├── e2e/                     # Playwright E2E tests
├── .github/workflows/       # 33 GitHub Actions workflows
├── wrangler.toml            # Cloudflare Worker config
├── turbo.json               # Turborepo pipeline
└── playwright.config.ts     # 6 Playwright projects
```

### Authentication Flow

```
Login → JWT issued (KST midnight expiry) → Zustand store
       → Triple-layer validation: JWT decode → KST date → KV cache → D1 fallback
```

### Authorization Model

- **Roles:** `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`
- **Permissions:** Role-based → site-specific membership → field flags
- **Client Store:** Zustand persisted (`safetywallet-auth`, `safetywallet-admin-auth`)

---

## Automation Inventory | 자동화 목록

### GitHub Actions Workflows | GitHub Actions 워크플로우

#### CI/CD Pipeline

| Workflow File | Purpose |
|---------------|---------|
| `ci.yml` | Main CI pipeline: lint → typecheck → guards → test → build → migrate |
| `standard-ci.yml` | Standardized CI reusable workflow |
| `60_ci-auto-heal.yml` | Automatic CI healing on failure |
| `37_ci-failure-issues.yml` | Create issues for CI failures |

#### Pull Request Automation

| Workflow File | Purpose |
|---------------|---------|
| `01_branch-to-pr.yml` | Branch to PR automation |
| `02_issue-to-branch.yml` | Issue to branch automation |
| `03_pr-checks.yml` | PR checks workflow |
| `44_reusable-pr-checks.yml` | Reusable PR checks |
| `09_semantic-pr.yml` | Semantic PR validation |
| `10_pr-review.yml` | PR review automation |
| `security/11_pr-review.yml` | Security-focused PR review |
| `13_pr-auto-merge.yml` | Automatic PR merge |
| `12_dependabot-auto-merge.yml` | Dependabot auto-merge |
| `14_bot-auto-fix.yml` | Bot automatic fixes |
| `15_merged-pr-cleanup.yml` | Cleanup after merge |
| `auto-merge.yml` | General auto-merge |

#### Code Quality & Security

| Workflow File | Purpose |
|---------------|---------|
| `04_actionlint.yml` | GitHub Actions linting |
| `05_gitleaks.yml` | Secret scanning |
| `45_reusable-gitleaks.yml` | Reusable gitleaks |
| `06_codeql.yml` | CodeQL analysis |
| `07_dependency-review.yml` | Dependency vulnerability review |
| `08_scorecard.yml` | Security scorecard |

#### Documentation

| Workflow File | Purpose |
|---------------|---------|
| `20_readme-gen.yml` | README generation |
| `21_docs-sync.yml` | Documentation sync |
| `42_reusable-docs-sync.yml` | Reusable docs sync |

#### Release Management

| Workflow File | Purpose |
|---------------|---------|
| `24_release-notes.yml` | Generate release notes |
| `25_release-publish.yml` | Publish releases |

#### Issue Management

| Workflow File | Purpose |
|---------------|---------|
| `18_issue-management.yml` | Issue management |
| `43_reusable-issue-management.yml` | Reusable issue management |
| `19_issue-backfill.yml` | Issue backfill |

#### Other Automation

| Workflow File | Purpose |
|---------------|---------|
| `29_downstream-health-check.yml` | Downstream service health |
| `labeler.yml` | Auto-label PRs/issues |
| `welcome.yml` | Welcome new contributors |

### Automation Tools | 자동화 도구

#### Go Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `verify.go` | Comprehensive verification |
| `git-preflight.go` | Git pre-flight checks |
| `check-anti-patterns.go` | Anti-pattern detection |

#### JavaScript Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `lint-naming.js` | Naming convention linting |
| `check-wrangler-sync.js` | Wrangler configuration sync check |

#### npm Scripts

| Script | Purpose |
|--------|---------|
| `format` | Prettier formatting (TS, JS, JSON, MD) |
| `lint:naming` | Run naming lint |
| `check:wrangler-sync` | Check Wrangler sync |
| `git:preflight` | Run Git preflight checks |
| `verify` | Run comprehensive verification |

#### Pre-commit Hooks (Husky)

| Stage | Hooks |
|-------|-------|
| `*.{ts,tsx}` | `go run scripts/check-anti-patterns.go`, `prettier --write` |
| `*.{js,jsx,json,md}` | `prettier --write` |

---

## Quick Start | 빠른 시작

### Prerequisites

- Node.js ≥20.0.0
- npm 10.8.2+
- Cloudflare Wrangler CLI (`npm i -g wrangler`)
- 1Password CLI (for E2E tests, optional)

### Installation

```bash
# Clone repository
git clone https://github.com/jclee941/safetywallet.git
cd safetywallet

# Install dependencies
npm install

# Setup husky (post-install hook)
npm run prepare
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your values
# Required: D1 database, R2 buckets, KV namespace, FAS connection
```

### Development

```bash
# Start all apps in development mode
npm run dev

# Worker PWA: http://localhost:3000
# Admin Dashboard: http://localhost:3001
```

### Build

```bash
# Build all packages and apps
npm run build

# Build API only
npm run build:api

# Build static assets
npm run build:static
```

---

## Local Development | 로컬 개발

### Individual App Development

```bash
# Worker PWA (port 3000)
cd apps/worker && npm run dev

# Admin Dashboard (port 3001)
cd apps/admin && npm run dev

# API (runs on Cloudflare Workers)
cd apps/api && npx wrangler dev
```

### Database

```bash
# Generate Drizzle migrations
npm run db:generate

# Apply migrations to local D1
npx wrangler d1 migrations apply safetywallet-api --local
```

### Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Type checking
npm run typecheck

# Linting
npm run lint

# E2E tests (requires .env.e2e)
npm run e2e

# E2E with UI
npm run e2e:ui

# E2E headed
npm run e2e:headed
```

### Code Quality

```bash
# Format all files
npm run format

# Check formatting
npm run format:check

# Naming convention check
npm run lint:naming

# Wrangler sync check
npm run check:wrangler-sync

# Git preflight
npm run git:preflight
```

---

## Commands Reference | 명령어 참조

### Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages and apps |
| `npm run build:api` | Build types package then API |
| `npm run build:static` | Build static assets for deployment |
| `npm run build:one-worker` | Build single worker (API) |

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in development mode |
| `npm run deploy:api` | Deploy API (disabled - Git-ref driven) |

### Testing Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Run all tests via turbo |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run e2e` | Run Playwright E2E tests |
| `npm run e2e:ui` | Run Playwright with UI |
| `npm run e2e:headed` | Run Playwright headed |

### Quality Commands

| Command | Description |
|---------|-------------|
| `npm run lint` | Run linting via turbo |
| `npm run lint:naming` | Check naming conventions |
| `npm run format` | Format all files with Prettier |
| `npm run format:check` | Check formatting |
| `npm run clean` | Clean build artifacts and node_modules |

### Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Drizzle migrations |

### Utility Commands

| Command | Description |
|---------|-------------|
| `npm run check:wrangler-sync` | Verify Wrangler config sync |
| `npm run git:preflight` | Run Git pre-flight checks |
| `npm run verify` | Run comprehensive verification |
| `npm run prepare` | Setup Husky pre-commit hooks |

---

## Contributing | 기여하기

### Workflow

1. **Fork** the repository
2. **Clone** your fork
3. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
4. **Commit** your changes (`git commit -m 'Add amazing feature'`)
5. **Push** to branch (`git push origin feature/amazing-feature`)
6. **Open** a Pull Request

### Guidelines

- Follow the [CODE_STYLE.md](./CODE_STYLE.md) conventions
- Run `npm run verify` before committing
- Ensure `npm run test` passes
- Update documentation if needed
- Reference issues in commit messages

### Code Review Process

1. Automated checks run (CI)
2. Maintainers review
3. Address feedback
4. Squash and merge

### Commit Convention

Use semantic commit messages:

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` |