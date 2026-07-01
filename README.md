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

SafetyWallet은(는) 건설 현장 작업자가 모바일 PWA로 위험 요인을 보고하고 출퇴근을 기록하며 안전 포인트를 적립할 수 있도록 돕는 클라우드 네이티브 SaaS입니다. 단일 Cloudflare Worker가 Hono 기반 API와 두 개의 정적으로 export된 Next.js 프런트엔드를 호스트 이름 라우팅으로 동시에 제공하며, D1 · R2 · KV · Hyperdrive · Queue · Durable Object를 엣지에서 결합합니다.

## English Summary

SafetyWallet is a cloud-native SaaS that lets construction-site workers report hazards, log attendance, and earn safety points from a mobile PWA. A single Cloudflare Worker serves the Hono API and two statically-exported Next.js frontends via hostname routing, combining D1, R2, KV, Hyperdrive, Queues, and Durable Objects at the edge.

---

## 한눈에 보기 / At a Glance

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
| 운영 E2E               | Playwright (6 프로젝트), 1Password CLI 통합                              |

운영자가 가장 자주 쓰는 진입점은 `npm run dev`(로컬 통합 개발), `wrangler deploy`(Cloudflare 배포), `npm run e2e`(Playwright E2E), `npm run verify`(Go 기반 사전 점검) 입니다.

---

## 흐름 요약 / Flow Summary

1. 작업자가 모바일 PWA(Worker App, port 3000)에서 위험 보고 또는 출퇴근을 등록합니다.
2. 정적 export된 프런트엔드가 HTTPS 요청을 단일 Cloudflare Worker(`apps/api`)로 보냅니다.
3. Worker의 Hono 라우터가 호스트 이름(`api.`, `admin.`, 기본 도메인)으로 트래픽을 분기하고, JWT 인증과 3단계 권한 검사를 수행합니다.
4. 비즈니스 로직은 Drizzle ORM을 통해 D1(31 마이그레이션, 34 테이블)에 기록하고, 미디어는 R2에 업로드합니다.
5. 정기 작업은 10개의 cron 잡과 Durable Object 기반 `JobScheduler`로 처리됩니다.
6. 알림은 Queue → Consumer → R2 / 푸시 경로로 흘러가고, 실패 건은 DLQ로 격리됩니다.
7. 관리자 콘솔(Admin, port 3001)은 같은 Worker의 다른 호스트 이름 라우트로 제공되며 정적 export 결과를 `ASSETS` 바인딩으로 읽습니다.

---

## 패키지 구성 / Package Contents

| 경로 / Path                                | 역할 / Role                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `apps/api/`                                | Cloudflare Worker API (Hono + Drizzle + D1, 31 마이그레이션)                     |
| `apps/admin/`                             | Next.js 15 관리자 콘솔 (port 3001, `output: 'export'`)                            |
| `apps/worker/`                             | Next.js 15 작업자 PWA (port 3000, `output: 'export'`)                            |
| `apps/worker/android/`                     | Android TWA 빌드 (Bubblewrap 산출물)                                             |
| `packages/types/`                          | 공유 TS 타입 · enum · DTO · i18n 번역 데이터                                     |
| `packages/ui/`                             | 공유 shadcn/ui 컴포넌트 + Tailwind v4 토큰                                       |
| `scripts/`                                 | Go/JS 도구 (verify, naming lint, anti-pattern, preflight, wrangler-sync)        |
| `e2e/`                                     | Playwright E2E (auth, admin, worker 흐름)                                        |
| `docs/`                                    | PRD, 요구사항 명세, 운영 런북                                                    |
| `.github/workflows/`                       | CI/CD 파이프라인 정의                                                            |
| `wrangler.toml`, `turbo.json`, `vitest.config.ts`, `playwright.config.ts` | 빌드 · 테스트 설정 |

---

## 상태 / Status

- 활성 개발 중(internal active)이며 외부 공개 릴리스는 아닙니다.
- `apps/api`의 31개 D1 마이그레이션이 운영 DB에 순차 적용됩니다.
- 프로덕션 배포는 Git `master` 브랜치의 GitHub Actions에서만 트리거됩니다(수동 `wrangler deploy`는 의도적으로 비활성화).
- AGENTS.md 컨텍스트가 60개 위치에서 동기화되며, README는 그중 한 진입점입니다.

