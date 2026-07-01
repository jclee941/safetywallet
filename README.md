# SafetyWallet / 안전지갑

> Mobile-first PWA for construction-site safety reporting, attendance, and safety-point incentive management — deployed end-to-end on the Cloudflare edge.
> 건설 현장의 안전 보고 · 출퇴근 · 안전 포인트 인센티브를 관리하는 모바일 우선 PWA. **Cloudflare** 엣지에 전량 배포됩니다.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Hono%20%7C%20Drizzle%20%7C%20Next.js%2015%20%7C%20Cloudflare%20Workers-blue)
![Node](https://img.shields.io/badge/node-%E2%89%A520.0.0-green)
![Package Manager](https://img.shields.io/badge/npm-10.8.2-CB3837)
![Turborepo](https://img.shields.io/badge/turborepo-monorepo-FF1E56)

---

## Table of Contents / 목차

- [Overview / 개요](#overview--개요)
- [Key Features / 주요 기능](#key-features--주요-기능)
- [Architecture / 아키텍처](#architecture--아키텍처)
- [Tech Stack / 기술 스택](#tech-stack--기술-스택)
- [Repository Layout / 저장소 구조](#repository-layout--저장소-구조)
- [Quick Start / 빠른 시작](#quick-start--빠른-시작)
- [Configuration / 설정](#configuration--설정)
- [Commands Reference / 명령어 레퍼런스](#commands-reference--명령어-레퍼런스)
- [Local Development / 로컬 개발](#local-development--로컬-개발)
- [Testing / 테스트](#testing--testing)
- [Android TWA Build / Android TWA 빌드](#android-twa-build--android-twa-빌드)
- [Internationalization / 국제화](#internationalization--국제화)
- [Contribution Guide / 기여 가이드](#contribution-guide--기여-가이드)
- [License / 라이선스](#license--라이선스)

---

## Overview / 개요

**SafetyWallet** is a field-worker safety platform organized as a **Turborepo monorepo** and deployed end-to-end on **Cloudflare**. It targets construction sites where workers need a low-friction, installable mobile experience and site managers need a dashboard to triage safety reports, attendance, and incentive accrual.

**SafetyWallet**은 **Cloudflare** 엣지에 전량 배포되는 **Turborepo 모노레포** 기반 현장 작업자 안전 플랫폼입니다. 작업자는 현장에서 마찰 없이 설치 가능한 모바일 환경을 사용하고, 현장 관리자는 안전 보고 · 출퇴근 · 인센티브 적립을 한 곳에서 심사할 수 있도록 설계되었습니다.

A single Cloudflare Worker serves the **Hono** API and two statically-exported **Next.js 15** frontends (worker PWA + admin dashboard) via hostname routing. Persistent state lives in **Cloudflare D1** (via Drizzle ORM), with **R2** for media, **KV** for auth cache and system status, **Hyperdrive** for an external FAS employee database, **Queues** for notification delivery, and **Durable Objects** for rate limiting and job scheduling.

단일 **Cloudflare Worker**가 **Hono** API와 정적 빌드된 두 개의 **Next.js 15** 프런트엔드(작업자 PWA, 관리자 대시보드)를 호스트명 라우팅으로 제공합니다. 영속 데이터는 **Cloudflare D1**(Drizzle ORM 사용), 미디어는 **R2**, 인증 캐시와 시스템 상태는 **KV**, 외부 FAS 임직원 DB는 **Hyperdrive**, 알림 파이프라인은 **Queue**, 레이트 리미팅과 작업 스케줄링은 **Durable Object**를 사용합니다.

---

## Key Features / 주요 기능

### For Field Workers / 현장 작업자용

| Feature | Description (EN) | 설명 (KO) |
| --- | --- | --- |
| Mobile PWA | Installable Next.js PWA with offline shell and Android TWA build | 설치 가능한 Next.js PWA, 오프라인 셸과 Android TWA 빌드 제공 |
| Safety Reports | Photo/video hazard reports uploaded to R2 | 사진·영상 위험 보고를 R2로 업로드 |
| Attendance | KST same-day JWT-scoped attendance logging | KST 당일 만료 JWT 기반 출퇴근 기록 |
| Safety Points | Earn and track incentive points for compliant behavior | 준수 행동에 대한 인센티브 포인트 적립 및 추적 |
| Multilingual UI | Korean, English, Vietnamese, Chinese | 한국어, 영어, 베트남어, 중국어 지원 |

### For Site Admins / 현장 관리자용

| Feature | Description (EN) | 설명 (KO) |
| --- | --- | --- |
| Admin Dashboard | Static-exported Next.js 15 dashboard on a dedicated hostname | 전용 호스트명의 Next.js 15 관리자 대시보드 |
| Review Queue | Triage posts, votes, and education records | 게시글, 투표, 교육 기록 심사 |
| Settlements | Period-based safety-point settlement workflow | 기간별 안전 포인트 정산 워크플로 |
| Field Permissions | Per-site `canAwardPoints`, `canReview`, `canExportData` flags | 현장별 `canAwardPoints`, `canReview`, `canExportData` 플래그 |
| Compliance Reports | Exportable compliance and attendance summaries | 내보낼 수 있는 컴플라이언스 및 출퇴근 요약 |

### Platform Capabilities / 플랫폼 기능

- **Triple-layer auth validation** — JWT decode → KST date check → KV cache lookup → D1 fallback.
- **Three-tier authorization** — Role-based (`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`) → site membership → field-level flags.
- **Notification pipeline** — Queue-based delivery with a separate DLQ.
- **Scheduled jobs** — Durable Object scheduler driving 10 cron jobs.
- **Wrangler-sync guard** — Pre-commit script that diffs `wrangler.toml` against actual binding usage.

---

## Architecture / 아키텍처

### High-Level Topology / 최상위 토폴로지

| Layer | Component | Responsibility | 책임 |
| --- | --- | --- | --- |
| Edge | Cloudflare Worker (single entry) | Hostname-based routing, API, static asset serving | 호스트명 기반 라우팅, API, 정적 자산 제공 |
| API | Hono on Workers | REST endpoints, Zod validation, auth middleware | REST 엔드포인트, Zod 검증, 인증 미들웨어 |
| Data | Cloudflare D1 (Drizzle) | Primary relational store (34 tables) | 주 관계형 저장소(34 테이블) |
| Cache | Cloudflare KV | Auth cache, system status, runtime config | 인증 캐시, 시스템 상태, 런타임 설정 |
| Object Storage | Cloudflare R2 | User media, attendance bucket | 사용자 미디어, 출퇴근 자산 버킷 |
| External | Hyperdrive → FAS DB | Read-only employee database | 읽기 전용 임직원 데이터베이스 |
| Async | Cloudflare Queue + DLQ | Notification delivery | 알림 전달 |
| Coordination | Durable Objects | `RateLimiter`, `JobScheduler` | 레이트 리미팅, 작업 스케줄링 |
| Frontend A | `apps/worker` (port 3000) | Worker PWA, static export to `out/` | 작업자 PWA, `out/`으로 정적 내보내기 |
| Frontend B | `apps/admin` (port 3001) | Admin dashboard, static export to `out/` | 관리자 대시보드, `out/`으로 정적 내보내기 |
| Shell | `apps/worker/android` | TWA wrapper for Play Store distribution | Play Store 배포용 TWA 래퍼 |

### Request Flow / 요청 흐름

1. DNS resolves a worker or admin hostname to the same Cloudflare Worker.
2. The Worker inspects the `Host` header and routes to either the static `ASSETS` binding (PWA shell) or the Hono router (API).
3. Hono middleware runs in order: `cors` → `requestLogger` → `analytics` → `securityHeaders` → `auth` → route handler.
4. The `auth` middleware performs the triple-layer validation (JWT decode → KST midnight check → KV cache → D1 fallback) and attaches `ctx.user`.
5. Route handlers use Zod-validated input, call Drizzle-backed helpers, and may enqueue to `NOTIFICATION_QUEUE` or read from R2/Hyperdrive.
6. Durable Object `RateLimiter` enforces per-route quotas; `JobScheduler` triggers cron jobs.

### Monorepo Build Order / 모노레포 빌드 순서

```
@safetywallet/types → @safetywallet/ui → apps/api → apps/worker → apps/admin
```

The `turbo.json` pipeline keys are `build`, `dev`, `lint`, `typecheck`, `test`, `clean`. See `turbo.json` for explicit `dependsOn` and `outputs`.

---

## Tech Stack / 기술 스택

| Area | Technology | Purpose | 용도 |
| --- | --- | --- | --- |
| Language | TypeScript (strict) | Shared type safety across all packages | 패키지 공통 타입 안정성 |
| Monorepo | Turborepo + npm workspaces | Build orchestration, caching | 빌드 오케스트레이션, 캐싱 |
| API framework | Hono | Lightweight router on Workers | Worker 위 경량 라우터 |
| ORM | Drizzle | Type-safe D1 access | 타입 안전 D1 액세스 |
| Validation | Zod | Request/response schemas | 요청/응답 스키마 |
| Frontend | Next.js 15 (App Router) | SSR-free static export | SSR 없는 정적 내보내기 |
| Styling | Tailwind CSS | Utility-first styling | 유틸리티 우선 스타일링 |
| State (client) | Zustand | Persisted auth store | 영속 인증 스토어 |
| Data fetching | TanStack Query | Server state cache | 서버 상태 캐시 |
| UI components | shadcn/ui (custom build) | Shared component library | 공통 컴포넌트 라이브러리 |
| Unit testing | Vitest | Per-package unit tests | 패키지별 단위 테스트 |
| E2E testing | Playwright | 6-project cross-browser E2E | 6-프로젝트 E2E |
| Hooks | Husky + lint-staged | Pre-commit lint, format, anti-pattern check | 커밋 전 lint·format·안티 패턴 검사 |
| Tooling scripts | Go (`scripts/*.go`) | Naming lint, anti-pattern guard, verify | 명명 lint, 안티 패턴 가드, 검증 |
| Edge platform | Cloudflare Workers + D1 + R2 + KV + Queues + DOs + Hyperdrive | Full edge runtime | 풀 엣지 런타임 |
| Android shell | Bubblewrap-style TWA | Play Store distribution | Play Store 배포 |

---

## Repository Layout / 저장소 구조

The repository is a Turborepo monorepo. The actual top-level layout is:

```
.
├── apps/
│   ├── api/                # Cloudflare Worker API (Hono + Drizzle + D1)
│   ├── admin/              # Next.js 15 admin dashboard (port 3001, static export)
│   └── worker/             # Next.js 15 worker PWA (port 3000, static export)
│       ├── android/        # Android TWA project (Gradle, twa-manifest.json)
│       └── src/app/        # App Router pages (login, posts, attendance, education)
├── packages/
│   ├── types/              # Shared TS types, enums, DTOs, i18n translation data
│   └── ui/                 # Shared shadcn/ui components + Tailwind theme tokens
├── scripts/                # Go/JS tooling (verify, naming lint, anti-pattern checks)
├── e2e/                    # Playwright E2E tests
├── docs/                   # PRD, requirements specs, ops runbooks
├── .github/workflows/      # CI/CD pipelines
├── wrangler.toml           # Root Cloudflare Worker config + bindings
├── turbo.json              # Turborepo pipeline definition
├── playwright.config.ts    # 6 Playwright projects
├── vitest.config.ts        # Root Vitest config
├── package.json            # Workspaces, scripts, devDependencies
├── package-lock.json
├── AGENTS.md               # Project knowledge base
├── ARCHITECTURE.md         # Architecture details
├── CODE_STYLE.md           # Coding conventions
├── CONTRIBUTING.md         # Contribution rules
├── LICENSE
└── README.md
```

### Workspace Packages / 워크스페이스 패키지

| Package | Path | Description | 설명 |
| --- | --- | --- | --- |
| `apps/api` | `apps/api` | Cloudflare Worker API | Cloudflare Worker API |
| `apps/admin` | `apps/admin` | Admin dashboard SPA | 관리자 대시보드 SPA |
| `apps/worker` | `apps/worker` | Worker PWA + Android TWA | 작업자 PWA + Android TWA |
| `packages/types` | `packages/types` | Shared TS types and DTOs | 공통 TS 타입과 DTO |
| `packages/ui` | `packages/ui` | Shared UI components | 공통 UI 컴포넌트 |

---

## Quick Start / 빠른 시작

### Prerequisites / 사전 요구 사항

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 20.0.0 | Enforced via `engines` |
| npm | 10.8.2 | Enforced via `packageManager` (use Corepack) |
| Go | recent | Required only for `scripts/*.go` tooling |
| Wrangler | latest | `npx wrangler` for local Worker dev |

### Bootstrap / 설치

```bash
# 1. Clone the repository
git clone <repository-url> safetywallet
cd safetywallet

# 2. Enable the pinned package manager
corepack enable
corepack prepare npm@10.8.2 --activate

# 3. Install dependencies (npm workspaces)
npm install

# 4. (Optional) Prepare Husky git hooks
npm run prepare
```

### First Run / 첫 실행

```bash
# Start the full Turborepo dev pipeline (api, worker, admin)
npm run dev

# Or run a single workspace
npm run dev --workspace=apps/worker      # worker PWA on http://localhost:3000
npm run dev --workspace=apps/admin       # admin dashboard on http://localhost:3001
npm run dev --workspace=apps/api         # Cloudflare Worker via Wrangler
```

---

## Configuration / 설정

### Cloudflare Bindings / Cloudflare 바인딩

`wrangler.toml` declares all bindings for the single Cloudflare Worker. The `check:wrangler-sync` script ensures that runtime usage matches the declared configuration.

| Binding | Type | Purpose | 용도 |
| --- | --- | --- | --- |
| `DB` | D1 | Primary database (Drizzle, 34 tables) | 주 데이터베이스 |
| `FAS_HYPERDRIVE` | Hyperdrive | External FAS employee database | 외부 FAS 임직원 DB |
| `ASSETS` | Workers Static Assets | Static frontend files (worker + admin SPAs) | 정적 프런트엔드 자산 |
| `R2` | R2 | User-uploaded images and videos | 사용자 업로드 이미지/영상 |
| `ACETIME_BUCKET` | R2 | Attendance-related assets | 출퇴근 관련 자산 |
| `KV` | KV | Auth cache, system status, config | 인증 캐시, 시스템 상태, 설정 |
| `NOTIFICATION_QUEUE` | Queue | Notification delivery pipeline | 알림 전달 파이프라인 |
| `NOTIFICATION_DLQ` | Queue | Failed notification dead-letter queue | 알림 실패 데드 레터 큐 |
| `RATE_LIMITER` | Durable Object | Per-route rate limiting | 경로별 레이트 리미팅 |
| `JOB_SCHEDULER` | Durable Object | Cron-driven job scheduler | 크론 작업 스케줄러 |

### Environment Variables / 환경 변수

Local secrets should be stored in `.dev.vars` for `wrangler dev` and in `.env.e2e` for Playwright (read via 1Password CLI as `op run --env-file`).

| Variable | Scope | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | api | HMAC secret for KST-midnight JWTs |
| `ADMIN_HOST` | worker root | Hostname used to route to the admin SPA |
| `WORKER_HOST` | worker root | Hostname used to route to the worker PWA |
| `E2E_*` | e2e | Loaded via `op run --env-file=.env.e2e` |

### Wrangler Sync Check / Wrangler 동기화 검사

```bash
npm run check:wrangler-sync
```

This script fails the build if any binding used at runtime is missing from `wrangler.toml`, or vice versa.

---

## Commands Reference / 명령어 레퍼런스

All commands are run from the repository root unless noted.

### Build / 빌드

| Command | Description | 설명 |
| --- | --- | --- |
| `npm run build` | Full monorepo build + static distribution assembly (`dist/`) | 모노레포 전체 빌드와 `dist/` 정적 묶음 생성 |
| `npm run build:api` | Build `packages/types` and `apps/api` only | `packages/types`와 `apps/api`만 빌드 |
| `npm run build:static` | Build static export and assemble `dist/admin` | 정적 내보내기 빌드와 `dist/admin` 조립 |
| `npm run build:one-worker` | Alias for `build:api` | `build:api`의 별칭 |

### Develop / 개발

| Command | Description | 설명 |
| --- | --- | --- |
| `npm run dev` | Run Turborepo dev pipeline across all workspaces | 모든 워크스페이스의 개발 서버 실행 |
| `npm run db:generate` | Generate Drizzle types from schema (api workspace) | 스키마에서 Drizzle 타입 생성 |

### Quality / 품질 검사

| Command | Description | 설명 |
| --- | --- | --- |
| `npm run lint` | ESLint across workspaces | 워크스페이스 전체 ESLint |
| `npm run lint:naming` | Naming convention check (JS script) | 명명 규칙 검사 (JS 스크립트) |
| `npm run typecheck` | TypeScript across workspaces | 워크스페이스 전체 타입 검사 |
| `npm run format` | Prettier write | Prettier 자동 정리 |
| `npm run format:check` | Prettier check (no write) | Prettier 검사만 |
| `npm run check:wrangler-sync` | Diff runtime vs. `wrangler.toml` | 런타임 vs. `wrangler.toml` 차이 검사 |
| `npm run git:preflight` | Go-based pre-flight checks | Go 기반 사전 점검 |
| `npm run verify` | Go-based full verification | Go 기반 전체 검증 |

### Test / 테스트

| Command | Description | 설명 |
| --- | --- | --- |
| `npm run test` | Vitest across workspaces | 워크스페이스 전체 Vitest |
| `npm run test:coverage` | Vitest with coverage | 커버리지 포함 Vitest |
| `npm run e2e` | Playwright via 1Password env injection | Playwright (1Password 환경 주입) |
| `npm run e2e:headed` | Playwright headed mode | Playwright 헤드 모드 |
| `npm run e2e:ui` | Playwright interactive UI | Playwright 대화형 UI |

### Deploy / 배포

| Command | Description | 설명 |
| --- | --- | --- |
| `npm run deploy:api` | Intentionally disabled — deploy is Git-ref driven via CI on `master` | 의도적으로 비활성화 — 배포는 `master` 기준 CI에서 Git-ref로 수행 |

### Maintenance / 유지 보수

| Command | Description | 설명 |
| --- | --- | --- |
| `npm run clean` | Turbo clean + remove `node_modules` | Turbo clean과 `node_modules` 삭제 |
| `npm run prepare` | Install Husky hooks | Husky 훅 설치 |

---

## Local Development / 로컬 개발

### Frontend / 프런트엔드

- `apps/worker` runs on `http://localhost:3000` for the worker PWA.
- `apps/admin` runs on `http://localhost:3001` for the admin dashboard.
- Both produce a static export to `apps/<workspace>/out/`. The root `build:static` step copies these to `dist/` and `dist/admin/`, which `ASSETS` serves in production.

### API / API

`apps/api` runs via Wrangler:

```bash
npm run dev --workspace=apps/api
```

Local secrets go in `apps/api/.dev.vars`. D1 migrations live under `apps/api/migrations/` (31 SQL files).

### Database / 데이터베이스

```bash
# Apply local D1 migrations
npx wrangler d1 migrations apply DB --local

# Generate Drizzle types from schema
npm run db:generate
```

### Shared Packages / 공통 패키지

`@safetywallet/types` is built before any consuming workspace (`turbo.json` `dependsOn`). When you change a type or DTO, rebuild via `npm run build --workspace=packages/types` (or rely on the full pipeline).

---

## Testing / 테스트

### Unit Tests / 단위 테스트

Vitest is configured per workspace (`vitest.config.ts` at root and inside `apps/worker/`). Run all unit tests:

```bash
npm run test
npm run test:coverage   # writes coverage reports
```

### End-to-End Tests / E2E 테스트

Playwright is configured with **6 projects** in `playwright.config.ts`. E2E tests live under `e2e/` (auth setup, admin flows, worker flows). Secrets are injected via the 1Password CLI:

```bash
# Headless
npm run e2e

# Headed
npm run e2e:headed

# Interactive UI mode
npm run e2e:ui
```

The `op run --env-file=.env.e2e` wrapper is required because `E2E_*` variables are not committed to the repo.

### Naming & Anti-Pattern / 명명 및 안티 패턴

```bash
npm run lint:naming          # JS naming convention check
# Anti-pattern check runs as a lint-staged hook on *.ts / *.tsx:
#   go run scripts/check-anti-patterns.go
```

---

## Android TWA Build / Android TWA 빌드

`apps/worker/android/` contains a Trusted Web Activity wrapper that packages the worker PWA for Play Store distribution.

| File / Directory | Purpose | 용도 |
| --- | --- | --- |
| `twa-manifest.json` | Bubblewrap/TWA configuration | Bubblewrap/TWA 설정 |
| `build.gradle`, `settings.gradle`, `gradle.properties` | Gradle project definition | Gradle 프로젝트 정의 |
| `app/build.gradle` | App module build script | 앱 모듈 빌드 스크립트 |
| `app/src/main/AndroidManifest.xml` | Android manifest | Android 매니페스트 |
| `app/src/main/java/me/jclee/safetywallet/twa/` | `Application`, `DelegationService`, `LauncherActivity` | TWA 진입점 |
| `app/src/main/res/` | Icons, splash, manifest XML, shortcuts | 아이콘, 스플래시, 매니페스트, 바로가기 |
| `gradle/wrapper/` | Pinned Gradle wrapper | Gradle 래퍼 고정 버전 |
| `manifest-checksum.txt` | Integrity checksum for the web manifest | 웹 매니페스트 무결성 체크섬 |

Build the Android app from `apps/worker/android/`:

```bash
cd apps/worker/android
./gradlew assembleRelease
```

---

## Internationalization / 국제화

The worker PWA ships a custom i18n runtime in `apps/worker/src/i18n/` with translation data sourced from `packages/types`.

| Locale | Code | Notes |
| --- | --- | --- |
| Korean | `ko` | Default |
| English | `en` | — |
| Vietnamese | `vi` | — |
| Chinese | `zh` | — |

Implementation details are documented in `apps/worker/I18N_IMPLEMENTATION.md`.

---

## Contribution Guide / 기여 가이드

1. Read `AGENTS.md`, `ARCHITECTURE.md`, and `CODE_STYLE.md` before opening a PR.
2. Use the pinned toolchain: `corepack prepare npm@10.8.2 --activate`.
3. Before pushing, run the full local verification chain:
   ```bash
   npm run lint
   npm run lint:naming
   npm run typecheck
   npm run test
   npm run check:wrangler-sync
   npm run verify
   ```
4. Husky `pre-commit` runs `go run scripts/check-anti-patterns.go` and Prettier on staged files. Do not bypass it.
5. When you change `wrangler.toml` or a binding usage, run `npm run check:wrangler-sync`.
6. When you change a shared type, ensure `packages/types` is rebuilt before downstream workspaces.
7. Follow the conventions in `CONTRIBUTING.md` for branch naming, commit messages, and PR templates.

---

## License / 라이선스

See [`LICENSE`](./LICENSE) for the full license text.
전체 라이선스 전문은 [`LICENSE`](./LICENSE) 파일을 참조하세요.