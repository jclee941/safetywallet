# PROJECT KNOWLEDGE BASE

**Stack:** TypeScript · Hono · Drizzle · Next.js 15 · Cloudflare Workers · D1
**Generated:** 2026-04-04 via init-deep
**Status:** Active - 48 AGENTS.md files across codebase

## OVERVIEW

Field workers use a mobile PWA to report hazards, log attendance, and earn safety points. Site admins manage reviews, settlements, and compliance via a dashboard. A single Cloudflare Worker serves the Hono API and two statically-exported Next.js frontends via hostname routing.

## STRUCTURE

```text
.
├── apps/
│   ├── api/                 # Cloudflare Worker API (Hono + Drizzle + D1)
│   │   ├── src/routes/      # 18 API route modules (admin/ nested)
│   │   ├── src/lib/         # Auth, helpers, FAS integration, R2
│   │   ├── src/middleware/   # CORS, logging, analytics, security headers
│   │   ├── src/db/          # Drizzle schema (34 tables), seed, helpers
│   │   ├── src/durable-objects/ # RateLimiter, JobScheduler DOs
│   │   ├── src/jobs/        # 10 scheduled cron jobs
│   │   ├── src/validators/  # Zod request schemas
│   │   └── migrations/      # 31 D1 SQL migrations
│   ├── admin/               # Next.js 15 admin dashboard (port 3001, static export)
│   │   └── src/app/         # App Router: attendance, posts, votes, education
│   └── worker/              # Next.js 15 worker PWA (port 3000, static export)
│       ├── src/app/         # App Router: login, posts, attendance, education
│       ├── src/i18n/        # Custom i18n runtime (ko, en, vi, zh)
│       └── src/components/  # Worker-specific UI components
├── packages/
│   ├── types/               # Shared TS types, enums, DTOs, i18n translation data
│   └── ui/                  # Shared shadcn/ui components + Tailwind v4 theme tokens
├── docs/                    # PRD, requirements specs, ops runbooks
├── scripts/                 # Go/JS tooling (verify, naming lint, anti-pattern checks)
├── e2e/                     # Playwright E2E tests (auth setup, admin, worker flows)
├── .gitlab-ci.yml           # CI/CD: GitLab pipeline (lint → typecheck → guards → test → build → migrate)
├── wrangler.toml            # Root CF Worker config + all bindings
├── turbo.json               # Turborepo pipeline (types → ui → apps)
└── playwright.config.ts     # 6 Playwright projects
```

## AUTHENTICATION & AUTHORIZATION

- **Auth flow**: Login → JWT issued with KST same-day midnight expiry → stored in client Zustand.
- **Triple-layer validation**: JWT decode → KST date check → KV cache lookup → D1 fallback.
- **Three-tier permissions**: Role-based (`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`) → site-specific membership → field-level flags (`canAwardPoints`, `canReview`, `canExportData`).
- **Client auth**: Zustand persisted store + 401 refresh mutex. Worker key: `safetywallet-auth`, admin key: `safetywallet-admin-auth`.

## CLOUDFLARE BINDINGS

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

## DATABASE SCHEMA

34 tables in 5 domains defined in `apps/api/src/db/schema.ts`:

- **Identity** (7): users, sites, siteMemberships, sessions, userProfiles, userDevices, userNotificationPreferences.
- **Safety** (8): posts, postImages, actions, reviews, disputes, approvals, recommendations, announcements.
- **Points/Votes** (6): pointTransactions, pointPolicies, pointSettlements, votes, voteCandidates, voteRecords.
- **Attendance** (4): attendanceRecords, attendanceSyncErrors, fasEmployeeCache, attendanceSettings.
- **Education** (8): educationContents, educationQuizzes, educationQuizQuestions, educationQuizAttempts, educationQuizAnswers, educationAssignments, educationProgress, educationCategories.

## DATA FLOW

- **Client → API**: Both apps call `/api/*` endpoints via `apiFetch` wrapper with auth headers, retry, and 401 refresh.
- **Worker offline**: IndexedDB queue (`safetywallet_offline_queue`) syncs on reconnect.
- **API → D1**: Drizzle ORM queries via `DB` binding.
- **API → FAS**: Hyperdrive connection for external employee sync (`/api/fas/*` routes).
- **API → R2**: Image/video upload with Workers AI face blur + perceptual hash dedup. Served via `GET /r2/*` route.
- **API → KV**: Auth session cache, system status flags (`fas_down`, `maintenance`).
- **API → Queue**: Notification delivery via `NOTIFICATION_QUEUE` with DLQ fallback.
- **Observability**: Analytics Engine for request metrics. Issue tracking integration on unhandled errors.

## WHERE TO LOOK

