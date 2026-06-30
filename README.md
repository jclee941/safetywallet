# SafetyWallet / 안전지갑

> Mobile-first PWA for construction-site safety reporting, attendance, and safety-point incentive management — deployed end-to-end on the Cloudflare edge.
> 건설 현장의 안전 보고 · 출퇴근 · 안전 포인트 인센티브를 관리하는 모바일 우선 PWA. Cloudflare 엣지에 전량 배포됩니다.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Hono%20%7C%20Drizzle%20%7C%20Next.js%2015%20%7C%20Cloudflare%20Workers-blue)
![Node](https://img.shields.io/badge/node-%E2%89%A520.0.0-green)
![Package%20Manager](https://img.shields.io/badge/npm-10.8.2-CB3837)
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
- [Testing / 테스트](#testing--테스트)
- [Android TWA Build / Android TWA 빌드](#android-twa-build--android-twa-빌드)
- [Internationalization / 국제화](#internationalization--국제화)
- [Contribution Guide / 기여 가이드](#contribution-guide--기여-가이드)
- [License / 라이선스](#license--라이선스)

---

## Overview / 개요

**SafetyWallet** is a field-worker safety platform organized as a **Turborepo monorepo** and deployed end-to-end on **Cloudflare**. It targets construction sites where workers need a low-friction, installable mobile experience and site managers need a dashboard to triage safety reports, attendance, and incentive accrual.

**SafetyWallet**은 Cloudflare 엣지에 전량 배포되는 **Turborepo 모노레포** 기반 현장 작업자 안전 플랫폼입니다. 작업자가 현장에서 마찰 없이 설치 가능한 모바일 환경을 사용하고, 현장 관리자가 안전 보고 · 출퇴근 · 인센티브 적립을 심사할 수 있도록 설계되었습니다.

A single Cloudflare Worker serves a Hono API plus two statically-exported Next.js frontends via hostname routing. Data lives in D1 (primary), KV (cache / config), R2 (uploads), and Queue (notification delivery). An Android Trusted Web Activity (TWA) wraps the worker PWA for native distribution.

단일 Cloudflare Worker가 Hono API와 두 개의 정적-export Next.js 프런트엔드를 호스트명 기반으로 라우팅하며, 데이터는 D1(주 데이터베이스), KV(캐시 · 설정), R2(업로드), Queue(알림 전달)에 저장됩니다. Android TWA가 작업자 PWA를 네이티브 배포용으로 래핑합니다.

---

## Key Features / 주요 기능

| Feature | Description | 기능 설명 |
| --- | --- | --- |
| Mobile-first PWA | Installable worker app with offline-friendly UI and TWA packaging | 설치 가능한 작업자 PWA, TWA 패키징 지원 |
| Safety reports | Workers file hazards and observations with photos / video | 사진 · 동영상 첨부 가능한 안전 보고 |
| Attendance | GPS-aware check-in / check-out per site | 현장별 GPS 기반 출퇴근 |
| Safety-point incentives | Earning, review, and settlement flows | 안전 포인트 적립 · 심사 · 정산 |
| Admin dashboard | Site admin triage, exports, configuration | 현장 관리자 심사 · 내보내기 · 설정 |
| Education | Required training modules per role | 역할별 필수 교육 모듈 |
| Multilingual | ko / en / vi / zh runtime translation | 한국어 · 영어 · 베트남어 · 중국어 |
| Edge-native | Cloudflare Workers, D1, R2, KV, Queue | Cloudflare 엣지 네이티브 구성 |

---

## Architecture / 아키텍처

### Request Flow / 요청 흐름

1. Client opens worker PWA or admin PWA — hostnames map to static assets under `apps/worker/out/*` and `apps/admin/out/*` via the `ASSETS` binding.
2. The browser calls the same origin for `/api/*`; the root Worker routes to the Hono app defined in `apps/api`.
3. Hono applies `cors`, logging, analytics, and security-header middleware, then validates the JWT (KST same-day midnight expiry + KV cache + D1 fallback).
4. Route handlers in `apps/api/src/routes/*` consult Drizzle against the `DB` (D1) binding, with optional reads from `FAS_HYPERDRIVE` for the external FAS employee database.
5. Uploads stream to `R2` (general) or `ACETIME_BUCKET` (attendance); notifications enqueue to `NOTIFICATION_QUEUE` with a `NOTIFICATION_DLQ` failure lane.
6. Cron triggers invoke the JobScheduler Durable Object, which fans out to 10 scheduled jobs (settlement, reminders, retention, etc.).
7. Rate limiting is enforced via the `RATE_LIMITER` Durable Object on sensitive routes.

### Cloudflare Bindings / Cloudflare 바인딩

| Binding | Type | Purpose |
| --- | --- | --- |
| `DB` | D1 | Primary relational store (Drizzle-managed schema) |
| `FAS_HYPERDRIVE` | Hyperdrive | Connection pool to the external FAS employee DB |
| `ASSETS` | Workers Static Assets | Worker + Admin SPA bundles |
| `R2` | R2 bucket | User-uploaded images and videos |
| `ACETIME_BUCKET` | R2 bucket | Attendance-related assets |
| `KV` | KV namespace | Auth cache, system status, runtime config |
| `NOTIFICATION_QUEUE` | Queue | Notification delivery pipeline |
| `NOTIFICATION_DLQ` | Queue | Notification dead-letter lane |
| `RATE_LIMITER` | Durable Object | Per-key request rate limiting |
| `JobScheduler` | Durable Object | Cron orchestration and job registry |

### Authorization Tiers / 권한 계층

| Tier | Roles | Notes |
| --- | --- | --- |
| Global role | `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM` | Carried in JWT claims |
| Site membership | Per-site binding between user and site | Enforced in route handlers |
| Field flags | `canAwardPoints`, `canReview`, `canExportData` | Scoped per role × site |

### Runtime Status / 런타임 상태

| Surface | Where | Owner |
| --- | --- | --- |
| Worker API health | `GET /api/health` | Hono route |
| Admin SPA | `https://admin.<domain>/` | `ASSETS` static export |
| Worker SPA | `https://<domain>/` | `ASSETS` static export |
| Notification pipeline | `NOTIFICATION_QUEUE` → `NOTIFICATION_DLQ` | Queue consumers |
| Scheduled jobs | Cron triggers + `JobScheduler` DO | Worker |

---

## Tech Stack / 기술 스택

| Layer | Technology |
| --- | --- |
| Language | TypeScript (Node.js ≥ 20) |
| API framework | Hono on Cloudflare Workers |
| ORM / DB | Drizzle ORM + D1 (SQLite) |
| Frontend | Next.js 15 (App Router, static export) |
| Styling | Tailwind CSS v4, shared shadcn/ui in `packages/ui` |
| State / data | Zustand (auth), TanStack Query |
| i18n | Custom runtime with `packages/types` translation data |
| Testing | Vitest (unit), Playwright (E2E, 6 projects) |
| Build | Turborepo pipeline (`turbo.json`) |
| Package manager | npm 10.8.2 with workspaces |
| Tooling | Prettier, ESLint, Husky, lint-staged, custom Go scripts |
| Native shell | Android TWA (`apps/worker/android/`) |

---

## Repository Layout / 저장소 구조

```text
.
├── AGENTS.md                 # Project knowledge base
├── ARCHITECTURE.md           # Long-form architecture notes
├── CODE_STYLE.md             # TypeScript / formatting conventions
├── CONTRIBUTING.md           # Contribution workflow
├── LICENSE
├── README.md
├── package.json              # npm workspaces root, Turbo scripts
├── package-lock.json
├── playwright.config.ts      # Playwright projects (auth + flows)
├── turbo.json                # Turborepo pipeline
├── vitest.config.ts
├── wrangler.toml             # Cloudflare Worker config + bindings
└── apps/
    └── worker/               # Worker-facing Next.js 15 PWA (port 3000)
        ├── AGENTS.md
        ├── I18N_IMPLEMENTATION.md
        ├── next.config.mjs
        ├── next-env.d.ts
        ├── package.json
        ├── postcss.config.cjs
        ├── tailwind.config.js
        ├── tsconfig.json
        ├── vitest.config.ts
        ├── android/          # Android TWA shell
        │   ├── build.gradle
        │   ├── gradle.properties
        │   ├── gradlew, gradlew.bat
        │   ├── manifest-checksum.txt
        │   ├── settings.gradle
        │   ├── store_icon.png
        │   ├── twa-manifest.json
        │   ├── app/
        │   └── gradle/wrapper/
        └── src/
            └── app/          # App Router pages
                ├── AGENTS.md
                ├── error.tsx
                ├── globals.css
                ├── layout.tsx
                └── page.tsx
```

Note: The monorepo root declares `workspaces: ["apps/*", "packages/*"]` in `package.json`, and the wider project also contains the `apps/api` Cloudflare Worker (Hono + Drizzle + D1), the `apps/admin` Next.js dashboard, plus `packages/types` (shared DTOs / enums / translation data) and `packages/ui` (shared shadcn/ui + Tailwind v4 theme tokens). See `AGENTS.md` for the full picture.

참고: 루트 `package.json`은 `apps/*`, `packages/*` 워크스페이스를 선언하며, 본 프로젝트에는 `apps/api` Cloudflare Worker(Hono + Drizzle + D1), `apps/admin` Next.js 대시보드, `packages/types`(공유 DTO · 열거형 · 번역 데이터), `packages/ui`(공유 shadcn/ui + Tailwind v4 테마 토큰)가 함께 포함됩니다. 전체 구조는 `AGENTS.md`를 참고하세요.

---

## Quick Start / 빠른 시작

### Prerequisites / 사전 요구 사항

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 20.0.0 | Per `engines.node` in `package.json` |
| npm | 10.8.2 | Matches `packageManager` |
| Wrangler | latest | Required for Cloudflare local dev |
| Go | recent | Used by `scripts/verify.go` and pre-flight tools |

### Install / 설치

```bash
npm install
```

### Develop / 개발 실행

```bash
npm run dev      # Turbo runs all dev targets across workspaces
```

The worker PWA defaults to `http://localhost:3000` and the admin dashboard to `http://localhost:3001` (when present in your workspace).

### Build / 빌드

```bash
npm run build           # turbo build + bundles static assets into ./dist
npm run build:api       # types + api worker only
npm run build:static    # rebuilds ./dist from existing apps/*/out
```

---

## Configuration / 설정

### Cloudflare / Cloudflare 설정

`wrangler.toml` at the repository root is the single source of truth for environment, bindings (`DB`, `FAS_HYPERDRIVE`, `ASSETS`, `R2`, `ACETIME_BUCKET`, `KV`, `NOTIFICATION_QUEUE`, `NOTIFICATION_DLQ`, Durable Objects), and cron triggers. The script `npm run check:wrangler-sync` verifies that bindings stay in sync between `wrangler.toml` and the Worker source.

루트 `wrangler.toml`이 환경, 바인딩, Durable Object, 크론 트리거의 단일 출처입니다. `npm run check:wrangler-sync`는 Worker 소스와 바인딩 정합성을 검사합니다.

### Environment Variables / 환경 변수

| Name | Used by | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | API | Signs and verifies auth tokens |
| `DATABASE_URL` (D1 binding) | API | Primary D1 connection (resolved via Wrangler) |
| `FAS_*` (Hyperdrive) | API | External FAS employee DB credentials |
| R2 / KV / Queue IDs | API | Resolved by Wrangler at deploy time |
| `.env.e2e` | E2E | Secrets loaded via 1Password CLI (`op run`) |

### Static Export Routing / 정적 Export 라우팅

After `npm run build`, the script `build:static` produces:

```
dist/
├── (worker SPA files from apps/worker/out)
└── admin/
    └── (admin SPA files from apps/admin/out)
```

These are uploaded to the `ASSETS` binding; the Worker maps hostnames to directories at request time.

`build:static` 실행 후 `dist/`가 생성되며, Worker가 호스트명에 따라 적절한 디렉터리를 서빙합니다.

### Deployment / 배포

Manual deploys are disabled — production releases are Git-ref driven through CI on the default branch. Use `npm run deploy:api` only as a guard (it intentionally exits with an error and a hint).

수동 배포는 비활성화되어 있으며, 프로덕션 배포는 기본 브랜치의 CI가 Git-ref 기반으로 수행합니다. `npm run deploy:api`는 의도적으로 실패하도록 작성된 가드 스크립트입니다.

---

## Commands Reference / 명령어 레퍼런스

| Command | Description |
| --- | --- |
| `npm run dev` | Run all workspace dev servers via Turbo |
| `npm run build` | Full build + static bundle into `./dist` |
| `npm run build:api` | Build only `packages/types` and `apps/api` |
| `npm run build:static` | Re-pack static assets into `./dist` |
| `npm run build:one-worker` | Alias for `build:api` |
| `npm run lint` | Turbo lint across workspaces |
| `npm run lint:naming` | Naming convention check (`scripts/lint-naming.js`) |
| `npm run typecheck` | TypeScript type checks |
| `npm run test` | Run Vitest suites across workspaces |
| `npm run test:coverage` | Run Vitest with coverage |
| `npm run e2e` | Playwright E2E via 1Password-loaded secrets |
| `npm run e2e:headed` / `e2e:ui` | Headed / UI mode for Playwright |
| `npm run format` | Prettier write across the repo |
| `npm run format:check` | Prettier check (CI-friendly) |
| `npm run db:generate` | Drizzle schema generation in `apps/api` |
| `npm run check:wrangler-sync` | Validate Wrangler binding parity |
| `npm run git:preflight` | Run Go-based pre-flight checks |
| `npm run verify` | Run aggregate Go-based verification |
| `npm run clean` | Turbo clean + remove `node_modules` |

---

## Local Development / 로컬 개발

1. Clone the repo and run `npm install`.
2. Copy or generate local secrets used by `apps/api` and the E2E runner (the E2E harness expects a `.env.e2e` resolved through the 1Password CLI).
3. Start the dev loop with `npm run dev` — Turbo will boot the worker PWA, admin PWA, and API Worker concurrently.
4. For iteration on schema, edit the Drizzle files in `apps/api/src/db` and run `npm run db:generate` to regenerate migrations, then apply locally via Wrangler.
5. Before pushing, run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run check:wrangler-sync`, and `npm run format:check` to match CI expectations.

로컬 개발 절차: 저장소 클론 → `npm install` → E2E용 시크릿 준비(`.env.e2e`는 1Password CLI로 로드) → `npm run dev`로 통합 실행 → Drizzle 스키마 변경 시 `npm run db:generate` → 푸시 전 `lint`, `typecheck`, `test`, `check:wrangler-sync`, `format:check` 통과.

Husky hooks run `scripts/check-anti-patterns.go` and Prettier on staged files (see `lint-staged` in `package.json`).

---

## Testing / 테스트

| Layer | Tool | Location |
| --- | --- | --- |
| Unit / integration | Vitest | Per-workspace `vitest.config.ts` files |
| End-to-end | Playwright | `playwright.config.ts` with 6 projects (auth, admin, worker flows) |
| Naming convention | Node script | `scripts/lint-naming.js` |
| Wrangler parity | Node script | `scripts/check-wrangler-sync.js` |
| Anti-pattern guard | Go script | `scripts/check-anti-patterns.go` |
| Pre-flight / verify | Go scripts | `scripts/git-preflight.go`, `scripts/verify.go` |

Run the full suite locally with `npm run test` for unit tests and `npm run e2e` for Playwright. Coverage is available through `npm run test:coverage`.

전체 테스트는 `npm run test`(단위), `npm run e2e`(Playwright)로 실행하며, 커버리지는 `npm run test:coverage`로 확인합니다.

---

## Android TWA Build / Android TWA 빌드

The Android shell wraps the worker PWA as a Trusted Web Activity for native distribution.

1. Build the worker PWA: `npm run build` (produces `apps/worker/out`).
2. Open `apps/worker/android/` in Android Studio or invoke Gradle directly: `./gradlew :app:assembleRelease`.
3. The TWA reads the SHA-256 checksum recorded in `apps/worker/android/manifest-checksum.txt` to validate the hosted origin via `twa-manifest.json`.
4. Launcher entry point: `me.jclee.safetywallet.twa.LauncherActivity` (delegates to `DelegationService` and `Application` for TWA lifecycle).
5. Static assets: launcher / maskable icons across `mipmap-*`, splash and notification icons under `drawable-*`, plus the bundled `web_app_manifest.json` and `shortcuts.xml`.

Android 셸은 Trusted Web Activity로 작업자 PWA를 네이티브 패키징합니다. `apps/worker/out` 생성 후 `apps/worker/android/`에서 `./gradlew :app:assembleRelease`로 빌드하며, `manifest-checksum.txt`의 SHA-256이 호스팅 출처의 TWA 매니페스트와 일치해야 합니다.

---

## Internationalization / 국제화

The worker PWA ships a custom i18n runtime supporting **ko**, **en**, **vi**, and **zh**. Translation data lives in `packages/types` and is consumed by `apps/worker/src/i18n`. See `apps/worker/I18N_IMPLEMENTATION.md` and `apps/worker/src/app/AGENTS.md` for runtime details.

작업자 PWA는 ko · en · vi · zh를 지원하는 커스텀 i18n 런타임을 포함합니다. 번역 데이터는 `packages/types`에 있으며 `apps/worker/src/i18n`에서 사용됩니다. 자세한 내용은 `apps/worker/I18N_IMPLEMENTATION.md`를 참고하세요.

---

## Contribution Guide / 기여 가이드

- Read `CONTRIBUTING.md`, `CODE_STYLE.md`, and the relevant `AGENTS.md` files before opening a pull request.
- Use feature branches with descriptive names; Husky hooks will run anti-pattern checks and Prettier on staged files.
- Keep the pipeline green: `npm run lint && npm run typecheck && npm run test && npm run check:wrangler-sync && npm run format:check`.
- For schema changes, commit both the Drizzle source and generated migration files.
- Avoid bypassing the disabled manual deploy — CI on the default branch is the only production release path.

기여 전 `CONTRIBUTING.md`, `CODE_STYLE.md`, 관련 `AGENTS.md`를 읽어 주세요. Husky 훅이 staged 파일에 대해 anti-pattern 검사와 Prettier를 실행하며, 파이프라인 전체(`lint`, `typecheck`, `test`, `check:wrangler-sync`, `format:check`)를 통과시켜 주세요. 스키마 변경 시 Drizzle 소스와 생성된 마이그레이션을 함께 커밋하고, 비활성화된 수동 배포 우회 경로는 사용하지 않습니다.

---

## License / 라이선스

See the [`LICENSE`](./LICENSE) file for details.

자세한 내용은 [`LICENSE`](./LICENSE) 파일을 참고하세요.