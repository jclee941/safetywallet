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
- [Testing / 테스트](#testing--testing)
- [Android TWA Build / Android TWA 빌드](#android-twa-build--android-twa-빌드)
- [Internationalization / 국제화](#internationalization--국제화)
- [Contribution Guide / 기여 가이드](#contribution-guide--기여-가이드)
- [License / 라이선스](#license--라이선스)

---

## Overview / 개요

**SafetyWallet** is a field-worker safety platform organized as a **Turborepo monorepo** and deployed end-to-end on **Cloudflare**. It targets construction sites where workers need a low-friction, installable mobile experience and site managers need a dashboard to triage safety reports, attendance, and incentive accrual.

**SafetyWallet**은 **Cloudflare** 엣지에 전량 배포되는 **Turborepo 모노레포** 기반 현장 작업자 안전 플랫폼입니다. 작업자가 현장에서 마찰 없이 설치 가능한 모바일 환경을 사용하고, 현장 관리자가 안전 보고 · 출퇴근 · 인센티브 적립을 심사할 수 있도록 설계되었습니다.

A single Cloudflare Worker serves the **Hono** API and two statically-exported **Next.js 15** frontends (worker PWA + admin dashboard) via hostname routing on the edge.

---

## Key Features / 주요 기능

| Feature / 기능 | Description / 설명 |
|---|---|
| Mobile-first PWA / 모바일 우선 PWA | Installable worker app with offline-friendly flows / 설치 가능한 작업자 앱, 오프라인 친화적 흐름 |
| Safety reporting / 안전 신고 | Hazard posts with approvals, votes, and reviews / 위험 게시글, 승인 · 투표 · 심사 |
| Attendance / 출퇴근 | Check-in / check-out with face-verification, scheduled jobs for late/missed punches / 얼굴 인증 출퇴근, 지각/미체크 자동화 잡 |
| Safety Points / 안전 포인트 | Earning, accrual, lifetime cap, and per-site limits / 적립, 누적, 상한, 현장별 한도 |
| Admin Dashboard / 관리자 대시보드 | Reviews, settlements, education content, exports via Next.js / 심사 · 정산 · 교육 콘텐츠 · 데이터 내보내기 |
| Edge-native auth / 엣지 네이티브 인증 | JWT + KST-day expiry, KV cache, D1 fallback, layered validation / JWT · KST 자정 만료 · KV 캐시 · D1 폴백 |
| Scheduled jobs / 스케줄링 잡 | Cron-driven notifications, attendance reconciliation, settlements / 알림 · 출퇴근 대조 · 정산 잡 |
| Static export / 정적 내보내기 | Both worker and admin built as static assets, hosted by Worker `ASSETS` binding |
| Android TWA / Android TWA | Trusted Web Activity wrapper for Play Store distribution / 플레이스토어 배포용 TWA 래퍼 |
| i18n / 국제화 | Korean (default), English, Vietnamese, Chinese — runtime switching / 한·영·베·중 런타임 전환 |

---

## Architecture / 아키텍처

The platform is a **monorepo** coordinated by **Turborepo**, sharing a single Cloudflare Worker that multiplexes a JSON API and two static SPAs via hostname-based routing.

**Request flow**

1. Worker receives a request at the edge (Cloudflare global network).
2. Hostname router dispatches to either the **API router** (Hono, JSON) or the **static asset** binding (`ASSETS` for worker PWA / admin dashboard).
3. API requests pass through middleware (`CORS`, logging, security headers, analytics), then `auth` (JWT decode → KST day check → KV lookup → D1 fallback).
4. Route handlers validate input (Zod), call Drizzle-bound D1, optionally read R2 / Hyperdrive / KV.
5. Long-running or fan-out workloads are enqueued via `NOTIFICATION_QUEUE` (DLQ: `NOTIFICATION_DLQ`); rate-limit state lives in the `RATE_LIMITER` Durable Object.

### Cloudflare Bindings / Cloudflare 바인딩

| Binding | Type | Purpose |
|---|---|---|
| `DB` | D1 | Primary database (Drizzle / SQLite) |
| `FAS_HYPERDRIVE` | Hyperdrive | External FAS employee database access |
| `ASSETS` | Workers Static Assets | Worker PWA + admin dashboard static files |
| `R2` | R2 | User-uploaded images and videos |
| `ACETIME_BUCKET` | R2 | Attendance-related media assets |
| `KV` | KV | Auth cache, system status, runtime config |
| `NOTIFICATION_QUEUE` | Queue | Notification delivery producer |
| `NOTIFICATION_DLQ` | Queue | Notification dead-letter queue |
| `RATE_LIMITER` | Durable Object | Edge rate-limiting state |

### Apps / 앱

| App | Purpose | Dev Port | Build |
|---|---|---|---|
| `apps/api` | Hono + Drizzle + D1 API Worker | — | `wrangler deploy` (CI-driven) |
| `apps/worker` | Worker PWA (Next.js 15 App Router) | `3000` | Static export (`out/`) |
| `apps/admin` | Admin dashboard (Next.js 15 App Router) | `3001` | Static export (`out/`) |
| `apps/worker/android` | Android TWA wrapper for the worker PWA | — | `gradle` (Bubblewrap/`twa-manifest.json`) |

### Permissions / 권한

Roles are layered: role → site membership → field-level flags.

| Role | Typical scope / 일반 권한 범위 |
|---|---|
| `WORKER` | Reporting, attendance, points, education / 신고 · 출퇴근 · 포인트 · 교육 |
| `SITE_ADMIN` | Site-level review, attendance approval, content moderation / 현장 심사 · 출퇴근 승인 · 콘텐츠 관리 |
| `SUPER_ADMIN` | Cross-site operations, user management / 현장 간 운영 · 사용자 관리 |
| `SYSTEM` | Internal service identity / 내부 서비스 신원 |

Field-level flags (examples): `canAwardPoints`, `canReview`, `canExportData`.

---

## Tech Stack / 기술 스택

| Layer / 계층 | Technology / 기술 |
|---|---|
| Language / 언어 | TypeScript |
| API framework / API 프레임워크 | Hono |
| ORM / ORM | Drizzle |
| Frontend / 프런트엔드 | Next.js 15 (App Router), statically exported |
| UI / UI | shadcn/ui + Tailwind v4 theme tokens (`packages/ui`) |
| Edge runtime / 엣지 런타임 | Cloudflare Workers |
| Database / DB | Cloudflare D1 (SQLite-compatible) |
| Storage / 저장소 | Cloudflare R2 |
| Cache / 캐시 | Cloudflare KV |
| Queues / 큐 | Cloudflare Queues (`NOTIFICATION_QUEUE`, `NOTIFICATION_DLQ`) |
| Coordination / 모노레포 | Turborepo |
| E2E testing / E2E 테스트 | Playwright |
| Unit testing / 단위 테스트 | Vitest |
| Android / Android | Bubblewrap TWA |
| Lint hooks / 린트 훅 | Husky + lint-staged (Prettier + Go anti-pattern checks) |

---

## Repository Layout / 저장소 구조

Top-level files and directories present in this repository:

```
.
├── AGENTS.md
├── ARCHITECTURE.md
├── CODE_STYLE.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── package.json
├── package-lock.json
├── playwright.config.ts
├── turbo.json
├── vitest.config.ts
├── wrangler.toml
└── apps/
    └── worker/
        ├── AGENTS.md
        ├── I18N_IMPLEMENTATION.md
        ├── next-env.d.ts
        ├── next.config.mjs
        ├── package.json
        ├── postcss.config.cjs
        ├── tailwind.config.js
        ├── tsconfig.json
        ├── vitest.config.ts
        ├── android/              # Bubblewrap TWA (twa-manifest.json + gradle)
        └── src/
            └── app/
                ├── AGENTS.md
                ├── error.tsx
                ├── globals.css
                ├── layout.tsx
                └── page.tsx
```

Other workspaces (`apps/api`, `apps/admin`) and shared packages (`packages/types`, `packages/ui`), as well as `docs/`, `scripts/`, `e2e/`, and CI workflows, are declared in `package.json` workspaces and `turbo.json` and are pulled in by the scripts above.

---

## Quick Start / 빠른 시작

### Prerequisites / 사전 요구사항

- **Node.js** `>= 20.0.0`
- **npm** `10.8.2` (declared as `packageManager` in `package.json`)
- **Wrangler** for local Cloudflare emulation: `npx wrangler --version`
- Optional for TWA: JDK 17 + Android SDK
- Optional for end-to-end tests: `op` (1Password CLI) for `.env.e2e`

### One-command dev / 한 줄로 개발 시작

```bash
npm install
npm run dev
```

`npm run dev` starts all workspaces via Turbo. The worker PWA serves on `http://localhost:3000`, the admin dashboard on `http://localhost:3001`, and the API runs on the Cloudflare Worker local simulator (Wrangler dev).

### First-time build check / 첫 빌드 확인

```bash
npm run build           # Full build (types → ui → apps, then static copy into dist/)
npm run typecheck       # Cross-workspace type checks
npm run lint            # Lint all workspaces
```

---

## Configuration / 설정

### Cloudflare Worker (`wrangler.toml`)

The root `wrangler.toml` defines the Worker name, compatibility date/flags, route mapping, and all bindings listed in the **Cloudflare Bindings** table. Changes to bindings should be kept in sync with the type definitions consumed by `apps/api` (see `npm run check:wrangler-sync`).

### Frontend env (per app)

Each app reads environment-specific constants at build time. Provide the appropriate `.env.local` for the app you run; never commit secrets. Use `op` (1Password CLI) for E2E secrets (see `npm run e2e`).

### Wrangler sync check / Wrangler 동기화 검사

```bash
npm run check:wrangler-sync
```

Fails the check if `wrangler.toml` drifts from the typed bindings consumed by the API app.

---

## Commands Reference / 명령어 레퍼런스

| Command | Description / 설명 |
|---|---|
| `npm run dev` | Run all workspaces in dev mode via Turbo / Turbo로 전체 워크스페이스 개발 모드 실행 |
| `npm run build` | Build all workspaces + copy static output into `dist/` / 전체 빌드 + 정적 결과물 `dist/` 복사 |
| `npm run build:api` | Build `packages/types` and `apps/api` only / types + API만 빌드 |
| `npm run build:static` | Copy `apps/worker/out/*` and `apps/admin/out/*` into `dist/admin/` |
| `npm run build:one-worker` | Alias for `build:api` / `build:api`의 단축형 |
| `npm run deploy:api` | **Refuses** local manual deploy — deploys are git-ref driven via CI on `master` / 로컬 수동 배포는 거부됩니다. 배포는 CI가 `master` Git ref 기반으로 수행합니다. |
| `npm run lint` | Lint all workspaces / 전체 워크스페이스 린트 |
| `npm run lint:naming` | Run naming-convention lint (`scripts/lint-naming.js`) / 명명 규칙 린트 |
| `npm run typecheck` | Cross-workspace type checks / 전체 타입 체크 |
| `npm run check:wrangler-sync` | Verify `wrangler.toml` ↔ typed bindings / 바인딩 일치 검사 |
| `npm run git:preflight` | Pre-commit Go checks (`scripts/git-preflight.go`) / 커밋 전 Go 검사 |
| `npm run verify` | Aggregate verification (`scripts/verify.go`) / 통합 검증 |
| `npm run format` | Prettier write across TS/JS/JSON/MD |
| `npm run format:check` | Prettier check (CI-friendly) |
| `npm run test` | Run Vitest in all workspaces / 워크스페이스 전체 Vitest |
| `npm run test:coverage` | Run tests with coverage / 커버리지 포함 |
| `npm run e2e` | Playwright E2E (env loaded via `op`) / Playwright E2E (`op`로 환경 로드) |
| `npm run e2e:headed` | Playwright with headed browsers / 헤디드 브라우저 E2E |
| `npm run e2e:ui` | Playwright UI mode / UI 모드 E2E |
| `npm run db:generate` | Run Drizzle codegen in `apps/api` / Drizzle 스키마 코드 생성 |
| `npm run clean` | Clean all workspaces + remove `node_modules` / 클린 + 의존성 제거 |

---

## Local Development / 로컬 개발

### Auth & permissions / 인증과 권한

- Login issues a JWT with **KST same-day midnight** expiry, stored in a Zustand client store.
- Three validation layers run per protected request:
  1. JWT decode + signature verification
  2. KST-day expiry check (re-issued at midnight KST)
  3. KV cache lookup, with D1 fallback if KV misses
- Three-tier authorization: **role** (`WORKER` / `SITE_ADMIN` / `SUPER_ADMIN` / `SYSTEM`) → site membership → field-level flags (`canAwardPoints`, `canReview`, `canExportData`).
- Client auth store keys: `safetywallet-auth` (worker) / `safetywallet-admin-auth` (admin). A 401 refresh mutex prevents stampedes.

### Code style / 코드 스타일

- `CODE_STYLE.md` is the source of truth for formatting and naming.
- `npm run lint:naming` enforces naming conventions.
- Pre-commit hooks (`husky` + `lint-staged`) run anti-pattern checks and Prettier on staged files.

### Adding a workspace / 워크스페이스 추가

1. Create the new package under `apps/<name>` or `packages/<name>` (matches `workspaces` glob in `package.json`).
2. Add a `package.json` that names the workspace and declares its `scripts`.
3. Add the workspace to `turbo.json` if it needs to participate in the pipeline.

---

## Testing / 테스트

### Unit / 단위 테스트

```bash
npm run test                # Run via Turbo
npm run test --workspace=apps/api
npm run test:coverage       # Vitest coverage
```

### E2E / E2E 테스트

End-to-end tests live under `e2e/` and are driven by Playwright (see `playwright.config.ts` for the project matrix).

```bash
op run --env-file=.env.e2e -- npx playwright test
npm run e2e            # same
npm run e2e:headed
npm run e2e:ui
```

> E2E runs require `op` (1Password CLI) to inject secrets from `.env.e2e`.

### CI pipeline order / CI 파이프라인 순서

`lint → typecheck → naming/anti-pattern/anti-pattern guards → test → build → migrate`.

---

## Android TWA Build / Android TWA 빌드

The worker PWA is also distributed as a **Trusted Web Activity** wrapper so it can be published to the Play Store while reusing the same web bundle.

```bash
cd apps/worker/android
./gradlew assembleRelease
```

Key files:

- `apps/worker/android/twa-manifest.json` — Bubblewrap manifest (target URL, theme color, icon, etc.).
- `apps/worker/android/app/build.gradle` — Android module build.
- `apps/worker/android/app/src/main/java/me/jclee/safetywallet/twa/` — `Application`, `LauncherActivity`, `DelegationService`.
- `apps/worker/android/app/src/main/AndroidManifest.xml` — App manifest.
- `apps/worker/android/app/src/main/res/raw/web_app_manifest.json` — Embedded web app manifest.

Outputs land under `apps/worker/android/app/build/outputs/apk/`. The TWA reuses the same static export as the PWA.

---

## Internationalization / 국제화

The worker PWA uses a **custom runtime i18n** system supporting Korean (default), English, Vietnamese, and Chinese.

- Source of truth: `apps/worker/src/i18n/` (runtime, dictionaries).
- Shared translation types and data live in `packages/types`.
- Translation data is consumed at runtime — no rebuild required to flip languages.
- Implementation notes: `apps/worker/I18N_IMPLEMENTATION.md`.

To add a locale:

1. Add the locale code to the i18n config in `apps/worker/src/i18n/`.
2. Provide a dictionary (and types in `packages/types` if shared).
3. Verify translations in the worker PWA and admin dashboard.

---

## Contribution Guide / 기여 가이드

1. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`CODE_STYLE.md`](./CODE_STYLE.md), and [`ARCHITECTURE.md`](./ARCHITECTURE.md).
2. Check existing `AGENTS.md` files for area-specific guidance (each app and the route surface has its own).
3. Branch from `master`, keep changes scoped, and write tests for new behavior.
4. Run before pushing:
   ```bash
   npm run lint
   npm run typecheck
   npm run lint:naming
   npm run check:wrangler-sync
   npm run test
   npm run verify
   ```
5. Open a PR — CI must pass the gates described in **Local Development**. Deploys are **git-ref driven via CI on `master`**, never manual.

Code conventions:

- Naming: enforced via `npm run lint:naming`.
- Anti-patterns: enforced by `scripts/check-anti-patterns.go` on staged files.
- Formatting: Prettier (`npm run format`).

---

## License / 라이선스

See [`LICENSE`](./LICENSE).