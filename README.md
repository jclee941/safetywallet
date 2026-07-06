# SafetyWallet / 안전지갑

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Hono%20%7C%20Next.js%20%7C%20Cloudflare%20Workers-blue)
![Runtime](https://img.shields.io/badge/node-%E2%89%A520.0.0-339933)
![Package manager](https://img.shields.io/badge/npm-10.8.2-CB3837)
![Pipeline](https://img.shields.io/badge/turborepo-workspace-FF1E56)
![Mobile](https://img.shields.io/badge/mobile-PWA%20%7C%20TWA-3DDC84)
![i18n](https://img.shields.io/badge/i18n-ko%20%7C%20en%20%7C%20vi%20%7C%20zh-0aa)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

---

## 한국어 요약

SafetyWallet(안전지갑)은 건설 현장의 작업자가 **모바일 PWA**에서 위험 요인을 보고하고, 출퇴근을 기록하며, **안전 포인트**를 적립하도록 돕는 클라우드 네이티브 서비스입니다. 단일 Cloudflare Worker가 Hono 기반 API와 정적으로 내보낸(exported) Next.js 프런트엔드 두 개(작업자용 · 관리자용)를 호스트명 라우팅으로 동시에 제공하며, D1 · R2 · KV · Hyperdrive · Queue · Durable Object를 엣지에서 결합합니다. 작업자는 한국어 · 영어 · 베트남어 · 중국어로 제공되는 PWA를 사용하고, 관리자는 별도 콘솔에서 게시물 검토 · 정산 · 교육 · 컴플라이언스를 처리합니다. Android 사용자는 `apps/worker/android/` 의 Trusted Web Activity 래퍼를 통해 Play 스토어에서도 동일한 PWA를 받습니다.

## English Summary

SafetyWallet is a cloud-native service that helps construction-site workers report hazards, log attendance, and earn safety points from a mobile PWA. A single Cloudflare Worker serves the Hono API and two statically-exported Next.js frontends (worker + admin) through hostname routing, combining D1, R2, KV, Hyperdrive, Queues, and Durable Objects at the edge. The same PWA is also packaged as a Trusted Web Activity for Android distribution. Operators handle reviews, settlements, education, and compliance from a dedicated admin console.

---

## 한눈에 보기 / At a Glance

| 항목 / Item                     | 값 / Value                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| 제품 / Product                  | SafetyWallet (안전지갑) — 모바일 PWA + 관리 콘솔 + Android TWA                           |
| 배포 모델 / Deployment          | 단일 Cloudflare Worker + Workers Static Assets (Git ref 기반 자동 배포)                  |
| API / Framework                 | Hono on Workers · Drizzle ORM · Zod 검증                                                |
| 데이터 / Data                   | D1 (34 테이블, SQLite via Drizzle) · Hyperdrive (FAS 사외 인사 DB)                       |
| 자산 / Assets                   | R2 (`R2` 사용자 업로드, `ACETIME_BUCKET` 근태)                                            |
| 캐시·큐 / Cache & Queue         | KV (인증·상태) · Queues (`NOTIFICATION_QUEUE`, `NOTIFICATION_DLQ`)                       |
| 상태성 / Stateful               | Durable Objects (`RATE_LIMITER`, `JOB_SCHEDULER`)                                        |
| 프런트엔드 / Frontend           | Next.js 15 App Router · 정적 내보내기 · worker(3000) · admin(3001)                       |
| 인증 / Auth                     | JWT (KST 자정 만료) + KV 캐시 + 3단계 권한(`WORKER` / `SITE_ADMIN` / `SUPER_ADMIN`)      |
| 모바일 / Mobile                 | 모바일 우선 PWA + Android TWA (Play 스토어 배포)                                          |
| i18n                            | ko, en, vi, zh — `apps/worker/src/i18n/` 자체 런타임                                      |
| Node / 패키지 매니저            | Node ≥ 20 · npm 10.8.2 · Turborepo workspace                                             |
| 테스트 / Tests                  | Vitest(단위) · Playwright(E2E, 6 프로젝트) · Go 스크립트 가드                              |
| CI/CD                           | GitHub Actions: lint → typecheck → 가드 → test → build → migrate → deploy                |
| 상태 / Status                   | Active · 본 저장소 운영 배포 본                                                            |
| 라이선스 / License              | Proprietary                                                                              |

## 운영 흐름 / Operational Flow

1. **로그인** — 작업자 또는 관리자가 PWA/콘솔에서 로그인하면 JWT가 KST 자정 만료로 발급되고 클라이언트 Zustand에 persist.
2. **3단 인증 검증** — 요청 시점에서 JWT decode → KST 자정 체크 → KV 캐시 조회 → D1 폴백 순으로 검증.
3. **데이터 기록** — 출퇴근·위험요인·포인트/투표가 `apps/api` 의 Hono 라우터(18개 모듈)로 유입되어 D1 에 기록되고 R2 에 자산이 업로드.
4. **관리자 처리** — 관리자 콘솔이 동일 API를 상위 역할로 호출하여 검토·정산·교육·컴플라이언스 작업을 처리.
5. **비동기 알림** — Queue로 fan-out, 실패분은 `NOTIFICATION_DLQ`에 격리.
6. **예약 잡** — 10종 cron 잡이 Durable Object `JOB_SCHEDULER`에서 시간 기반으로 실행.
7. **배포** — `master` 브랜치 기준 GitHub Actions가 마이그레이션까지 적용한 뒤 Worker에 자동 배포. 수동 배포 스크립트는 의도적으로 비활성화.

## 목차 / Table of Contents

1. [기능 / Features](#기능--features)
2. [아키텍처 / Architecture](#아키텍처--architecture)
3. [저장소 구조 / Repository Layout](#저장소-구조--repository-layout)
4. [빠른 시작 / Quick Start](#빠른-시작--quick-start)
5. [설정 / Configuration](#설정--configuration)
6. [명령 참조 / Commands](#명령-참조--commands)
7. [로컬 개발 / Local Development](#로컬-개발--local-development)
8. [테스트 / Testing](#테스트--testing)
9. [기여 / Contributing](#기여--contributing)
10. [유지보수 · 지원 / Maintenance & Support](#유지보수--지원--maintenance--support)
11. [라이선스 / License](#라이선스--license)
12. [더 보기 / Further Reading](#더-보기--further-reading)

---

## 기능 / Features

### 작업자 / Worker

- 출퇴근 기록 (현장별, 사진 첨부 가능)
- 위험요인 보고 및 후속 투표/댓글
- 안전 포인트 적립 및 잔액 조회
- 안전 교육 시청·진도 추적
- 다국어 UI (ko, en, vi, zh) · 모바일 우선 PWA · 오프라인 친화

### 관리자 / Admin

- 게시물 검토·승인/반려 워크플로
- 정산(포인트) 일괄 처리 및 내보내기
- 교육 자료 관리, 사용자 권한 관리
- 현장 단위 멤버십 관리 및 컴플라이언스 리포트

### 플랫폼 / Platform

- Durable Object 기반 분산 Rate Limiter
- 10종 cron 잡 (근태 마감, 정산 알림, 리텐션 등)
- 알림 큐 + DLQ 분리
- KV 기반 인증 캐시, 시스템 상태 캐시
- Git ref 기반의 단일 Worker 배포 (master 브랜치 기준)

---

## 아키텍처 / Architecture

### 상위 구조 / Top-Level

| 계층 / Layer       | 위치 / Location                                  | 역할 / Role                                            |
| ------------------ | ------------------------------------------------ | ------------------------------------------------------ |
| Edge API           | `apps/api/`                                      | Hono 라우터, Drizzle 스키마(34 tables), 31개 D1 마이그레이션 |
| Worker PWA         | `apps/worker/`                                   | 작업자용 Next.js 15 (정적 내보내기, port 3000)         |
| Admin Console      | `apps/admin/`                                    | 관리자용 Next.js 15 (정적 내보내기, port 3001)         |
| 공유 타입          | `packages/types/`                                | TS 타입·열거형·DTO·i18n 번역 데이터                    |
| 공유 UI            | `packages/ui/`                                   | shadcn/ui 컴포넌트, Tailwind v4 테마 토큰               |
| Android TWA        | `apps/worker/android/`                           | `me.jclee.safetywallet.twa` 패키지의 PWA 래퍼           |
| 문서·런북          | `docs/`                                          | PRD, 요구사항 명세, 운영 runbook                         |
| 자동화 스크립트    | `scripts/`                                       | Go 및 JS 도구(검증, 명명 lint, anti-pattern check)     |
| E2E                | `e2e/`                                           | Playwright 인증 셋업·관리자·작업자 플로우               |

### Cloudflare 바인딩 / Cloudflare Bindings

| 바인딩 / Binding            | 종류 / Type            | 용도 / Purpose                                    |
| --------------------------- | ---------------------- | ------------------------------------------------- |
| `DB`                        | D1                     | 주 데이터베이스 (34 테이블, Drizzle)              |
| `FAS_HYPERDRIVE`            | Hyperdrive             | FAS 사외 직원 DB 연결                              |
| `ASSETS`                    | Workers Static Assets  | worker + admin 정적 프런트엔드 SPA                |
| `R2`                        | R2                     | 사용자 업로드 이미지·비디오                        |
| `ACETIME_BUCKET`            | R2                     | 근태 관련 자산                                     |
| `KV`                        | KV                     | 인증 캐시, 시스템 상태, 설정                      |
| `NOTIFICATION_QUEUE`        | Queue                  | 알림 fan-out                                       |
| `NOTIFICATION_DLQ`          | Queue                  | 알림 실패 격리                                     |
| `RATE_LIMITER`              | Durable Object         | 분산 레이트 리미팅                                  |
| `JOB_SCHEDULER`             | Durable Object         | cron 잡 스케줄링                                   |

### 인증·권한 / Authentication & Authorization

| 항목 / Item                | 설명 / Description                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------- |
| 토큰 형식 / Token          | JWT · KST 자정 기준 만료                                                            |
| 클라이언트 저장 / Storage  | Zustand persist (worker: `safetywallet-auth`, admin: `safetywallet-admin-auth`)   |
| 401 갱신 / Refresh         | 클라이언트 측 refresh mutex                                                         |
| 검증 단계 / Validation     | JWT decode → KST 자정 체크 → KV 캐시 조회 → D1 폴백                                |
| 역할 / Roles               | `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`                                    |
| 현장 권한 / Site scope     | 사용자-현장 멤버십                                                                   |
| 필드 플래그 / Field flags  | `canAwardPoints`, `canReview`, `canExportData` 등                                  |

요청 흐름 / Request flow:

1. 클라이언트가 PWA/콘솔에서 요청
2. 호스트명 라우팅이 요청을 `apps/api`의 적절한 핸들러로 보냄
3. 미들웨어(CORS, 로깅, 분석, 보안 헤더)가 요청을 처리
4. 인증 미들웨어가 JWT·KV·D1 순으로 검증
5. Zod 검증 후 Drizzle 리포지토리를 통해 D1 또는 R2에 접근
6. 응답 직전 산출물이 Durable Object(RateLimit/JOB)에 기록

---

## 저장소 구조 / Repository Layout

```text
.
├── AGENTS.md                 # 프로젝트 지식 베이스 (init-deep에서 생성)
├── ARCHITECTURE.md           # 상세 아키텍처 노트
├── CODE_STYLE.md             # 코딩 규약
├── CONTRIBUTING.md           # 기여 절차
├── LICENSE                   # 라이선스
├── README.md                 # 본 문서
├── package.json              # npm workspaces, turbo 스크립트
├── turbo.json                # Turborepo 파이프라인
├── wrangler.toml             # Cloudflare Worker 설정 + 바인딩
├── vitest.config.ts          # 단위 테스트 설정
├── playwright.config.ts      # E2E 설정 (6 프로젝트)
├── apps/
│   ├── api/                  # Cloudflare Worker API (Hono + Drizzle + D1)
│   ├── admin/                # Next.js 15 관리 콘솔 (정적 내보내기, :3001)
│   └── worker/               # Next.js 15 작업자 PWA (정적 내보내기, :3000)
│       ├── android/          # TWA 빌드 (bubblewrap/PWA 래퍼)
│       │   ├── twa-manifest.json
│       │   ├── app/src/main/ # AndroidManifest, 리소스, LauncherActivity
│       │   └── gradle/wrapper
│       ├── src/types/        # CSS 타이핑
│       └── src/app/          # App Router: login, posts, attendance, education …
├── packages/
│   ├── types/                # 공유 타입·열거형·DTO·i18n 번역
│   └── ui/                   # 공유 shadcn/ui + Tailwind v4 테마
├── docs/                     # PRD, 요구사항 명세, 운영 runbook
├── scripts/                  # verify, naming-lint, anti-pattern, wrangler-sync
└── e2e/                      # Playwright 인증 셋업·admin·worker 플로우
```

---

## 빠른 시작 / Quick Start

### 사전 요구사항 / Prerequisites

- Node.js **20 이상** (저장소는 `>=20.0.0` 요구)
- npm **10.8.2** (저장소 lockfile 기준) — `corepack enable` 권장
- Cloudflare 계정 + D1 / R2 / KV / Hyperdrive / Queue 자원 (운영 배포 시)
- Wrangler (`wrangler`) — Workers 로컬 실행/배포
- Playwright 브라우저 — E2E 실행 시 `npx playwright install`
- Android 빌드 시: JDK 17, Android SDK, Gradle (CI에서 자동 처리)

### 로컬 설치 / Install & Boot

```bash
# 1. 의존성 설치 (npm workspaces + Turborepo)
npm install

# 2. 공유 타입·UI 빌드 (apps가 의존)
npx turbo run build --filter=./packages/*

# 3. Drizzle 스키마 변경에 대한 마이그레이션 생성 (필요 시)
npm run db:generate

# 4. Turborepo dev (api + worker + admin 동시 실행)
npm run dev

# 별도 워크스페이스 단독 실행 예
npm run dev --workspace=apps/worker   # http://localhost:3000
npm run dev --workspace=apps/admin    # http://localhost:3001
```

### 첫 빌드 / First Production Build

```bash
# API + 정적 자산 빌드 후 worker·admin SPA를 dist로 모음
npm run build
```

CI를 거치지 않은 수동 `wrangler deploy`는 의도적으로 차단되어 있습니다. 운영 반영은 `master` 브랜치에 푸시되면 GitHub Actions가 마이그레이션·검증·빌드·배포를 순차로 수행합니다.

---

## 설정 / Configuration

### 환경 변수 / Environment Variables

| 변수 / Variable              | 사용처 / Where                    | 비고 / Notes                                              |
| ---------------------------- | --------------------------------- | --------------------------------------------------------- |
| `JWT_SECRET`                 | `apps/api`                        | JWT 서명 키. KST 자정 만료 정책과 함께 사용.              |
| `CF_ACCOUNT_ID`              | Wrangler / CI                     | Cloudflare 계정 ID                                         |
| `CF_API_TOKEN`               | Wrangler / CI                     | D1 / R2 / KV / Queue 권한을 가진 토큰                      |
| `FAS_*`                      | `apps/api` (Hyperdrive)           | 사외 FAS DB 연결 정보                                      |
| `.env.e2e`                   | Playwright 실행(`op run` 경유)    | 1Password CLI를 통해 주입; 평문 커밋 금지                 |
| `wrangler.toml`              | 루트                              | D1 / R2 / KV / Hyperdrive / Queue / Durable Object 바인딩 |

### i18n / 국제화

- 지원 언어: `ko`, `en`, `vi`, `zh`
- 번역 키/데이터: `packages/types/`의 i18n 모듈
- 런타임: `apps/worker/src/i18n/` 자체 런타임 — 자세한 내용은 [docs/I18N_IMPLEMENTATION.md 참조](apps/worker/I18N_IMPLEMENTATION.md)

### Android TWA

- 패키지: `me.jclee.safetywallet.twa`
- 매니페스트: `apps/worker/android/twa-manifest.json`
- 엔트리: `Application.java`, `LauncherActivity.java`, `DelegationService.java`
- 리소스: 런처/마스커블 아이콘, 스플래시, 알림 아이콘, 단축키(`res/xml/shortcuts.xml`)
- 자산 메타: `res/raw/web_app_manifest.json`

---

## 명령 참조 / Commands

| 명령 / Command              | 설명 / Description                                                          |
| --------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`               | Turborepo를 통해 모든 워크스페이스의 dev 스크립트 실행                     |
| `npm run build`             | Turborepo 빌드 후 worker·admin 정적 자산을 `dist/`로 모음                   |
| `npm run build:api`         | `packages/types` → `apps/api` 만 빌드 (단일 워커 점검용)                   |
| `npm run build:static`      | `apps/worker/out` + `apps/admin/out` 를 `dist/`로 복사                     |
| `npm run lint`              | 워크스페이스 전체 ESLint (Turborepo 경유)                                  |
| `npm run lint:naming`       | 명명 규칙 lint (`scripts/lint-naming.js`)                                  |
| `npm run typecheck`         | 워크스페이스 전체 `tsc --noEmit` (Turborepo 경유)                          |
| `npm run test`              | Vitest 단위 테스트 (Turborepo 경유)                                        |
| `npm run test:coverage`     | 커버리지 포함 단위 테스트                                                   |
| `npm run e2e`               | Playwright (인증은 1Password 경유, 헤드리스)                                |
| `npm run e2e:headed`        | Playwright 헤드드 모드                                                     |
| `npm run e2e:ui`            | Playwright UI 모드                                                          |
| `npm run db:generate`       | Drizzle 마이그레이션 생성 (`apps/api` 워크스페이스로 위임)                 |
| `npm run check:wrangler-sync` | `wrangler.toml` 동기화 점검                                               |
| `npm run git:preflight`     | 커밋 전 점검 (Go 스크립트)                                                 |
| `npm run verify`            | 풀 스택 검증 (Go 스크립트)                                                 |
| `npm run format`            | Prettier 쓰기                                                              |
| `npm run format:check`      | Prettier 검사                                                              |
| `npm run clean`             | Turborepo clean + `node_modules` 정리                                      |
| `npm run deploy:api`        | **차단됨** — Git ref 기반 자동 배포만 허용 (`exit 1`)                      |

CI 워크플로 순서: `lint → typecheck → 가드 스크립트 → test → build → migrate → deploy`. 자세한 단계 정의는 `.github/workflows/` 참조.

---

## 로컬 개발 / Local Development

### 워크스페이스 / Workspaces

- `apps/api` — Hono 기반 API. 로컬은 `wrangler dev`로 실행.
- `apps/worker` — 작업자 PWA. Next.js dev는 `:3000`.
- `apps/admin` — 관리 콘솔. Next.js dev는 `:3001`.
- `packages/types` — 타입 변경은 의존 워크스페이스에서 즉시 반영.
- `packages/ui` — 컴포넌트 변경은 Tailwind v4 토큰까지 즉시 반영.

### 환경 분리 / Environments

| 환경 / Env | 용도 / Purpose                       | 비고 / Notes                                |
| ---------- | ------------------------------------ | ------------------------------------------- |
| local      | `wrangler dev` + Next.js dev         | Miniflare가 D1을 로컬 시뮬레이션              |
| preview    | PR 단위 임시 Worker                  | GitHub Actions에서 자동 생성                 |
| production | `master` 기준 자동 배포              | 수동 배포 비활성                              |

### 코드 작성 / Authoring Tips

- React 18.3.1 고정(루트 `overrides`).
- 직렬화 취약점 회피를 위해 `serialize-javascript ≥ 7.0.3` 고정.
- PR 전 `npm run format` + `npm run typecheck` + `npm run lint:naming` 권장.
- 커밋 훅은 husky → lint-staged → `check-anti-patterns.go` → prettier 순으로 동작.

### 데이터 모델 / Data Model

- Drizzle 스키마 파일은 `apps/api/src/db/`.
- 마이그레이션 디렉터리: `apps/api/migrations/` (31개 SQL 파일).
- 신규/변경 시 `npm run db:generate --workspace=apps/api` 후 검토 요청.

---

## 테스트 / Testing

| 종류 / Type    | 도구 / Tool      | 위치 / Location    | 명령 / Command                       |
| -------------- | ---------------- | ------------------ | ------------------------------------ |
| 단위 / Unit    | Vitest           | 워크스페이스 전반   | `npm run test`                       |
| 커버리지       | Vitest coverage  | 워크스페이스 전반   | `npm run test:coverage`              |
| E2E / Worker   | Playwright       | `e2e/`             | `npm run e2e` (1Password 주입)       |
| E2E / Headed   | Playwright       | `e2e/`             | `npm run e2e:headed`                 |
| E2E / UI mode  | Playwright       | `e2e/`             | `npm run e2e:ui`                     |
| 가드 / Guards  | Go 스크립트      | `scripts/`         | `git:preflight`, `verify`            |
| 정적 분석      | ESLint + naming  | 루트 + 워크스페이스 | `lint`, `lint:naming`                |

Playwright는 6개 프로젝트로 구성되어 있으며 인증 셋업과 역할별 플로우(worker, admin, 정산, 교육 등)를 다룹니다. E2E 비밀값은 커밋되지 않으며, `op run --env-file=.env.e2e` 경유로 주입됩니다.

---

## 기여 / Contributing

1. 이슈 또는 작업 항목에서 변경 범위를 합의합니다.
2. `main`에서 feature 브랜치를 분기합니다.
3. 작업 전 [AGENTS.md](AGENTS.md)와 [CODE_STYLE.md](CODE_STYLE.md), [ARCHITECTURE.md](ARCHITECTURE.md)를 읽습니다.
4. 변경 사항에 대해 가능한 한 Vitest 또는 Playwright 케이스를 함께 추가합니다.
5. PR 전 다음을 통과시킵니다.

   ```bash
   npm run lint
   npm run typecheck
   npm run lint:naming
   npm run test
   npm run format:check
   ```

6. PR 본문에 변경 요약 · 테스트 방법 · 마이그레이션/바인딩 영향 · 스크린샷(필요 시)을 기재합니다.
7. 상세 절차는 [CONTRIBUTING.md](CONTRIBUTING.md) 참조.

---

## 유지보수 · 지원 / Maintenance & Support

- 본 저장소는 **Active** 상태입니다. 본 저장소 운영팀이 마스터 브랜치를 기준으로 운영 배포합니다.
- 운영 절차와 인시던트 대응은 `docs/`의 런북과 [ARCHITECTURE.md](ARCHITECTURE.md) 참조.
- 디자인 결정과 데이터 모델 진화는 `docs/` 명세와 AGENTS.md(60개 파일) 추적본으로 관리.
- 보안 보고: 저장소 운영 채널을 통해 비공개로 전달.

---

## 라이선스 / License

본 저장소의 코드는 **Proprietary** 라이선스 하에 배포됩니다. 사용·복제·배포·수정에 대한 권한은 명시적 합의가 있을 때만 부여됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일 참조.

---

## 더 보기 / Further Reading

| 문서 / Document                                                | 내용 / Contents                                  |
| -------------------------------------------------------------- | ------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                                         | 자동 생성된 코드베이스 지식 베이스 (60개 파일)    |
| [ARCHITECTURE.md](ARCHITECTURE.md)                             | 아키텍처 결정과 트레이드오프                      |
| [CODE_STYLE.md](CODE_STYLE.md)                                 | 코딩 규약, 명명, 직렬화 정책                      |
| [CONTRIBUTING.md](CONTRIBUTING.md)                             | 기여 절차와 PR 체크리스트                        |
| `apps/worker/I18N_IMPLEMENTATION.md`                           | 다국어 런타임 구현 노트                            |
| `apps/api/src/db/` 및 `apps/api/migrations/`                   | Drizzle 스키마, D1 마이그레이션                    |
| `docs/` (PRD, 요구사항 명세, 운영 runbook)                      | 제품·운영 문서                                    |
| `.github/workflows/`                                           | CI 파이프라인 정의                                  |