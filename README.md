# SafetyWallet

[![Node](https://img.shields.io/badge/node-%E2%89%A520.0.0-339933)](package.json)
[![npm](https://img.shields.io/badge/package_manager-npm%2010.8.2-blue)](package.json)
[![Turborepo](https://img.shields.io/badge/build-turbo-0f172a)](turbo.json)
[![Cloudflare](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](wrangler.toml)
[![Playwright](https://img.shields.io/badge/e2e-Playwright-2EAD33)](playwright.config.ts)
[![License](https://img.shields.io/badge/license-see%20LICENSE-blue)](LICENSE)

> 현장 작업자가 모바일 PWA로 위험 요인을 신고하고 출퇴근을 기록하며 안전 포인트를 적립하는 멀티 테넌트 안전 운영 시스템. 같은 데이터를 사이트 관리자가 검토·정산·컴플라이언스에 사용합니다.

[English overview](#english-overview) · [아키텍처 노트](ARCHITECTURE.md) · [기여 가이드](CONTRIBUTING.md)

## 한 줄 요약

SafetyWallet은 단일 Cloudflare Worker가 Hono API와 두 개의 정적 export Next.js 프런트엔드(현장 작업자 PWA, 관리자 대시보드)를 호스트네임 기반으로 라우팅하는 안전 운영 플랫폼입니다.

## 빠른 상태

| 항목 | 값 |
| --- | --- |
| 런타임 | Cloudflare Workers · D1 · R2 · KV · Durable Objects · Queues |
| 프런트엔드 | Next.js 15 × 2 (현장 PWA `:3000`, 관리자 `:3001`, 둘 다 정적 export) |
| 데이터 계층 | Drizzle ORM, D1 SQLite, 31개 마이그레이션, 외부 FAS Hyperdrive |
| 인증 | JWT (KST 자정 만료) + KV 캐시 + 401 리프레시 뮤텍스 |
| 권한 모델 | 역할 (`WORKER` / `SITE_ADMIN` / `SUPER_ADMIN` / `SYSTEM`) + 사이트 멤버십 + 필드 플래그 |
| 패키지 매니저 | npm 10.8.2, workspaces: `apps/*`, `packages/*` |
| 파이프라인 | Turborepo `types → ui → apps` |
| 배포 | `master` Git 참조 기반 CI (수동 배포 비활성화) |
| 운영자 다음 명령 | `npm run verify` · `npm run typecheck` · `npm run check:wrangler-sync` |

## 운영 흐름 요약

1. 현장 작업자가 PWA에 로그인해 출퇴근·위험 신고를 제출하고 JWT는 `safetywallet-auth` Zustand 스토어에 보관됩니다.
2. 같은 Cloudflare Worker가 호스트네임을 보고 Hono API 또는 정적 export 자산(`apps/worker/out`, `apps/admin/out`)으로 라우팅합니다.
3. API는 D1에 읽고 쓰며, 인증 캐시와 시스템 상태는 KV, 첨부 파일과 출퇴근 자산은 R2 버킷에 저장됩니다.
4. 알림은 `NOTIFICATION_QUEUE`로 흘러 실패 시 `NOTIFICATION_DLQ`로 격리되고, 10개의 cron 작업이 `JobScheduler` Durable Object로 스케줄됩니다.
5. 관리자는 `safetywallet-admin-auth` 키로 대시보드에서 검토·정산·교육을 수행하며, 사이트 관리자가 부여한 필드 권한으로 데이터 export까지 제어합니다.

## 목차

- [제품 개요](#product-overview)
- [패키지 구성](#package-contents)
- [먼저 읽을 파일](#first-files-to-read)
- [진입점과 API](#entry-points-and-api)
- [빠른 시작](#quickstart)
- [설정과 Cloudflare 바인딩](#configuration)
- [명령어 레퍼런스](#command-reference)
- [로컬 개발](#local-development)
- [테스트와 검증](#testing-and-verification)
- [기여와 운영자 정보](#contributing)
- [English overview](#english-overview)
- [라이선스](#license)

## 제품 개요

SafetyWallet은 현장 작업자가 모바일 PWA로 위험 요인을 신고하고 출퇴근을 기록해 안전 포인트를 적립하고, 사이트 관리자가 같은 데이터로 검토·정산·컴플라이언스를 처리하도록 설계된 멀티 테넌트 안전 운영 시스템입니다.

- 사용자
  - `WORKER` — PWA로 출퇴근·위험 신고·교육 수강·포인트 적립
  - `SITE_ADMIN` — 현장 단위 검토·정산·현장 관리
  - `SUPER_ADMIN` — 다중 사이트 운영
  - `SYSTEM` — 자동화 작업과 외부 연동
- 핵심 기능
  - 위험 요인 신고와 사진/동영상 첨부 (R2 저장)
  - 출퇴근 기록과 위치 로그
  - 안전 포인트 적립과 보상 정산
  - 한국어·영어·베트남어·중국어 UI
  - 10개의 cron 작업으로 자동 정산과 알림 발송
- 플랫폼 의도
  - 모바일 우선 PWA와 TWA 기반 Android 패키지(`apps/worker/android/`)
  - 단일 Worker가 API와 두 프런트엔드를 라우팅
  - 외부 FAS(근로자) DB와 Hyperdrive로 연동

## 패키지 구성

다음은 이 저장소가 다루는 워크스페이스입니다. 각 디렉터리의 자세한 책임은 [`ARCHITECTURE.md`](ARCHITECTURE.md)에 정리되어 있습니다.

- `apps/api/` — Cloudflare Worker API: Hono 라우터, Drizzle 스키마 (34개 테이블), D1 마이그레이션 (31개), cron 작업 (10개)
- `apps/admin/` — Next.js 15 관리자 대시보드, App Router, 정적 export, `:3001`
- `apps/worker/` — Next.js 15 현장 PWA, App Router, 정적 export, `:3000`, Android TWA 포함
- `packages/types/` — 공유 TypeScript 타입, enum, DTO, i18n 번역 데이터
- `packages/ui/` — 공유 shadcn/ui 컴포넌트와 Tailwind v4 테마 토큰
- `docs/` — PRD, 요구사항 명세, 운영 런북
- `e2e/` — Playwright E2E (인증 셋업, 관리자/작업자 흐름, 6개 프로젝트)
- `scripts/` — Go/JS 도구: verify, naming lint, anti-pattern 검사, wrangler sync 검사, git preflight

## 먼저 읽을 파일

새로운 기여자나 운영자는 다음 순서로 읽어보세요.

1. [`AGENTS.md`](AGENTS.md) — 전체 프로젝트 지식 베이스 (스택, 바인딩, 인증 모델)
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — 워크스페이스 경계와 데이터 흐름
3. [`CODE_STYLE.md`](CODE_STYLE.md) — 작성 규약과 lint 정책
4. [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md) — 현장 PWA 구현 컨텍스트
5. [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) — 다국어 런타임
6. [`CONTRIBUTING.md`](CONTRIBUTING.md) — PR, 검증, 운영 가이드
7. [`wrangler.toml`](wrangler.toml) — 바인딩 단일 진실 소스

## 진입점과 API

- 단일 Worker 진입점. [`wrangler.toml`](wrangler.toml)이 라우팅과 바인딩을 정의합니다. `apps/api/`의 Hono 앱이 호스트네임을 보고 API인지 정적 자산 요청인지 분기합니다.
- Hono 라우터. `apps/api/src/routes/` 아래 18개 모듈 (`admin/` 하위 라우트 포함). 미들웨어는 `apps/api/src/middleware/`에서 CORS·로깅·분석·보안 헤더를 담당합니다.
- 검증기. `apps/api/src/validators/`의 Zod 스키마로 요청 payload를 검증합니다.
- Durable Objects. `apps/api/src/durable-objects/`의 `RateLimiter`와 `JobScheduler`.
- 스케줄 작업. 10개 cron이 `apps/api/src/jobs/`에 등록되어 있고, `wrangler.toml`의 `[triggers]`에서 정의합니다.
- 프런트엔드 라우트
  - 관리자: `apps/admin/src/app/`의 App Router — attendance, posts, votes, education
  - 현장: `apps/worker/src/app/`의 App Router — login, posts, attendance, education
- E2E 진입점. [`playwright.config.ts`](playwright.config.ts)의 6개 프로젝트와 [`e2e/`](e2e/) 시나리오

## 빠른 시작

1. 요구 사항
   - Node `>= 20.0.0`, npm `10.8.2`
   - Wrangler CLI (Cloudflare 배포 시)
   - 1Password CLI(`op`): E2E 시크릿 주입용 (선택)
2. 설치
   - `npm install` — 루트에서 workspaces 전체를 설치합니다.
3. 로컬 개발
   - `npm run dev` — Turborepo로 모든 워크스페이스 개발 서버를 동시에 실행합니다.
   - 현장 PWA: `http://localhost:3000`
   - 관리자 대시보드: `http://localhost:3001`
4. 빌드
   - `npm run build` — Turbo 빌드 후 정적 export를 `dist/`에 정리합니다 (`dist/admin`에 관리자 번들, 루트에 작업자 번들).
5. E2E
   - `.env.e2e` 시크릿을 1Password에 두고 `npm run e2e`. 헤드 모드는 `npm run e2e:headed`, UI 모드는 `npm run e2e:ui`.

## 설정과 Cloudflare 바인딩

[`wrangler.toml`](wrangler.toml)이 모든 Cloudflare 바인딩을 단일 진실 소스로 관리합니다. [`scripts/check-wrangler-sync.js`](scripts/)가 변경 사항이 동기화되었는지 검사합니다.

- `DB` — D1. 기본 데이터 저장소 (`apps/api/src/db/`의 Drizzle 스키마)
- `FAS_HYPERDRIVE` — 외부 FAS 근로자 DB로의 Hyperdrive
- `ASSETS` — Workers Static Assets (작업자/관리자 정적 export)
- `R2` — 사용자 업로드 사진/동영상
- `ACETIME_BUCKET` — 출퇴근 관련 자산용 R2 버킷
- `KV` — 인증 캐시, 시스템 상태, 설정
- `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` — 알림 파이프라인과 실패 격리
- `RATE_LIMITER`, `JobScheduler` — 속도 제한과 스케줄링을 위한 Durable Objects

권한 모델은 세 겹입니다.

- 역할: `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`
- 사이트 멤버십: 어느 사이트에서 어떤 역할을 가지는지 별도 매핑
- 필드 플래그: `canAwardPoints`, `canReview`, `canExportData` 등

## 명령어 레퍼런스

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 모든 워크스페이스 개발 서버 동시 실행 |
| `npm run build` | Turbo 빌드 후 `dist/`에 정적 자산 정리 |
| `npm run build:api` | types → api만 빌드 (API 단독 검증) |
| `npm run build:static` | `dist/` 재생성 (정적 export만) |
| `npm run build:one-worker` | API 단독 빠른 빌드 |
| `npm run lint` | 워크스페이스 lint 통합 실행 |
| `npm run lint:naming` | 명명 규약 검사 (`scripts/lint-naming.js`) |
| `npm run typecheck` | Turbo 타입 검사 통합 실행 |
| `npm run test` | 워크스페이스 단위 테스트 |
| `npm run test:coverage` | 커버리지 리포트 포함 |
| `npm run e2e` / `e2e:headed` / `e2e:ui` | Playwright E2E (1Password 시크릿 필요) |
| `npm run check:wrangler-sync` | `wrangler.toml` ↔ 코드 동기화 검사 |
| `npm run verify` | `scripts/verify.go` 운영자 종합 검증 |
| `npm run git:preflight` | `scripts/git-preflight.go` 커밋 전 검사 |
| `npm run format` / `format:check` | Prettier 쓰기/검사 |
| `npm run db:generate` | Drizzle 클라이언트/스키마 생성 |
| `npm run clean` | 워크스페이스 정리 + `node_modules` 제거 |

`npm run deploy:api`는 의도적으로 비활성화되어 있습니다. 배포는 `master` 푸시에서 CI가 Git 참조 기반으로 수행합니다.

## 로컬 개발

- Turborepo 의존성 순서. `types → ui → apps`. 새 워크스페이스를 추가하면 [`turbo.json`](turbo.json) 파이프라인을 확인하세요.
- Husky 훅. `prepare` 스크립트가 husky를 설치합니다. lint-staged는 TypeScript 파일에 `go run scripts/check-anti-patterns.go` + Prettier를 적용합니다.
- wrangler 로컬. Worker와 정적 자산을 함께 검증하려면 `wrangler dev`로 루트 `wrangler.toml`을 가리키세요. D1과 R2는 시뮬레이터 바인딩을 사용합니다.
- Android TWA. `apps/worker/android/`는 현장 PWA를 Trusted Web Activity로 감싼 패키지입니다. 실제 디바이스 테스트가 필요할 때만 빌드하세요.
- i18n. 작업자 PWA는 커스텀 런타임 i18n(`apps/worker/src/i18n/`)을 사용합니다. 번역 추가는 [`packages/types/`](packages/types/)에서 키 정합성을 확인하세요.
- 상위 패키지 잠금. 루트 `package.json`의 `overrides`가 React 18.3.1, ESLint ^8.57.0, `serialize-javascript >=7.0.3`을 강제합니다.

## 테스트와 검증

- 단위 테스트. 워크스페이스별 Vitest (`vitest.config.ts`가 다수 존재). `npm run test` 또는 `npm run test:coverage`로 커버리지 확인.
- E2E. 6개 Playwright 프로젝트 (auth setup, admin, worker 등). `.env.e2e` 파일을 1Password CLI로 주입하는 방식이 기본입니다.
- 타입 검사. `npm run typecheck`가 turbo로 워크스페이스 전반을 검사합니다.
- 운영자 종합 검증. `npm run verify`가 [`scripts/verify.go`](scripts/)를 통해 lint·typecheck·test·스키마 동기화를 한 번에 실행합니다.
- wrangler 동기화. `npm run check:wrangler-sync`로 `wrangler.toml`과 코드의 정합성을 확인합니다.
- 명명 규약. `npm run lint:naming`이 위반 항목을 보고합니다.
- 안티 패턴 검사. 커밋 훅에서 Go 스크립트가 자동 실행됩니다.

## 기여와 운영자 정보

- [`CONTRIBUTING.md`](CONTRIBUTING.md)에 PR 흐름, 커밋 메시지 규약, 검증 절차가 정리되어 있습니다.
- [`CODE_STYLE.md`](CODE_STYLE.md)에 TypeScript, React, SQL 작성 규약이 있습니다.
- 작업 전 [`AGENTS.md`](AGENTS.md)의 "OVERVIEW", "AUTHENTICATION & AUTHORIZATION", "CLOUDFLARE BINDINGS"를 다시 확인하세요.
- 코드 변경 후 PR에는 `npm run verify`와 `npm run check:wrangler-sync` 통과 결과를 남겨 주세요.
- Maintainers / Points of Contact. 프로젝트 운영자 연락처와 책임 범위는 [`CONTRIBUTING.md`](CONTRIBUTING.md)와 [`CODE_STYLE.md`](CODE_STYLE.md) 상단의 안내를 따릅니다. 명시된 연락처가 없는 변경은 PR 리뷰어를 통해 운영자 그룹에 라우팅됩니다.

## English overview

SafetyWallet is a multi-tenant safety operations platform built on a single Cloudflare Worker that routes a Hono API and two statically-exported Next.js frontends (a field-worker PWA and an admin dashboard) by hostname. Field workers report hazards, log attendance, and accrue safety points from a mobile PWA; site and super admins review submissions, settle points, and run education and compliance workflows from a dashboard over the same data. The platform uses D1 via Drizzle for primary storage, two R2 buckets for media, KV for auth cache and system state, Hyperdrive to an external FAS employee database, Durable Objects for rate limiting and job scheduling, and two Queues for notification delivery with a DLQ. Authentication is JWT-based with KST same-day midnight expiry and a triple-layer validation (decode, KST date, KV cache fallback to D1); authorization is a three-tier role model (WORKER, SITE_ADMIN, SUPER_ADMIN, SYSTEM) layered with site membership and field flags. The worker PWA ships with Korean, English, Vietnamese, and Chinese locales and a Trusted Web Activity Android wrapper. Deployments are Git-ref driven on `master` via CI; manual deploy commands are intentionally disabled. Local development uses npm workspaces with a Turborepo pipeline (`types → ui → apps`), Vitest for unit tests, and Playwright (six projects) for end-to-end verification with secrets injected via 1Password CLI.

## 라이선스

저장소 루트의 [`LICENSE`](LICENSE)를 참고하세요.