---

## 먼저 읽을 파일 / First Files to Read

운영자 또는 신규 합류자가 작업 순서대로 살펴보아야 할 핵심 문서는 다음과 같습니다.

| 순서 | 파일 / File                                  | 이유 / Why read it                                       |
| ---- | -------------------------------------------- | -------------------------------------------------------- |
| 1    | [AGENTS.md](./AGENTS.md)                     | 저장소 지식 베이스, 구조와 규칙의 단일 출처               |
| 2    | [ARCHITECTURE.md](./ARCHITECTURE.md)         | 시스템 아키텍처, 데이터 흐름, Cloudflare 바인딩          |
| 3    | [CONTRIBUTING.md](./CONTRIBUTING.md)         | 기여 절차, 커밋 규칙, PR 체크리스트                      |
| 4    | [CODE_STYLE.md](./CODE_STYLE.md)             | TypeScript / Drizzle / Tailwind 컨벤션                   |
| 5    | `wrangler.toml`                              | Worker 바인딩, 환경 변수, 라우트                         |
| 6    | `apps/api/src/routes/`                       | API 엔드포인트 목록과 권한 매트릭스                       |
| 7    | `apps/worker/src/i18n/`                      | 다국어 런타임 동작                                       |
| 8    | `docs/`                                      | PRD와 운영 런북                                          |

---

## API 및 진입점 / API & Entry Points

Cloudflare Worker는 다음 호스트 이름 라우팅으로 모든 트래픽을 제공합니다.

| 호스트 / Host      | 서비스 / Service        | 산출물 / Source                                                                 |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------- |
| `<root>`           | Worker PWA (Next.js)    | `apps/worker/out/` (정적 export)                                                |
| `admin.<root>`     | Admin Console (Next.js) | `apps/admin/out/admin/`                                                        |
| `api.<root>`       | Hono API                | `apps/api/src/routes/` (18 모듈)                                                |
| `/internal/cron/*` | Cron 핸들러             | `apps/api/src/jobs/` (10 잡)                                                    |
| `/internal/queue/*`| Queue Consumer          | `apps/api/src/jobs/notification-consumer.ts`                                    |

대표적인 HTTP 진입점은 다음과 같습니다.

| 메서드 / Method | 경로 / Path                       | 권한 / Role                | 설명 / Purpose                       |
| --------------- | --------------------------------- | -------------------------- | ------------------------------------ |
| `POST`          | `/api/v1/auth/login`              | Public                     | 로그인, JWT 발급                     |
| `POST`          | `/api/v1/posts`                   | WORKER                     | 위험 보고 작성                       |
| `POST`          | `/api/v1/attendance/check-in`     | WORKER                     | 출근 기록                            |
| `POST`          | `/api/v1/attendance/check-out`    | WORKER                     | 퇴근 기록                            |
| `POST`          | `/api/v1/uploads`                 | WORKER                     | R2 미디어 업로드 사전 서명           |
| `GET`           | `/api/v1/admin/posts`             | SITE_ADMIN, SUPER_ADMIN    | 관리자 보고 심사 큐 조회             |
| `POST`          | `/api/v1/admin/posts/:id/review`  | SITE_ADMIN, SUPER_ADMIN    | 보고 승인/반려                       |
| `POST`          | `/api/v1/admin/points/award`      | canAwardPoints 보유자      | 안전 포인트 부여                     |
| `GET`           | `/api/v1/admin/settlements`       | canExportData 보유자       | 정산 내역 export                      |
| `GET`           | `/internal/health`                | Internal                   | 헬스 체크 (CI에서 게이트로 사용)      |

전체 라우트와 Zod 스키마는 `apps/api/src/routes/` 및 `apps/api/src/validators/`에서 확인할 수 있습니다.

---

## 빠른 시작 / Quickstart

로컬에서 Worker · Admin · API를 함께 띄우는 표준 절차는 다음과 같습니다.

### 사전 요구사항 / Prerequisites

