# SafetyWallet / 안전지갑

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Hono%20%7C%20Next.js%20%7C%20Cloudflare%20Workers-blue)
![Runtime](https://img.shields.io/badge/node-%E2%89%A520.0.0-339933)
![Package manager](https://img.shields.io/badge/npm-10.8.2-CB3837)
![Pipeline](https://img.shields.io/badge/turborepo-workspace-FF1E56)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

---

## 한국어 요약

SafetyWallet은(는) 건설 현장의 작업자가 모바일 PWA에서 위험 요인을 보고하고 출퇴근을 기록하며 안전 포인트를 적립하도록 돕는 클라우드 네이티브 서비스입니다. 단일 Cloudflare Worker가 Hono 기반 API와 정적으로 내보내진(exported) Next.js 프런트엔드를 호스트 이름 라우팅으로 동시에 제공하며, D1 · R2 · KV · Hyperdrive · Queue · Durable Object를 엣지에서 결합합니다. 관리자는 별도 콘솔에서 게시물 검토, 정산, 교육, 컴플라이언스를 처리하고, 작업자는 한국어 · 영어 · 베트남어 · 중국어로 제공되는 PWA를 사용해 현장 활동을 기록합니다.

## English Summary

SafetyWallet is a cloud-native service that lets construction-site workers report hazards, log attendance, and earn safety points from a mobile PWA. A single Cloudflare Worker serves the Hono API and statically-exported Next.js frontends via hostname routing, combining D1, R2, KV, Hyperdrive, Queues, and Durable Objects at the edge. Site admins handle reviews, settlements, education, and compliance from a dedicated console, while workers record day-to-day field activity through a localized PWA (ko, en, vi, zh).

---

## 한눈에 보기 / At a Glance

| 항목 / Item                | 값 / Value                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------- |
| 제품명 / Product           | SafetyWallet (안전지갑)                                                                  |
| 배포 모델 / Deployment     | Cloudflare Workers + Workers Static Assets                                              |
| 데이터 저장 / Data          | D1(주 DB) · R2(이미지/영상) · KV(캐시) · Hyperdrive(FAS 사외 DB)                          |
| 비동기 / Async             | Notification Queue + DLQ, Durable Objects(RateLimiter, JobScheduler)                      |
| 워크스페이스 / Workspaces   | `apps/*`, `packages/*` (Turborepo 파이프라인)                                           |
| 프런트엔드 / Frontends     | 작업자 PWA, 관리자 콘솔 (둘 다 Next.js 15 정적 export)                                  |
| 모바일 래퍼 / Mobile wrapper | Android TWA (`apps/worker/android/`)                                                    |
| 인증 / Auth                | JWT (KST 자정 만료) · 3단 권한 (역할 / 현장 멤버십 / 필드 플래그)                       |
| 다국어 / i18n              | 한국어 · 영어 · 베트남어 · 중국어                                                       |
| 런타임 / Runtime           | Node.js >= 20.0.0, npm 10.8.2                                                          |
| 테스트 / Testing           | Vitest(단위), Playwright(E2E, 6 프로젝트)                                               |
| 배포 트리거 / Deploy trigger | `master` 브랜치에 대한 Git ref 푸시 (수동 배포 비활성화)                                |
| 라이선스 / License          | Proprietary (사내 사용)                                                                 |

## 핵심 흐름 / Flow at a Glance

1. 작업자가 PWA에 로그인 → JWT가 발급되어 KST 자정 기준 만료 시각과 함께 저장됩니다.
2. 작업자가 게시글(위험 보고/안전 사례) 작성 또는 출퇴근 기록 → API가 D1에 영속화하고 R2에 미디어를 업로드합니다.
3. 현장 관리자가 관리자 콘솔에서 게시글을 검토, 투표, 정산, 교육 이수 처리 → 모든 변경은 D1과 KV 캐시에 반영됩니다.
4. Durable Object `RateLimiter`가 호출 빈도를 제한하고 `JobScheduler`가 10개의 cron 작업을 트리거합니다.
5. 알림은 `NOTIFICATION_QUEUE`로 enqueue되고 실패 시 `NOTIFICATION_DLQ`로 라우팅되어 재처리됩니다.

---

## 패키지 구성 / Package Contents

| 경로 / Path               | 역할 / Role                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `apps/api/`               | Cloudflare Worker API (Hono + Drizzle + D1). 18개 라우트, 31개 마이그레이션 |
| `apps/worker/`            | 작업자용 Next.js 15 PWA. 정적 export, 커스텀 i18n 런타임                    |
| `apps/worker/android/`    | Bubblewrap으로 생성된 Android TWA 래퍼                                      |
| `apps/admin/`             | 관리자용 Next.js 15 콘솔 (포트 3001). 정적 export                           |
| `packages/types/`         | 공유 TypeScript 타입, enum, DTO, i18n 번역 데이터                           |
| `packages/ui/`            | 공유 shadcn/ui 컴포넌트 + Tailwind v4 테마 토큰                              |
| `scripts/`                | verify, git preflight, 명명 규칙, anti-pattern 검사(Go/JS)                  |
| `e2e/`                    | Playwright E2E 테스트 (인증 설정, 관리자/작업자 플로우)                      |
| `docs/`                   | PRD, 요구사항 명세, 운영 런북                                               |
| `wrangler.toml`           | 루트 Cloudflare Worker 설정 + 모든 바인딩                                   |
| `turbo.json`              | Turborepo 파이프라인 정의 (`types → ui → apps`)                              |
| `playwright.config.ts`    | 6개 Playwright 프로젝트                                                      |

## 먼저 읽을 파일 / First Files to Read

운영자/기여자가 처음 살펴봐야 할 문서는 다음과 같습니다.

- [`AGENTS.md`](AGENTS.md) — 프로젝트 지식 베이스(스택, 구조, 인증, 바인딩, 권한 모델 요약).
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — 시스템 아키텍처, 요청 흐름, 모듈 경계.
- [`CODE_STYLE.md`](CODE_STYLE.md) — 코딩 컨벤션, lint 규칙, 포매터 설정.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — 기여 절차, PR 규칙, 사전 점검.
- [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) — 작업자 PWA의 다국어 런타임 동작.
- [`wrangler.toml`](wrangler.toml) — 바인딩, 라우팅, 환경 변수, Durable Object 선언.

## API / Entry Points

| Entry                                  | 설명 / Description                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| Cloudflare Worker (단일 엔트리)         | 호스트 이름으로 작업자 PWA, 관리자 콘솔, API를 라우팅                              |
| `apps/api/src/routes/`                 | Hono 라우트 모듈 18종 (`admin/` 하위 포함)                                          |
| `apps/api/src/durable-objects/`        | `RateLimiter`, `JobScheduler`                                                      |
| `apps/api/src/jobs/`                   | 10개의 스케줄된 cron 작업                                                          |
| `apps/worker/src/app/`                 | 작업자 PWA: 로그인, 게시글, 출퇴근, 교육                                           |
| `apps/admin/src/app/`                  | 관리자 콘솔: 출퇴근, 게시글, 투표, 교육                                            |
| `apps/worker/android/`                 | Android TWA 진입점 (`LauncherActivity`, `Application`, `DelegationService`)         |

---

## 아키텍처 / Architecture

### Cloudflare 바인딩 / Bindings

| 바인딩 / Binding                       | 종류 / Type            | 용도 / Purpose                                          |
| -------------------------------------- | ---------------------- | ------------------------------------------------------- |
| `DB`                                   | D1                     | 주 데이터베이스 (34 테이블, Drizzle ORM)                |
| `FAS_HYPERDRIVE`                       | Hyperdrive             | 사외 FAS 임직원 DB 연결                                 |
| `ASSETS`                               | Workers Static Assets  | 작업자 PWA + 관리자 콘솔 정적 파일                      |
| `R2`                                   | R2                     | 사용자 업로드 이미지/영상                               |
| `ACETIME_BUCKET`                       | R2                     | 출퇴근 관련 자산                                         |
| `KV`                                   | KV                     | 인증 캐시, 시스템 상태, 설정                            |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | Queue               | 알림 전달 파이프라인 + 실패 재처리                      |
| `RATE_LIMITER`                         | Durable Object         | API 호출 빈도 제한                                       |
| `JOB_SCHEDULER`                        | Durable Object         | cron 작업 스케줄링                                      |

### 요청 흐름 / Request Flow

1. 클라이언트(작업자 PWA 또는 관리자 콘솔)가 호스트 이름과 함께 요청을 전송합니다.
2. 단일 Cloudflare Worker가 호스트 이름을 기준으로 `ASSETS`(SPA) 또는 Hono API로 라우팅합니다.
3. Hono 미들웨어 체인이 CORS, 로깅, 분석, 보안 헤더를 적용합니다.
4. 인증 미들웨어가 JWT를 디코드 → KST 자정 만료 검증 → KV 캐시 조회 → D1 폴백 순으로 확인합니다.
5. 권한 게이트가 역할, 현장 멤버십, 필드 플래그를 3단으로 평가합니다.
6. 핸들러가 D1/Hyperdrive/R2에 접근하고, 필요 시 Queue에 메시지를 발행합니다.
7. 응답이 클라이언트로 반환되며, `RateLimiter` DO가 호출 메트릭을 기록합니다.
8. `JobScheduler` DO가 주기적으로 정산, 알림, 만료 처리 등 10개의 cron 작업을 실행합니다.

### 인증 & 권한 / Auth & Permissions

- **로그인 → JWT 발급**: 만료 시각은 KST 기준 당일 자정입니다. 클라이언트는 Zustand 영속 스토어에 보관합니다.
- **3단 검증**: JWT 디코드 → KST 자정 확인 → KV 캐시 → D1 폴백.
- **3단 권한**: 역할(`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`) → 현장 멤버십 → 필드 플래그(`canAwardPoints`, `canReview`, `canExportData`).
- **클라이언트 키**: 작업자 `safetywallet-auth`, 관리자 `safetywallet-admin-auth`. 401 응답 시 refresh mutex로 단일 갱신을 보장합니다.

---

## 빠른 시작 / Quick Start

### 사전 요구 사항 / Prerequisites

- Node.js >= 20.0.0
- npm 10.8.2 (`packageManager`에 고정)
- Cloudflare 계정 + Wrangler CLI
- D1, R2, KV, Hyperdrive, Queue 바인딩을 포함한 원격 환경(또는 로컬 시뮬레이션)
- E2E 실행 시 1Password CLI(`op`)와 `.env.e2e` 파일

### 설치 / Install

```bash
npm install
```

### 로컬 개발 / Run Dev Servers

Turborepo가 작업자 PWA(3000), 관리자 콘솔(3001), API를 동시에 실행합니다.

```bash
npm run dev
```

### 빌드 / Build

전체 정적 산출물은 `dist/` 아래 생성됩니다. `dist/<root>`는 작업자 PWA, `dist/admin/`은 관리자 콘솔입니다.

```bash
npm run build
```

### 단위 테스트 / Unit Tests

```bash
npm run test
```

### 타입 체크 / Typecheck

```bash
npm run typecheck
```

### 코드 스타일 검사 / Lint

```bash
npm run lint
npm run lint:naming
```

---

## 설정 / Configuration

| 파일 / File                | 용도 / Purpose                                                                |
| -------------------------- | ----------------------------------------------------------------------------- |
| `wrangler.toml`            | Cloudflare Worker 이름, 호스트 라우팅, 바인딩, 환경 변수, Durable Object 선언 |
| `apps/worker/next.config.mjs` | 작업자 PWA 정적 export + 출력 경로(`out/`)                                 |
| `apps/admin/next.config.mjs`  | 관리자 콘솔 정적 export                                                    |
| `apps/worker/twa-manifest.json` | Android TWA 메타데이터(시작 URL, 아이콘, 색상)                          |
| `.env.e2e`                 | E2E용 비밀 시크릿(1Password CLI가 주입)                                       |
| `apps/worker/src/i18n/`    | 다국어 리소스 디렉터리                                                        |
| `tailwind.config.js`       | Tailwind v4 토큰 및 테마                                                      |

환경별 시크릿은 Cloudflare 대시보드의 `wrangler secret put` 또는 CI의 GitHub Secrets로 관리합니다. 로컬 E2E는 1Password CLI를 통해 주입되며, 일반 개발 시에는 `.dev.vars`(Wrangler)가 자동으로 로드됩니다.

---

## 명령어 레퍼런스 / Commands Reference

| 명령어 / Command                  | 설명 / Description                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`                     | 모든 워크스페이스 개발 서버 동시 실행                                               |
| `npm run build`                   | API + 작업자/관리자 정적 빌드 후 `dist/`로 통합                                    |
| `npm run build:api`               | `packages/types`와 `apps/api`만 빌드                                               |
| `npm run build:static`            | 정적 산출물을 `dist/`로 통합                                                        |
| `npm run build:one-worker`        | 단일 Worker로 제한 빌드 (`build:api`의 별칭)                                       |
| `npm run lint`                    | Turborepo 전체 lint                                                                |
| `npm run lint:naming`             | 명명 규칙 검사 (`scripts/lint-naming.js`)                                          |
| `npm run test`                    | 단위 테스트 (Vitest)                                                               |
| `npm run test:coverage`           | 커버리지 포함 단위 테스트                                                          |
| `npm run typecheck`               | TypeScript 타입 체크                                                               |
| `npm run check:wrangler-sync`     | `wrangler.toml`과 코드 측 바인딩 선언 일치 여부 검증                               |
| `npm run git:preflight`           | 커밋 전 점검(Go 스크립트)                                                          |
| `npm run verify`                  | 저장소 일관성 검증(Go 스크립트)                                                    |
| `npm run format` / `format:check` | Prettier 실행 / 검증                                                               |
| `npm run db:generate`             | Drizzle 스키마 → 마이그레이션 생성                                                 |
| `npm run e2e`                     | 1Password 시크릿 주입 후 Playwright 실행                                           |
| `npm run e2e:headed`              | 헤드 모드로 Playwright 실행                                                        |
| `npm run e2e:ui`                  | Playwright UI 모드 실행                                                            |
| `npm run clean`                   | Turborepo 산출물 + `node_modules` 정리                                             |

`lint-staged`는 staged 변경에 대해 anti-pattern 검사(Go)와 Prettier를 적용하며, `prepare` 훅으로 Husky가 설치됩니다.

## 로컬 개발 / Local Development

- 작업자 PWA는 `apps/worker`에서 개발하며, i18n 리소스 변경 시 서버 재시작 없이 반영되도록 워치 모드가 구성되어 있습니다.
- 관리자 콘솔은 `apps/admin`에서 독립적으로 실행되며 API 엔드포인트만 공유합니다.
- API는 `apps/api`에서 Wrangler의 로컬 시뮬레이터로 실행되며 D1 로컬 인스턴스를 사용합니다.
- 공통 타입/컴포넌트 변경 시 Turborepo 의존성에 따라 다운스트림 작업이 자동 재빌드됩니다(`types → ui → apps`).
- PR 제출 전 `npm run verify && npm run typecheck && npm run test`를 권장합니다.

## 테스트 / Testing

- **단위 테스트**: Vitest로 라우트, 미들웨어, 헬퍼, Durable Object 동작을 검증합니다. `npm run test:coverage`로 커버리지를 확인할 수 있습니다.
- **E2E 테스트**: Playwright 6 프로젝트로 인증 설정, 관리자/작업자 플로우를 다룹니다. 실행에 1Password가 필요하므로 CI 시크릿 또는 로컬 `op` 인증 상태가 요구됩니다.
- **계약/스키마**: Zod 검증기가 API 경계에서 요청/응답을 강제하므로 테스트 외 영역에서도 일관성을 유지합니다.
- **사전 점검**: `git:preflight`, `verify`, `check:wrangler-sync`, `lint:naming`이 정적 검증 레이어를 구성합니다.

## 배포 / Deployment

- 배포는 **수동 명령으로 트리거되지 않습니다.** `deploy:api` 스크립트는 의도적으로 실패하며, 실제 배포는 `master` 브랜치의 Git ref 푸시를 통한 CI에서만 실행됩니다.
- CI 파이프라인은 일반적으로 `lint → typecheck → guards → test → build → migrate` 순으로 구성됩니다.
- D1 마이그레이션은 `apps/api/migrations/`에 31개 시드로 보관되어 있으며, `npm run db:generate`로 새 마이그레이션을 추가합니다.
- 정적 산출물(`apps/worker/out`, `apps/admin/out`)은 `Workers Static Assets`의 `ASSETS` 바인딩으로 Worker와 함께 배포됩니다.

## 기여 가이드 / Contributing

- 절차와 PR 규칙은 [`CONTRIBUTING.md`](CONTRIBUTING.md)를 따릅니다.
- 코드 컨벤션은 [`CODE_STYLE.md`](CODE_STYLE.md)를 따르며, Prettier와 ESLint를 기준으로 합니다.
- 커밋 전 `git:preflight`, `format`, `verify`를 로컬에서 통과시켜 주세요.
- DB 스키마 변경 시 마이그레이션을 함께 추가하고 `db:generate` 산출물을 커밋해 주세요.
- i18n 키 추가는 `packages/types`와 `apps/worker/src/i18n` 양쪽을 동기화해야 합니다.

## 문제 해결 / Getting Help

- 프로젝트 지식 베이스: [`AGENTS.md`](AGENTS.md)
- 아키텍처 상세: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- 운영 런북 및 PRD: [`docs/`](docs/)
- 작업자 PWA 다국어 동작: [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md)
- Cloudflare 바인딩 차이: `npm run check:wrangler-sync` 실행 후 출력 확인

## 유지보수 / Maintainers & Points of Contact

| 역할 / Role       | 책임 / Responsibility                            |
| ----------------- | ------------------------------------------------ |
| Repository owners | 제품/엔지니어링 총괄, 마스터 브랜치 보호 정책    |
| Backend (API)     | Hono 라우트, Drizzle 스키마, Durable Object, cron |
| Worker PWA        | 작업자 UI/UX, i18n, 오프라인 동작, TWA 래퍼      |
| Admin Console     | 관리자 워크플로, 정산, 교육, 컴플라이언스 화면   |
| Platform / DevX   | Turborepo 파이프라인, CI/CD, Wrangler 설정       |
| QA                | Playwright E2E, Vitest 커버리지, 명명 검사       |

담당자 핸들/이메일은 사내 디렉터리 또는 [`CONTRIBUTING.md`](CONTRIBUTING.md)의 책임자 표를 참고해 주세요.

## 추가 문서 / Further Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — 상세 아키텍처, 시퀀스 다이어그램, 모듈 의존성
- [`AGENTS.md`](AGENTS.md) — 프로젝트 지식 베이스(스택, 권한 모델, 바인딩 요약)
- [`CODE_STYLE.md`](CODE_STYLE.md) — 코드 컨벤션, lint 규칙, 포매터
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — PR 절차, 커밋 메시지, 리뷰 SLA
- [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) — 작업자 PWA 다국어 런타임
- [`docs/`](docs/) — PRD, 요구사항 명세, 운영 런북
- [`wrangler.toml`](wrangler.toml) — 배포 환경, 바인딩, Durable Object 선언

---

## License

Proprietary. 사내 라이선스 정책에 따릅니다. 외부 배포, 역엔지니어링, 무단 복제를 금지합니다. 자세한 내용은 [`LICENSE`](LICENSE) 파일을 참고하세요.