| Task                  | Location                        | Notes                                                |
| --------------------- | ------------------------------- | ---------------------------------------------------- |
| API routes            | `apps/api/src/routes/`          | 18 modules, admin routes nested in `admin/`          |
| Database schema       | `apps/api/src/db/schema.ts`     | 34 D1 tables across 5 domains                        |
| D1 migrations         | `apps/api/migrations/`          | Sequential SQL files, applied in CI                  |
| Auth logic            | `apps/api/src/lib/auth.ts`      | JWT + KST day check + KV cache + D1 fallback         |
| Middleware chain      | `apps/api/src/middleware/`      | CORS → logging → analytics → security headers        |
| Scheduled jobs        | `apps/api/src/jobs/`            | 10 cron jobs (cleanup, sync, notifications)          |
| Durable Objects       | `apps/api/src/durable-objects/` | RateLimiter, JobScheduler                            |
| Admin dashboard pages | `apps/admin/src/app/`           | attendance, posts, votes, education modules          |
| Worker PWA pages      | `apps/worker/src/app/`          | login, posts, attendance, education, offline-capable |
| i18n translations     | `packages/types/src/i18n/`      | Translation data; runtime in `apps/worker/src/i18n/` |
| Shared types/DTOs     | `packages/types/src/`           | Enums, DTOs, Zod schemas shared across apps          |
| Shared UI components  | `packages/ui/src/components/`   | shadcn/ui base + Tailwind v4 theme tokens            |
| CF Worker bindings    | `wrangler.toml`                 | D1, R2, KV, Queue, DO, AI, Analytics, Hyperdrive     |
| CI pipeline           | `.gitlab-ci.yml`                | lint → typecheck → guards → test → build → migrate   |
| E2E tests             | `e2e/`                          | Playwright: auth, admin, worker flows                |
| Scripts               | `scripts/`                      | Go/JS tooling (verify, lint, deploy, test)           |
| Requirements specs    | `docs/requirements/`            | Feature specs, ELK prefix, etc.                      |

## CONVENTIONS

- **Monorepo**: npm workspaces + Turborepo. Build order: `types` → `ui` → `api` + `admin` + `worker`.
- **Hosting**: Single CF Worker. Hostname routing: `safetywallet.jclee.me/api/*` → Hono, `safetywallet.jclee.me/*` → worker PWA, `admin.safetywallet.jclee.me/*` → admin SPA.
- **Auth**: JWT with KST same-day midnight expiry. Triple-layer validation. Three-tier role permissions (`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`).
- **Database**: Drizzle ORM + D1 (SQLite). 34 tables in 5 domains: Identity, Safety, Points/Votes, Attendance, Education.
- **State management**: Zustand (persisted stores) + TanStack Query in both frontends.
- **i18n**: Worker-only, custom runtime (not next-intl). 4 locales: ko (default), en, vi, zh. Keys: `section.camelCaseKey`.
- **Deploy**: Git-ref driven only via Cloudflare Git Integration. Manual deploy scripts exit non-zero.
- **D1 migrations**: Applied on master push in CI (`d1-migrate` step). Generated via `npm run db:generate`.
- **Testing**: Vitest + Testing Library + happy-dom (unit). Playwright (E2E, credentials via 1Password `op run`).
- **Commits**: Conventional commits (`type(scope): summary`). Squash merge only. ~200 LOC per PR.
- **Imports**: ES modules, workspace refs via `@safetywallet/types` and `@safetywallet/ui`.
- **Git hooks**: Husky pre-commit → lint-staged → `check-anti-patterns.go` + prettier.

## ANTI-PATTERNS

- Never suppress type errors: no `as any`, `@ts-ignore`, `@ts-expect-error`, no empty `catch {}`.
- Never run manual deploys — deploy is CI-only (`deploy:api` script exits non-zero).
- Never hardcode IPs, secrets, or credentials — use env vars or `wrangler.toml` vars.
- Never use mutable action tags — always pin versions with explicit references.
- Never use merge commits — squash merge only.
- Never create long-lived feature branches — trunk-based development.
- Never hardcode UI strings — use i18n keys from `packages/types/src/i18n/`.

## COMMANDS

```bash
npm run build              # Turborepo parallel build + static export aggregation
npm run dev                # Turborepo parallel dev servers
npm run typecheck          # Workspace-wide TypeScript check
npm test                   # Vitest across all workspaces
npm run e2e                # Playwright E2E (requires 1Password op run)
npm run verify             # 7-step pipeline: typecheck → eslint → vitest → anti-pattern → naming → wrangler-sync → build
npm run lint:naming        # Validate package/file naming conventions
npm run format             # Prettier across all workspaces
npm run db:generate        # Generate Drizzle migration from schema changes
npm run git:preflight      # Pre-push verification (Go script)
```

## Review guidelines

- Verify auth changes maintain triple-layer validation and KST expiry logic.
- Verify D1 schema changes have corresponding migration files.
- For CI/CD changes: verify pinned versions, correct permissions scoping.

## NOTES

- `ARCHITECTURE.md` contains the same architecture details as above — kept in sync as secondary reference.
- `CODE_STYLE.md` contains naming conventions, import patterns, and testing standards.
- FAS integration env vars (`FAS_DB_NAME`, `FAS_SITE_CD`, `FAS_SITE_NAME`) are in `wrangler.toml` vars.
