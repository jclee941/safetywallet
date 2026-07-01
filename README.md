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

건설 현장 작업자가 모바일로 위험 요인을 보고하고 출퇴근을 기록하며 안전 포인트를 적립하면, 현장 관리자가 별도 대시보드에서 심사 · 정산 · 컴플라이언스를 처리합니다. 단일 Cloudflare Worker가 Hono API와 두 개의 정적으로 export된 Next.js 프런트엔드를 호스트 이름 라우팅으로 동시에 제공합니다.

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

## 흐름 요약 / Flow Summary

작업자가 PWA에서 보고서를 작성하면 Cloudflare Worker가 받아 D1에 기록하고, R2 미디어를 연결하며, 알림 큐로 후속 작업을 분리합니다. 관리자 콘솔은 동일 API를 통해 심사하고, KST 자정에 만료되는 JWT로 권한을 검증합니다.

| 단계 / Step | 주체 / Actor          | 핵심 결과 / Outcome                                |
| ----------- | --------------------- | -------------------------------------------------- |
| 1           | 작업자 PWA            | 미디어 업로드 + 위험 보고 / 출퇴근 기록            |
| 2           | Worker API (Hono)     | JWT 검증 → D1 트랜잭션 → R2 객체 연결              |
| 3           | Durable Object        | `RateLimiter` 스로틀, `JobScheduler` 비동기 작업    |
| 4           | 외부 FAS              | Hyperdrive 경유 사번/근태 동기화                    |
| 5           | 관리자 콘솔           | 심사, 포인트 정산, 데이터 익스포트                  |
| 6           | Cron Jobs (10개)      | 정산, 알림, 캐시 무효화, 보고서 마감                |

---

## 목차 / Table of Contents