- Node.js ≥ 20.0.0
- npm 10.8.2 (`nvm use` 또는 Volta 권장)
- 1Password CLI (`op`) — E2E 및 시크릿 로드에 필요
- Cloudflare 계정과 `wrangler` 로그인 (`wrangler login`)
- D1, R2, KV, Hyperdrive, Queue 리소스가 프로비저닝된 계정

### 설치 / Install

```bash
npm install
npm run build:types
```

### 환경 변수 / Env

루트에 `.env` 파일을 작성하거나 1Password 항목에서 주입합니다. 예시는 `.env.example`(저장소 루트)을 참고합니다.

### 개발 서버 / Dev Servers

```bash
npm run dev
```

이 명령은 Turborepo가 다음 세 서버를 동시에 부팅합니다.

| 포트 / Port | 서비스 / Service | 작업 디렉터리        |
| ----------- | ---------------- | -------------------- |
| `3000`      | Worker PWA       | `apps/worker/`       |
| `3001`      | Admin Console    | `apps/admin/`        |
| `8787`      | Worker API (wrangler dev) | `apps/api/` |

### 빌드 및 배포 / Build & Deploy

```bash
npm run build          # turbo build + 정적 산출물 통합 (dist/)
npm run build:static   # apps/worker/out + apps/admin/out → dist/
npm run verify         # Go 스크립트로 사전 점검
```

프로덕션 배포는 `master` 푸시에서 GitHub Actions가 D1 마이그레이션과 `wrangler deploy`를 순차 실행합니다. 로컬에서 수동 배포는 `npm run deploy:api`에서 의도적으로 실패합니다.

---

## 아키텍처 / Architecture

SafetyWallet는 Cloudflare Workers 플랫폼에서 가능한 모든 구성 요소를 결합한 엣지 네이티브 시스템입니다.

| 계층 / Layer        | 구현 / Implementation                                                       |
| ------------------- | ---------------------------------------------------------------------------- |
| Edge 런타임         | Cloudflare Workers (V8 isolate), `@hono/zod-validator`                        |
| 라우팅              | Hono + hostname 매처, 정적 자산은 Workers Static Assets                     |
| 영속 저장           | D1(SQLite) + Drizzle ORM, 31 마이그레이션                                     |
| 외부 시스템         | Hyperdrive 캐시 어댑터를 통해 사내 FAS(employee DB) 연결                     |
| 미디어              | R2 버킷 `R2`와 출퇴근 전용 `ACETIME_BUCKET`                                  |
| 캐시 · 설정         | KV (`safetywallet:*` 네임스페이스)                                            |
| 비동기 처리         | Queues (`NOTIFICATION_QUEUE` + DLQ), Durable Object `RateLimiter`             |
| 잡 스케줄러         | `JobScheduler` DO + `/internal/cron/*` 엔드포인트                            |
| 인증                | JWT(KST 자정 만료) + KV 캐시, 3단계 권한 (역할 → 사이트 멤버십 → 필드 플래그) |
| 프런트엔드          | Next.js 15 App Router, `output: 'export'`, Tailwind v4                        |
| 모바일 패키지       | Bubblewrap으로 산출된 Android TWA, PWA WebAPK                                 |
| 관측                | 구조화 로거, 응답 헤더, 워커 메트릭, `/internal/health`                       |

### 인증 / Authorization

1. 클라이언트가 로그인하면 Worker가 JWT를 발급하고 KST 자정까지 유효한 만료 시각을 설정합니다.
2. 클라이언트는 발급된 토큰을 Zustand 영속 저장소(`safetywallet-auth`, `safetywallet-admin-auth`)에 보관합니다.
3. 모든 요청은 다음 3단계 검사를 통과합니다.
   - JWT 디코드 + 서명 + 만료(KST 자정 기준)
   - KV 캐시된 사용자 정보 조회 (없으면 D1 fallback)
   - 역할(`WORKER | SITE_ADMIN | SUPER_ADMIN | SYSTEM`) → 사이트 멤버십 → 필드 플래그(`canAwardPoints`, `canReview`, `canExportData`)
4. 401 응답은 클라이언트 측 refresh mutex로 단일 재시도로 제한됩니다.

### 데이터 흐름 / Data Flow

