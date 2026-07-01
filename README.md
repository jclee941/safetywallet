# SafetyWallet / 안전지갑

> 모바일 우선 PWA 기반 건설 현장 안전 보고 · 출퇴근 · 안전 포인트 인센티브 플랫폼.
> Cloudflare 엣지에 API, 관리자 콘솔, 작업자 PWA가 전량 배포됩니다.
> Mobile-first PWA for construction-site safety reporting, attendance, and safety-point incentive management — deployed end-to-end on the Cloudflare edge.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Hono%20%7C%20Drizzle%20%7C%20Next.js%2015%20%7C%20Cloudflare%20Workers-blue)
![Node](https://img.shields.io/badge/node-%E2%89%A520.0.0-green)
![Package Manager](https://img.shields.io/badge/npm-10.8.2-CB3837)
![Turborepo](https://img.shields.io/badge/turborepo-monorepo-FF1E56)

---

## 한눈에 보기 / At a Glance

건설 현장 작업자가 모바일로 위험 요인을 보고하고 출퇴근을 기록하며 안전 포인트를 적립하고, 현장 관리자는 별도 대시보드에서 심사 · 정산 · 컴플라이언스를 처리합니다. 단일 Cloudflare Worker가 Hono API와 두 개의 정적 export된 Next.js 프런트엔드를 호스트 이름 라우팅으로 동시에 제공합니다.

| 항목 / Item            | 값 / Value                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| 배포 모델 / Deployment | Cloudflare Workers + Workers Static Assets                              |
| 저장소 / Storage       | D1 (주 DB), R2 (미디어), KV (캐시 · 설정), Hyperdrive (외부 FAS)        |
| 인증 / Auth            | JWT (KST 자정 만료) + KV 캐시 + 3단계 권한                              |
| 패키지 매니저 / PM     | npm 10.8.2 (워크스페이스)                                               |
| 빌드 오케스트레이션    | Turborepo (`types → ui → apps`)                                         |
| CI/CD                  | GitHub Actions (lint → typecheck → guard → test → build → migrate)      |
| 지원 언어 / i18n       | 한국어, 영어, 베트남어, 중국어 (간체)                                   |
| 모바일 패키지 / Mobile | Android TWA 빌드 (`apps/worker/android/`)                               |

운영자가 가장 자주 쓰는 진입점은 `npm run dev` (로컬 통합 개발), `wrangler deploy` (Cloudflare 배포), `npm run e2e` (Playwright E2E), `npm run verify` (Go 기반 사전 점검) 입니다.

---

## 목차 / Table of Contents

- [개요 / Overview](#개요--overview)
- [주요 기능 / Key Features](#주요-기능--key-features)
- [아키텍처 / Architecture](#아키텍처--architecture)
- [기술 스택 / Tech Stack](#기술-스택--tech-stack)
- [저장소 구조 / Repository Layout](#저장소-구조--repository-layout)
- [빠른 시작 / Quick Start](#빠른-시작--quick-start)
- [설정 / Configuration](#설정--configuration)
- [명령어 레퍼런스 / Commands Reference](#명령어-레퍼런스--commands-reference)
- [로컬 개발 / Local Development](#로컬-개발--local-development)
- [테스트 / Testing](#테스트--testing)
- [Android TWA 빌드 / Android TWA Build](#android-twa-빌드--android-twa-build)
- [국제화 / Internationalization](#국제화--internationalization)
- [기여 가이드 / Contribution Guide](#기여-가이드--contribution-guide)
- [라이선스 / License](#라이선스--license)

---

## 개요 / Overview

**SafetyWallet** 은 **Cloudflare** 엣지에 전량 배포되는 **Turborepo 모노레포** 기반의 현장 작업자 안전 플랫폼입니다. 현장 작업자는 설치 가능한 모바일 PWA 로 마찰 없이 위험을 보고하고 출퇴근을 기록하며 안전 포인트를 적립합니다. 현장 관리자는 동일한 인프라에서 정적 export 된 관리자 콘솔로 안전 보고 심사 · 정산 · 컴플라이언스를 처리합니다.

**SafetyWallet** is a **Turborepo monorepo** deployed end-to-end on **Cloudflare**, targeting construction sites where workers need a low-friction, installable mobile experience and site managers need a dashboard to triage safety reports, attendance, and incentive accrual. A single Cloudflare Worker serves the **Hono** API and two statically-exported **Next.js 15** frontends via hostname routing.

### 사용자가 이 프로젝트로 무엇을 할 수 있는가 / What users can do with it

- **현장 작업자 / Field worker** — 모바일 PWA 에서 로그인, 안전 게시글 작성, 출퇴근 체크, 교육 시청, 안전 포인트 적립 확인.
- **현장 관리자 / Site admin** — 관리자 콘솔에서 게시글 심사, 투표, 정산, 데이터 내보내기.
- **최고 관리자 / Super admin** — 다중 현장 운영, 사이트 멤버십 관리, 감사 로그 조회.
- **운영자 / Operator** — 단일 명령으로 로컬 통합 개발, E2E 검증, Cloudflare 배포.

---

## 주요 기능 / Key Features

| 영역 / Area            | 기능 / Feature                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| 안전 보고 / Reporting  | 사진 · 동영상 첨부, 위험 등급, 위치 메타데이터, 동료 투표 기반 우선순위                                  |
| 출퇴근 / Attendance    | GPS 기반 출퇴근 기록, 일별 · 월별 집계, R2 버킷(`ACETIME_BUCKET`) 연동 자산                             |
| 인센티브 / Incentives  | 안전 포인트 적립 · 사용, `canAwardPoints` 필드 플래그 기반 권한 분리                                     |
| 교육 / Education       | 콘텐츠 목록 · 시청 기록 · 진도율                                                                        |
| 다국어 / i18n          | ko, en, vi, zh 4개 언어, 사용자 선택 기반 런타임 전환, 번역 데이터는 `packages/types` 에 집중화         |
| 인증 / Auth            | JWT (KST 자정 만료) + KV 캐시 + D1 폴백, 401 리프레시 mutex, 4단계 역할                                  |
| 백그라운드 작업 / Jobs | 10개의 Cron Job (정산, 알림, 만료 정리 등) + Durable Object 기반 `JobScheduler`                          |
| 알림 / Notifications   | Cloudflare Queue 파이프라인(`NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ`)                                  |
| 레이트 리미팅 / Limits | Durable Object 기반 `RateLimiter`                                                                      |
| 모바일 배포 / Mobile   | Android TWA 패키지(`apps/worker/android/`), PWA 매니페스트, 바로가기(shortcuts)                         |

---

## 아키텍처 / Architecture

단일 Cloudflare Worker 가 라우팅을 담당하고, API 와 두 개의 정적 프런트엔드를 모두 엣지에서 제공합니다. 데이터는 D1 을 주 저장소로, R2 는 미디어, KV 는 캐시와 시스템 상태, Hyperdrive 는 외부 FAS 직원 DB 연결에 사용합니다.

| 컴포넌트 / Component      | 역할 / Role                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Cloudflare Worker         | Hono API 라우팅 + 호스트명 기반 정적 자산 라우팅 (`worker.<host>` / `admin.<host>`)                |
| `apps/api`                | Hono API, Drizzle 스키마(34 테이블), 31개 SQL 마이그레이션, Zod 검증                              |
| `apps/admin`              | Next.js 15 관리자 콘솔, 정적 export, App Router (attendance · posts · votes · education)          |
| `apps/worker`             | Next.js 15 작업자 PWA, 정적 export, App Router (login · posts · attendance · education)           |
| `packages/types`          | 공유 TS 타입 · 열거형 · DTO · i18n 번역 데이터                                                    |
| `packages/ui`             | 공유 shadcn/ui + Tailwind v4 테마 토큰                                                            |
| Durable Objects           | `RateLimiter`, `JobScheduler`                                                                      |
| Cloudflare Queue          | `NOTIFICATION_QUEUE` + `NOTIFICATION_DLQ` (알림 파이프라인)                                       |
| Cron Triggers             | 10개 정기 작업 (정산 · 알림 · 정리 등)                                                             |

### 요청 흐름 / Request flow

1. 클라이언트(작업자 PWA / 관리자 콘솔 / Android TWA)가 호스트명을 통해 Cloudflare 엣지에 도달합니다.
2. Worker 의 라우터가 호스트명을 판별해 `admin.*` 이면 `apps/admin` 정적 export, `worker.*` 이면 `apps/worker` 정적 export, 그 외 API 경로는 Hono 앱으로 전달합니다.
3. Hono 의 미들웨어 체인이 CORS · 로깅 · 분석 · 보안 헤더 · 인증을 순차로 적용합니다.
4. 인증은 JWT 디코드 → KST 날짜 검증 → KV 캐시 조회 → D1 폴백 순서로 3중 검증됩니다.
5. 라우트 핸들러는 Zod 스키마로 입력을 검증하고 Drizzle 로 D1 에 질의합니다.
6. 미디어 첨부는 R2, 외부 직원 데이터는 Hyperdrive 경유 FAS DB 로 라우팅됩니다.
7. 알림 발생 시 Queue 로 enqueue, 실패는 DLQ 로 격리됩니다.
8. 레이트 리미팅과 장기 작업은 각각 Durable Object(`RateLimiter`, `JobScheduler`)에 위임됩니다.

자세한 내용은 [`ARCHITECTURE.md`](ARCHITECTURE.md) 와 [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md) 를 참조하세요.

---

## 기술 스택 / Tech Stack

| 영역 / Layer          | 선택 / Choice                                                                       |
| --------------------- | ----------------------------------------------------------------------------------- |
| 언어 / Language       | TypeScript (Node ≥ 20)                                                              |
| API 프레임워크 / API  | Hono (Cloudflare Workers)                                                           |
| 프런트엔드 / FE       | Next.js 15 (App Router, `output: 'export'`)                                         |
| 스타일 / Styling      | Tailwind CSS v4 (`packages/ui` 토큰 집중화), shadcn/ui                              |
| DB / ORM             | Cloudflare D1 + Drizzle ORM (34 테이블, 31 마이그레이션)                            |
| 캐시 / Cache          | Cloudflare KV                                                                       |
| 미디어 / Media        | Cloudflare R2 (`R2`, `ACETIME_BUCKET`)                                              |
| 외부 DB / External DB | Hyperdrive 경유 FAS 직원 DB (`FAS_HYPERDRIVE`)                                      |
| 검증 / Validation    | Zod (`apps/api/src/validators/`)                                                    |
| 상태 관리 / State     | Zustand (인증 영속화, 클라이언트 키: `safetywallet-auth`, `safetywallet-admin-auth`) |
| 데이터 페칭 / Fetch   | TanStack Query + Devtools                                                           |
| 모바일 / Mobile       | Bubblewrap 기반 Android TWA                                                         |
| 테스트 / Testing      | Vitest (단위), Playwright (E2E, 6 프로젝트)                                         |
| 품질 도구 / Quality   | ESLint, Prettier, Go 스크립트(`verify.go`, `check-anti-patterns.go`, `lint-naming`) |
| Git 훅 / Git hooks    | Husky + lint-staged                                                                 |

---

## 저장소 구조 / Repository Layout

```text
.
├── apps/
│   ├── api/                 # Cloudflare Worker API (Hono + Drizzle + D1)
│   ├── admin/               # Next.js 15 관리자 콘솔 (정적 export, 포트 3001)
│   └── worker/              # Next.js 15 작업자 PWA (정적 export, 포트 3000)
│       ├── src/app/         # App Router (login, posts, attendance, education)
│       ├── src/i18n/        # 커스텀 i18n 런타임 (ko, en, vi, zh)
│       ├── src/components/  # 작업자 전용 UI
│       └── android/         # Android TWA 빌드 (Gradle + Bubblewrap)
├── packages/
│   ├── types/               # 공유 TS 타입 · 열거형 · DTO · 번역 데이터
│   └── ui/                  # 공유 shadcn/ui + Tailwind v4 토큰
├── docs/                    # PRD, 요구사항 명세, 운영 런북
├── scripts/                 # Go / JS 도구 (verify, naming lint, anti-pattern)
├── e2e/                     # Playwright E2E (auth setup, admin, worker 흐름)
├── .github/workflows/       # CI: lint → typecheck → guard → test → build → migrate
├── wrangler.toml            # 루트 Cloudflare Worker 설정 + 모든 바인딩
├── turbo.json               # Turborepo 파이프라인
├── playwright.config.ts     # 6개 Playwright 프로젝트
├── package.json             # npm 워크스페이스 정의
└── AGENTS.md                # 프로젝트 지식 베이스 (자동화 도구 컨텍스트)
```

상세 디렉터리 구조는 [`ARCHITECTURE.md`](ARCHITECTURE.md) 와 각 앱의 `AGENTS.md` 를 참조하세요.

---

## 빠른 시작 / Quick Start

사전 요구사항 / Prerequisites: **Node.js 20+**, **npm 10.8.2**, **Wrangler**, (옵션) **1Password CLI** (E2E 시크릿 주입용), (옵션) **Go** (검증 스크립트 실행 시).

```bash
# 1. 의존성 설치
npm install

# 2. 워크스페이스 빌드 (공유 패키지 → 앱 순)
npm run build

# 3. 통합 개발 서버 (모든 앱 동시 실행)
npm run dev

# 4. 워커 / 관리자 콘솔 개별 실행
npm run dev --workspace=apps/worker      # http://localhost:3000
npm run dev --workspace=apps/admin       # http://localhost:3001
npm run dev --workspace=apps/api         # wrangler dev

# 5. 검증 (타입 · 린트 · 테스트)
npm run typecheck
npm run lint
npm run test
```

---

## 설정 / Configuration

루트의 [`wrangler.toml`](wrangler.toml) 은 Cloudflare Worker 의 단일 진입점이며, D1 · R2 · KV · Hyperdrive · Queue · Durable Object 바인딩을 모두 선언합니다. 환경별 시크릿은 Wrangler 의 `secret put` 으로 주입하고, E2E 환경 변수(`.env.e2e`)는 1Password CLI(`op run`)로 주입하는 것을 권장합니다.

| 바인딩 / Binding                 | 종류 / Type            | 용도 / Purpose                            |
| -------------------------------- | ---------------------- | ----------------------------------------- |
| `DB`                             | D1                     | 주 데이터베이스 (34 테이블)               |
| `FAS_HYPERDRIVE`                 | Hyperdrive             | 외부 FAS 직원 DB                          |
| `ASSETS`                         | Workers Static Assets  | 작업자 · 관리자 SPA 정적 파일             |
| `R2`                             | R2                     | 사용자 업로드 이미지 · 동영상             |
| `ACETIME_BUCKET`                 | R2                     | 출퇴근 관련 자산                          |
| `KV`                             | KV                     | 인증 캐시 · 시스템 상태 · 설정            |
| `NOTIFICATION_QUEUE`             | Queue                  | 알림 배달 파이프라인                      |
| `NOTIFICATION_DLQ`               | Queue                  | 알림 실패 격리                            |
| `RATE_LIMITER`                   | Durable Object         | 분산 레이트 리미팅                        |
| `JOB_SCHEDULER`                  | Durable Object         | 장기 작업 스케줄링                        |
| Cron Triggers                    | Schedules              | 10개 정기 작업                            |

추가 설정은 [`ARCHITECTURE.md`](ARCHITECTURE.md) 의 "Cloudflare Bindings" 절과 [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) 를 참조하세요.

---

## 명령어 레퍼런스 / Commands Reference

루트 `package.json` 의 스크립트는 Turborepo 를 통해 모든 워크스페이스에 위임됩니다. 워크스페이스 표기: `@safetywallet/api`, `@safetywallet/admin`, `@safetywallet/worker`, `@safetywallet/types`, `@safetywallet/ui`.

| 명령어 / Command                | 설명 / Description                                                        |
| ------------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`                   | 모든 워크스페이스의 `dev` 스크립트를 병렬 실행                            |
| `npm run build`                 | Turborepo 빌드 후 정적 export 통합 (`dist/`)                              |
| `npm run build:api`             | `packages/types` + `apps/api` 만 빌드                                     |
| `npm run build:one-worker`      | API 단독 빌드 (`build:api` 의 별칭)                                       |
| `npm run build:static`          | `dist/` 정리 후 worker/admin 정적 export 결과 통합                        |
| `npm run lint`                  | 워크스페이스 전체 ESLint 실행                                              |
| `npm run lint:naming`           | 명명 규칙 검사 (`scripts/lint-naming.js`)                                  |
| `npm run typecheck`             | 워크스페이스 전체 타입 체크                                                |
| `npm run test`                  | Vitest 단위 테스트                                                        |
| `npm run test:coverage`         | 커버리지 포함 단위 테스트                                                 |
| `npm run e2e`                   | 1Password CLI + Playwright 헤드리스 E2E                                   |
| `npm run e2e:headed`            | E2E 헤드드 모드                                                           |
| `npm run e2e:ui`                | Playwright UI 모드                                                        |
| `npm run check:wrangler-sync`   | wrangler 설정과 코드 사용처 일치 여부 검사                                |
| `npm run git:preflight`         | Go 기반 커밋 사전 점검                                                    |
| `npm run verify`                | Go 기반 통합 검증                                                         |
| `npm run format` / `format:check` | Prettier 쓰기 / 검사                                                    |
| `npm run db:generate`           | Drizzle 스키마로부터 마이그레이션 생성                                    |
| `npm run clean`                 | 모든 워크스페이스 정리 + `node_modules` 삭제                              |
| `wrangler deploy`               | Cloudflare Worker 배포 (수동 배포는 비활성, `master` ref 기반 CI 권장)   |
| `wrangler dev`                  | 로컬 Workers 에뮬레이터                                                   |
| `wrangler d1 migrations apply`  | D1 마이그레이션 적용                                                       |

> 참고 / Note: `npm run deploy:api` 는 의도적으로 실패하도록 고정되어 있습니다. 배포는 `master` 브랜치의 Git-ref 기반 CI 를 통해서만 수행됩니다.

---

## 로컬 개발 / Local Development

1. **공유 패키지부터 빌드** — Turborepo 가 의존성 순서를 보장하지만, IDE 에서는 `npm run build --workspace=packages/types` 후 `packages/ui` 빌드를 권장합니다.
2. **시크릿 주입** — 로컬 `.dev.vars` (Wrangler) 와 `.env.e2e` (Playwright + 1Password CLI) 를 준비합니다.
3. **D1 로컬 실행** — `wrangler d1 migrations apply --local` 로 마이그레이션을 적용합니다.
4. **통합 개발** — `npm run dev` 로 worker(3000), admin(3001), api(8787) 가 동시에 실행됩니다.
5. **Pre-commit 훅** — Husky 가 staged 파일에 `check-anti-patterns.go` 와 Prettier 를 자동 실행합니다.
6. **핫리로드 주의** — `apps/worker` 와 `apps/admin` 은 정적 export 이므로, 라우트 변경 후 `npm run build:static` 으로 `dist/` 를 갱신해야 합니다.

자세한 워크플로는 [`CONTRIBUTING.md`](CONTRIBUTING.md) 와 [`CODE_STYLE.md`](CODE_STYLE.md) 를 참조하세요.

---

## 테스트 / Testing

| 계층 / Layer    | 도구 / Tool              | 위치 / Location                | 실행 / Run             |
| --------------- | ------------------------ | ------------------------------ | ---------------------- |
| 단위 / Unit     | Vitest                   | 각 워크스페이스                | `npm run test`         |
| 커버리지        | Vitest + c8/V8          | 워크스페이스 루트              | `npm run test:coverage`|
| E2E             | Playwright (6 프로젝트)  | [`e2e/`](e2e/)                 | `npm run e2e`          |
| 타입 / Type     | `tsc --noEmit`           | 워크스페이스 루트              | `npm run typecheck`    |
| 명명 / Naming   | 커스텀 Go/JS 린터        | `scripts/`                     | `npm run lint:naming`  |
| 안티패턴        | `check-anti-patterns.go` | `scripts/`                     | lint-staged 자동 실행  |
| 통합 검증       | `verify.go`              | `scripts/`                     | `npm run verify`       |

CI 파이프라인은 `lint → typecheck → guard(anti-pattern, naming, wrangler-sync) → test → build → migrate` 순서로 강제되며, 어느 단계라도 실패하면 배포가 차단됩니다.

---

## Android TWA 빌드 / Android TWA Build

[`apps/worker/android/`](apps/worker/android/) 는 Bubblewrap 로 생성된 **Trusted Web Activity** 프로젝트입니다. 작업자 PWA 를 네이티브 Android 앱으로 패키징하여 Google Play 배포 또는 사내 디바이스 설치를 지원합니다.

| 산출물 / Artifact        | 경로 / Path                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| TWA 매니페스트          | `apps/worker/android/twa-manifest.json`                                       |
| 빌드 스크립트           | `apps/worker/android/gradlew`, `gradlew.bat`                                  |
| Gradle 설정             | `apps/worker/android/build.gradle`, `settings.gradle`                         |
| 앱 모듈 빌드            | `apps/worker/android/app/build.gradle`                                        |
| 런타임 클래스           | `apps/worker/android/app/src/main/java/me/jclee/safetywallet/twa/`            |
| PWA 매니페스트          | `apps/worker/android/app/src/main/res/raw/web_app_manifest.json`              |
| 바로가기 / Shortcuts    | `apps/worker/android/app/src/main/res/xml/shortcuts.xml`                      |
| FileProvider 경로       | `apps/worker/android/app/src/main/res/xml/filepaths.xml`                      |
| 아이콘 / Splash         | `apps/worker/android/app/src/main/res/mipmap-*/`, `drawable-*/`               |

빌드 절차는 [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md) 의 TWA 절을 참조하세요.

---

## 국제화 / Internationalization

작업자 PWA 는 커스텀 경량 i18n 런타임을 사용합니다. 번역 데이터는 `packages/types` 에 집중화되어 worker · admin 양쪽에서 동일한 사전을 참조합니다.

- 지원 로케일 / Locales: **ko**, **en**, **vi**, **zh**
- 런타임 / Runtime: [`apps/worker/src/i18n/`](apps/worker/src/i18n/)
- 구현 노트: [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md)
- 번역 추가 절차: `packages/types` 의 번역 객체에 키를 추가하고 양쪽 앱에서 동일한 키를 사용합니다.

---

## 기여 가이드 / Contribution Guide

기여 절차 · 브랜치 전략 · 커밋 메시지 규칙 · PR 체크리스트는 [`CONTRIBUTING.md`](CONTRIBUTING.md) 에 정리되어 있습니다. 코딩 스타일은 [`CODE_STYLE.md`](CODE_STYLE.md), 안티패턴 규칙은 `scripts/check-anti-patterns.go` 를 참조하세요.

| 단계 / Step | 명령 / Command                                                |
| ----------- | ------------------------------------------------------------- |
| 브랜치      | 기능별 feature 브랜치 생성                                    |
| 포맷        | `npm run format`                                              |
| 검증        | `npm run typecheck && npm run lint && npm run test`           |
| 사전 점검   | `npm run verify`                                              |
| 커밋        | Husky 가 lint-staged 자동 실행                                |
| 푸시        | CI 가 lint → typecheck → guard → test → build → migrate 실행  |

문제는 저장소 이슈 트래커를 사용하고, 보안 이슈는 공개 이슈 대신 저장소 운영자에게 비공개로 연락하세요.

---

## 라이선스 / License

[`LICENSE`](LICENSE) 파일을 참조하세요. 라이선스 본문은 저장소 루트에 명시되어 있습니다.