- [Purpose / 패키지 구성](#purpose--패키지-구성)
- [Status](#status)
- [First Files to Read](#first-files-to-read)
- [API and Entry Points](#api-and-entry-points)
- [Quickstart](#quickstart)
- [Architecture](#architecture)
- [Configuration (Cloudflare Bindings)](#configuration-cloudflare-bindings)
- [Commands Reference](#commands-reference)
- [Local Development](#local-development)
- [Testing](#testing)
- [Contribution Guide](#contribution-guide)
- [Maintainers / Points of Contact](#maintainers--points-of-contact)
- [Further Documentation](#further-documentation)
- [License](#license)

---

## Purpose / 패키지 구성

이 저장소는 건설 현장의 안전 보고 · 출퇴근 · 안전 포인트 인센티브 흐름을 단일 플랫폼으로 통합합니다. 작업자는 모바일 PWA로 빠르게 위험을 기록하고 포인트를 적립하며, 현장 관리자는 데이터 기반으로 즉시 심사하고 정산합니다.

| 패키지 / Package | 역할 / Role                                              | 비고 / Notes                              |
| ---------------- | -------------------------------------------------------- | ----------------------------------------- |
| `apps/api`       | Hono 기반 Cloudflare Worker API                         | Drizzle ORM, D1, R2, Hyperdrive, Durable Objects |
| `apps/admin`     | Next.js 15 관리자 대시보드 (정적 export, 포트 3001)      | App Router, 출퇴근 · 보고 · 교육 심사       |
| `apps/worker`    | Next.js 15 작업자 PWA (정적 export, 포트 3000)           | ko · en · vi · zh 커스텀 i18n             |
| `apps/worker/android` | Bubblewrap 기반 Android TWA 빌드                  | Play Store 배포용 APK 산출물              |
| `packages/types` | 공유 타입 · 열거형 · DTO · i18n 번역 데이터              | API/UI 양쪽이 의존                       |
| `packages/ui`    | 공유 shadcn/ui 컴포넌트 + Tailwind v4 테마 토큰         | 두 프런트엔드 공통 UI 기반                |
| `scripts/`       | Go/JS 보조 도구                                          | verify, lint-naming, anti-pattern         |
| `e2e/`           | Playwright E2E 시나리오 (6개 프로젝트)                    | 인증 · 작업자 · 관리자 플로우             |
| `docs/`          | PRD, 요구사항 명세, 운영 런북                            | 상세 설계 · 정책 문서                     |

`turbo.json`이 빌드 순서를 `types → ui → apps`로 강제하고, GitHub Actions가 `lint → typecheck → guard → test → build → migrate`로 게이트합니다.

---

## Status

| 영역 / Area          | 상태 / Status           | 메모 / Notes                                                |
| -------------------- | ----------------------- | ----------------------------------------------------------- |
| 코드베이스           | Active (production-bound) | 60개의 `AGENTS.md`가 모듈별 규약을 문서화                  |
| 인증 모델            | Stable                  | KST 자정 만료 + 3단계 권한                                  |
| i18n                 | 운영 중                 | ko · en · vi · zh 활성, 헬퍼 일관화 완료                    |
| D1 스키마            | 34 테이블 · 31 마이그레이션 | Drizzle ORM 기반, 자동 마이그레이션                    |
| Android TWA          | 빌드 가능               | `apps/worker/android/`에서 `./gradlew assembleRelease`     |
| E2E 테스트           | Playwright 6 프로젝트   | 1Password(`op`) 시크릿 주입 기반                            |
| 배포                 | Git-ref 기반 CI        | 수동 `deploy` 스크립트는 의도적으로 차단됨                  |

---

## First Files to Read

운영자가 가장 먼저 봐야 하는 파일들입니다. 의존성 순서는 위에서 아래로 갑니다.

| 순서 / Order | 경로 / Path                                   | 이유 / Why read this                                       |
| ------------- | --------------------------------------------- | ---------------------------------------------------------- |
| 1             | [`AGENTS.md`](AGENTS.md)                       | 프로젝트 지식 베이스 (스택 · 구조 · 인증 · 바인딩)          |
| 2             | [`ARCHITECTURE.md`](ARCHITECTURE.md)           | 시스템 다이어그램, 데이터 흐름, 모듈 경계                    |
| 3             | [`CODE_STYLE.md`](CODE_STYLE.md)               | 코딩 규약, 명명 규칙, 안티 패턴 목록                        |
| 4             | [`CONTRIBUTING.md`](CONTRIBUTING.md)           | PR 절차, 검사 게이트, 브랜치 정책                           |
| 5             | [`wrangler.toml`](wrangler.toml)               | 환경 변수와 Cloudflare 바인딩 정의의 단일 진실 공급원        |
| 6             | [`apps/api/AGENTS.md`](apps/api/AGENTS.md)     | API 모듈 구조 · 미들웨어 · 작업 규약                         |
| 7             | [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md) | 작업자 PWA 구조 · i18n 구현 메모                          |
| 8             | [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) | 다국어 런타임 세부사항       |

---

## API and Entry Points

| 표면 / Surface  | 경로 / Path                          | 진입점 / Entry Point                          |
| --------------- | ------------------------------------ | --------------------------------------------- |
| Worker SPA      | `https://<worker-host>/`             | `apps/worker/src/app/page.tsx`                |
| Admin SPA       | `https://<admin-host>/`              | `apps/admin/src/app/page.tsx`                 |
| API 베이스      | `https://<api-host>/api/v1/...`      | `apps/api/src/index.ts` (Hono 앱)             |
| 루트 Worker     | 배포 진입                            | `wrangler.toml`의 `main`                      |
| Android APK     | `apps/worker/android/`               | `./gradlew assembleRelease`                   |

API 라우트는 `apps/api/src/routes/`의 18개 모듈(`admin/` 하위 포함)로 구성되며, 각 모듈은 Drizzle ORM 기반 핸들러와 Zod 검증기를 내보냅니다. 인증은 `apps/api/src/lib/auth/`가 처리하고, 권한은 3단계(역할 → 현장 멤버십 → 필드 플래그)로 강제됩니다.

---

## Quickstart

사전 요구 사항: Node.js ≥ 20.0.0, npm 10.8.2, Wrangler(Cloudflare CLI), 1Password CLI(`op`)는 E2E 실행 시에만 필요합니다.

| 단계 / Step | 명령 / Command                                             | 목적 / Purpose                              |
| ----------- | ---------------------------------------------------------- | ------------------------------------------- |
| 1           | `npm install`                                              | 워크스페이스 의존성 설치                     |
| 2           | `cp .dev.vars.example .dev.vars` 후 시크릿 채우기         | 로컬 환경 변수 (D1, R2, KV, JWT 등)         |
| 3           | `npm run db:generate`                                      | Drizzle 클라이언트 생성                      |
| 4           | `npm run dev`                                              | Turborepo가 세 워크스페이스 병렬 기동        |
| 5           | http://localhost:3000 (작업자) · http://localhost:3001 (관리자) | 로컬 접속                                 |

빌드와 검증만 독립적으로 돌리고 싶다면 `npm run build`, `npm run typecheck`, `npm run lint`, `npm run verify`를 순서대로 실행합니다.

---

## Architecture

### 모듈 구조 / Module Layout

| 계층 / Layer       | 위치                                            | 책임 / Responsibility                        |
| ------------------ | ----------------------------------------------- | -------------------------------------------- |
| 프런트엔드 UI      | `apps/worker/`, `apps/admin/`                   | 정적 export된 Next.js 15 SPA                  |
| 공유 UI / 타입     | `packages/ui/`, `packages/types/`               | 컴포넌트 · 테마 · DTO · i18n 데이터          |
| API 라우팅         | `apps/api/src/routes/`                          | Hono 라우터, 미들웨어 체인                    |
| 비즈니스 로직      | `apps/api/src/lib/`                             | 인증 · 권한 · FAS 어댑터 · R2 업로드          |
| 데이터 접근        | `apps/api/src/db/`                              | Drizzle 스키마 (34 테이블) · 시드             |
| 비동기 작업        | `apps/api/src/jobs/`, `src/durable-objects/`    | 10개 cron + `RateLimiter` · `JobScheduler`    |
| 검증               | `apps/api/src/validators/`                      | 요청/응답 Zod 스키마                          |
| 마이그레이션        | `apps/api/migrations/`                          | 31개 D1 SQL 파일                              |

### 요청 흐름 / Request Flow

1. 클라이언트가 호스트 이름에 따라 `worker`, `admin`, `api` 엔드포인트 중 하나로 진입합니다.
2. Worker 정적 자산(`ASSETS`) 또는 Hono 라우터 중 하나가 요청을 받아 미들웨어 체인을 통과합니다(`cors` → `securityHeaders` → `logging` → `analytics`).
3. 인증 미들웨어가 JWT를 디코드하고 KST 자정 만료 시각과 비교하며, 결과를 KV 캐시로 조회합니다 (D1 폴백 포함).
4. 권한 게이트가 역할 → 현장 멤버십 → 필드 플래그 3단계를 검증합니다.
5. 핸들러가 Zod 스키마로 입력을 검증하고 Drizzle 트랜잭션으로 D1에 기록합니다. 미디어가 있으면 R2 시그니처 URL을 발급합니다.
6. 부수 효과는 `NOTIFICATION_QUEUE`로 enqueue되거나 Durable Object(`JobScheduler`)로 비동기 디스패치됩니다.
7. 응답이 클라이언트로 돌아가고, 작업자 PWA는 Zustand 스토어에 새 토큰 만료를 반영합니다.

### 인증 모델 / Auth Model

| 단계 / Stage | 메커니즘 / Mechanism                       | 비고 / Notes                              |
| ------------ | ------------------------------------------ | ----------------------------------------- |
| 토큰 발급    | `apps/api/src/lib/auth/`                   | KST 자정(KST 00:00) 만료 시각             |
| 클라이언트   | Zustand persisted store                    | `safetywallet-auth`, `safetywallet-admin-auth` |
| 서버 검증    | JWT 디코드 → KST 시각 비교 → KV 조회 → D1 폴백 | 401 발생 시 refresh mutex로 재발급  |
| 권한         | 역할 → 현장 멤버십 → 필드 플래그            | `canAwardPoints`, `canReview`, `canExportData` |

---

## Configuration (Cloudflare Bindings)

`wrangler.toml`이 모든 바인딩과 환경 변수의 단일 진실 공급원입니다. `npm run check:wrangler-sync`가 실제 코드와 선언이 일치하는지 검사합니다.

| 바인딩 / Binding                         | 종류 / Type            | 용도 / Purpose                              |
| ---------------------------------------- | ---------------------- | ------------------------------------------- |
| `DB`                                     | D1                     | 주 데이터베이스 (34 테이블, Drizzle ORM)    |
| `FAS_HYPERDRIVE`                         | Hyperdrive             | 외부 FAS 직원 DB 연결                       |
| `ASSETS`                                 | Workers Static Assets  | 작업자 + 관리자 SPA 정적 파일               |
| `R2`                                     | R2                     | 사용자 업로드 이미지/비디오                 |
| `ACETIME_BUCKET`                         | R2                     | 출퇴근 관련 자산                            |
| `KV`                                     | KV                     | 인증 캐시 · 시스템 상태 · 설정              |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | Queue                | 알림 배달 파이프라인 (DLQ 포함)              |
| `RATE_LIMITER`                           | Durable Object         | 분당 요청 스로틀링                          |
| `JOB_SCHEDULER`                          | Durable Object         | 비동기 잡 디스패치                          |
| Cron Triggers                            | Schedules              | 정산 · 알림 · 캐시 무효화 · 보고서 마감     |

> 참고: 실제 바인딩 이름은 운영 환경에 따라 달라질 수 있습니다. `wrangler.toml`의 `[env.<name>]` 섹션과 로컬 `.dev.vars`를 함께 확인하세요.

---

## Commands Reference

루트 `package.json`이 워크스페이스 전반의 스크립트를 노출합니다.

| 명령 / Command                    | 설명 / Description                                            |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                     | Turborepo로 세 워크스페이스 병렬 개발 서버 기동                |
| `npm run build`                   | 워크스페이스 빌드 + 정적 산출물을 `dist/`로 모음               |
| `npm run build:api`               | `packages/types` + `apps/api`만 빌드                          |
| `npm run build:one-worker`        | API 단독 빌드 (Worker-only 빠른 검증)                         |
| `npm run lint`                    | 워크스페이스 전체 ESLint                                       |
| `npm run lint:naming`             | 명명 규칙 검사 (Go 스크립트)                                   |
| `npm run typecheck`               | `tsc --noEmit` 전체                                            |
| `npm run test`                    | Vitest 단위/통합 테스트                                       |
| `npm run test:coverage`           | 커버리지 리포트가 포함된 테스트                                |
| `npm run check:wrangler-sync`     | 코드 ↔ `wrangler.toml` 일치 검사                              |
| `npm run git:preflight`           | 커밋 전 안전 점검 (Go)                                         |
| `npm run verify`                  | 풀스택 사전 점검 (Go)                                          |
| `npm run db:generate`             | Drizzle 클라이언트 재생성                                      |
| `npm run format` / `format:check` | Prettier 쓰기 / 검사                                          |
| `npm run e2e`                     | Playwright 헤드리스 (1Password 시크릿 주입)                   |
| `npm run e2e:headed` / `e2e:ui`   | 헤디드 / UI 모드 Playwright                                    |
| `npm run deploy:api`              | 의도적으로 실패 (CI 기반 Git-ref 배포만 허용)                  |
| `npm run clean`                   | 모든 워크스페이스 + `node_modules` 정리                       |

Husky의 `prepare` 훅이 설치되며, `lint-staged`가 `*.{ts,tsx}`에 대해 `go run scripts/check-anti-patterns.go`와 Prettier를, 그 외 확장자에 대해 Prettier를 적용합니다.

---

## Local Development

| 작업 / Task                | 절차 / Steps                                                                  |
| -------------------------- | ------------------------------------------------------------------------------- |
| 새 환경 변수 추가          | `.dev.vars`(로컬)와 `wrangler.toml` `[vars]`(`dev`)에 동시 추가 후 `check:wrangler-sync` |
| 새 D1 테이블               | `apps/api/src/db/schema/` 수정 → `npm run db:generate` → 마이그레이션 파일 작성  |
| 새 API 라우트              | `apps/api/src/routes/<resource>/index.ts`에 Hono 모듈 추가, Zod 스키마 동반 작성 |
| 새 i18n 키                 | `packages/types`의 번역 데이터 + `apps/worker/src/i18n/` 등록                   |
| 새 공유 컴포넌트           | `packages/ui/`에 추가하고 두 프런트엔드가 import                                |
| Android TWA 빌드           | `cd apps/worker/android && ./gradlew assembleRelease`                          |

자세한 절차는 `AGENTS.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`를 순서대로 읽고 시작하는 것을 권장합니다.

---

## Testing

| 종류 / Type        | 도구 / Tool                  | 위치 / Location                          |
| ------------------ | ---------------------------- | ---------------------------------------- |
| 단위 / 통합        | Vitest                       | 각 워크스페이스 `vitest.config.ts`        |
| E2E                | Playwright (6 프로젝트)      | `e2e/`, 루트 `playwright.config.ts`      |
| 타입 검사          | `tsc --noEmit`               | 루트 + 워크스페이스 `tsconfig.json`       |
| 명명 · 안티패턴    | Go 스크립트                  | `scripts/lint-naming.js`, `check-anti-patterns.go` |
| 마이그레이션 검증  | D1 원격 백엔드               | CI 마지막 단계                           |

E2E는 1Password로 시크릿을 주입합니다. `op`가 설치되어 있고 `.env.e2e` 템플릿에 정의한 항목이 vault에 있어야 실행됩니다.

```
op run --env-file=.env.e2e -- npx playwright test
```

---

## Contribution Guide

1. 이슈를 먼저 등록하거나 연결합니다.
2. `AGENTS.md` → `ARCHITECTURE.md` → `CODE_STYLE.md` → `CONTRIBUTING.md`를 처음 PR 전에 모두 읽습니다.
3. 작업 브랜치에서 변경 후 `npm run lint && npm run typecheck && npm run test && npm run check:wrangler-sync`를 로컬에서 통과시킵니다.
4. 커밋은 Husky + lint-staged가 검사합니다.
5. PR에는 (a) 변경 요약 (b) 영향 모듈 (c) 테스트 결과 (d) 스크린샷/로그를 포함합니다.
6. CI가 모두 통과해야 리뷰어가 머지합니다.

기여자 행동 강령은 `CONTRIBUTING.md`를, 보안 이슈 보고 절차는 `docs/`의 운영 런북을 따릅니다.

---

## Maintainers / Points of Contact

| 역할 / Role | 책임 / Responsibility                  | 채널 / Channel                   |
| ----------- | -------------------------------------- | -------------------------------- |
| 백엔드 리드 | API · 데이터 · 인증 · 마이그레이션      | GitHub Issues `@safetywallet/api` |
| 프런트엔드 리드 | 작업자/관리자 SPA · i18n · UI 토큰   | GitHub Issues `@safetywallet/fe`  |
| 모바일 리드 | Android TWA · 배포 스크립트            | GitHub Issues `@safetywallet/mobile` |
| DevOps      | Wrangler · CI/CD · 바인딩 · cron       | GitHub Issues `@safetywallet/devops` |
| 보안 책임자 | JWT 정책 · 권한 매트릭스                | 내부 보안 채널 (운영 런북 참조)  |

운영 시간 외 장애 대응 절차는 `docs/`의 런북을 따릅니다.

---

## Further Documentation

| 문서 / Document                                                                                  | 용도 / Use it for                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| [`docs/PRD.md`](docs/PRD.md)                                                                     | 제품 요구사항 원본                          |
| [`docs/requirements/`](docs/requirements/)                                                       | 기능별 상세 명세                            |
| [`docs/ops/runbooks/`](docs/ops/runbooks/)                                                       | 장애 대응 · 롤백 · 배포 절차                |
| [`AGENTS.md`](AGENTS.md)                                                                         | 프로젝트 지식 베이스 (스택 · 구조 · 인증)   |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                                                             | 시스템 다이어그램 · 모듈 경계               |
| [`CODE_STYLE.md`](CODE_STYLE.md)                                                                 | 코딩 규약 · 명명 · 안티 패턴               |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                                                             | PR 절차 · 검사 게이트                       |
| [`apps/api/AGENTS.md`](apps/api/AGENTS.md)                                                       | API 모듈 규약                               |
| [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md)                                                 | 작업자 PWA 규약                             |
| [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md)                       | 다국어 런타임 구현 메모                      |

---

## License

이 저장소의 라이선스는 [`LICENSE`](LICENSE) 파일을 참조하세요. 외부 기여 시 동일한 라이선스 정책 적용을 전제로 진행합니다.