| 단계 / Step | 작업 / Action                                                     |
| ----------- | ----------------------------------------------------------------- |
| 1           | 클라이언트 → Worker SPA → `fetch('/api/v1/...')`                  |
| 2           | Hono 미들웨어가 CORS, 로깅, 보안 헤더, 레이트 리미트 적용         |
| 3           | 인증 미들웨어가 JWT + KV 캐시 + 권한 매트릭스 평가                |
| 4           | 라우트 핸들러가 Zod 스키마로 입력 검증                            |
| 5           | Drizzle을 통해 D1 또는 R2, Hyperdrive에 기록                     |
| 6           | 부수 효과가 있으면 Queue에 알림 메시지를 enqueue                  |
| 7           | 응답에 추적 ID를 부여하여 클라이언트와 서버 로그를 연결           |

---

## 환경 변수 / Configuration

Cloudflare Workers의 모든 바인딩과 시크릿은 `wrangler.toml`에서 정의하며, 로컬에서는 `.dev.vars` 또는 1Password 항목을 사용합니다.

| 변수 / Var                    | 범위 / Scope        | 출처 / Source                          | 용도 / Purpose                              |
| ----------------------------- | ------------------- | -------------------------------------- | ------------------------------------------- |
| `DB`                          | Binding             | `wrangler.toml`                        | D1 데이터베이스                              |
| `FAS_HYPERDRIVE`              | Binding             | `wrangler.toml`                        | 사내 FAS용 Hyperdrive                        |
| `ASSETS`                      | Binding             | `wrangler.toml`                        | 정적 프런트엔드                              |
| `R2`                          | Binding             | `wrangler.toml`                        | 미디어 버킷                                  |
| `ACETIME_BUCKET`              | Binding             | `wrangler.toml`                        | 출퇴근 자산                                  |
| `KV`                          | Binding             | `wrangler.toml`                        | 인증 캐시 · 시스템 상태                      |
| `NOTIFICATION_QUEUE/DLQ`      | Binding             | `wrangler.toml`                        | 알림 큐                                      |
| `RATE_LIMITER`                | DO                  | `wrangler.toml`                        | 레이트 리미팅                                |
| `JWT_SECRET`                  | Secret              | 1Password / CI                         | JWT 서명 키                                  |
| `FAS_*`                       | Secret              | 1Password / CI                         | 외부 FAS 자격 증명                           |
| `OP_SERVICE_ACCOUNT_TOKEN`    | Secret              | 1Password                              | E2E 시크릿 로드                              |

`npm run check:wrangler-sync` 스크립트가 `wrangler.toml`과 코드 사용처의 일치 여부를 검사합니다.

---

## 명령어 / Commands

| 명령어 / Command                              | 설명 / Purpose                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                                 | Turborepo 통합 개발 (Worker, Admin, API)                                       |
| `npm run build`                               | 전체 워크스페이스 빌드 후 `dist/` 정적 산출물 통합                              |
| `npm run build:api`                           | API 워크스페이스만 빌드                                                         |
| `npm run build:static`                        | Next.js 정적 export 결과를 `dist/admin/`으로 모음                               |
| `npm run lint`                                | 워크스페이스 전체 ESLint                                                        |
| `npm run lint:naming`                         | 명명 규칙 린트(스크립트 `scripts/lint-naming.js`)                               |
| `npm run typecheck`                           | 워크스페이스 전체 타입 체크                                                    |
| `npm run test`                                | 워크스페이스 Vitest                                                             |
| `npm run test:coverage`                       | 커버리지 포함 Vitest                                                            |
| `npm run e2e`                                 | Playwright E2E (1Password CLI로 시크릿 주입)                                    |
| `npm run e2e:headed`                          | 헤드 모드 Playwright                                                            |
| `npm run e2e:ui`                              | Playwright UI 모드                                                              |
| `npm run db:generate`                         | Drizzle 마이그레이션 생성                                                       |
| `npm run check:wrangler-sync`                 | `wrangler.toml` ↔ 코드 사용처 동기화 점검                                       |
| `npm run verify`                              | Go 기반 사전 점검(빌드 산출물, 권한, 환경 일관성)                                |
| `npm run git:preflight`                       | 커밋 전 Git 상태 점검                                                           |
| `npm run format` / `format:check`             | Prettier 실행 / 검증                                                           |
| `npm run clean`                               | Turbo + `node_modules` 정리                                                    |
| `npm run deploy:api`                          | 의도적으로 실패 (CI 전용 배포 알림)                                             |

