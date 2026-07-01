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
- [Cloudflare Bindings / Cloudflare 바인딩](#cloudflare-bindings--cloudflare-바인딩)
- [Authentication & Authorization / 인증과 권한](#authentication--authorization--인증과-권한)
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

A single Cloudflare Worker serves the **Hono** API and two statically-exported **Next.js 15** frontends (worker PWA and admin dashboard) via hostname routing. SQLite-compatible **D1** is the primary store; **R2** holds uploaded media; **Hyperdrive** fronts the external FAS employee database; **KV** caches auth and config; **Queues** fan out notifications.

단일 Cloudflare Worker가 호스트명 기반 라우팅으로 **Hono** API와 두 개의 정적 익스포트된 **Next.js 15** 프런트엔드(작업자 PWA · 관리자 대시보드)를 제공합니다. **D1**이 주 저장소이며, **R2**는 업로드 미디어, **Hyperdrive**는 외부 FAS 직원 데이터베이스, **KV**는 인증·설정 캐시, **Queue**는 알림 파이프라인을 담당합니다.

### Target Users / 대상 사용자

| Persona / 페르소나         | Primary surface / 주 진입 화면 | Core jobs / 주요 작업                                         |
| -------------------------- | ------------------------------ | ------------------------------------------------------------- |
| Field Worker / 현장 작업자 | Worker PWA (mobile, installable) | Report hazards, log attendance, view safety-point balance     |
| Site Admin / 현장 관리자   | Admin dashboard                | Review posts, manage attendance, award safety points          |
| Super Admin / 총괄 관리자  | Admin dashboard                | Multi-site governance, exports, settlements, compliance       |
| System / 시스템            | API + scheduled jobs           | Background reconciliation, notifications, retention           |

---

## Key Features / 주요 기능

- **Mobile-first PWA / 모바일 우선 PWA** — Installable on Android via TWA, on iOS via "Add to Home Screen". Offline-friendly shell.
- **Hazard & Safety Reporting / 안전·위험 보고** — Workers submit posts with image/video evidence uploaded to R2.
- **Attendance Logging / 출퇴근 기록** — Geolocation- and time-bound check-in/out with R2-backed proof assets.
- **Safety-Point Incentives / 안전 포인트 인센티브** — Three-tier review with point awards redeemable as settlements.
- **Multi-site Membership / 다중 현장 멤버십** — Site-scoped roles layered on top of global roles.
- **Custom i18n Runtime / 자체 i18n 런타임** — `ko`, `en`, `vi`, `zh` with KST-aware date formatting and currency.
- **Scheduled Jobs / 스케줄드 잡** — 10 cron jobs for reconciliation, retention, and notification dispatch.
- **End-to-end Cloudflare / 전 구간 Cloudflare** — Workers, D1, R2, KV, Hyperdrive, Queues, Durable Objects.

---

## Architecture / 아키텍처

### Top-level data flow / 최상위 데이터 흐름

1. **Edge request** hits Cloudflare and routes by hostname to either `worker.<domain>` (PWA), `admin.<domain>` (dashboard), or API endpoints.
2. The **Hono** router dispatches to one of 18 API route modules; CORS, logging, analytics, and security-header middleware wrap every request.
3. **JWT-based auth** is verified through three layers: token decode → KST same-day expiry check → KV cache → D1 fallback.
4. Reads/writes land in **D1** (via Drizzle) for transactional data; media flows through **R2**; the external FAS DB is fronted by **Hyperdrive**.
5. Long-running work is queued via **Notification Queue** (+ DLQ); time-bound work is scheduled through the **JobScheduler Durable Object** and **cron triggers**.
6. Two statically-exported **Next.js 15** frontends are served from **Workers Static Assets** behind the same Worker.

### Frontend–backend split / 프런트엔드·백엔드 분리

| Surface / 화면         | Hostname / 호스트명             | Origin / 오리진         | Backend surface / 백엔드 |
| ---------------------- | ------------------------------- | ----------------------- | ------------------------ |
| Worker PWA / 작업자 앱 | `worker.<domain>` (default `/`) | Next.js 15 static export | Hono API + static assets |
| Admin Dashboard / 관리자 | `admin.<domain>`                | Next.js 15 static export | Hono API + static assets |
| API / API              | `api.<domain>` (or `/api/*`)    | Cloudflare Worker       | Hono                      |

### Monorepo pipeline / 모노레포 파이프라인

```
types  →  ui  →  api
                 ↓
               worker (Next.js static)
               admin (Next.js static)
```

`packages/types` is the build-time foundation for both shared DTOs and i18n translation data. `packages/ui` carries shared shadcn/ui components and Tailwind v4 theme tokens.

---

## Tech Stack / 기술 스택

### Runtime / 런타임

| Layer / 계층            | Technology / 기술                              | Notes / 비고                            |
| ----------------------- | ---------------------------------------------- | --------------------------------------- |
| Edge runtime / 엣지 런타임 | Cloudflare Workers                            | Single Worker serves API + static SPAs |
| API framework / API 프레임워크 | Hono                                          | Type-safe routing                       |
| ORM / ORM               | Drizzle                                        | Schema-first, SQL-typed                 |
| Primary DB / 주 DB      | Cloudflare D1 (SQLite)                         | 34 tables                               |
| Cache / 캐시            | Cloudflare KV                                  | Auth, system status, config             |
| Object storage / 객체 스토리지 | Cloudflare R2 (`R2`, `ACETIME_BUCKET`)     | Media + attendance assets               |
| External DB accelerator / 외부 DB 가속 | Hyperdrive (`FAS_HYPERDRIVE`)        | Employee DB read-through                |
| Async pipeline / 비동기 파이프라인 | Queues (`NOTIFICATION_QUEUE`, `..._DLQ`) | Notification delivery + dead-letter     |
| Coordination / 조율     | Durable Objects (`RateLimiter`, `JobScheduler`) | Rate limiting + cron scheduling       |
| Migrations / 마이그레이션 | D1 SQL migrations                            | 31 files                                |

### Frontend / 프런트엔드

| App / 앱   | Framework / 프레임워크 | Output / 출력            | Port / 포트 |
| ---------- | --------------------- | ------------------------ | ----------- |
| `worker`   | Next.js 15 (App Router, static export) | PWA + Android TWA wrap | 3000        |
| `admin`    | Next.js 15 (App Router, static export) | Admin SPA                | 3001        |
| `packages/ui` | shadcn/ui + Tailwind v4 tokens    | Shared component library | n/a         |

### Tooling / 도구

| Concern / 항목        | Tool / 도구                                    |
| --------------------- | ---------------------------------------------- |
| Monorepo / 모노레포   | Turborepo (`turbo.json`)                      |
| Package manager / 패키지 매니저 | npm 10.8.2 (workspaces)               |
| Language / 언어       | TypeScript 5                                   |
| Testing / 테스트      | Vitest (unit), Playwright (E2E, 6 projects)   |
| Lint / 린트           | ESLint 8.57, Prettier, custom naming & anti-pattern scripts |
| Hooks / 훅            | Husky + lint-staged                            |
| Secrets / 비밀값      | 1Password CLI (`op run --env-file`)            |
| iOS / Android packaging | Bubblewrap TWA (`apps/worker/android/`)      |

---

## Repository Layout / 저장소 구조

```
.
├── apps/
│   ├── worker/                # Next.js 15 worker PWA (port 3000, static export)
│   │   ├── src/app/           # App Router (login, posts, attendance, education, ...)
│   │   ├── src/i18n/          # Custom i18n runtime (ko, en, vi, zh)
│   │   ├── src/components/    # Worker-specific UI components
│   │   └── android/           # Bubblewrap-generated TWA project + APK assets
│   ├── admin/                 # Next.js 15 admin dashboard (port 3001, static export)
│   └── api/                   # Cloudflare Worker API (Hono + Drizzle + D1)
├── packages/
│   ├── types/                 # Shared TS types, enums, DTOs, i18n translation data
│   └── ui/                    # Shared shadcn/ui + Tailwind v4 theme tokens
├── docs/                      # PRD, requirements, ops runbooks
├── scripts/                   # Go/JS tooling (verify, naming, anti-pattern checks)
├── e2e/                       # Playwright E2E suites
├── wrangler.toml              # Root CF Worker config + bindings
├── turbo.json                 # Turborepo pipeline (types → ui → apps)
└── playwright.config.ts       # 6 Playwright projects
```

---

## Quick Start / 빠른 시작

### Prerequisites / 사전 요구사항

- **Node.js** ≥ 20.0.0
- **npm** 10.8.2 (`packageManager` pinned via `package.json`)
- **Wrangler** for Cloudflare local emulation (`npx wrangler`)
- **Go** for `scripts/*.go` tooling (verify, preflight, anti-pattern checks)
- **1Password CLI** (`op`) for E2E secret loading
- **Android SDK / Gradle** only if you intend to rebuild the TWA APK

### Install / 설치

```bash
npm install
```

This bootstraps the workspace and runs `husky` via the `prepare` script.

### Start the dev servers / 개발 서버 실행

```bash
npm run dev
```

This invokes `turbo run dev` and starts the API worker (`apps/api`), the worker PWA (`apps/worker`, port 3000), and the admin dashboard (`apps/admin`, port 3001) in parallel.

### First-time checks / 최초 점검

```bash
npm run typecheck       # TypeScript across all workspaces
npm run lint            # ESLint across all workspaces
npm run check:wrangler-sync   # Verify wrangler.toml ↔ app config consistency
npm run lint:naming     # Naming convention lint
```

---

## Configuration / 설정

### Environment files / 환경 파일

E2E and runtime secrets are loaded through **1Password CLI** via `op run --env-file`. Create a `.env.e2e` reference locally; the actual secret material lives in 1Password.

### `wrangler.toml` (root) / 루트 설정

The root `wrangler.toml` declares the Cloudflare Worker entry point, environment name, compatibility date/flags, all D1/KV/R2/Queue/Hyperdrive bindings, and per-environment overrides.

### Per-workspace TS / 워크스페이스별 TS

Each workspace owns a `tsconfig.json` extending the root config and is referenced by Turborepo's `build`/`typecheck`/`lint` tasks.

---

## Cloudflare Bindings / Cloudflare 바인딩

| Binding / 바인딩              | Type / 타입           | Purpose / 용도                                  |
| ----------------------------- | --------------------- | ----------------------------------------------- |
| `DB`                          | D1                    | Primary database (34 tables, Drizzle/SQLite)    |
| `FAS_HYPERDRIVE`              | Hyperdrive            | External FAS employee database                  |
| `ASSETS`                      | Workers Static Assets | Static frontend files (worker + admin SPAs)     |
| `R2`                          | R2                    | User-uploaded images and videos                 |
| `ACETIME_BUCKET`              | R2                    | Attendance-related assets                       |
| `KV`                          | KV                    | Auth cache, system status, config               |
| `NOTIFICATION_QUEUE`          | Queue                 | Notification delivery pipeline                  |
| `NOTIFICATION_DLQ`            | Queue                 | Dead-letter queue                               |
| `RATE_LIMITER`                | Durable Object        | Per-route rate limiting                         |
| `JOB_SCHEDULER`               | Durable Object        | Cron-style job coordination                     |

---

## Authentication & Authorization / 인증과 권한

### Auth lifecycle / 인증 흐름

1. **Login** → backend issues a JWT with **KST same-day midnight expiry**.
2. Client stores the token in a **Zustand**-persisted store (key: `safetywallet-auth` for worker, `safetywallet-admin-auth` for admin).
3. Each request runs through a **triple-layer validation**:
   1. JWT decode + signature check
   2. KST same-day expiry check
   3. **KV cache lookup** with **D1 fallback** on miss

### Permission model / 권한 모델

Three layers are evaluated in order:

| Layer / 계층 | Field / 필드                  | Purpose / 용도                                  |
| ------------ | ----------------------------- | ----------------------------------------------- |
| 1. Role / 역할 | `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM` | Global capability tier                |
| 2. Membership / 멤버십 | site-scoped membership      | Per-site access                                |
| 3. Flags / 플래그 | `canAwardPoints`, `canReview`, `canExportData` | Field-level overrides           |

### Client resilience / 클라이언트 회복탄력성

The Zustand store includes a **401 refresh mutex** to deduplicate concurrent refresh attempts and avoid token-stampede failures.

---

## Commands Reference / 명령어 레퍼런스

All commands run from the repository root unless noted.

| Script / 스크립트                  | Description / 설명                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`                      | Start API + worker PWA + admin dashboard in parallel via Turborepo                 |
| `npm run build`                    | Build all workspaces then assemble static SPA output into `dist/`                   |
| `npm run build:api`                | Build `packages/types` then `apps/api` only                                        |
| `npm run build:static`             | Reassemble static SPA output into `dist/` (worker → root, admin → `dist/admin/`)   |
| `npm run build:one-worker`         | Build only the API worker artifacts                                                |
| `npm run deploy:api`               | Intentionally disabled — prints a message and exits non-zero (Git-ref driven CI)   |
| `npm run lint`                     | ESLint across all workspaces via Turborepo                                         |
| `npm run lint:naming`              | Naming convention lint (`scripts/lint-naming.js`)                                  |
| `npm run test`                     | Vitest across all workspaces via Turborepo                                         |
| `npm run test:coverage`            | Vitest with coverage flag                                                          |
| `npm run typecheck`                | TypeScript check across all workspaces                                             |
| `npm run check:wrangler-sync`      | Verify `wrangler.toml` stays in sync with per-app config (`scripts/check-wrangler-sync.js`) |
| `npm run git:preflight`            | Pre-commit/pre-push guard rails (`scripts/git-preflight.go`)                        |
| `npm run verify`                   | Repo-wide integrity verify (`scripts/verify.go`)                                    |
| `npm run format`                   | Prettier write across `**/*.{ts,tsx,js,jsx,json,md}`                                |
| `npm run format:check`             | Prettier check (CI-friendly)                                                       |
| `npm run clean`                    | Turborepo clean + remove `node_modules`                                            |
| `npm run db:generate`              | Drizzle schema generation (`apps/api`)                                             |
| `npm run e2e`                      | Playwright E2E with 1Password-loaded secrets (`op run --env-file=.env.e2e ...`)     |
| `npm run e2e:headed`               | Playwright E2E with browser UI                                                     |
| `npm run e2e:ui`                   | Playwright UI mode                                                                 |

### lint-staged / 단계별 린트

On commit, staged files are processed automatically:

| Pattern / 패턴             | Hook / 훅                                                       |
| -------------------------- | --------------------------------------------------------------- |
| `*.{ts,tsx}`               | `go run scripts/check-anti-patterns.go` → `prettier --write`    |
| `*.{js,jsx,json,md}`       | `prettier --write`                                              |

---

## Local Development / 로컬 개발

### Recommended flow / 권장 흐름

```bash
# 1. Install
npm install

# 2. Sanity-check the repo
npm run typecheck
npm run lint
npm run check:wrangler-sync
npm run lint:naming

# 3. Run all dev servers
npm run dev
# worker PWA:  http://localhost:3000
# admin:       http://localhost:3001
# api:         routed by Cloudflare emulation (wrangler dev inside apps/api)
```

### Working on the API worker / API 워커 작업

The API is its own workspace (`apps/api`). Local Cloudflare emulation runs through Wrangler; D1 migrations live under `apps/api/migrations/` and are applied during CI/CD.

### Working on shared packages / 공유 패키지 작업

`packages/types` is the build-time root; rebuild it (`npm run build --workspace=packages/types`) before iterating on dependent apps. `packages/ui` exposes shared shadcn/ui components and Tailwind v4 theme tokens.

### Build verification / 빌드 검증

```bash
npm run build              # Full monorepo build + dist/ assembly
npm run build:api          # API-only build (fast feedback loop)
```

---

## Testing / 테스트

### Unit tests / 단위 테스트

Vitest is the unit-test runner. Workspace configs are inherited from `vitest.config.ts` at the root.

```bash
npm run test
npm run test:coverage
```

### End-to-end tests / E2E 테스트

Playwright is configured with **6 projects** in `playwright.config.ts`. Secrets are sourced from 1Password through `op run`:

```bash
npm run e2e          # Headless
npm run e2e:headed   # Headed (local debugging)
npm run e2e:ui       # Playwright UI mode
```

> The E2E suite expects a `.env.e2e` reference file. Actual secret material is fetched from 1Password at runtime.

### Pre-commit checks / 커밋 전 점검

`husky` + `lint-staged` runs anti-pattern detection and Prettier on staged files. `npm run git:preflight` and `npm run verify` provide additional repo-wide guard rails before push and CI.

---

## Android TWA Build / Android TWA 빌드

The worker PWA is also packaged as an **Android Trusted Web Activity** for distribution on devices where a "real" install is preferable to the in-browser PWA install prompt.

### Project location / 프로젝트 위치

`apps/worker/android/` — a Bubblewrap-style TWA project containing:

- `twa-manifest.json` — manifest consumed by Bubblewrap
- `app/build.gradle`, `settings.gradle`, root `build.gradle`
- `app/src/main/AndroidManifest.xml`
- Launcher activity (`LauncherActivity.java`), Application class, Delegation service
- Multi-density launcher / maskable / splash / notification icons
- `web_app_manifest.json` resource referenced by the wrapper

### Build / 빌드

```bash
cd apps/worker/android
./gradlew assembleRelease
```

Output and signing configuration follow the standard Android Gradle conventions; see `apps/worker/android/AGENTS.md` and the bundled `manifest-checksum.txt` for the verified asset fingerprint.

### Verification / 검증

`manifest-checksum.txt` pins the expected SHA-256 of `twa-manifest.json` so the wrapper project can detect drift between the PWA manifest and the Android wrapper manifest.

---

## Internationalization / 국제화

The worker PWA ships with a **custom i18n runtime** (not `next-intl`) under `apps/worker/src/i18n/`. Translation data and shared DTOs live in `packages/types`.

| Locale / 로케일 | Direction / 방향 | Notes / 비고                              |
| --------------- | ---------------- | ----------------------------------------- |
| `ko`            | LTR              | Primary locale (KST-aware formatting)     |
| `en`            | LTR              | English                                    |
| `vi`            | LTR              | Vietnamese                                 |
| `zh`            | LTR              | Chinese                                    |

The runtime also handles **KST-aware date formatting** and **currency formatting** so the worker app stays consistent across deployments regardless of the user's device timezone.

자세한 구현 내용은 `apps/worker/I18N_IMPLEMENTATION.md`를 참고하세요.

---

## Contribution Guide / 기여 가이드

1. Read `CONTRIBUTING.md`, `AGENTS.md`, and `ARCHITECTURE.md` at the repo root.
2. Honor the conventions enforced by `scripts/check-anti-patterns.go` and `scripts/lint-naming.js`.
3. Use `npm run verify` locally before pushing — it codifies the same checks CI runs.
4. Never invoke `npm run deploy:api`; deploys are **Git-ref driven via CI on `master`** and the script intentionally refuses to run.
5. For workspace additions, follow the existing pattern in `turbo.json` (dependency direction: `types → ui → apps`) and add matching `lint`/`typecheck`/`test`/`build` tasks.
6. Open a PR with a short summary and a list of touched workspaces. Reviewers will look for parallel changes across `apps/*`, `packages/*`, and any cross-cutting `wrangler.toml` updates.

---

## License / 라이선스

See [`LICENSE`](./LICENSE) in the repository root.
저장소 루트의 [`LICENSE`](./LICENSE) 파일을 참고하세요.