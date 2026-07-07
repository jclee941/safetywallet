# SafetyWallet (안전지갑)

[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)]()
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)]()
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)]()
[![Turborepo](https://img.shields.io/badge/Turborepo-2-cc00ff.svg)]()
[![License](https://img.shields.io/badge/License-Proprietary-lightgrey.svg)]()

## 요약 (Summary)

SafetyWallet(안전지갑)은 현장 근로자가 모바일 PWA로 위험 요인을 신고하고 출퇴근을 기록하며 안전 포인트를 적립하고, 현장 관리자가 대시보드에서 리뷰·정산·컴플라이언스를 처리하도록 돕는 현장 안전 관리 플랫폼이다. 단일 Cloudflare Worker가 Hono 기반 API와 두 개의 Next.js 15 정적 프런트엔드(작업자 PWA, 관리자 대시보드)를 호스트 이름 기반 라우팅으로 제공하며, D1·R2·KV·Queue·Durable Object를 결합해 인증·알림·미디어·스케줄러를 한 곳에서 운영한다. 작업자 PWA는 Trusted Web Activity 래퍼를 통해 Android 설치 패키지(TWA)로도 배포된다.

A bilingual, Korean-first overview of a field-safety platform built on a single Cloudflare Worker that hosts a Hono API and two statically exported Next.js 15 frontends. The worker PWA also ships with an Android TWA wrapper for native install on site devices.

## 한눈에 보기 (At a Glance)

| 항목 | 값 | 비고 |
| --- | --- | --- |
| 제품명 | SafetyWallet (안전지갑) | `package.json` `name` |
| 버전 | `0.1.0` | `private: true` |
| 패키지 매니저 | npm 10.8.2 | `packageManager` 고정 |
| Node | `>= 20.0.0` | `engines` |
| 빌드 오케스트레이터 | Turborepo | `turbo.json` |
| 워크스페이스 | `apps/*`, `packages/*` | `package.json` |
| 프런트엔드 | Next.js 15 App Router (static export) | `apps/worker`, `apps/admin` |
| API | Hono + Drizzle + D1 | `apps/api` |
| 호스팅 | Cloudflare Workers + Static Assets | `wrangler.toml` |
| 인증 | JWT (KST 자정 만료) + KV 캐시 | Zustand 영속 스토어 |
| 모바일 | PWA + Android TWA (APK/AAB) | `apps/worker/android/` |
| 단위 테스트 | Vitest | 워크스페이스별 `vitest.config.ts` |
| E2E 테스트 | Playwright (6 프로젝트) | `playwright.config.ts` |
| E2E 비밀 주입 | `op run --env-file=.env.e2e` | 1Password CLI |

## 핵심 흐름 (Core Flow)

| 단계 | 주체 | 동작 | 산출물 |
| --- | --- | --- | --- |
| 1 | 현장 근로자 | 모바일 PWA 로그인, 출퇴근·위험 신고·안전 활동 기록 | D1 트랜잭션 + R2 미디어 |
| 2 | 클라이언트 | JWT 발급(자정 만료) → Zustand 영속 저장 | `safetywallet-auth` 스토어 |
| 3 | Hono API | JWT 디코드 → KST 자정 검증 → KV 캐시 → D1 폴백 | 요청별 권한 결정 |
| 4 | 현장 관리자 | 관리자 대시보드에서 리뷰·정산·승인 | 알림 큐 발행 |
| 5 | `JobScheduler` DO | 크론 잡 실행(정산·마감·정리 등 10종) | D1 갱신 + 큐 발행 |
| 6 | 알림 파이프라인 | `NOTIFICATION_QUEUE` → 소비자 → 실패 시 `NOTIFICATION_DLQ` | 푸시/SMS/이메일 |

## 목차 (Table of Contents)

1. [목적 및 패키지 구성 (Purpose & Package Contents)](#목적-및-패키지-구성)
2. [상태 (Status)](#상태)
3. [먼저 읽을 파일 (First Files to Read)](#먼저-읽을-파일)
4. [API 및 진입점 (API & Entry Points)](#api-및-진입점)
5. [빠른 시작 (Quickstart)](#빠른-시작)
6. [아키텍처 (Architecture)](#아키텍처)
7. [구성 (Configuration)](#구성)
8. [명령어 참조 (Commands Reference)](#명령어-참조)
9. [로컬 개발 (Local Development)](#로컬-개발)
10. [테스트 (Testing)](#테스트)
11. [기여 가이드 (Contribution)](#기여-가이드)
12. [유지보수자 (Maintainers)](#유지보수자)
13. [추가 문서 (Further Documentation)](#추가-문서)
14. [라이선스 (License)](#라이선스)

## 목적 및 패키지 구성

### 왜 유용한가 (Why It's Useful)

- 현장 근로자는 출퇴근·위험요인·안전 활동을 모바일에서 즉시 기록할 수 있다.
- 현장 관리자는 별도 시스템 없이 리뷰, 정산, 컴플라이언스를 대시보드에서 처리한다.
- 단일 Cloudflare Worker 배포로 운영 복잡도를 낮추고 엣지에서 낮은 지연 시간을 제공한다.
- 작업자 PWA는 TWA 래퍼로 Android 기기에도 설치 가능하다.
- 34개 D1 테이블 + 10개 크론 잡 + Durable Object로 결제를 포함한 운영 업무를 자동화한다.

### 주요 사용자 (Who Uses It)

| 역할 | 사용 인터페이스 | 주요 활동 |
| --- | --- | --- |
| 현장 근로자 (`WORKER`) | 모바일 PWA / TWA | 출퇴근, 위험 신고, 안전 활동, 교육 시청 |
| 현장 관리자 (`SITE_ADMIN`) | 관리자 대시보드 | 출퇴근 승인, 정산, 근로자 관리 |
| 슈퍼 관리자 (`SUPER_ADMIN`) | 관리자 대시보드 | 현장 간 비교, 정책, 보고 |
| 시스템 (`SYSTEM`) | 내부 워커 / 잡 | 자동 정산, 알림, 마감 |

### 저장소 구성 (Package Contents)

| 경로 | 설명 | 출처 |
| --- | --- | --- |
| `apps/worker/` | Next.js 15 정적 export 작업자 PWA. App Router, 다국어(`ko`, `en`, `vi`, `zh`), Android TWA. 기본 포트 3000. | 파일 트리 |
| `apps/admin/` | Next.js 15 정적 export 관리자 대시보드. 출퇴근·게시글·투표·교육 화면. 기본 포트 3001. | AGENTS.md |
| `apps/api/` | Cloudflare Worker 기반 Hono API. 18개 라우트 모듈, 34개 D1 테이블, 10개 크론 잡, Durable Object, R2/KV/Queue 바인딩. | AGENTS.md |
| `packages/types/` | 공유 TypeScript 타입, enum, DTO, i18n 번역 데이터. | AGENTS.md |
| `packages/ui/` | 공유 shadcn/ui 컴포넌트 + Tailwind v4 토큰. | AGENTS.md |
| `e2e/` | Playwright E2E 테스트(인증 설정, 관리자/작업자 흐름). | AGENTS.md |
| `docs/` | PRD, 요구사항 명세, 운영 런북. | AGENTS.md |
| `scripts/` | Go/JS 도구(`verify`, `lint-naming`, `check-anti-patterns`, `git-preflight`, `check-wrangler-sync`). | `package.json` |
| `.github/workflows/` | CI/CD 파이프라인(lint → typecheck → guards → test → build → migrate). | AGENTS.md |
| `wrangler.toml` | 루트 Cloudflare Worker 설정과 모든 바인딩. | 파일 트리 |
| `turbo.json` | Turborepo 파이프라인(`types → ui → apps`). | 파일 트리 |
| `playwright.config.ts` | Playwright E2E 6 프로젝트 설정. | 파일 트리 |
| `vitest.config.ts` | 루트 단위 테스트 설정. | 파일 트리 |

## 상태

| 항목 | 상태 |
| --- | --- |
| 제품 성숙도 | Active (운영 중, 코드베이스 전반에 60개 `AGENTS.md`) |
| 메이저 버전 | `0.1.0` (사전 공개) |
| 공개 범위 | `private: true` — 비공개 |
| API 런타임 | Cloudflare Workers (V8 isolates) |
| 데이터베이스 | Cloudflare D1 (SQLite via Drizzle, 34 테이블) |
| 자산 저장소 | Cloudflare R2 (`R2`, `ACETIME_BUCKET`) |
| 캐시 / 설정 | Cloudflare KV |
| 메시지 큐 | Cloudflare Queues (`NOTIFICATION_QUEUE`, `NOTIFICATION_DLQ`) |
| 스케줄러 | `JobScheduler` Durable Object + 10개 크론 잡 |
| 속도 제한 | `RATE_LIMITER` Durable Object |
| 모바일 | PWA + Android TWA (Gradle 래퍼, APK/AAB 패키징) |
| 프로덕션 준비도 | 운영 중 — 배포는 `master` Git-ref 기반 CI에서만 트리거됨 |
| 수동 배포 | 금지 — `npm run deploy:api`는 의도적으로 실패한다 |

## 먼저 읽을 파일

순서대로 읽으면 제품을 빠르게 파악할 수 있다.

1. [`AGENTS.md`](AGENTS.md) — 스택, 구조, 인증, 바인딩, 운영 규칙 요약.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — 요청 흐름, 모듈 경계, 데이터 흐름.
3. [`CODE_STYLE.md`](CODE_STYLE.md) — 명명 규칙, 파일 구조, 스타일 강제.
4. [`CONTRIBUTING.md`](CONTRIBUTING.md) — PR 절차, 가드 스크립트, 커밋 규약.
5. [`apps/worker/src/app/`](apps/worker/src/app) — 작업자 PWA의 App Router 진입점.
6. [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md) — 작업자 모듈 지식 베이스.
7. `apps/api/src/routes/` — Hono 라우트 모듈 (AGENTS.md 기준 18개).
8. `apps/api/src/db/` — Drizzle 스키마 (34 테이블).
9. [`wrangler.toml`](wrangler.toml) — 운영 환경 바인딩과 호스트 라우팅.
10. `docs/` — PRD, 요구사항 명세, 운영 런북.

## API 및 진입점

### 작업자 PWA 진입점

| 항목 | 값 |
| --- | --- |
| 루트 디렉터리 | `apps/worker/` |
| App Router 디렉터리 | `apps/worker/src/app/` |
| 다국어 런타임 | `apps/worker/src/i18n/` (`ko`, `en`, `vi`, `zh`) |
| 에러 경계 | `apps/worker/src/app/error.tsx` |
| 글로벌 스타일 | `apps/worker/src/app/globals.css` |
| 정적 export 출력 | `apps/worker/out/` → 최종 `dist/` |
| TWA 소스 | `apps/worker/android/` (Gradle, `twa-manifest.json`, `manifest-checksum.txt`) |
| Next 설정 | `apps/worker/next.config.mjs` |
| Tailwind 설정 | `apps/worker/tailwind.config.js` |
| PostCSS 설정 | `apps/worker/postcss.config.cjs` |
| 기본 개발 포트 | 3000 |

### 관리자 진입점

| 항목 | 값 |
| --- | --- |
| 루트 디렉터리 | `apps/admin/` |
| App Router 디렉터리 | `apps/admin/src/app/` (출퇴근, 게시글, 투표, 교육) |
| 정적 export 출력 | `apps/admin/out/` → 최종 `dist/admin/` |
| 기본 개발 포트 | 3001 |

### API 진입점

| 항목 | 값 |
| --- | --- |
| 루트 디렉터리 | `apps/api/` |
| 라우트 | `apps/api/src/routes/` (18개 모듈, 일부 `admin/` 중첩) |
| 미들웨어 | `apps/api/src/middleware/` (CORS, logging, analytics, security headers) |
| 인증·헬퍼 | `apps/api/src/lib/` (Auth, FAS 통합, R2 헬퍼) |
| DB 스키마 | `apps/api/src/db/` (Drizzle, 34 테이블) |
| Durable Object | `apps/api/src/durable-objects/` (`RateLimiter`, `JobScheduler`) |
| 크론 잡 | `apps/api/src/jobs/` (10개) |
| 검증 스키마 | `apps/api/src/validators/` (Zod) |
| 마이그레이션 | `apps/api/migrations/` (31개 SQL) |

## 빠른 시작

### 사전 조건 (Prerequisites)

- Node.js 20 이상
- npm 10.8.2 (`packageManager` 고정값과 일치 권장)
- Wrangler CLI (`npx wrangler`)
- Cloudflare 계정, D1, R2, KV, Queue 사용 권한
- JDK 17 + Android SDK (Android TWA 패키징 시)
- 1Password CLI (`op`) — E2E 비밀값 주입용

### 설치 (Install)

```bash
npm install
npm run db:generate
```

### 개발 서버 실행 (Run Dev Servers)

```bash
npm run dev
```

Turborepo가 다음 워크스페이스를 병렬로 실행한다.

| 워크스페이스 | 기본 포트 | 비고 |
| --- | --- | --- |
| `apps/worker` (작업자 PWA) | 3000 | Next.js 개발 서버 |
| `apps/admin` (관리자 대시보드) | 3001 | Next.js 개발 서버 |
| `apps/api` (Hono Worker) | Wrangler 개발 프록시 | 로컬 Workers 런타임 |

### 빌드 (Build)

```bash
npm run build           # turbo run build + 정적 export를 dist/로 복사
npm run build:api       # packages/types + apps/api만 빌드
npm run build:one-worker # API 워크스페이스 단독 빌드
```

빌드 산출물:

| 산출물 | 경로 |
| --- | --- |
| API 번들 | `apps/api/dist/` (Wrangler 업로드 대상) |
| 작업자 PWA 정적 자산 | `apps/worker/out/` → `dist/` |
| 관리자 대시보드 정적 자산 | `apps/admin/out/` → `dist/admin/` |

### 첫 배포 (First Deploy)

1. Cloudflare 인증: `npx wrangler login`.
2. `wrangler.toml` 검토 후 D1/R2/KV/Queue 리소스 ID 동기화: `npm run check:wrangler-sync`.
3. D1 마이그레이션 적용 (CI에서 자동 또는 운영 절차에 따라 수동).
4. 변경을 `master`로 푸시 — 배포는 Git-ref 기반 CI가 트리거한다.
5. 수동 배포 스크립트(`npm run deploy:api`)는 의도적으로 실패한다. CI 외 배포 금지 정책.

## 아키텍처

### 워크스페이스 그래프 (Workspace Graph)

`packages/types → packages/ui → apps/*` 순으로 의존성이 강제된다.

| 단계 | 패키지 | 산출물 | 다음 단계 의존성 |
| --- | --- | --- | --- |
| 1 | `packages/types` | ESM 타입 | 모든 프런트엔드·API |
| 2 | `packages/ui` | ESM 컴포넌트 | 관리자·작업자 PWA |
| 3 | `apps/api` | Worker 번들 | `apps/worker`, `apps/admin`이 호출 |
| 4 | `apps/worker` | 정적 PWA | Cloudflare Static Assets |
| 5 | `apps/admin` | 정적 대시보드 | Cloudflare Static Assets |

### 요청 흐름 (Request Flow)

1. 클라이언트(작업자 PWA 또는 관리자 대시보드)가 `https://<host>/...`로 요청을 전송한다.
2. Cloudflare 엣지가 `wrangler.toml` 호스트 이름 라우팅으로 두 SPA 또는 API 중 하나로 분기한다.
3. API 경로일 경우 Hono 미들웨어 체인이 CORS, 로깅, 분석, 보안 헤더, 인증을 순차 적용한다.
4. 인증 미들웨어는 JWT 디코드 → KST 자정 만료 확인 → KV 캐시 조회 → D1 폴백 순으로 검증한다.
5. 권한 검사(`WORKER` / `SITE_ADMIN` / `SUPER_ADMIN` / `SYSTEM`)와 현장 멤버십, 필드 플래그(`canAwardPoints`, `canReview`, `canExportData`)가 적용된다.
6. Zod 검증 → 라우트 핸들러 → Drizzle로 D1 조회/변경 → 필요 시 R2 업로드 또는 큐 발행.
7. Durable Object(`RATE_LIMITER`)가 분당·시간당 요청을 제한한다.
8. 응답 직렬화 후 보안 헤더와 함께 반환한다.
9. 백그라운드 잡은 `JobScheduler` Durable Object가 10개 크론을 실행해 정산·마감·정리를 자동화한다.

### Cloudflare 바인딩 (Bindings)

| 바인딩 | 종류 | 용도 |
| --- | --- | --- |
| `DB` | D1 | 주 데이터베이스 (Drizzle, 34 테이블) |
| `FAS_HYPERDRIVE` | Hyperdrive | 외부 FAS 사원 데이터베이스 연결 |
| `ASSETS` | Workers Static Assets | 작업자·관리자 SPA 정적 파일 |
| `R2` | R2 | 사용자 업로드 이미지·비디오 |
| `ACETIME_BUCKET` | R2 | 출퇴근 관련 자산 |
| `KV` | KV | 인증 캐시, 시스템 상태, 설정 |
| `NOTIFICATION_QUEUE` | Queue | 알림 전달 파이프라인 |
| `NOTIFICATION_DLQ` | Queue | 알림 실패 데드레터 |
| `RATE_LIMITER` | Durable Object | 분산 속도 제한 |

### 인증·권한 (Authentication & Authorization)

| 계층 | 설명 |
| --- | --- |
| 토큰 | JWT 발급, KST 자정 만료, Zustand 영속 스토어 |
| 1차 검증 | JWT 디코드 + KST 자정 확인 |
| 2차 캐시 | KV 조회 |
| 3차 폴백 | D1 조회 |
| 역할 | `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM` |
| 멤버십 | 현장별 사용자-현장 매핑 |
| 필드 플래그 | `canAwardPoints`, `canReview`, `canExportData` |
| 클라이언트 키 | 작업자 `safetywallet-auth`, 관리자 `safetywallet-admin-auth` |
| 갱신 전략 | 401 수신 시 refresh mutex로 단일 갱신 보장 |

## 구성

### 루트 `package.json`

| 필드 | 값 | 의미 |
| --- | --- | --- |
| `name` | `safetywallet` | 패키지 이름 |
| `version` | `0.1.0` | 사전 공개 단계 |
| `private` | `true` | 외부 배포 금지 |
| `packageManager` | `npm@10.8.2` | 패키지 매니저 고정 |
| `workspaces` | `apps/*`, `packages/*` | 모노레포 |
| `engines.node` | `>= 20.0.0` | Node 20 이상 |
| `overrides` | `react@18.3.1`, `serialize-javascript >= 7.0.3` 등 | 보안 핀 |

### 환경 변수

루트에 `.env.e2e`(1Password CLI로 주입)와 워크스페이스별 `.env`를 둔다. 각 키의 정확한 목록은 [`docs/`](docs/)의 운영 런북을 참조한다.

### Wrangler 동기화

```bash
npm run check:wrangler-sync
```

로컬 `wrangler.toml`과 Cloudflare 원격 바인딩 정합성을 확인한다.

## 명령어 참조

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 모든 워크스페이스의 개발 서버를 병렬 실행 |
| `npm run build` | 전체 빌드 + 정적 산출물을 `dist/`로 복사 |
| `npm run build:api` | `packages/types` + `apps/api`만 빌드 |
| `npm run build:static` | `apps/worker/out`과 `apps/admin/out`을 `dist/`로 복사 |
| `npm run build:one-worker` | API 워크스페이스 단독 빌드 |
| `npm run lint` | Turbo 워크스페이스 전체 lint 실행 |
| `npm run lint:naming` | 명명 규칙 lint (`scripts/lint-naming.js`) |
| `npm run typecheck` | TypeScript 타입 체크 |
| `npm run test` | Vitest 단위 테스트 |
| `npm run test:coverage` | 커버리지 포함 단위 테스트 |
| `npm run e2e` | 1Password CLI로 비밀 주입 후 Playwright E2E |
| `npm run e2e:headed` | 헤드 모드 Playwright E2E |
| `npm run e2e:ui` | Playwright UI 모드 |
| `npm run db:generate` | Drizzle 스키마에서 마이그레이션 생성 |
| `npm run check:wrangler-sync` | Wrangler 설정과 원격 바인딩 동기화 검사 |
| `npm run git:preflight` | Git 푸시 전 가드 (Go) |
| `npm run verify` | 통합 검증 (Go) |
| `npm run format` | Prettier 자동 정렬 |
| `npm run format:check` | Prettier 검증 |
| `npm run clean` | 워크스페이스 정리 + `node_modules` 삭제 |
| `npm run deploy:api` | 의도적으로 실패 — CI 외 수동 배포 금지 |
| `npm run prepare` | Husky 훅 설치 |

## 로컬 개발

### 일반 워크플로

1. 기능 브랜치를 생성한다 (예: `feature/...`).
2. `npm install` 후 `npm run dev`로 워크스페이스를 띄운다.
3. 변경 후 `npm run lint && npm run typecheck && npm run test`로 통과를 확인한다.
4. 스키마 변경 시 `npm run db:generate`로 마이그레이션을 생성하고 검토 후 커밋한다.
5. PR 전 `npm run verify`로 전체 가드를 통과시킨다.
6. PR 전 `npm run format`을 적용한다.

### Android TWA 빌드

```bash
cd apps/worker/android
./gradlew assembleRelease
```

`twa-manifest.json`, `manifest-checksum.txt`, `LauncherActivity.java`, `DelegationService.java`, `Application.java`가 PWA를 네이티브 Android 앱으로 패키징한다.

### Husky / lint-staged

커밋 시 `scripts/check-anti-patterns.go`와 Prettier가 `lint-staged`를 통해 자동 실행된다. 강제되는 항목은 [`CODE_STYLE.md`](CODE_STYLE.md)에 정리되어 있다.

## 테스트

| 계층 | 도구 | 위치 | 실행 |
| --- | --- | --- | --- |
| 단위 | Vitest | 워크스페이스별 `vitest.config.ts` | `npm run test` |
| 커버리지 | Vitest + c8 | 동일 | `npm run test:coverage` |
| E2E | Playwright (6 프로젝트) | `e2e/`, [`playwright.config.ts`](playwright.config.ts) | `npm run e2e` |
| 정적 분석 | ESLint, TypeScript | Turbo 파이프라인 | `npm run lint`, `npm run typecheck` |
| 명명 규칙 | 사용자 스크립트 | `scripts/lint-naming.js` | `npm run lint:naming` |
| 안티 패턴 | Go 스크립트 | `scripts/check-anti-patterns.go` | `lint-staged` 훅 |
| Wrangler 동기화 | 사용자 스크립트 | `scripts/check-wrangler-sync.js` | `npm run check:wrangler-sync` |
| 통합 검증 | Go 스크립트 | `scripts/verify.go` | `npm run verify` |

E2E는 1Password CLI로 비밀을 주입해야 실행된다. CI에서도 동일하게 호출된다.

## 기여 가이드

기여 전 다음 문서를 반드시 읽는다.

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — PR 절차, 커밋 메시지 규약, 코드 리뷰 가이드.
- [`CODE_STYLE.md`](CODE_STYLE.md) — 명명 규칙, 모듈 경계, 스타일 강제.
- [`AGENTS.md`](AGENTS.md) — 워크스페이스 의존성, 인증·권한, 바인딩 제약.

권장 절차:

1. 이슈 또는 작업 항목을 먼저 생성한다.
2. 작업 브랜치를 만들고 범위를 좁게 유지한다.
3. Husky 훅과 `lint-staged`가 강제하는 검사를 통과시킨다.
4. `npm run verify`로 전체 가드를 통과시킨다.
5. PR 본문에 작업 요약, 테스트 결과, UI 변경 시 스크린샷을 포함한다.

## 유지보수자

| 항목 | 값 |
| --- | --- |
| 운영 책임 | 안전지갑 플랫폼 팀 |
| 사내 연락처 | 사내 디렉터리 / 운영 채널 참조 |
| 외부 연락 | 사내 정책에 따라 운영 채널 안내 |
| 인시던트 대응 | [`docs/`](docs/) 운영 런북 |

## 추가 문서

| 문서 | 설명 |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | 프로젝트 지식 베이스 (스택, 구조, 인증, 바인딩) |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 상세 아키텍처, 요청 흐름, 모듈 경계 |
| [`CODE_STYLE.md`](CODE_STYLE.md) | 코드 스타일, 명명, 구조 강제 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 기여 절차, PR 규약 |
| [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md) | 작업자 PWA 모듈 지식 |
| [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) | 다국어 런타임 구현 메모 |
| [`apps/worker/src/app/AGENTS.md`](apps/worker/src/app/AGENTS.md) | App Router 세부 가이드 |
| `docs/` | PRD, 요구사항, 운영 런북 |
| `e2e/` | Playwright E2E 시나리오 |

## 라이선스

이 저장소는 비공개(`private: true`)이며, 외부 배포를 금한다. 사내 라이선스 조건은 [`LICENSE`](LICENSE) 파일을 참조한다.