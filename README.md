# SafetyWallet / 안전지갑

> 모바일 우선 PWA 기반 건설 현장 안전 보고 · 출퇴근 · 안전 포인트 인센티브 플랫폼. Cloudflare 엣지에서 API, 관리자 콘솔, 작업자 PWA가 함께 제공됩니다.
> Mobile-first PWA for construction-site safety reporting, attendance, and safety-point incentive management — deployed end-to-end on the Cloudflare edge.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Hono%20%7C%20Drizzle%20%7C%20Next.js%2015%20%7C%20Cloudflare%20Workers-blue)
![Node](https://img.shields.io/badge/node-%E2%89%A520.0.0-green)
![npm](https://img.shields.io/badge/npm-10.8.2-CB3837)
![Turborepo](https://img.shields.io/badge/turborepo-workspace-FF1E56)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

---

## 한국어 요약

SafetyWallet은(는) 건설 현장 작업자가 모바일 PWA로 위험 요인을 보고하고 출퇴근을 기록하며 안전 포인트를 적립할 수 있도록 돕는 클라우드 네이티브 SaaS입니다. 단일 Cloudflare Worker가 Hono 기반 API와 두 개의 정적으로 export된 Next.js 프런트엔드를 호스트 이름 라우팅으로 동시에 제공하며, D1 · R2 · KV · Hyperdrive · Queue · Durable Object를 엣지에서 결합합니다. 관리자는 별도 콘솔에서 게시물 검토, 정산, 교육, 컴플라이언스를 처리하고, 작업자는 한국어 · 영어 · 베트남어 · 중국어로 본 PWA를 통해 현장 활동을 기록합니다.

## English Summary

SafetyWallet is a cloud-native SaaS that lets construction-site workers report hazards, log attendance, and earn safety points from a mobile PWA. A single Cloudflare Worker serves the Hono API and two statically-exported Next.js frontends via hostname routing, combining D1, R2, KV, Hyperdrive, Queues, and Durable Objects at the edge. Site admins review posts, run settlements, manage education, and handle compliance from a dedicated console, while workers use a localized PWA (ko, en, vi, zh) for day-to-day field activity.

---

## 한눈에 보기 / At a Glance

| 항목 / Item            | 값 / Value                                                                 |
| ---------------------- | -------------------------------------------------------------------------- |
| 배포 모델 / Deployment | Cloudflare Workers + Workers Static Assets                                 |
| 저장소 / Storage       | D1 (주 DB), R2 (미디어), KV (캐시 · 설정), Hyperdrive (외부 FAS)           |
| 인증 / Auth            | JWT (KST 자정 만료) + KV 캐시 + 3단계 권한                                 |
| 패키지 매니저 / PM     | npm 10.8.2 (워크스페이스)                                                  |
| 빌드 오케스트레이션    | Turborepo (`types → ui → api → admin → worker`)                            |
| 프런트엔드 / Frontend  | Next.js 15 App Router, 정적 export (`output: "export"`)                    |
| i18n                   | ko · en · vi · zh (커스텀 런타임, [`packages/types`](packages/types))      |
| 상태 / Status          | Active (운영 중, 60개의 AGENTS.md 유지)                                    |
| Node 엔진              | `>=20.0.0`                                                                 |

## 운영 상태 / Runtime Status

| 컴포넌트 / Component | 위치 / Location                | 책임 / Responsibility                              |
| -------------------- | ------------------------------ | --------------------------------------------------- |
| API (Hono)           | `apps/api`                     | 18개 라우트 모듈, Drizzle ORM, 31개 D1 마이그레이션 |
| Admin 콘솔           | `apps/admin` (port 3001)       | 출퇴근 · 게시물 · 투표 · 교육 정산 · 회원 관리      |
| Worker PWA           | `apps/worker` (port 3000)      | 로그인 · 게시물 작성 · 출퇴근 체크 · 교육 시청      |
| Android TWA          | `apps/worker/android`          | Bubblewrap 기반 Trusted Web Activity 래퍼          |
| 공유 타입 / Types    | `packages/types`               | TS 타입, enum, DTO, i18n 번역 데이터                |
| 공유 UI / UI         | `packages/ui`                  | shadcn/ui + Tailwind v4 테마 토큰                   |
| E2E 테스트           | `e2e/` + `playwright.config.ts` | 6개 Playwright 프로젝트, `op run` 기반 시크릿 주입  |
| 운영 스크립트 / Ops  | `scripts/`                     | Go · JS 도구 (verify, naming, anti-pattern, preflight) |

---

## Purpose & Package Contents / 목적과 구성

SafetyWallet은(는) 건설 현장에서 발생하는 안전 인시던트 보고, 작업자 출퇴근, 안전 교육 이수, 인센티브 정산을 하나의 모바일 우선 워크플로로 묶는 것을 목표로 합니다. 작업자는 현장 스마트폰에서 바로 PWA를 실행해 게시물을 작성하고, 관리자는 같은 데이터에 대해 검토·승인·포인트 부여·정산 처리를 수행합니다.

| 패키지 / Package    | 역할 / Role                                                              |
| ------------------- | ------------------------------------------------------------------------ |
| `apps/api`          | Hono 기반 API Worker. 18개 라우트 모듈, Zod 검증, Drizzle ORM, Durable Object(RateLimiter, JobScheduler), 10개 cron 잡 |
| `apps/admin`        | Next.js 15 관리자 대시보드, 정적 export, 포트 3001                       |
| `apps/worker`       | Next.js 15 작업자 PWA, 정적 export, 포트 3000, 커스텀 i18n 런타임         |
| `apps/worker/android` | Trusted Web Activity (Bubblewrap) 빌드, 알림 아이콘/스플래시/매니페스트 |
| `packages/types`    | 공유 TypeScript 타입, enum, DTO, i18n 번역 데이터                        |
| `packages/ui`       | 공유 shadcn/ui 컴포넌트와 Tailwind v4 테마 토큰                          |
| `docs/`             | PRD, 요구사항 명세, 운영 런북                                            |
| `scripts/`          | verify, naming lint, anti-pattern 검사, git preflight, wrangler sync 점검 |
| `e2e/`              | Playwright E2E (auth setup, admin, worker 플로우)                        |
| `.github/workflows` | CI/CD 파이프라인 (lint → typecheck → guards → test → build → migrate)   |

## Status / 운영 상태

| 항목 / Item    | 상태 / Status                                                |
| -------------- | ------------------------------------------------------------ |
| 활성 여부      | Active (운영 중)                                             |
| 안정성         | Production-ready on Cloudflare edge                          |
| 사내 사용      | 현장 운영 배포 진행 중                                        |
| AGENTS.md      | 코드베이스 전반에 60개 파일로 컨텍스트 유지                   |
| Deprecated     | 없음 / None                                                   |

## First Files to Read / 먼저 읽을 파일

운영자·기여자 모두에게 아래 순서로 읽기를 권장합니다. 짧은 의존 그래프를 따라 한 번 훑으면 전체 그림이 잡힙니다.

1. [`package.json`](package.json) — npm 워크스페이스 정의와 루트 스크립트
2. [`turbo.json`](turbo.json) — 빌드 파이프라인 (`types → ui → api → admin → worker`)
3. [`wrangler.toml`](wrangler.toml) — Cloudflare Worker 바인딩과 환경 변수
4. [`AGENTS.md`](AGENTS.md) — 프로젝트 지식 베이스 (오버뷰, 구조, 인증, 바인딩)
5. [`ARCHITECTURE.md`](ARCHITECTURE.md) — 시스템 아키텍처 상세
6. [`CODE_STYLE.md`](CODE_STYLE.md) — 코드 스타일 규칙
7. [`CONTRIBUTING.md`](CONTRIBUTING.md) — 기여 절차와 가드
8. [`apps/worker/src/app/AGENTS.md`](apps/worker/src/app/AGENTS.md) — 작업자 PWA 내부 컨텍스트
9. [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) — i18n 런타임 구현 메모

---

## Architecture / 아키텍처

### 호스트 이름 라우팅 / Hostname Routing

Cloudflare Worker는 들어오는 `Host` 헤더를 기준으로 한 번에 세 가지 책임을 분기합니다.

| 호스트 패턴 / Host         | 응답 / Response                                    |
| -------------------------- | -------------------------------------------------- |
| `api.<도메인>` / `api.<domain>` | Hono API 라우트 (`apps/api/src/routes`)            |
| `admin.<도메인>` / `admin.<domain>` | `apps/admin/out` 정적 자산 (Workers Assets)        |
| `<기타>` / worker 도메인   | `apps/worker/out` 정적 자산 (Workers Assets)        |

### Cloudflare 바인딩 / Cloudflare Bindings

| 바인딩                                     | 종류 / Type           | 용도 / Purpose                                          |
| ------------------------------------------ | --------------------- | ------------------------------------------------------- |
| `DB`                                       | D1                    | 주 데이터베이스 (34개 테이블, Drizzle ORM)              |
| `FAS_HYPERDRIVE`                           | Hyperdrive            | 외부 FAS 직원 데이터베이스                              |
| `ASSETS`                                   | Workers Static Assets | 정적 프런트엔드 자산 (worker + admin)                   |
| `R2`                                       | R2                    | 사용자가 업로드한 이미지 · 비디오                       |
| `ACETIME_BUCKET`                           | R2                    | 출퇴근 관련 자산                                         |
| `KV`                                       | KV                    | 인증 캐시, 시스템 상태, 설정                            |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ`  | Queue                 | 알림 전송 파이프라인                                     |
| `RATE_LIMITER`                             | Durable Object        | 분산 속도 제한                                           |
| `JOB_SCHEDULER`                            | Durable Object        | cron 잡의 단일 실행 보장                                 |

### 인증 · 권한 / Auth & Authorization

| 계층 / Layer      | 메커니즘 / Mechanism                                              |
| ----------------- | ----------------------------------------------------------------- |
| 토큰 / Token      | JWT, KST 자정 만료 (KST same-day midnight expiry)                 |
| 검증 / Validation | JWT 디코드 → KST 일자 확인 → KV 캐시 조회 → D1 폴백 (3중 검증)   |
| 권한 / Roles      | `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`                  |
| 멤버십 / Membership | 사이트별 사용자 멤버십                                            |
| 필드 플래그 / Flags | `canAwardPoints`, `canReview`, `canExportData` 등 필드 단위 권한  |
| 클라이언트 / Client | Zustand 영속 저장소 + 401 refresh mutex. 키: `safetywallet-auth` (작업자), `safetywallet-admin-auth` (관리자) |

### 요청 흐름 / Request Flow

1. 모바일 PWA 또는 관리자 콘솔이 Cloudflare 엣지로 요청을 전송합니다.
2. Worker가 호스트 이름으로 라우팅을 결정하고 (API · 정적 자산) `Hono` 앱 또는 `ASSETS`로 분기합니다.
3. API 요청은 CORS · 로깅 · 분석 · 보안 헤더 미들웨어를 거친 뒤 JWT 3중 검증을 수행합니다.
4. 라우트 핸들러가 Zod 스키마로 입력을 검증하고, Drizzle을 통해 D1 또는 Hyperdrive(FAS)로 위임합니다.
5. 미디어 업로드는 R2로 직접 전송되며, 알림은 `NOTIFICATION_QUEUE`로 인큐되어 별도 워커가 소비합니다.
6. 응답은 표준 보안 헤더와 함께 클라이언트로 반환되고, 인증 정보는 KV에 캐시됩니다.
7. 정기 잡은 `JOB_SCHEDULER` Durable Object가 단일 실행을 보장하며, 알림 실패는 `NOTIFICATION_DLQ`로 라우팅됩니다.

---

## API & Entry Points / API와 엔트리 포인트

### Hono API 라우트 (선택)

API는 [`apps/api/src/routes`](apps/api/src/routes) 아래에 모듈화되어 있으며, 일반적인 진입점은 다음과 같습니다.

| 경로 패턴 / Pattern                | 메서드 / Method   | 설명 / Description                            |
| ---------------------------------- | ----------------- | --------------------------------------------- |
| `/api/auth/login`                  | POST              | JWT 발급, KST 자정 만료                       |
| `/api/auth/refresh`                | POST              | 401 시 토큰 갱신                              |
| `/api/posts`                       | GET / POST        | 안전 게시물 목록 조회 · 작성                  |
| `/api/posts/:id`                   | GET / PATCH       | 게시물 상세 · 검토                            |
| `/api/attendance`                  | GET / POST        | 출퇴근 체크, R2 자산 업로드                   |
| `/api/education`                   | GET / POST        | 안전 교육 시청 기록                           |
| `/api/votes`                       | POST              | 안전 포인트 투표 · 지급                       |
| `/api/admin/...`                   | 다양 / various    | 정산, 회원 관리, 데이터 내보내기               |

> 운영 환경의 정확한 베이스 URL은 `wrangler.toml`의 `routes` 섹션과 환경 변수(`API_BASE_URL`)에 정의되어 있습니다. 자세한 스키마는 [`packages/types`](packages/types)의 DTO 정의를 참조하세요.

### 프런트엔드 진입점 / Frontend Entry Points

| 앱 / App       | 진입점 / Entry Point                       | 빌드 출력 / Build Output                |
| -------------- | ------------------------------------------ | --------------------------------------- |
| Worker PWA     | [`apps/worker/src/app/page.tsx`](apps/worker/src/app/page.tsx)         | `apps/worker/out/`                      |
| Worker Layout  | [`apps/worker/src/app/layout.tsx`](apps/worker/src/app/layout.tsx)     | (루트 레이아웃, i18n 프로바이더)         |
| Worker Error   | [`apps/worker/src/app/error.tsx`](apps/worker/src/app/error.tsx)       | (에러 바운더리)                          |
| Android TWA    | [`apps/worker/android/app/src/main/java/me/jclee/safetywallet/twa/LauncherActivity.java`](apps/worker/android/app/src/main/java/me/jclee/safetywallet/twa/LauncherActivity.java) | `twa-manifest.json`, Gradle 빌드        |

---

## Quickstart / 빠르게 시작하기

### 사전 요구 사항 / Prerequisites

| 도구 / Tool | 버전 / Version | 비고 / Notes                            |
| ----------- | -------------- | --------------------------------------- |
| Node.js     | `>=20.0.0`     | `engines` 필드 확인                      |
| npm         | `10.8.2`       | `packageManager` 고정 (`corepack enable` 권장) |
| Wrangler    | 최신 / latest  | Cloudflare Worker 로컬 실행용            |
| 1Password CLI | 최신 / latest | E2E 시크릿 주입 (`op run`)              |
| Go (선택)   | 1.22+          | `scripts/*.go` 도구 실행 시              |

### 설치 / Install

```bash
git clone <repository-url> safetywallet
cd safetywallet
npm install
```

### 환경 변수 / Environment Variables

| 변수 / Variable      | 용도 / Purpose                                    |
| -------------------- | ------------------------------------------------- |
| `API_BASE_URL`       | 프런트엔드가 호출하는 API 호스트                  |
| `WORKER_HOSTNAME`    | Worker PWA가 응답할 호스트 이름                   |
| `ADMIN_HOSTNAME`     | Admin 콘솔이 응답할 호스트 이름                   |
| `CLOUDFLARE_*`       | Cloudflare 계정 인증 (CI에서 주입)               |
| `.env.e2e`           | E2E용 시크릿 모음 (`op run --env-file=.env.e2e`) |

운영 비밀값은 코드에 직접 두지 말고, CI 시크릿 또는 1Password Vault에서 주입하세요.

### 첫 실행 / First Run

```bash
# 1) 공유 타입 · UI 빌드 후 워커 PWA · 어드민 · API 개발 서버 동시 기동
npm run dev

# 2) 전체 빌드 (정적 자산까지 묶어서 dist/ 로 산출)
npm run build

# 3) Playwright E2E (1Password 시크릿 필요)
npm run e2e
```

기본 포트는 Worker PWA `3000`, Admin `3001`입니다. 실제 호스트 이름 라우팅은 Cloudflare에 배포된 후 동작합니다.

---

## Configuration / 설정

### `wrangler.toml` 주요 키 / Key Sections

| 섹션 / Section       | 설명 / Description                                          |
| -------------------- | ----------------------------------------------------------- |
| `name`               | Worker 이름                                                  |
| `main`               | Worker 엔트리 (`apps/api/src/index.ts`)                      |
| `compatibility_date` | Workers 호환성 날짜                                          |
| `assets`             | 정적 자산 매니페스트 디렉터리                                 |
| `[[d1_databases]]`   | D1 바인딩 (`DB`)                                             |
| `[[r2_buckets]]`     | R2 바인딩 (`R2`, `ACETIME_BUCKET`)                           |
| `[[kv_namespaces]]`  | KV 바인딩                                                    |
| `[[hyperdrive]]`     | 외부 FAS 연결                                                |
| `[[queues]]`         | 알림 큐 / DLQ                                                |
| `[[durable_objects]]` | RateLimiter, JobScheduler 바인딩                              |
| `[[routes]]`         | 호스트 이름 라우팅 규칙                                      |

`npm run check:wrangler-sync` 스크립트는 라우트 패턴과 코드 내부 화이트리스트의 일치를 자동 점검합니다.

### i18n / 다국어

| 언어 / Locale | 코드 / Code | 출처 / Source                                                |
| ------------- | ----------- | ------------------------------------------------------------ |
| 한국어        | `ko`        | [`packages/types`](packages/types) + [`apps/worker/src/i18n`](apps/worker/src/i18n) |
| English       | `en`        | 동일                                                          |
| Tiếng Việt    | `vi`        | 동일                                                          |
| 中文          | `zh`        | 동일                                                          |

번역 추가는 [`packages/types`](packages/types) 데이터 파일과 [`apps/worker/src/i18n`](apps/worker/src/i18n) 런타임을 함께 갱신해야 합니다. 자세한 절차는 [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md)를 참조하세요.

---

## Commands Reference / 명령어 레퍼런스

루트 [`package.json`](package.json)에서 실행하는 주요 스크립트입니다.

| 명령어 / Command                | 용도 / Purpose                                                  |
| ------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                   | Turbo로 모든 워크스페이스 개발 서버 동시 실행                    |
| `npm run build`                 | 전체 빌드 후 `dist/`에 정적 자산 통합                            |
| `npm run build:api`             | `packages/types` → `apps/api` 빌드 (Worker 1종만 배포 시)        |
| `npm run build:one-worker`      | `build:api`의 단축 별칭                                          |
| `npm run build:static`          | `dist/` 재생성 (worker → admin 순서로 정적 자산 복사)            |
| `npm run lint`                  | Turbo로 워크스페이스별 ESLint 실행                               |
| `npm run lint:naming`           | 네이밍 규칙 검사 (`scripts/lint-naming.js`)                     |
| `npm run typecheck`             | Turbo로 워크스페이스별 `tsc --noEmit`                            |
| `npm run test`                  | Vitest 단위/통합 테스트                                         |
| `npm run test:coverage`         | 커버리지 리포트 동시 출력                                        |
| `npm run e2e`                   | Playwright E2E (`op run --env-file=.env.e2e`)                  |
| `npm run e2e:headed`            | 헤드 모드 E2E                                                    |
| `npm run e2e:ui`                | Playwright UI 모드                                               |
| `npm run db:generate`           | Drizzle 스키마 → SQL 생성 (`apps/api`)                          |
| `npm run check:wrangler-sync`   | `wrangler.toml` ↔ 코드 화이트리스트 일치 검사                    |
| `npm run git:preflight`         | 커밋 전 Go 기반 사전 점검                                        |
| `npm run verify`                | Go 기반 통합 검증                                                |
| `npm run format` / `format:check` | Prettier 쓰기 / 검사                                            |
| `npm run clean`                 | Turbo clean + `node_modules` 삭제                                |
| `npm run deploy:api`            | 수동 배포 비활성화 (CI on master로만 배포)                       |

> `deploy:api`는 의도적으로 실패합니다. 배포는 master 브랜치 Git ref 기반 CI에서만 수행됩니다.

---

## Local Development / 로컬 개발

| 작업 / Task                  | 절차 / Steps                                                          |
| ---------------------------- | --------------------------------------------------------------------- |
| 작업자 PWA 단독 개발         | `npm run dev --workspace=apps/worker`                                  |
| 관리자 콘솔 단독 개발        | `npm run dev --workspace=apps/admin`                                   |
| API 단독 개발                | `npm run dev --workspace=apps/api` (Wrangler 로컬 모드)                |
| 공유 타입 변경 반영          | `npm run build --workspace=packages/types` 후 앱 재기동                |
| D1 로컬 마이그레이션          | `wrangler d1 migrations apply DB --local`                              |
| Android TWA 빌드             | `cd apps/worker/android && ./gradlew assembleRelease`                  |
| 시크릿 주입 E2E              | `op run --env-file=.env.e2e -- npx playwright test`                    |
| Husky 훅 설치                | `npm install` 시 `prepare` 훅으로 자동 설치                            |
| 커밋 전 검사                 | lint-staged: `*.{ts,tsx}` → `check-anti-patterns.go` + Prettier, 그 외 → Prettier |

---

## Testing / 테스트

| 종류 / Kind  | 도구 / Tool          | 위치 / Location          | 명령어 / Command               |
| ------------ | -------------------- | ------------------------ | ------------------------------ |
| 단위 / Unit  | Vitest               | 워크스페이스별           | `npm run test`                 |
| 커버리지     | Vitest (`--coverage`) | 동일                    | `npm run test:coverage`        |
| 타입 / Type  | `tsc --noEmit`       | Turbo로 워크스페이스별   | `npm run typecheck`            |
| 린트 / Lint  | ESLint + 네이밍 검사 | Turbo + `scripts/`        | `npm run lint` / `lint:naming` |
| 정적 분석    | `check-anti-patterns.go` | lint-staged 훅        | (커밋 시 자동)                  |
| E2E          | Playwright           | [`e2e/`](e2e)            | `npm run e2e`                  |
| CI 파이프라인 | GitHub Actions      | `.github/workflows`      | (PR · master push 시 자동)      |

CI는 `lint → typecheck → guards → test → build → migrate` 순서로 실행됩니다. PR을 올리면 위 순서가 자동으로 검증됩니다.

---

## Maintainers & Points of Contact / 유지보수와 연락처

| 역할 / Role        | 책임 / Responsibility                                |
| ------------------ | ----------------------------------------------------- |
| 제품 · 운영        | `me.jclee` (SafetyWallet 운영팀)                      |
| 백엔드 · Worker    | `apps/api` 코드 오너 — API · Durable Object · 잡      |
| 프런트엔드         | `apps/admin`, `apps/worker` 코드 오너                 |
| 모바일 패키징      | `apps/worker/android` (TWA 빌드)                      |
| 공유 모듈          | `packages/types`, `packages/ui`                       |
| E2E · QA           | `e2e/` + Playwright 설정                              |
| 인프라             | Cloudflare 계정 · DNS · 바인딩 (`wrangler.toml`)       |

내부 이슈 트래커와 1Password Vault는 사내 문서(`docs/`)를 참조하세요.

## Contributing / 기여 가이드

기여 전 [`CONTRIBUTING.md`](CONTRIBUTING.md)와 [`CODE_STYLE.md`](CODE_STYLE.md)를 반드시 읽어 주세요.

| 단계 / Step | 내용 / Detail                                                |
| ----------- | ------------------------------------------------------------ |
| 1. 브랜치   | `feat/<scope>-<short>` 또는 `fix/<scope>-<short>`            |
| 2. 코드     | 워크스페이스 컨벤션 준수, 공유 타입 변경 시 `packages/types` 먼저 |
| 3. 가드     | `npm run lint` · `typecheck` · `test` 통과                    |
| 4. 커밋     | Husky 훅 자동 실행: `check-anti-patterns.go`, Prettier         |
| 5. PR       | CI 통과 후 리뷰, Cloudflare preview 환경에서 수동 확인         |
| 6. 머지     | master 머지 시 CI가 자동으로 Worker를 Git ref 기반으로 배포    |

## License / 라이선스

Proprietary (사내 라이선스). 자세한 조건은 [`LICENSE`](LICENSE) 파일을 참조하세요. 외부 배포 · 복제 · 수정은 금지됩니다.

---

## Further Documentation / 추가 문서

| 문서 / Document                                              | 내용 / Topic                                |
| ------------------------------------------------------------ | ------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                     | 프로젝트 지식 베이스 (오버뷰, 구조, 바인딩)  |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                         | 시스템 아키텍처 상세                          |
| [`CODE_STYLE.md`](CODE_STYLE.md)                             | 코드 스타일 규칙                             |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                         | 기여 절차와 가드                              |
| [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md)             | 작업자 PWA 컨텍스트                          |
| [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) | i18n 런타임 구현 메모              |
| [`apps/worker/src/app/AGENTS.md`](apps/worker/src/app/AGENTS.md) | 작업자 PWA 내부 라우트 컨텍스트             |
| [`docs/`](docs)                                              | PRD, 요구사항 명세, 운영 런북                |
| [`turbo.json`](turbo.json)                                   | 빌드 파이프라인 정의                          |
| [`wrangler.toml`](wrangler.toml)                             | Cloudflare Worker 설정                       |
| [`playwright.config.ts`](playwright.config.ts)               | E2E 프로젝트 6종 정의                        |

### 도움말 받기 / Getting Help

| 채널 / Channel         | 용도 / When to Use                              |
| ---------------------- | ----------------------------------------------- |
| 사내 이슈 트래커       | 버그 리포트, 작업 항목, 릴리스 요청             |
| `docs/` 런북           | 배포, 마이그레이션, 장애 대응 절차              |
| `AGENTS.md`            | 코드 위치 · 책임 범위 확인                      |
| 운영팀 (SafetyWallet)  | 인증 · 바인딩 · 인프라 관련 긴급 이슈            |