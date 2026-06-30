# SafetyWallet / 안전지갑

> Mobile-first PWA for construction-site safety reporting, attendance, and safety-point incentive management — deployed end-to-end on the Cloudflare edge.
> 건설 현장의 안전 보고 · 출퇴근 · 안전 포인트 인센티브를 관리하는 모바일 우선 PWA. **Cloudflare** 엣지에 전량 배포됩니다.

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
- [Internationalization / 국제화](#international화)
- [Contribution Guide / 기여 가이드](#contribution-guide--기여-가이드)
- [License / 라이선스](#license--라이선스)

---

## Overview / 개요

**SafetyWallet** is a field-worker safety platform organized as a **Turborepo monorepo** and deployed end-to-end on **Cloudflare**. It targets construction sites where workers need a low-friction, installable mobile experience and site managers need a dashboard to triage safety reports, attendance, and incentive accrual.

**SafetyWallet**은 **Cloudflare** 엣지에 전량 배포되는 **Turborepo 모노레포** 기반 현장 작업자 안전 플랫폼입니다. 작업자가 현장에서 마찰 없이 설치 가능한 모바일 환경을 사용하고, 현장 관리자가 안전 보고 · 출퇴근 · 인센티브 적립을 심사할 수 있도록 설계되었습니다.

The repository is composed of TypeScript workspaces coordinated by Turbo, with a single Cloudflare Worker serving the Hono API and two statically-exported Next.js 15 frontends via hostname routing.

저장소는 Turbo로 조정되는 TypeScript 워크스페이스로 구성되며, 단일 Cloudflare Worker가 Hono API와 정적 익스포트로 빌드된 두 개의 Next.js 15 프런트엔드를 호스트네임 라우팅으로 함께 제공합니다.

### Primary Users / 주요 사용자

| Persona / 페르소나 | Needs / 필요 사항 |
| --- | --- |
| Field worker / 현장 작업자 | Report hazards, log attendance, earn safety points from a phone / 휴대전화에서 위험 보고 · 출퇴근 기록 · 안전 포인트 적립 |
| Site admin / 현장 관리자 | Review reports, settle points, manage attendance / 보고서 심사 · 포인트 정산 · 출퇴근 관리 |
| Super admin / 총괄 관리자 | Cross-site oversight, exports, compliance / 다중 현장 관리 · 데이터 내보내기 · 컴플라이언스 |
| System / 시스템 | Background jobs, integrations (FAS, R2, queues) / 백그라운드 작업 · 외부 연동 |

---

## Key Features / 주요 기능

| Feature / 기능 | Description / 설명 |
| --- | --- |
| Mobile PWA worker app / 모바일 PWA 작업자 앱 | Next.js 15 static export optimized for low-end Android devices on-site / 현장 저사양 Android 기기에 최적화된 Next.js 15 정적 빌드 |
| Admin dashboard / 관리자 대시보드 | Next.js 15 static export for desktop-class review workflows / 데스크톱 환경의 심사 워크플로를 위한 Next.js 15 정적 빌드 |
| Hono API on Cloudflare Workers / Workers 기반 Hono API | Edge-native REST API behind one Worker entry point / 단일 Worker 엔트리 포인트 뒤의 엣지 네이티브 REST API |
| D1 + Drizzle persistence / D1 + Drizzle 영속성 | 34-table SQLite-via-D1 schema managed by Drizzle migrations / Drizzle 마이그레이션으로 관리되는 34개 테이블 |
| Triple-layer auth / 3중 인증 | JWT decode → KST same-day expiry check → KV cache → D1 fallback / JWT 디코드 → KST 자정 기준 만료 검증 → KV 캐시 → D1 폴백 |
| Three-tier RBAC / 3단계 권한 | Role + site membership + per-field flags (`canAwardPoints`, `canReview`, `canExportData`) / 역할 + 현장 멤버십 + 필드 플래그 |
| Attendance & posts / 출퇴근 · 게시글 | Hazard reporting, daily attendance, photo/video evidence via R2 / 위험 보고 · 일일 출퇴근 · R2 기반 증거 자료 |
| Safety-point incentives / 안전 포인트 인센티브 | Award, review, settle workflow with audit trail / 감사 추적이 포함된 적립 · 심사 · 정산 흐름 |
| Scheduled jobs / 스케줄 작업 | Cloudflare Cron Triggers driving background settlements and notifications / 정산 · 알림을 처리하는 Cron Trigger |
| Durable Objects / Durable Objects | `RateLimiter` and `JobScheduler` for rate limiting and queued work / 레이트 리미팅과 큐 작업 |
| R2 media storage / R2 미디어 저장 | User uploads (`R2`) and attendance assets (`ACETIME_BUCKET`) / 사용자 업로드와 출퇴근 자산 분리 |
| Notification pipeline / 알림 파이프라인 | `NOTIFICATION_QUEUE` + `NOTIFICATION_DLQ` delivery with retry / 재시도가 포함된 알림 큐 |
| Internationalization / 국제화 | Custom i18n runtime: `ko`, `en`, `vi`, `zh` / 커스텀 i18n 런타임 |
| Android TWA / Android TWA | Trusted Web Activity wrapper distributing the worker PWA through Play / Play 스토어를 통해 PWA를 배포 |
| E2E testing / E2E 테스트 | Playwright projects covering auth setup, admin, and worker flows / 인증 · 관리자 · 작업자 흐름을 다루는 Playwright 프로젝트 |

---

## Architecture / 아키텍처

The system has three runnable surfaces sharing one Cloudflare Worker as the entry point. Hostname routing inside the Worker dispatches to the right backend.

시스템은 단일 Cloudflare Worker를 엔트리 포인트로 공유하는 세 개의 실행 표면을 가집니다. Worker 내부의 호스트네임 라우팅이 각 백엔드로 디스패치합니다.

### Request Flow / 요청 흐름

1. DNS resolves a request to the Cloudflare edge. / DNS가 요청을 Cloudflare 엣지로 해석합니다.
2. The Worker matches the hostname (`worker.*`, `admin.*`, or API host) and routes to the matching handler. / Worker가 호스트네임을 매칭해 적절한 핸들러로 라우팅합니다.
3. API paths go through Hono with CORS, logging, analytics, and security-headers middleware. / API 경로는 CORS · 로깅 · 분석 · 보안 헤더 미들웨어를 거치는 Hono로 전달됩니다.
4. Hono handlers resolve auth via the triple-layer validation and consult Drizzle/D1. / Hono 핸들러는 3중 인증을 거친 뒤 Drizzle/D1을 조회합니다.
5. Static frontends are served from Workers Static Assets (`ASSETS`) bound to the same Worker. / 정적 프런트엔드는 동일 Worker에 바인딩된 `ASSETS`에서 제공됩니다.
6. Background Cron Triggers invoke scheduled jobs; heavy work runs inside Durable Objects. / Cron Trigger가 스케줄 작업을 실행하며, 무거운 작업은 Durable Object에서 처리됩니다.

### Runtime Surfaces / 런타임 표면

| Surface / 표면 | Runtime / 런타임 | Port (dev) / 개발 포트 | Build / 빌드 | Hostname / 호스트네임 |
| --- | --- | --- | --- | --- |
| Worker PWA / 작업자 PWA | Next.js 15 (static export) | `3000` | `next build` → `apps/worker/out/` | `worker.*` |
| Admin dashboard / 관리자 대시보드 | Next.js 15 (static export) | `3001` | `next build` → `apps/admin/out/` | `admin.*` |
| API / API | Cloudflare Worker (Hono) | `8787` (Wrangler) | `wrangler deploy` | API host / API 호스트 |

### Cloudflare Bindings / Cloudflare 바인딩

| Binding / 바인딩 | Type / 타입 | Purpose / 용도 |
| --- | --- | --- |
| `DB` | D1 | Primary database / 주 데이터베이스 |
| `FAS_HYPERDRIVE` | Hyperdrive | External FAS employee database / 외부 FAS 직원 DB |
| `ASSETS` | Workers Static Assets | Static frontend files (worker + admin SPAs) / 정적 프런트엔드 파일 |
| `R2` | R2 | User-uploaded images and videos / 사용자 업로드 |
| `ACETIME_BUCKET` | R2 | Attendance-related assets / 출퇴근 자산 |
| `KV` | KV | Auth cache, system status, config / 인증 캐시 · 시스템 상태 · 설정 |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | Queue | Notification delivery pipeline / 알림 파이프라인 |
| `RATE_LIMITER` / `JOB_SCHEDULER` | Durable Objects | Rate limiting, queued work / 레이트 리미팅 · 큐 작업 |

### Workspace Pipeline / 워크스페이스 파이프라인

Turborepo orders the workspace build as `packages/types` → `packages/ui` → `apps/*`. Shared types and UI tokens are compiled first, then each app consumes them.

Turborepo는 워크스페이스 빌드를 `packages/types` → `packages/ui` → `apps/*` 순서로 정렬합니다. 공유 타입과 UI 토큰을 먼저 컴파일한 뒤 각 앱이 이를 소비합니다.

---

## Tech Stack / 기술 스택

| Layer / 계층 | Technology / 기술 |
| --- | --- |
| Language / 언어 | TypeScript |
| Runtime / 런타임 | Node.js ≥ 20, Cloudflare Workers |
| API framework / API 프레임워크 | Hono |
| Database / 데이터베이스 | D1 (SQLite), Drizzle ORM |
| Frontend / 프런트엔드 | Next.js 15 (App Router, static export) |
| Styling / 스타일링 | Tailwind CSS |
| UI components / UI 컴포넌트 | shadcn/ui (shared in `packages/ui`) |
| State / 상태 관리 | Zustand (persisted auth store) |
| Validation / 유효성 검증 | Zod |
| Monorepo / 모노레포 | Turborepo, npm workspaces |
| E2E / E2E | Playwright (6 projects) |
| Unit / 단위 테스트 | Vitest |
| Edge deployment / 엣지 배포 | Wrangler, Cloudflare |
| Mobile wrapper / 모바일 래퍼 | Android TWA |
| Tooling scripts / 도구 스크립트 | Go, Node |

---

## Repository Layout / 저장소 구조

```text
.
├── apps/
│   ├── api/                  # Cloudflare Worker API (Hono + Drizzle + D1)
│   ├── admin/                # Next.js 15 admin dashboard (static export)
│   └── worker/               # Next.js 15 worker PWA (static export)
│       ├── src/app/          # App Router pages (login, posts, attendance, education)
│       ├── src/i18n/         # Custom i18n runtime
│       ├── src/components/   # Worker-specific UI components
│       └── android/          # Trusted Web Activity project (Gradle, manifests, icons)
├── packages/
│   ├── types/                # Shared TypeScript types, enums, DTOs, i18n data
│   └── ui/                   # Shared shadcn/ui + Tailwind theme tokens
├── docs/                     # PRD, requirement specs, ops runbooks
├── scripts/                  # Go/Node tooling (verify, naming lint, anti-pattern checks)
├── e2e/                      # Playwright end-to-end tests
├── .github/workflows/        # CI/CD pipelines
├── wrangler.toml             # Root Cloudflare Worker config and bindings
├── turbo.json                # Turborepo pipeline definition
├── playwright.config.ts      # Playwright multi-project configuration
├── vitest.config.ts          # Vitest configuration
├── package.json              # Workspace root and shared scripts
├── ARCHITECTURE.md           # Detailed architecture notes
├── AGENTS.md                 # AI assistant knowledge base
├── CODE_STYLE.md             # Coding conventions
├── CONTRIBUTING.md           # Contribution workflow
└── LICENSE                   # Project license
```

---

## Quick Start / 빠른 시작

### Prerequisites / 사전 요구 사항

- **Node.js** ≥ 20.0.0
- **npm** 10.8.2 (pinned via `packageManager`)
- **Wrangler** for Cloudflare local emulation (`npx wrangler`)
- **Go** (optional, only required for `scripts/*.go` tooling)
- **1Password CLI** (`op`) — required only for E2E tests against staging secrets
- **Android Studio / Gradle** (optional, only for the TWA build)

### Install / 설치

```bash
npm install
```

### Run the full stack locally / 전체 스택 로컬 실행

```bash
npm run dev
```

This starts all workspaces through Turbo. By default:

- Worker PWA → `http://localhost:3000`
- Admin dashboard → `http://localhost:3001`
- API → `http://localhost:8787` (Wrangler local)

### Build for production / 프로덕션 빌드

```bash
npm run build            # All workspaces, then assemble the static bundle in dist/
npm run build:api        # types + API only
npm run build:static     # Re-assemble apps/worker/out and apps/admin/out into dist/
```

The final static bundle lives in `dist/` (worker SPA at the root, admin SPA under `dist/admin/`).

최종 정적 번들은 `dist/`에 위치하며, 작업자 SPA는 루트, 관리자 SPA는 `dist/admin/` 아래에 있습니다.

---

## Configuration / 설정

| Source / 출처 | Scope / 범위 | Notes / 설명 |
| --- | --- | --- |
| `wrangler.toml` (root) | Worker + bindings | Defines `DB`, `KV`, `R2`, `ACETIME_BUCKET`, queues, Durable Objects, hostname routes / Cloudflare 리소스 정의 |
| `apps/*/.env.local` | Per-app secrets | Conventional Next.js env files; never commit / Next.js 관습 env 파일, 커밋 금지 |
| `.env.e2e` | Playwright runs only | Injected through `op run --env-file=.env.e2e` / `op run --env-file=.env.e2e`로 주입 |
| `apps/worker/android/twa-manifest.json` | TWA build | Digital asset links, package id, target URL / 디지털 자산 링크 · 패키지 ID · 대상 URL |
| `apps/api/src/db/*` | Database | Drizzle schema and migration source of truth / Drizzle 스키마와 마이그레이션 원본 |
| `package.json` (`overrides`) | Workspace | Pins `react`, `react-dom`, `eslint`, `serialize-javascript` / 워크스페이스 공통 핀 |
| `package.json` (`engines`) | Toolchain | Requires Node ≥ 20 / Node ≥ 20 요구 |

> Manual `wrangler deploy` is disabled. Deployments are Git-ref driven via CI on `master`.
> 수동 `wrangler deploy`는 비활성화되어 있습니다. 배포는 `master` 브랜치의 Git 참조 기반 CI로 진행됩니다.

---

## Commands Reference / 명령어 레퍼런스

All commands run from the repository root unless otherwise noted.

별도 표기가 없는 한 모든 명령어는 저장소 루트에서 실행합니다.

| Command / 명령어 | Purpose / 용도 |
| --- | --- |
| `npm run dev` | Run all workspaces in dev mode via Turbo / Turbo로 전체 워크스페이스 개발 모드 실행 |
| `npm run build` | Build everything and assemble `dist/` / 전체 빌드 후 `dist/` 조립 |
| `npm run build:api` | Build `packages/types` + `apps/api` only / 타입 패키지와 API만 빌드 |
| `npm run build:static` | Rebuild `dist/` from existing `out/` folders / 기존 `out/` 폴더로 `dist/` 재조립 |
| `npm run build:one-worker` | Alias for `build:api` / `build:api` 별칭 |
| `npm run lint` | Lint all workspaces / 전체 워크스페이스 린트 |
| `npm run lint:naming` | Run naming lint script (`scripts/lint-naming.js`) / 명명 규칙 린트 |
| `npm run typecheck` | TypeScript check across workspaces / 워크스페이스 타입 검사 |
| `npm run test` | Run Vitest in every workspace / 워크스페이스별 Vitest 실행 |
| `npm run test:coverage` | Run Vitest with coverage output / 커버리지 포함 Vitest 실행 |
| `npm run e2e` | Run Playwright E2E with `op` env injection / `op` 환경 변수 주입 후 Playwright 실행 |
| `npm run e2e:headed` | Playwright in headed mode / 헤디드 모드 Playwright |
| `npm run e2e:ui` | Playwright UI mode / Playwright UI 모드 |
| `npm run db:generate` | Generate Drizzle artifacts in `apps/api` / `apps/api`에서 Drizzle 산출물 생성 |
| `npm run check:wrangler-sync` | Verify `wrangler.toml` ↔ bindings consistency / `wrangler.toml` 바인딩 일관성 검증 |
| `npm run git:preflight` | Pre-commit Go check / 커밋 전 Go 검사 |
| `npm run verify` | Project-wide verification script / 프로젝트 전수 검증 |
| `npm run format` / `format:check` | Prettier write / check / Prettier 쓰기 · 검사 |
| `npm run clean` | Tear down build outputs and `node_modules` / 빌드 산출물과 `node_modules` 정리 |
| `npm run deploy:api` | Intentionally fails with a clear message (CI-driven deploys only) / 의도적으로 실패하며 안내 메시지 출력 (CI 전용) |

---

## Local Development / 로컬 개발

### Recommended workflow / 권장 워크플로

1. `npm install` after pulling the latest changes. / 최신 변경 사항을 받은 뒤 `npm install`을 실행합니다.
2. `npm run dev` for full-stack iteration. / 전체 스택 반복 개발에는 `npm run dev`를 사용합니다.
3. For API-only changes, run `wrangler dev` inside `apps/api` to leverage D1 local emulation. / API만 변경하는 경우 `apps/api` 내부에서 `wrangler dev`를 사용해 D1 로컬 에뮬레이션을 활용합니다.
4. Before pushing, run `npm run lint && npm run typecheck && npm run test`. / 푸시 전 `npm run lint && npm run typecheck && npm run test`를 실행합니다.
5. Use `npm run check:wrangler-sync` whenever bindings change. / 바인딩 변경 시 `npm run check:wrangler-sync`를 실행합니다.

### Working with shared packages / 공유 패키지 작업

- `packages/types` exports enums, DTOs, and i18n translation data consumed by both frontends and the API. / `packages/types`는 양쪽 프런트엔드와 API가 소비하는 enum · DTO · i18n 데이터를 내보냅니다.
- `packages/ui` provides shadcn/ui components and Tailwind theme tokens. / `packages/ui`는 shadcn/ui 컴포넌트와 Tailwind 테마 토큰을 제공합니다.
- Turbo resolves workspace dependencies automatically; no manual `npm link` is required. / Turbo가 워크스페이스 의존성을 자동 해석하므로 수동 `npm link`는 필요 없습니다.

### Auth stores / 인증 저장소

| App / 앱 | Persisted key / 영속 키 |
| --- | --- |
| Worker / 작업자 | `safetywallet-auth` |
| Admin / 관리자 | `safetywallet-admin-auth` |

Both are Zustand-backed. A 401 response triggers a refresh through a mutex to avoid stampedes.

두 저장소 모두 Zustand 기반이며, 401 응답 시 경합을 피하기 위해 뮤텍스를 통해 재발급을 트리거합니다.

---

## Testing / 테스트

| Layer / 계층 | Tool / 도구 | Where / 위치 |
| --- | --- | --- |
| Unit / integration / 단위 · 통합 | Vitest | Each workspace's `*.test.ts` / 각 워크스페이스의 `*.test.ts` |
| Coverage / 커버리지 | Vitest (`--coverage`) | Run via `npm run test:coverage` / `npm run test:coverage`로 실행 |
| End-to-end / E2E | Playwright | `e2e/` directory, configured in `playwright.config.ts` / `e2e/` 디렉터리, `playwright.config.ts` 구성 |
| Naming / 명명 | `scripts/lint-naming.js` | `npm run lint:naming` |
| Anti-pattern / 안티 패턴 | `scripts/check-anti-patterns.go` | Pre-commit hook / 커밋 전 훅 |
| Wrangler sync / Wrangler 동기화 | `scripts/check-wrangler-sync.js` | `npm run check:wrangler-sync` |

E2E tests require secrets provisioned through 1Password. Use `npm run e2e` (or the headed/UI variants) so `op run --env-file=.env.e2e` resolves all required values before Playwright starts.

E2E 테스트는 1Password로 비밀값을 주입해야 합니다. `op run --env-file=.env.e2e`가 모든 비밀값을 해석하도록 `npm run e2e` (또는 헤디드/UI 변형)을 사용하세요.

---

## Android TWA Build / Android TWA 빌드

The worker PWA is wrapped in a Trusted Web Activity so it can ship through the Play Store while behaving like a native app. The wrapper lives in `apps/worker/android/`.

작업자 PWA는 Trusted Web Activity로 래핑되어 Play 스토어를 통해 배포되며 네이티브 앱처럼 동작합니다. 래퍼는 `apps/worker/android/`에 있습니다.

| Asset / 자산 | Path / 경로 |
| --- | --- |
| TWA manifest / TWA 매니페스트 | `apps/worker/android/twa-manifest.json` |
| App entry / 앱 진입점 | `apps/worker/android/app/src/main/java/me/jclee/safetywallet/twa/LauncherActivity.java` |
| Delegation service / 위임 서비스 | `apps/worker/android/app/src/main/java/me/jclee/safetywallet/twa/DelegationService.java` |
| Gradle wrapper / Gradle 래퍼 | `apps/worker/android/gradlew`, `gradlew.bat` |
| Resource bundle / 리소스 묶음 | `apps/worker/android/app/src/main/res/` (mipmap, drawable, xml, raw) |
| Web manifest raw / 웹 매니페스트 원본 | `apps/worker/android/app/src/main/res/raw/web_app_manifest.json` |
| Manifest checksum / 매니페스트 체크섬 | `apps/worker/android/manifest-checksum.txt` |

Refer to `apps/worker/I18N_IMPLEMENTATION.md` for app-side notes that affect TWA defaults (e.g. launch locale, splash text).

런치 로케일 · 스플래시 텍스트 등 TWA 기본값에 영향을 주는 앱 측 메모는 `apps/worker/I18N_IMPLEMENTATION.md`를 참고하세요.

---

## Internationalization / 국제화

| Item / 항목 | Detail / 상세 |
| --- | --- |
| Runtime / 런타임 | Custom i18n runtime in `apps/worker/src/i18n/` / `apps/worker/src/i18n/`의 커스텀 런타임 |
| Supported locales / 지원 로케일 | `ko`, `en`, `vi`, `zh` |
| Translation source / 번역 출처 | `packages/types` exports the canonical translation data / `packages/types`가 정식 번역 데이터를 내보냄 |
| Reference / 참조 | `apps/worker/I18N_IMPLEMENTATION.md` |

When adding a new locale, update both the i18n registry and the translation payload, then verify that `npm run lint` and `npm run typecheck` pass.

새 로케일을 추가할 때는 i18n 레지스트리와 번역 페이로드 양쪽을 모두 갱신하고, `npm run lint`와 `npm run typecheck`가 통과하는지 확인하세요.

---

## Contribution Guide / 기여 가이드

1. Read `CODE_STYLE.md` for naming, formatting, and TypeScript conventions. / 명명 · 포맷팅 · TypeScript 규칙은 `CODE_STYLE.md`를 참고하세요.
2. Read `ARCHITECTURE.md` for module boundaries and request flow. / 모듈 경계와 요청 흐름은 `ARCHITECTURE.md`를 참고하세요.
3. Create a feature branch. Conventional commits are encouraged. / 기능 브랜치를 생성하고 conventional commit을 권장합니다.
4. Keep changes scoped to a single workspace where possible; cross-workspace changes must update both consumers. / 가급적 단일 워크스페이스에 변경을 한정하고, 여러 워크스페이스를 건드릴 때는 모든 소비자를 함께 갱신합니다.
5. Before pushing: / 푸시 전:
   ```bash
   npm run lint && npm run typecheck && npm run test
   ```
6. Husky-managed pre-commit hooks run `scripts/check-anti-patterns.go` and Prettier on staged files. / Husky 기반 커밋 전 훅이 스테이지된 파일에 대해 `scripts/check-anti-patterns.go`와 Prettier를 실행합니다.
7. Open a pull request describing the change, the impacted workspaces, and any required migrations. / 변경 내용 · 영향받은 워크스페이스 · 필요한 마이그레이션을 PR에 명시하세요.

---

## License / 라이선스

See the [`LICENSE`](./LICENSE) file at the repository root for license terms.

라이선스 조건은 저장소 루트의 [`LICENSE`](./LICENSE) 파일을 참고하세요.