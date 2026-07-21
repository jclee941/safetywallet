# Safetywallet

[![Status: Active development](https://img.shields.io/badge/status-active--development-blue)]()
[![Cloudflare Workers](https://img.shields.io/badge/deploy-cloudflare--workers-orange)]()
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-339933)]()
[![License: AGPL-3.0](LICENSE)]()
[![i18n: ko · en · vi · zh](https://img.shields.io/badge/i18n-ko%20%C2%B7%20en%20%C2%B7%20vi%20%C2%B7%20zh-9cf)](#다국어--internationalization)

현장 작업자가 모바일 PWA로 위험 요소를 신고하고, 출퇴근을 기록하며, 안전 점수를 적립하는 시스템입니다. 사이트 관리자는 대시보드에서 신고 검토·정산·컴플라이언스를 처리합니다. 단일 Cloudflare Worker가 Hono API와 두 개의 정적 익스포트 Next.js 프런트엔드를 호스트 이름 라우팅으로 제공합니다.

Safety platform for field workers: report hazards, log attendance, and earn safety points through a mobile PWA; admins review, settle, and export compliance data from a dashboard.

## 한눈에 보기 / At a Glance

| 항목 | 값 |
| --- | --- |
| 상태 / Status | Active development (production deploy via CI only) |
| 배포 정책 / Deploy policy | Git-ref driven, `master` push triggers CI |
| 런타임 / Runtime | Cloudflare Workers + D1, R2, KV, Queues, Durable Objects |
| 스택 / Stack | TypeScript, Hono, Drizzle, Next.js 15, Wrangler |
| 패키지 매니저 / PM | npm 10.8.2 workspaces + Turborepo |
| Node | `>= 20` |
| 작업자 PWA / Worker PWA | `apps/worker` (port 3000) + TWA Android wrapper |
| 관리자 / Admin | `apps/admin` (port 3001, static export) |
| API | `apps/api` (Hono + Drizzle + D1, 18 route modules) |
| 공유 / Shared | `packages/types`, `packages/ui` |
| 다국어 / i18n | ko, en, vi, zh (custom runtime, `apps/worker/src/i18n`) |
| 인증 / Auth | JWT (KST 자정 만료) + 3-tier permissions |
| 테스트 / Testing | Vitest, Playwright (6 프로젝트) |
| 검증 도구 / Verify | `npm run verify` (Go), `check:wrangler-sync` |

## 빠른 흐름 / Quick Flow

1. 작업자가 PWA(또는 `apps/worker/android` TWA 래퍼)에 로그인 → KST 자정 만료 JWT 발급, Zustand 저장.
2. 프런트엔드가 동일 오리진의 `/api/*`를 호출 → Hono 라우터가 호스트/경로로 작업자·관리자 라우트 분기.
3. Drizzle ORM이 D1(34 테이블) 또는 Hyperdrive(FAS 외부 DB)로 라우팅.
4. 업로드는 `R2`/`ACETIME_BUCKET`, 알림은 `NOTIFICATION_QUEUE` → `NOTIFICATION_DLQ`.
5. `RATE_LIMITER` DO가 속도 제한, `JOB_SCHEDULER` DO가 10개 cron 작업을 디스패치.
6. 관리자는 `admin.<host>`로 접근 → 역할 × 사이트 멤버십 × 필드 플래그 권한 검증 후 정산·리뷰·내보내기.

## 운영 진입점 / Operator Entry Point

| 목적 | 명령 / 위치 |
| --- | --- |
| 로컬 개발 시작 | `npm run dev` |
| 전체 빌드 (dist/) | `npm run build` |
| API만 빌드 | `npm run build:api` |
| 정적 자산 묶음 | `npm run build:static` |
| 타입 / 린트 | `npm run typecheck`, `npm run lint`, `npm run lint:naming` |
| 단위 테스트 | `npm run test`, `npm run test:coverage` |
| E2E | `npm run e2e` (headless), `e2e:headed`, `e2e:ui` |
| 배포 | CI only — `master` push (수동 배포 비활성) |
| 정합성 | `npm run check:wrangler-sync`, `npm run verify`, `npm run git:preflight` |

## 패키지 구성 / Package Contents

| 경로 | 역할 |
| --- | --- |
| `apps/api` | Cloudflare Worker API (Hono, Drizzle, D1, 미들웨어, 31 마이그레이션) |
| `apps/admin` | 관리자 대시보드 Next.js 15 정적 익스포트 |
| `apps/worker` | 작업자 PWA Next.js 15 정적 익스포트 + Bubblewrap TWA Android wrapper |
| `packages/types` | 공유 타입, enum, DTO, i18n 번역 데이터 |
| `packages/ui` | 공유 shadcn/ui 컴포넌트 + Tailwind v4 테마 토큰 |
| `scripts/` | Go/JS 도구 — verify, naming lint, anti-pattern 검사 |
| `e2e/` | Playwright 시나리오 (auth, admin, worker) |
| `docs/` | PRD, 요구사항 명세, 운영 런북 |
| `wrangler.toml` | 루트 CF Worker 설정 + 모든 바인딩 단일 출처 |
| `turbo.json` | 파이프라인 (`types → ui → apps`) |
| `playwright.config.ts` | Playwright 6 프로젝트 정의 |
| `.github/workflows/` | CI/CD 파이프라인 (lint → typecheck → guards → test → build → migrate) |

## 먼저 읽을 파일 / First Files to Read

1. `AGENTS.md` — 프로젝트 지식 베이스, 인증/바인딩 요약.
2. `ARCHITECTURE.md` — 시스템 아키텍처와 모듈 경계.
3. `wrangler.toml` — 실제 배포되는 바인딩과 라우트의 단일 출처.
4. `CODE_STYLE.md` — 코드 스타일 가이드.
5. `apps/worker/AGENTS.md` + `apps/worker/I18N_IMPLEMENTATION.md` — PWA와 다국어 정책.
6. `CONTRIBUTING.md` — PR·이슈 가이드라인.

## 목차 / Contents

- [빠른 시작 / Quickstart](#빠른-시작--quickstart)
- [아키텍처 / Architecture](#아키텍처--architecture)
- [Cloudflare 바인딩](#cloudflare-바인딩--cloudflare-bindings)
- [인증과 권한](#인증과-권한--auth--authorization)
- [테스트](#테스트--testing)
- [모바일 배포](#모바일-배포--mobile-distribution)
- [운영과 관측](#운영과-관측--operations)
- [기여 / Contributing](#기여--contributing)
- [관리 / Maintainers](#관리--maintainers)
- [더 읽을 거리](#더-읽을-거리--further-documentation)

## 빠른 시작 / Quickstart

### 사전 준비 / Prerequisites

- Node.js `>= 20`, npm `10.8.2` (`packageManager` 필드 고정).
- Cloudflare 계정, `wrangler` CLI.
- D1, R2, KV, Queues, Hyperdrive 리소스 (개발은 `wrangler dev`로 충분).
- E2E 실행 시 1Password CLI (`op`)와 `.env.e2e`.

### 설치와 개발 / Install & Develop

```bash
npm install
npm run dev
```

Turborepo가 `packages/types → packages/ui → apps/*` 순으로 의존성을 해결하며 병렬 실행합니다. 작업자 PWA는 `http://localhost:3000`, 관리자는 `http://localhost:3001`에서 열립니다.

### 빌드 / Build

```bash
npm run build          # 전체: turbo build + dist/ 정적 묶음
npm run build:api      # packages/types + apps/api 만
npm run build:static   # apps/worker/out, apps/admin/out → dist/
```

빌드 산출물은 `dist/`(SPA)와 `apps/api/dist`(Worker)입니다.

### 배포 / Deploy

수동 배포는 비활성화되어 있습니다.

```bash
npm run deploy:api
# → "Manual deploy is disabled. Deploy is Git-ref driven via CI on master."
```

`master`에 push하면 CI가 lint → typecheck → guards → test → build → migrate 순으로 실행 후 Worker와 자산을 배포합니다.

## 아키텍처 / Architecture

| 계층 | 위치 | 책임 |
| --- | --- | --- |
| Edge / Worker | `apps/api/src/routes` | 18개 라우트 모듈 (admin/ 중첩) |
| 미들웨어 | `apps/api/src/middleware` | CORS, 로깅, 분석, 보안 헤더 |
| 데이터 | `apps/api/src/db` | Drizzle 스키마(34 테이블), seed, helpers |
| 영속 객체 | `apps/api/src/durable-objects` | `RateLimiter`, `JobScheduler` |
| 작업 | `apps/api/src/jobs` | 10개 cron 작업 |
| 검증 | `apps/api/src/validators` | Zod 요청 스키마 |
| 마이그레이션 | `apps/api/migrations` | 31개 D1 SQL |
| 외부 | `apps/api/src/lib/fas` | Hyperdrive 통한 FAS 연동 |
| 자산 | `R2`, `ACETIME_BUCKET` | 이미지·동영상, 출퇴근 자산 |
| 프런트 | `apps/worker`, `apps/admin` | Next.js 15 App Router, 정적 익스포트 |

## Cloudflare 바인딩 / Cloudflare Bindings

`wrangler.toml`이 단일 출처이며 `npm run check:wrangler-sync`로 소스와 표의 정합성을 검증합니다.

| 바인딩 | 종류 | 용도 |
| --- | --- | --- |
| `DB` | D1 | 주 데이터베이스 (Drizzle, 34 테이블) |
| `FAS_HYPERDRIVE` | Hyperdrive | 외부 FAS 직원 DB |
| `ASSETS` | Workers Static Assets | 작업자·관리자 SPA 자산 |
| `R2` | R2 | 사용자 업로드 이미지·동영상 |
| `ACETIME_BUCKET` | R2 | 출퇴근 관련 자산 |
| `KV` | KV | 인증 캐시, 시스템 상태, 설정 |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | Queue | 알림 파이프라인 |
| `RATE_LIMITER` | Durable Object | 토큰 버킷 속도 제한 |
| `JOB_SCHEDULER` | Durable Object | cron 작업 디스패치 |

## 인증과 권한 / Auth & Authorization

- **발급**: 로그인 시 KST 자정 만료 JWT, Zustand 지속 저장소 보관 (`safetywallet-auth`, `safetywallet-admin-auth`).
- **검증 3단계**: JWT 디코드 → KST 날짜 확인 → KV 캐시 조회 → D1 폴백.
- **권한 모델**: 역할(`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`) × 사이트 멤버십 × 필드 플래그(`canAwardPoints`, `canReview`, `canExportData`).
- **클라이언트**: Zustand + 401 refresh mutex.

## 테스트 / Testing

| 종류 | 명령 | 위치 / 도구 |
| --- | --- | --- |
| 단위 | `npm run test` | 워크스페이스 전반 Vitest |
| 커버리지 | `npm run test -- --coverage` | turbo + Vitest |
| 타입 | `npm run typecheck` | 워크스페이스 전반 tsc |
| 린트 | `npm run lint`, `npm run lint:naming` | ESLint, naming 가드 |
| 안티 패턴 | `go run scripts/check-anti-patterns.go` | lint-staged 훅 |
| E2E (headless) | `npm run e2e` | Playwright, 6 프로젝트 |
| E2E (headed / UI) | `npm run e2e:headed`, `e2e:ui` | Playwright Inspector |
| 사전 점검 | `npm run git:preflight`, `npm run verify` | Go 도구 |
| 포맷 | `npm run format`, `npm run format:check` | Prettier |

## 모바일 배포 / Mobile Distribution

`apps/worker/android/`는 Bubblewrap으로 생성된 TWA(Trusted Web Activity) 래퍼입니다. 패키지 `me.jclee.safetywallet.twa`로 빌드되며 `twa-manifest.json`과 `web_app_manifest.json`을 참조합니다. 작업자 PWA는 브라우저만으로 사용 가능하며, APK는 옵션 배포 채널입니다.

## 운영과 관측 / Operations

- **cron**: `apps/api/src/jobs/*`의 10개 작업이 `JOB_SCHEDULER` DO에서 실행됩니다.
- **알림**: `NOTIFICATION_QUEUE` 발행, 실패는 `NOTIFICATION_DLQ`에서 재처리.
- **속도 제한**: `RATE_LIMITER` DO의 토큰 버킷 (KV 보조 캐시).
- **마이그레이션**: `apps/api/migrations`의 31개 SQL이 CI에서 순차 적용됩니다.
- **관측**: 미들웨어(`apps/api/src/middleware`)가 요청 로깅·분석·보안 헤더를 처리합니다.

## 기여 / Contributing

- 코드 스타일은 [`CODE_STYLE.md`](CODE_STYLE.md)를 따릅니다.
- 절차는 [`CONTRIBUTING.md`](CONTRIBUTING.md)를 참고하세요.
- 커밋 전 `lint`, `typecheck`, `verify`, `check:wrangler-sync` 통과를 권장합니다.

## 관리 / Maintainers

| 역할 책임 영역 | 담당 위치 / 참고 문서 |
| --- | --- |
| 제품/도메인 (위험·출퇴근·정산) | `AGENTS.md` 도메인 섹션 |
| API/플랫폼 (Hono, Drizzle, D1) | `apps/api/AGENTS.md` |
| 프런트엔드 (작업자 PWA, 관리자, UI) | `apps/worker/AGENTS.md`, `apps/admin/AGENTS.md`, `packages/ui` |
| 인프라 (CF 바인딩, CI/CD) | `wrangler.toml`, `.github/workflows/` |
| QA (E2E 시나리오, Vitest) | `e2e/`, `playwright.config.ts` |
| 다국어 (ko, en, vi, zh) | `packages/types` 번역, `apps/worker/I18N_IMPLEMENTATION.md` |

## 더 읽을 거리 / Further Documentation

- [`AGENTS.md`](AGENTS.md) — 프로젝트 지식 베이스, 인증/바인딩 요약 (60개 AGENTS.md 인덱스의 진입점).
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — 시스템 아키텍처 다이어그램과 모듈 경계.
- [`CODE_STYLE.md`](CODE_STYLE.md) — 코드 스타일 가이드.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — PR·이슈 가이드라인.
- [`LICENSE`](LICENSE) — AGPL-3.0 전문.
- `docs/` — PRD, 요구사항 명세, 운영 런북.