---

## 로컬 개발 / Local Development

- 코드 스타일은 [CODE_STYLE.md](./CODE_STYLE.md)와 `.editorconfig`를 따릅니다. Tailwind v4 토큰은 `packages/ui`에서 노출합니다.
- 작업 전 `npm run git:preflight`를 호출해 브랜치 보호 룰을 확인합니다.
- Husky 훅은 `.husky/`에서 staged 파일에 `go run scripts/check-anti-patterns.go`와 `prettier --write`를 적용합니다.
- 새 라우트는 `apps/api/src/routes/`에 모듈로 추가하고, Drizzle 스키마 변경은 `apps/api/src/db/schema/`에서 시작해 `npm run db:generate`를 실행합니다.
- 새 UI 컴포넌트는 가능하면 `packages/ui`에 공유 컴포넌트로 등록하고, 앱 전용 컴포넌트는 `apps/<workspace>/src/components/`에 둡니다.

---

## 테스트 / Testing

| 계층 / Tier            | 도구 / Tool                  | 위치 / Location                                |
| ---------------------- | ---------------------------- | ---------------------------------------------- |
| 단위 / Unit            | Vitest                       | `apps/*/src/**/__tests__`, `vitest.config.ts`   |
| 통합 / Integration     | Vitest + MSW                 | `apps/api/src/**/__tests__`                    |
| E2E                    | Playwright (6 프로젝트)      | `e2e/`, `playwright.config.ts`                 |
| 정적 분석 / Static     | ESLint, TypeScript, Prettier | 루트 및 각 워크스페이스                         |
| 가드 / Guard           | Go 스크립트(`verify`, anti-pattern, naming, wrangler-sync) | `scripts/`                       |

E2E는 1Password CLI와 `--env-file=.env.e2e`로 시크릿을 주입합니다. CI는 시크릿을 GitHub Actions secrets에서 로드합니다.

---

## 다국어 / Internationalization

- 지원 로케일: `ko`, `en`, `vi`, `zh`
- 런타임은 `apps/worker/src/i18n/`의 자체 번역 시스템이며, 번역 데이터는 `packages/types`에서 공유합니다(자세한 절차는 [apps/worker/I18N_IMPLEMENTATION.md](./apps/worker/I18N_IMPLEMENTATION.md) 참고).
- 관리자 콘솔과 API 에러 메시지도 동일한 키를 공유합니다.

---

## 모바일 패키지 / Mobile (Android TWA)

`apps/worker/android/`는 Bubblewrap으로 생성된 신뢰할 수 있는 웹 활동(Trusted Web Activity) 프로젝트입니다.

| 항목 / Item             | 값 / Value                                                   |
| ----------------------- | ------------------------------------------------------------ |
| 패키지 ID               | `me.jclee.safetywallet.twa`                                  |
| Manifest 체크섬         | `manifest-checksum.txt`                                      |
| 런처                    | `apps/worker/android/app/src/main/java/me/jclee/safetywallet/twa/LauncherActivity.java` |
| Delegation 서비스       | `DelegationService.java`                                     |
| 빌드                    | `gradlew assembleRelease` (CI에서 서명)                      |
| 스토어 아이콘           | `store_icon.png`, `ic_launcher*`, `ic_maskable*`             |

PWA `manifest.json`은 `apps/worker/android/app/src/main/res/raw/web_app_manifest.json`에 위치하며, TWA 매니페스트는 `twa-manifest.json`입니다.

---

## 운영 / Operations

- 헬스 체크: `GET /internal/health` (CI 게이트, 모니터링에서 사용)
- 배포: GitHub Actions가 `master`에 푸시될 때 lint → typecheck → anti-pattern guard → test → build → migrate 순서로 실행
- D1 마이그레이션은 마이그레이션 ID 순서대로 CI에서만 적용되며 로컬에서는 `wrangler d1 migrations apply` 사용
- 알림 DLQ는 `apps/api/src/jobs/notification-dlq-replay.ts`에서 재처리합니다
- 데이터 export는 `canExportData` 권한이 있는 관리자만 호출할 수 있도록 감사 로그에 기록됩니다

