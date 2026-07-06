# SafetyWallet / 안전지갑

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Hono%20%7C%20Next.js%20%7C%20Cloudflare%20Workers-blue)
![Runtime](https://img.shields.io/badge/node-%E2%89%A520.0.0-339933)
![Package manager](https://img.shields.io/badge/npm-10.8.2-CB3837)
![Pipeline](https://img.shields.io/badge/turborepo-workspace-FF1E56)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)
![i18n](https://img.shields.io/badge/i18n-ko%20%7C%20en%20%7C%20vi%20%7C%20zh-0aa)

---

## 한국어 요약

SafetyWallet은(는) 건설 현장의 작업자가 모바일 PWA에서 위험 요인을 보고하고 출퇴근을 기록하며 안전 포인트를 적립하도록 돕는 클라우드 네이티브 서비스입니다. 단일 Cloudflare Worker가 Hono 기반 API와 정적으로 내보낸(exported) Next.js 프런트엔드 두 개(작업자용 · 관리자용)를 호스트 이름 라우팅으로 동시에 제공하며, D1 · R2 · KV · Hyperdrive · Queue · Durable Object를 엣지에서 결합합니다. 관리자는 별도 콘솔에서 게시물 검토 · 정산 · 교육 · 컴플라이언스를 처리하고, 작업자는 한국어 · 영어 · 베트남어 · 중국어로 제공되는 PWA를 사용해 현장 활동을 기록합니다.

## English Summary

SafetyWallet is a cloud-native service that lets construction-site workers report hazards, log attendance, and earn safety points from a mobile PWA. A single Cloudflare Worker serves the Hono API and two statically-exported Next.js frontends (worker + admin) through hostname routing, combining D1, R2, KV, Hyperdrive, Queues, and Durable Objects at the edge. Site admins handle reviews, settlements, education, and compliance from a dedicated console, while workers record day-to-day field activity through a localized PWA (ko, en, vi, zh).

---

## 한눈에 보기 / At a Glance

| 항목 / Item                | 값 / Value                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------- |
| 제품명 / Product           | SafetyWallet (안전지갑)                                                                |
| 배포 모델 / Deployment     | Cloudflare Workers + Workers Static Assets                                            |
| 데이터 저장 / Data         | D1(주 DB) · R2(이미지/영상) · KV(캐시/세션) · Hyperdrive(FAS 사외 DB)                    |
| 비동기 / Async             | Notification Queue + DLQ, Durable Object(`RateLimiter`, `JobScheduler`)                |
| 워크스페이스 / Workspace   | Turborepo (`apps/*`, `packages/*`)                                                    |
| 런타임 / Runtime           | Node.js ≥ 20.0.0, npm 10.8.2                                                          |
| 인증 / Auth                | JWT (KST 자정 만료) · Zustand 영구 저장소 · 401 refresh mutex                          |
| 권한 등급 / Roles          | WORKER · SITE_ADMIN · SUPER_ADMIN · SYSTEM                                            |
| i18n                       | ko · en · vi · zh (런타임 사전을 클라이언트 측 번들로 주입)                             |
| E2E 테스트 / E2E           | Playwright 6 프로젝트 (auth setup · admin · worker 플로우)                             |
| 라이선스 / License         | Proprietary (저장소 루트의 [`LICENSE`](../LICENSE) 참조)                               |

## 운영 흐름 / Operator Flow

1. 개발자가 `wrangler.toml` 의 Worker 이름 · 바인딩을 정의합니다.
2. 모노레포에서 `types → ui → apps` 순으로 Turbo 파이프라인이 빌드합니다.
3. `apps/api` 가 Hono 라우트 18개 · Durable Object 2개 · Cron Job 10개를 한 Worker에 패키징합니다.
4. `apps/worker` · `apps/admin` 은 `output: export` 로 정적 산출물을 생성하고 Worker가 ASSETS 바인딩으로 호스트 이름별로 라우팅합니다.
5. Push 시 GitHub Actions가 lint → typecheck → 가드 검사 → test → build → D1 마이그레이션을 수행하고, `master` 는 CI에서 직접 배포합니다.
6. 운영자는 Playwright E2E(`e2e`)와 Vitest 단위 테스트를 합쳐 회귀를 확인합니다.

---

## 목차 / Table of Contents

1. [목적 / Purpose](#목적--purpose)
2. [패키지 구성 / Package Contents](#패키지-구성--package-contents)
3. [상태 / Status](#상태--status)
4. [처음 읽을 파일 / First Files to Read](#처음-읽을-파일--first-files-to-read)
5. [진입점과 라우팅 / Entry Points & Routing](#진입점과-라우팅--entry-points--routing)
6. [아키텍처 / Architecture](#아키텍처--architecture)
7. [빠른 시작 / Quickstart](#빠른-시작--quickstart)
8. [명령어 참조 / Commands Reference](#명령어-참조--commands-reference)
9. [로컬 개발 / Local Development](#로컬-개발--local-development)
10. [테스트 / Testing](#테스트--testing)
11. [기여 가이드 / Contributing](#기여-가이드--contributing)
12. [유지보수자와 문의 / Maintainers & Contact](#유지보수자와-문의--maintainers--contact)
13. [추가 문서 / Further Documentation](#추가-문서--further-documentation)
14. [라이선스 / License](#라이선스--license)

---

## 목적 / Purpose

SafetyWallet은(는) 건설 현장의 안전 관리 운영을 모바일 1st 인터페이스로 옮기기 위한 풀스택 SaaS입니다. 작업자는 스마트폰으로 사진을 첨부한 위험 신고를 올리고, 출퇴근을 자동 · 수동으로 기록하고, 안전 활동에 대한 포인트를 적립합니다. 현장 관리자(SITE_ADMIN)는 게시물 검토, 포인트 정산, 안전 교육 게시, 컴플라이언스 자료 내보내기를 같은 워크플로에서 처리합니다. SUPER_ADMIN은 다중 현장 테넌시 · 사용자 권한 · 결제 요금을 관장합니다.

일반적인 사용 사례:

- **현장 작업자** — 출근 체크 후 위험 요소를 사진과 함께 제출하고, 본인이 작성한 포스트에 대한 투표와 알림을 받습니다.
- **현장 관리자** — 게시물 큐를 검토하고 승인을 내리며, 정산 마감 전에 KPI를 검토합니다.
- **안전 감사자** — 교육 모듈을 게시하고 이수율을 추적하며, 컴플라이언스 자료를 CSV/PDF로 추출합니다.
- **외부 통합** — Hyperdrive 를 통해 사외 FAS 임직원 DB와 주기적으로 동기화합니다.

## 패키지 구성 / Package Contents

| 경로 / Path                          | 역할 / Role                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `apps/api`                           | Cloudflare Worker API (Hono + Drizzle + D1) · Durable Object · Cron Job 모음     |
| `apps/admin`                         | Next.js 15 관리자 콘솔 (정적 export, port 3001)                                  |
| `apps/worker`                        | Next.js 15 작업자 PWA (정적 export, port 3000) · 커스텀 i18n 런타임               |
| `apps/worker/android`                | Bubblewrap 으로 패키징한 TWA(Trusted Web Activity) 프로젝트                     |
| `packages/types`                     | 공유 TS 타입 · 열거형 · DTO · i18n 사전 데이터                                    |
| `packages/ui`                        | shadcn/ui 기반 공유 컴포넌트 + Tailwind v4 토큰                                  |
| `docs/`                              | PRD · 요구사항 명세 · 운영 런북 (별도 디렉터리)                                   |
| `scripts/`                           | verify / naming lint / anti-pattern 검사 등 Go · JS 도구                          |
| `e2e/`                               | Playwright E2E (auth setup · admin · worker 흐름)                                |
| `wrangler.toml`                      | 루트 CF Worker 설정 + 모든 바인딩 정의                                            |
| `turbo.json`                         | 파이프라인 정의 (`types → ui → apps`)                                            |

## 상태 / Status

- **활성 / Active**: 본 저장소의 모든 앱은 활발히 개발 중이며 `master` 브랜치는 GitHub Actions를 통해 자동 배포됩니다.
- **수동 배포 비활성 / Manual deploy disabled**: `npm run deploy:api` 는 의도적으로 즉시 실패하도록 스크립트되어 있으며, 배포는 Git-ref 기반 CI만 가능합니다.
- **프로덕션 준비도 / Production readiness**: Hono API · 관리자 콘솔 · 작업자 PWA 모두 자체 호스팅 전제에 가깝게 다듬어진 상태이며, 변경 사항은 CI 가드(이름 규칙 · 안티 패턴 · anti-pattern check · anti-pattern lint)와 Playwright 회귀 테스트를 통과해야 합니다.

## 처음 읽을 파일 / First Files to Read

아래 순서로 읽으면 30분 안에 코드베이스 전체의 모양이 잡힙니다.

| 순서 | 파일                                          | 읽고 얻는 것                                                   |
| ---- | --------------------------------------------- | --------------------------------------------------------------- |
| 1    | [`../AGENTS.md`](../AGENTS.md)                | 프로젝트 지식 베이스(스택 · 구조 · 인증 · 바인딩)                |
| 2    | [`../ARCHITECTURE.md`](../ARCHITECTURE.md)    | 요청 흐름 · 엣지 토폴로지 · 데이터 모델 개요                     |
| 3    | [`../CODE_STYLE.md`](../CODE_STYLE.md)        | 네이밍 규칙 · 모듈 경계 · 금지 패턴                              |
| 4    | [`../CONTRIBUTING.md`](../CONTRIBUTING.md)    | PR 절차 · lint-staged · Husky 훅                                 |
| 5    | [`../wrangler.toml`](../wrangler.toml)        | 바인딩 목록 · 환경 변수 · 크론 트리거                            |
| 6    | `apps/worker/AGENTS.md`                       | 작업자 PWA 의 라우트 · 컴포넌트 · 상태 관리 정책                 |
| 7    | `apps/worker/I18N_IMPLEMENTATION.md`          | 커스텀 i18n 런타임 동작 방식                                     |

## 진입점과 라우팅 / Entry Points & Routing

| 표면 / Surface       | 진입점 / Entry Point                                      | 호스트 이름 / Hostname        | 산출물 / Output                |
| -------------------- | --------------------------------------------------------- | ----------------------------- | ------------------------------ |
| 작업자 PWA           | `apps/worker/src/app/` (App Router)                       | `worker.<도메인>` (예시 도메인) | 정적 export (Worker ASSETS)    |
| 관리자 콘솔          | `apps/admin/src/app/` (App Router)                        | `admin.<도메인>` (예시 도메인) | 정적 export (Worker ASSETS)    |
| API                  | `apps/api/src/index.ts` → Hono 라우터                      | `api.<도메인>` (예시 도메인) | Workers runtime (Hono)         |
| Health Check         | Hono 라우터의 `GET /health`                                | 동일 API 도메인               | JSON status                    |
| Durable Objects      | `apps/api/src/durable-objects/{RateLimiter,JobScheduler}`  | API 도메인 내부              | Workers DO                     |
| Cron Jobs            | `apps/api/src/jobs/*` (총 10개)                            | Cloudflare Triggers          | 내부 잡                        |
| Android TWA          | `apps/worker/android/`                                    | 모바일 패키지                  | APK / AAB                      |

호스트 이름 라우팅은 `wrangler.toml` 의 routes 설정과 Worker의 hostname 검사 미들웨어에서 처리합니다. 실제 호스트 이름은 조직 배포 정책에 맞게 교체해서 사용하세요.

## 아키텍처 / Architecture

### 요청 흐름 (작업자 모바일)

1. 작업자가 PWA 에서 폼을 제출합니다.
2. Next.js 정적 산출물은 Cloudflare ASSETS 바인딩을 통해 즉답됩니다.
3. API 호출은 JWT 를 Authorization 헤더로 싣고 `api.<도메인>` 으로 이동합니다.
4. Cloudflare Worker 의 Hono 라우터가 CORS · 로깅 · 분석 · 보안 헤더 미들웨어를 통과시킵니다.
5. 인증 미들웨어가 JWT 디코드 → KST 자정 검증 → KV 캐시 조회 → D1 폴백 순으로 사용자를 식별합니다.
6. 권한 미들웨어가 역할 · 현장 멤버십 · 필드 플래그(`canAwardPoints`, `canReview`, `canExportData`)를 확인합니다.
7. 라우트 핸들러가 Drizzle 로 D1 에 읽고/쓰며, 필요 시 R2 로 미디어를 업로드하고 Hyperdrive 로 사외 DB 와 동기화합니다.
8. 부수 효과는 `NOTIFICATION_QUEUE` 로 발행되어 DLQ 로 안전하게 처리됩니다.

### Cloudflare 바인딩

| 바인딩                  | 종류 / Type               | 용도 / Purpose                                                |
| ----------------------- | ------------------------- | ------------------------------------------------------------- |
| `DB`                    | D1                        | 주 데이터베이스(34 테이블, SQLite via Drizzle)                |
| `FAS_HYPERDRIVE`        | Hyperdrive                | 외부 FAS 임직원 DB                                            |
| `ASSETS`                | Workers Static Assets     | 작업자 + 관리자 SPA 정적 파일                                  |
| `R2`                    | R2                        | 사용자가 업로드한 이미지/영상                                 |
| `ACETIME_BUCKET`        | R2                        | 출퇴근 관련 자산                                              |
| `KV`                    | KV                        | 인증 캐시 · 시스템 상태 · 설정                                |
| `NOTIFICATION_QUEUE`    | Queue                     | 알림 배달 파이프라인                                          |
| `NOTIFICATION_DLQ`      | Queue                     | 알림 배달 데드 레터                                           |
| `RATE_LIMITER`          | Durable Object            | API 속도 제한                                                 |
| `JOB_SCHEDULER`         | Durable Object            | Cron 잡의 진행 상태                                           |

### 권한 모델

| 등급              | 책임                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| `WORKER`          | 본인 출퇴근 · 본인 게시물 작성/수정                                         |
| `SITE_ADMIN`      | 현장 단위 게시물 검토 · 정산 · 교육 게시                                    |
| `SUPER_ADMIN`     | 다중 현장 · 사용자 권한 · 결제 요금                                         |
| `SYSTEM`          | 내부 잡 · 마이그레이션 · 운영 도구 전용                                     |

추가로 현장 멤버십 테이블과 필드 플래그(`canAwardPoints`, `canReview`, `canExportData`)가 정책 결정을 보완합니다. 자세한 권한 매트릭스는 [`../AGENTS.md`](../AGENTS.md) 와 [`../ARCHITECTURE.md`](../ARCHITECTURE.md) 를 참조하세요.

## 빠른 시작 / Quickstart

사전 요구 사항:

- Node.js ≥ 20.0.0
- npm 10.8.2 (저장소 고정)
- Wrangler (`npm i -g wrangler`)
- Cloudflare 계정과 D1 · R2 · KV · Hyperdrive · Queue 네임스페이스
- Playwright 브라우저 (`npx playwright install`)

절차:

1. 의존성을 설치합니다.

   ```bash
   npm install
   ```

2. 환경을 준비합니다. `.dev.vars` 에 Wrangler 비밀 값을, `.env.e2e` 에 E2E 자격증명을 둡니다(둘 다 gitignore). `op run --env-file=.env.e2e` 패턴으로 1Password CLI 를 사용할 수 있습니다.

3. Drizzle 스키마와 마이그레이션을 생성 · 적용합니다.

   ```bash
   npm run db:generate
   ```

4. 로컬 개발 서버를 띄웁니다.

   ```bash
   npm run dev
   ```

   Turborepo 가 `apps/api` (Worker), `apps/admin` (포트 3001), `apps/worker` (포트 3000) 을 동시에 구동합니다.

5. 프로덕션 빌드를 생성합니다.

   ```bash
   npm run build
   ```

   `build:api` 단계로 Worker 를 패키징하고, `build:static` 단계로 두 Next.js 앱을 `dist/` 아래로 모읍니다.

6. E2E 테스트를 실행합니다.

   ```bash
   npm run e2e
   ```

## 명령어 참조 / Commands Reference

| 명령어                       | 설명                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                | Turbo 가 모든 앱을 병렬로 구동 (Worker + Admin + Worker API)          |
| `npm run build`              | API 와 정적 자산을 모두 빌드하여 `dist/` 에 산출                       |
| `npm run build:api`          | 공유 타입과 Worker API 만 빌드(빠른 반복용)                            |
| `npm run build:one-worker`   | `build:api` 의 단축 별칭                                              |
| `npm run build:static`       | `apps/worker/out` 과 `apps/admin/out` 을 `dist/` 로 복사              |
| `npm run lint`               | Turbo 가 모든 앱에서 ESLint 수행                                       |
| `npm run lint:naming`        | `scripts/lint-naming.js` 로 명명 규칙 일괄 검사                        |
| `npm run typecheck`          | Turbo 가 모든 앱에서 TS 타입 검사                                      |
| `npm run test`               | Turbo 가 모든 앱에서 Vitest 실행                                       |
| `npm run test:coverage`      | 커버리지 리포트 포함                                                   |
| `npm run e2e`                | Playwright E2E (1Password CLI 경유)                                    |
| `npm run e2e:headed` / `e2e:ui` | headed 모드 / UI 모드                                                |
| `npm run check:wrangler-sync`| `scripts/check-wrangler-sync.js` 로 wrangler 설정 ↔ 코드를 동기화 검사 |
| `npm run git:preflight`      | 커밋/PR 전 사전 점검                                                   |
| `npm run verify`             | 종합 검증 스크립트                                                     |
| `npm run format` / `format:check` | Prettier 쓰기/검사                                                 |
| `npm run clean`              | 모든 빌드 산출물과 `node_modules` 제거                                  |
| `npm run db:generate`        | Drizzle 스키마 → SQL 마이그레이션 생성                                  |
| `npm run deploy:api`         | 의도적으로 실패 (CI-only 배포 정책 안내)                                |

## 로컬 개발 / Local Development

- **빌드 순서**: Turbo 가 `packages/types → packages/ui → apps/*` 순으로 의존성을 강제합니다. 단일 앱만 보고 싶다면 `npm run dev --workspace=apps/worker` 처럼 `--workspace` 플래그를 쓰세요.
- **환경 변수**: 로컬은 Wrangler 의 `.dev.vars`, E2E 는 `.env.e2e` + 1Password CLI, 프로덕션은 `wrangler.toml` 의 `[vars]` 와 `wrangler secret put` 으로 분리합니다.
- **TWA 패키징**: `apps/worker/android/` 는 Bubblewrap 프로젝트입니다. PWA 빌드 후 `./gradlew assembleRelease` 로 APK/AAB 를 만들 수 있습니다.
- **데이터 마이그레이션**: `apps/api/migrations/` 의 SQL 을 Drizzle 가 추적합니다. 스키마 변경은 PR 단위로 추가하고 CI 가 자동 검증합니다.

## 테스트 / Testing

| 레이어 / Layer      | 도구 / Tool           | 위치 / Where                                                          |
| ------------------- | --------------------- | --------------------------------------------------------------------- |
| 단위 / Unit         | Vitest                | 각 앱/패키지의 `*.test.ts(x)`                                         |
| 통합 / Integration  | Vitest + Miniflare    | Hono 라우터 · Durable Object 시뮬레이션                                |
| E2E                 | Playwright            | `e2e/` 디렉터리 (auth setup + admin + worker)                          |
| 가드 / Guards       | Go 스크립트            | `scripts/check-anti-patterns.go`, `scripts/verify.go`                  |
| 명명 / Naming       | Node 스크립트          | `scripts/lint-naming.js`                                              |
| 포맷 / Format       | Prettier              | `lint-staged` 가 커밋 시점에 자동 적용                                |

E2E 의 실행은 `op run --env-file=.env.e2e -- npx playwright test` 패턴을 권장합니다. 헤드리스 모드 외에 `e2e:headed`, `e2e:ui` 가 제공됩니다.

## 기여 가이드 / Contributing

1. 브랜치를 만들고 [`../CODE_STYLE.md`](../CODE_STYLE.md) 의 명명 규칙을 따릅니다.
2. Husky 가 커밋 직전에 `check-anti-patterns.go` 와 Prettier 를 실행합니다.
3. PR 은 `npm run lint && npm run typecheck && npm run test && npm run check:wrangler-sync` 가 모두 통과해야 합니다.
4. 저장소 정책에 따라 변경 범위가 Drizzle 마이그레이션 · Worker 바인딩 · KV 키 네임스페이스에 닿으면 PR 본문에 영향 분석을 적어 주세요.
5. 세부 절차는 [`../CONTRIBUTING.md`](../CONTRIBUTING.md) 를 따릅니다.

## 유지보수자와 문의 / Maintainers & Contact

| 역할 / Role            | 채널 / Channel                                              |
| ---------------------- | ----------------------------------------------------------- |
| 제품 책임 / Product    | 사내 PM 채널, 분기별 로드맵 리뷰                            |
| 엔지니어링 리드 / Eng  | 사내 Slack `#safetywallet-dev`                              |
| 보안 신고 / Security   | 사내 보안팀 핫라인 (PGP 키는 사내 위키 참조)                |
| 인프라 / Infra         | Cloudflare 대시보드 + Wrangler tail 로그                     |

## 추가 문서 / Further Documentation

| 문서 / Document                                         | 경로 / Path                                              |
| -------------------------------------------------------- | --------------------------------------------------------- |
| 프로젝트 지식 베이스 / Project knowledge base            | [`../AGENTS.md`](../AGENTS.md)                            |
| 아키텍처 명세 / Architecture spec                         | [`../ARCHITECTURE.md`](../ARCHITECTURE.md)                |
| 코드 스타일 / Code style                                 | [`../CODE_STYLE.md`](../CODE_STYLE.md)                    |
| 기여 가이드 / Contributing                               | [`../CONTRIBUTING.md`](../CONTRIBUTING.md)                |
| 작업자 PWA 에이전트 노트 / Worker PWA agent notes         | `apps/worker/AGENTS.md`                                   |
| i18n 구현 노트 / i18n implementation notes               | `apps/worker/I18N_IMPLEMENTATION.md`                      |
| 작업자 PWA 전역 스타일 / Worker global CSS               | `apps/worker/src/app/globals.css`                         |
| 작업자 PWA 에러 경계 / Worker error boundary             | `apps/worker/src/app/error.tsx`                           |
| Playwright 설정 / Playwright config                      | [`../playwright.config.ts`](../playwright.config.ts)      |
| Turborepo 파이프라인 / Turborepo pipeline                | [`../turbo.json`](../turbo.json)                          |
| Wrangler 설정 / Wrangler config                          | [`../wrangler.toml`](../wrangler.toml)                    |

수요에 따라 `docs/` 아래의 PRD · 요구사항 명세 · 운영 런북을 추가합니다.

## 라이선스 / License

본 저장소는 Proprietary 라이선스입니다. 자세한 조건은 저장소 루트의 [`LICENSE`](../LICENSE) 파일을 참조하세요. 외부 기여는 별도 Contributor License Agreement 가 필요할 수 있습니다.