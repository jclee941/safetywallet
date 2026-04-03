## Overview

SafetyWallet is an industrial safety compliance platform. Field workers use a mobile PWA to report hazards, log attendance, and earn safety points. Site admins manage reviews, settlements, and compliance via a dashboard. A single Cloudflare Worker serves the API and both static frontends.

## Tech Stack

- Runtime: Node 20, npm 10 (`.nvmrc`, `package.json`).
- Language: TypeScript strict across all workspaces.
- Monorepo: Turborepo (`turbo.json`) with npm workspaces.
- API: Hono + Drizzle ORM on Cloudflare Workers/D1 (`wrangler.toml`).
- Web: Next.js 15 + React 18 static export for admin and worker apps.
- Testing: Vitest + Testing Library + happy-dom. Playwright for E2E (`playwright.config.ts`).
- CI: GitLab CI/CD (`.gitlab-ci.yml`) — lint → typecheck → guards → test → audit → build → d1-migrate → validate → Slack notify.

## Directory Structure

```
.
├── apps/
│   ├── api/                 # Cloudflare Worker API (Hono + Drizzle + D1)
│   ├── admin/               # Next.js admin dashboard (port 3001, static export)
│   └── worker/              # Next.js worker PWA (port 3000, static export)
├── packages/
│   ├── types/               # Shared TS types, enums, DTOs, i18n data (runtime-free)
│   └── ui/                  # Shared UI components (shadcn/ui + Tailwind v4 theme tokens)
├── docs/                    # PRD, requirements, ops runbooks
├── scripts/                 # Repo tooling (verify, naming lint, anti-pattern checks)
├── e2e/                     # Playwright E2E tests (auth setup, admin, worker)
├── .gitlab-ci.yml           # CI/CD pipeline configuration
├── wrangler.toml            # Root CF Worker config + bindings
├── turbo.json               # Turborepo pipeline
└── vitest.config.ts         # Vitest workspace config
├── playwright.config.ts     # Playwright E2E config (6 projects)
├── .env.e2e                 # 1Password secret references for E2E (op:// URIs)
```

## Hosting Model

A single Cloudflare Worker handles all traffic via hostname-based routing:

- `safetywallet.jclee.me/api/*` → Hono API routes.
- `safetywallet.jclee.me/r2/*` → R2 media files (user-uploaded images and videos).
- `safetywallet.jclee.me/*` → Worker PWA static assets from Workers Static Assets (`ASSETS`).
- `admin.safetywallet.jclee.me/*` → Admin SPA static assets from Workers Static Assets (`ASSETS` at `/admin/*` prefix).
- Static frontends are built with `next export` and aggregated into `dist/` via `build:static`.

## Authentication & Authorization

- **Auth flow**: Login → JWT issued with KST same-day midnight expiry → stored in client Zustand.
- **Triple-layer validation**: JWT decode → KST date check → KV cache lookup → D1 fallback.
- **Three-tier permissions**: Role-based (`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`) → site-specific membership → field-level flags (`canAwardPoints`, `canReview`, `canExportData`).
- **Client auth**: Zustand persisted store + 401 refresh mutex. Worker key: `safetywallet-auth`, admin key: `safetywallet-admin-auth`.

## Cloudflare Bindings

| Binding                                   | Type                  | Purpose                                          |
| ----------------------------------------- | --------------------- | ------------------------------------------------ |
| `DB`                                      | D1                    | Primary database (34 tables, SQLite via Drizzle) |
| `FAS_HYPERDRIVE`                          | Hyperdrive            | External FAS employee database                   |
| `ASSETS`                                  | Workers Static Assets | Static frontend files (worker + admin SPAs)      |
| `R2`                                      | R2                    | User-uploaded images and videos                  |
| `ACETIME_BUCKET`                          | R2                    | Attendance-related assets                        |
| `KV`                                      | KV                    | Auth cache, system status, config                |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | Queue                 | Notification delivery pipeline                   |
| `RATE_LIMITER`                            | Durable Object        | Per-IP/user rate limiting                        |
| `JOB_SCHEDULER`                           | Durable Object        | Scheduled admin tasks                            |
| `AI`                                      | Workers AI            | Inference (face blur, content analysis)          |
| `ANALYTICS`                               | Analytics Engine      | Request analytics and metrics                    |

## Database Schema

34 tables in 5 domains defined in `apps/api/src/db/schema.ts`:

- **Identity** (7): users, sites, siteMemberships, sessions, userProfiles, userDevices, userNotificationPreferences.
- **Safety** (8): posts, postImages, actions, reviews, disputes, approvals, recommendations, announcements.
- **Points/Votes** (6): pointTransactions, pointPolicies, pointSettlements, votes, voteCandidates, voteRecords.
- **Attendance** (4): attendanceRecords, attendanceSyncErrors, fasEmployeeCache, attendanceSettings.
- **Education** (8): educationContents, educationQuizzes, educationQuizQuestions, educationQuizAttempts, educationQuizAnswers, educationAssignments, educationProgress, educationCategories.

## Data Flow

- **Client → API**: Both apps call `/api/*` endpoints via `apiFetch` wrapper with auth headers, retry, and 401 refresh.
- **Worker offline**: IndexedDB queue (`safetywallet_offline_queue`) syncs on reconnect.
- **API → D1**: Drizzle ORM queries via `DB` binding.
- **API → FAS**: Hyperdrive connection for external employee sync (`/api/fas/*` routes).
- **API → R2**: Image/video upload with Workers AI face blur + perceptual hash dedup. Served via `GET /r2/*` route.
- **API → KV**: Auth session cache, system status flags (`fas_down`, `maintenance`).
- **API → Queue**: Notification delivery via `NOTIFICATION_QUEUE` with DLQ fallback.
- **Observability**: Analytics Engine for request metrics. Issue tracking integration on unhandled errors.

## Build & Deploy

- `npm run build` — Turborepo parallel build (types → ui → api + admin + worker).
- `npm run build:static` — Builds Next.js apps + copies static output to `dist/` for R2 upload.
- `npm run typecheck` — Workspace-wide TypeScript check.
- `npm test` — Vitest across all workspaces.
- `npm run e2e` — Playwright E2E tests (credentials via 1Password `op run`).
- `npm run verify` — 7-step pipeline: typecheck → eslint → vitest → anti-pattern → naming → wrangler-sync → build.
- Deploy: Git-ref driven via Cloudflare Git Integration. Manual deploy scripts exit non-zero.
- D1 migrations: Applied on master push in CI (`d1-migrate` step).

## Configuration

- Environment: `.env` (root, gitignored), `.env.example` for reference.
- Cloudflare: `wrangler.toml` (root bindings) + `apps/api/wrangler.toml` (dev overrides).
- Formatting: `.editorconfig` + Prettier via lint-staged.
- Linting: Next.js ESLint in admin/worker, anti-pattern guard in pre-commit hook.
- Git hooks: `.husky/pre-commit` → lint-staged → `check-anti-patterns.go` + prettier.

## Notes

- Root `AGENTS.md` contains safetywallet project knowledge base.
- FAS integration env vars (`FAS_DB_NAME`, `FAS_SITE_CD`, `FAS_SITE_NAME`) are in wrangler.toml vars section.
- i18n is worker-only with custom runtime (not next-intl): ko, en, vi, zh locales.