자세한 절차는 `docs/` 디렉터리의 PRD와 런북을 참고합니다.

---

## 기여 절차 / Contributing

1. 새로운 작업은 이슈 또는 작업 티켓으로 시작합니다.
2. [CONTRIBUTING.md](./CONTRIBUTING.md)와 [CODE_STYLE.md](./CODE_STYLE.md)를 먼저 숙지합니다.
3. `npm run dev`로 세 워크스페이스가 모두 정상 부팅되는지 확인합니다.
4. 변경 범위에 따라 `npm run lint`, `npm run typecheck`, `npm run test`, 필요 시 `npm run e2e`를 실행합니다.
5. 커밋 전 `npm run git:preflight`와 Husky 훅을 통과합니다.
6. PR에는 영향 범위(API 변경, 마이그레이션 추가, i18n 키 추가 등)를 본문에 명시합니다.
7. 리뷰어는 [ARCHITECTURE.md](./ARCHITECTURE.md)와 Drizzle 스키마 일관성을 확인합니다.

---

## 보안 및 컴플라이언스 / Security & Compliance

- JWT는 KST 자정 만료로 발급되어 토큰 유효 시간이 길어지지 않도록 강제합니다.
- 비밀 키와 사내 FAS 자격 증명은 1Password에 저장되며 코드에는 커밋되지 않습니다.
- 업로드된 미디어는 R2에 저장되며 `canExportData` 권한 외에는 다운로드 로그가 기록됩니다.
- 보안 헤더(CSP, HSTS, Referrer-Policy 등)는 `apps/api/src/middleware/security-headers.ts`에서 일괄 적용됩니다.
- 레이트 리미팅은 `RateLimiter` Durable Object로 사용자/엔드포인트 단위로 적용됩니다.

---

## 유지보수자 / Maintainers & Points of Contact

| 역할 / Role       | 담당 / Owner                                  | 채널 / Channel                |
| ----------------- | --------------------------------------------- | ----------------------------- |
| 제품 책임자 / PM  | SafetyWallet 제품팀                           | 사내 메신저 `safetywallet-pm` |
| 백엔드 / API      | `apps/api` 담당                               | 사내 메신저 `safetywallet-be` |
| 프런트엔드        | `apps/admin`, `apps/worker` 담당              | 사내 메신저 `safetywallet-fe` |
| 모바일 / TWA      | `apps/worker/android` 담당                    | 사내 메신저 `safetywallet-android` |
| DevOps / SRE      | 배포, 관측, D1 마이그레이션                    | 사내 메신저 `safetywallet-ops`|
| 보안 / Security   | JWT, R2 접근, 권한 매트릭스 감사               | 사내 메신저 `safetywallet-sec`|

이메일 aliases와 채널 운영 시간은 사내 디렉터리 `safetywallet/contacts`에서 확인합니다.

---

## 추가 문서 / Further Documentation

| 주제 / Topic                | 문서 / Document                                                         |
| --------------------------- | ----------------------------------------------------------------------- |
| 지식 베이스 요약            | [AGENTS.md](./AGENTS.md)                                                |
| 시스템 아키텍처             | [ARCHITECTURE.md](./ARCHITECTURE.md)                                    |
| 기여 가이드                 | [CONTRIBUTING.md](./CONTRIBUTING.md)                                    |
| 코드 스타일                 | [CODE_STYLE.md](./CODE_STYLE.md)                                        |
| i18n 구현                   | [apps/worker/I18N_IMPLEMENTATION.md](./apps/worker/I18N_IMPLEMENTATION.md) |
| Worker 라우트 가이드        | `apps/worker/src/app/AGENTS.md`                                         |
| API 라이브러리 가이드       | `apps/api/src/lib/AGENTS.md` (존재하는 경우)                            |
| PRD 및 런북                 | `docs/`                                                                 |
| 보안 정책                   | 사내 보안 위키, `docs/security/`                                         |
| 릴리스 노트                 | `docs/releases/`                                                        |

---

## 라이선스 / License

본 저장소의 소스 코드는 사내 라이선스 하에 배포됩니다. 외부 배포, 재사용, 역엔지니어링을 금지합니다. 자세한 조건은 [LICENSE](./LICENSE)를 참고합니다.