# SafetyWallet

[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178C6)](https://www.typescriptlang.org)
[![Cloudflare Workers](https://img.shields.io/badge/cloudflare-workers-F38020)](https://workers.cloudflare.com)
[![Next.js 15](https://img.shields.io/badge/next.js-15-000000)](https://nextjs.org)
[![License](https://img.shields.io/badge/license-see%20LICENSE-blue)](./LICENSE)

현장 근로자가 PWA로 위험 요인을 신고하고, 출퇴근을 기록하며, 안전 포인트를 적립합니다.  
사이트 관리자는 대시보드에서 검토, 정산, 컴플라이언스를 처리합니다. 단일 Cloudflare Worker가 Hono API와 두 개의 Next.js 정적 프런트엔드를 호스트 이름 기반으로 라우팅합니다.

Field workers report hazards, log attendance, and earn safety points via a mobile PWA. Site admins handle reviews, settlements, and compliance from a dashboard. A single Cloudflare Worker serves the Hono API and two statically-exported Next.js frontends using hostname routing.

## 한눈에 보는 상태 / Status at a glance

| 영역 / Area | 값 / Value |
| --- | --- |
| 제품 / Product | 안전 관리 모바일 PWA + 관리자 대시보드 |
| 백엔드 / Backend | Cloudflare Worker (Hono + Drizzle + D1) |
| 프런트엔드 / Frontend | Next.js 15 정적 export (`apps/worker`, `apps/admin`) |
| 인증 / Auth | JWT (KST 자정 만료) + Zustand 클라이언트 스토어 |
| 패키지 매니저 / Pkg mgr | npm workspaces + Turborepo |
| Node / 언어 | Node ≥ 20, TypeScript strict |
| 배포 / Deploy | Git-ref 기반 CI (수동 배포 비활성) |
| 테스트 / Tests | Vitest (unit) + Playwright (E2E, 6 프로젝트) |
| 상태 / Status | Active — 60개 AGENTS.md 운영 중 |

## 실행 흐름 요약 / Operator flow

1. `npm install` 로 워크스페이스와 Husky 훅을 설치합니다.
2. `npm run dev` 로 `apps/api`, `apps/admin`(:3001), `apps/worker`(:3000)를 동시 기동합니다.
3. `npm run build` 로 타입 패키지 → UI → 앱 빌드 후 정적 산출물을 `dist/`로 복사합니다.
4. `wrangler deploy` (또는 CI) 로 `wrangler.toml` 의 바인딩을 사용해 Worker를 배포합니다.
5. `npm run test` 및 `npm run e2e` 로 회귀 테스트를 실행합니다.

## 목차 / Table of contents

- [Purpose / Package Contents](#purpose--package-contents)
- [Status](#status)
- [First Files to Read](#first-files-to-read)
- [API or Entry Points](#api-or-entry-points)
- [Quickstart / Usage](#quickstart--usage)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Commands Reference](#commands-reference)
- [Local Development](#local-development)
- [Testing](#testing)
- [Contribution Guide](#contribution-guide)
- [Maintainers / Points of Contact](#mainagers--points-of-contact)
- [Further Documentation](#further-documentation)
- [License](#license)

---

## Purpose / Package Contents

SafetyWallet는 산업 현장의 안전 운영을 모바일 중심으로 통합한 제품군입니다.

- **Worker PWA** (`apps/worker`) — 현장 근로자용. 출퇴근, 위험 신고, 안전 교육 수료, 포인트 적립을 처리합니다.
- **Admin 대시보드** (`apps/admin`) — 사이트 관리자용. 신고 검토, 포인트 정산, 컴플라이언스 리포트를 제공합니다.
- **API Worker** (`apps/api`) — Hono 기반 라우터, Drizzle 스키마, D1 데이터, R2 자산, 알림 큐, Durable Object를 단일 Worker에서 호스팅합니다.
- **공유 패키지** (`packages/types`, `packages/ui`) — TS 타입/enum/DTO 및 shadcn/ui + Tailwind v4 토큰.
- **Android TWA** (`apps/worker/android`) — Worker PWA를 Trusted Web Activity로 패키징한 Android 빌드.

**왜 유용한가 / Why it matters**

- 모바일 현장과 관리자 데스크탑을 단일 백엔드 도메인으로 묶어 호스트 기반 라우팅만으로 분리합니다.
- 근로자 권한, 사이트 멤버십, 필드 단위 플래그를 조합한 3단 권한 모델을 제공합니다.
- 모든 정적 산출물과 Worker를 한 리포지토리에서 빌드/배포 파이프라인으로 일괄 관리합니다.

---

## Status

| 항목 / Item | 상태 / State |
| --- | --- |
| 운영 / In production | 운영 중 / Active |
| API 라우트 / API routes | 18개 모듈 (`apps/api/src/routes`) |
| DB 테이블 / DB tables | 34개 (Drizzle 스키마) |
| SQL 마이그레이션 / Migrations | 31개 (`apps/api/migrations`) |
| Cron 잡 / Cron jobs | 10개 (`apps/api/src/jobs`) |
| Durable Object | `RateLimiter`, `JobScheduler` |
| i18n | 한국어, 영어, 베트남어, 중국어 |
| 안정성 / Stability | 프로덕션 사용 가능 / Production-ready |

---

## First Files to Read

| 우선순위 / Priority | 경로 / Path | 내용 / What it covers |
| --- | --- | --- |
| 1 | [`AGENTS.md`](./AGENTS.md) | 프로젝트 지식 베이스, 인증 모델, 바인딩 |
| 2 | [`ARCHITECTURE.md`](./ARCHITECTURE.md) | 시스템 아키텍처 결정과 흐름 |
| 3 | [`wrangler.toml`](./wrangler.toml) | Cloudflare 바인딩과 라우팅 |
| 4 | [`turbo.json`](./turbo.json) | 파이프라인 의존성 |
| 5 | [`apps/api/src/db`](./apps/api/src/db) | Drizzle 스키마, 시드, 헬퍼 |
| 6 | [`apps/worker/src/i18n`](./apps/worker/src/i18n) | i18n 런타임 |
| 7 | [`apps/worker/I18N_IMPLEMENTATION.md`](./apps/worker/I18N_IMPLEMENTATION.md) | 다국어 구현 가이드 |
| 8 | [`CODE_STYLE.md`](./CODE_STYLE.md) | 코딩 규약 |
| 9 | [`CONTRIBUTING.md`](./CONTRIBUTING.md) | 기여 절차 |

---

## API or Entry Points

| 경로 / Path | 역할 / Role |
| --- | --- |
| `apps/api/src/index.ts` | Worker 진입점, 호스트 라우팅 |
| `apps/api/src/routes/*` | REST 핸들러 (admin/ 중첩) |
| `apps/api/src/middleware/*` | CORS, 로깅, 분석, 보안 헤더 |
| `apps/api/src/validators/*` | Zod 요청 스키마 |
| `apps/api/src/jobs/*` | Cron 스케줄러 핸들러 |
| `apps/api/src/durable-objects/*` | `RateLimiter`, `JobScheduler` |
| `apps/worker/src/app/*` | Worker PWA 페이지 |
| `apps/admin/src/app/*` | Admin 대시보드 페이지 |
| `apps/worker/android/app/src/main/java/me/jclee/safetywallet/twa/LauncherActivity.java` | Android TWA 런처 |

**호스트 라우팅 / Host routing**

| 호스트 패턴 / Host pattern | 서비스 / Service |
| --- | --- |
| `api.<domain>` | Hono API |
| `admin.<domain>` | `dist/admin/*` 정적 자산 |
| `worker.<domain>` (또는 기본 호스트) | `dist/*` 정적 자산 |
| TWA / Android | `apps/worker/android` |

---

## Quickstart / Usage

요구 사항: Node ≥ 20, npm 10, Wrangler CLI, (선택) 1Password CLI (`op`) — Playwright E2E 시 필요.

```bash
# 1. 의존성 설치
npm install

# 2. 워크스페이스 빌드 (types → ui → apps)
npm run build:api
npm run build:static

# 3. 로컬 개발 (API, admin:3001, worker:3000)
npm run dev

# 4. 단위 테스트
npm run test

# 5. E2E 테스트 (.env.e2e 필요)
npm run e2e
```

**환경 변수 / Environment variables**

| 변수 / Var | 용도 / Purpose |
| --- | --- |
| `CF_ACCOUNT_ID` | Cloudflare 배포 시 |
| `CF_API_TOKEN` | Wrangler 인증 |
| `JWT_SECRET` | 토큰 서명 (KV에도 미러링) |
| `FAS_*` | 외부 FAS 사원 DB 자격 (Hyperdrive 경유) |
| `.env.e2e` | Playwright 자격 (1Password 항목) |

---

## Architecture

### 구성 요소 / Components

| 계층 / Layer | 위치 / Location | 책임 / Responsibility |
| --- | --- | --- |
| Edge | `apps/api` | Hono 라우팅, Drizzle, D1, R2, KV, Queue, Durable Object |
| Worker PWA | `apps/worker` | 현장 기능, 오프라인 가능, i18n 4종 |
| Admin SPA | `apps/admin` | 관리 워크플로, 정적 export |
| Shared | `packages/types`, `packages/ui` | 타입, shadcn/ui, Tailwind v4 토큰 |
| Mobile shell | `apps/worker/android` | TWA로 Worker PWA를 Android 앱으로 패키징 |
| E2E | `e2e/`, `playwright.config.ts` | 6개 Playwright 프로젝트 |

### 요청 흐름 / Request flow

1. 클라이언트가 호스트 헤더와 함께 Cloudflare 엣지에 도달합니다.
2. Worker 진입점이 호스트로 admin / worker / API 경로를 분기합니다.
3. API는 미들웨어(CORS, 로깅, 분석, 보안 헤더)를 통과합니다.
4. JWT 검증은 KV 캐시 → D1 폴백 순서로 진행되며, KST 자정 만료 검사를 함께 수행합니다.
5. 권한은 역할(`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`) → 사이트 멤버십 → 필드 플래그(`canAwardPoints`, `canReview`, `canExportData`) 순으로 평가합니다.
6. 비즈니스 로직은 Drizzle로 D1에 쓰고, 자산은 R2, 알림은 Queue로 발행합니다.
7. Cron 잡은 Durable Object `JobScheduler`를 통해 트리거됩니다.

### 인증 클라이언트 / Auth client

| 영역 / Area | 키 / Key | 백킹 / Backing |
| --- | --- | --- |
| Worker PWA | `safetywallet-auth` | Zustand persist |
| Admin SPA | `safetywallet-admin-auth` | Zustand persist |
| 서버 캐시 | KV | JWT → D1 폴백 |
| 토큰 만료 | KST 자정 | 클라이언트 + 서버 동시 검증 |

---

## Configuration

| 파일 / File | 용도 / Purpose |
| --- | --- |
| `wrangler.toml` | Cloudflare 바인딩, 라우팅, 크론, 환경 |
| `turbo.json` | 파이프라인 순서 (types → ui → apps) |
| `apps/worker/next.config.mjs` | Worker PWA Next 설정 (정적 export) |
| `apps/worker/tailwind.config.js` | Worker 디자인 토큰 |
| `apps/worker/postcss.config.cjs` | PostCSS 파이프라인 |
| `apps/admin/*` | Admin 앱 설정 (구조 동일) |
| `playwright.config.ts` | 6개 Playwright 프로젝트 정의 |
| `vitest.config.ts` | 단위 테스트 루트 설정 |
| `apps/worker/android/twa-manifest.json` | TWA 매니페스트 |
| `.env.e2e` | Playwright 자격 (저장소 비공개) |

### Cloudflare 바인딩 / Bindings

| 바인딩 / Binding | 타입 / Type | 용도 / Purpose |
| --- | --- | --- |
| `DB` | D1 | 34개 테이블의 주 데이터베이스 |
| `FAS_HYPERDRIVE` | Hyperdrive | 외부 FAS 사원 DB |
| `ASSETS` | Workers Static Assets | 정적 프런트엔드 |
| `R2` | R2 | 사용자 업로드 이미지/영상 |
| `ACETIME_BUCKET` | R2 | 출퇴근 자산 |
| `KV` | KV | 인증 캐시, 시스템 상태, 설정 |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | Queue | 알림 파이프라인 |
| `RATE_LIMITER` | Durable Object | 요청 속도 제한 |
| `JOB_SCHEDULER` | Durable Object | Cron 잡 스케줄 |

---

## Commands Reference

| 명령 / Command | 설명 / Description |
| --- | --- |
| `npm run dev` | 모든 워크스페이스 동시 개발 서버 |
| `npm run build` | 전체 빌드 후 `dist/`로 정적 산출물 복사 |
| `npm run build:api` | `packages/types` + `apps/api`만 빌드 |
| `npm run build:static` | `dist/` 재생성 (admin 포함) |
| `npm run build:one-worker` | API 전용 빌드 단축키 |
| `npm run lint` | 워크스페이스 전역 lint |
| `npm run lint:naming` | 명명 규칙 검사 (Go 스크립트) |
| `npm run typecheck` | TypeScript strict 검사 |
| `npm run test` | Vitest 단위 테스트 |
| `npm run test:coverage` | 커버리지 포함 실행 |
| `npm run e2e` | Playwright E2E (`op run`으로 시크릿 주입) |
| `npm run e2e:headed` | 헤드 모드 E2E |
| `npm run e2e:ui` | Playwright UI 모드 |
| `npm run format` | Prettier 포맷 |
| `npm run format:check` | Prettier 검사 |
| `npm run check:wrangler-sync` | wrangler 설정 일관성 검사 |
| `npm run git:preflight` | 커밋 직전 안전 검사 |
| `npm run verify` | 종합 검증 |
| `npm run db:generate` | Drizzle 마이그레이션 생성 |
| `npm run clean` | 빌드 산출물 + `node_modules` 정리 |
| `npm run deploy:api` | 비활성 (CI 전용, 항상 실패) |

---

## Local Development

| 시나리오 / Scenario | 절차 / Steps |
| --- | --- |
| Worker PWA 단독 | `npm run dev --workspace=apps/worker` |
| Admin 단독 | `npm run dev --workspace=apps/admin` |
| API 단독 | `npm run dev --workspace=apps/api` |
| TWA 빌드 | `apps/worker/android/gradlew assembleDebug` |
| 시크릿 주입 (E2E) | `op signin` 후 `npm run e2e` |
| Husky 훅 | `npm run prepare`로 설치 |

**팁 / Tips**

- 새 워크스페이스 추가 시 `package.json` `workspaces` 배열과 `turbo.json` 파이프라인을 함께 갱신합니다.
- i18n 키 추가는 `packages/types`의 번역 데이터와 `apps/worker/src/i18n` 양쪽에 등록합니다.
- `npm run check:wrangler-sync`는 바인딩 누락을 사전에 차단하므로 변경 시 반드시 실행합니다.

---

## Testing

| 영역 / Area | 도구 / Tool | 위치 / Location |
| --- | --- | --- |
| 단위 / Unit | Vitest | `vitest.config.ts` (루트 + 워크스페이스) |
| E2E | Playwright | `e2e/`, `playwright.config.ts` (6 프로젝트) |
| 정적 / Static | TypeScript, ESLint, Prettier | 루트 + 워크스페이스 |
| 명명 / Naming | Go 스크립트 | `scripts/lint-naming.js` |
| 안티 패턴 | Go 스크립트 | `scripts/check-anti-patterns.go` |
| 마이그레이션 동기화 | Go 스크립트 | `scripts/check-wrangler-sync.js` |
| 종합 / Verify | Go 스크립트 | `scripts/verify.go` |

E2E는 `.env.e2e`를 1Password 항목에서 주입받으므로, 머신에 `op` CLI가 설치되어 있고 해당 vault에 접근 권한이 있어야 합니다.

---

## Contribution Guide

1. 작업 전 [`AGENTS.md`](./AGENTS.md) 와 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 를 읽고 현재 규약을 확인합니다.
2. 브랜치는 기능 단위로 생성하고, 커밋 메시지는 기존 컨벤션을 따릅니다.
3. `CODE_STYLE.md` 의 명명/스타일 규칙을 준수합니다.
4. PR 전 `npm run lint` → `npm run typecheck` → `npm run test` 를 로컬에서 통과시킵니다.
5. DB 스키마 변경 시 `npm run db:generate` 로 마이그레이션을 생성하고 `apps/api/migrations` 에 커밋합니다.
6. wrangler 바인딩을 변경하면 `npm run check:wrangler-sync` 를 실행합니다.
7. `CONTRIBUTING.md` 의 PR 체크리스트를 따르고, Husky 훅이 자동 실행하는 lint/포맷을 신뢰합니다.

---

## Maintainers / Points of Contact

| 역할 / Role | 채널 / Channel |
| --- | --- |
| 제품 / Product | 안전 운영 팀 |
| 엔지니어링 / Engineering | `apps/*` 워크스페이스 오너 |
| 인프라 / Infra | Cloudflare 바인딩, D1, R2 오너 |
| 지원 / Support | 리포지토리 이슈 트래커 |

자세한 에스컬레이션 경로는 [`AGENTS.md`](./AGENTS.md) 의 "Points of Contact" 섹션을 따릅니다.

---

## Further Documentation

| 문서 / Document | 경로 / Path |
| --- | --- |
| 프로젝트 지식 베이스 | [`AGENTS.md`](./AGENTS.md) |
| 아키텍처 결정 | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| 코딩 규약 | [`CODE_STYLE.md`](./CODE_STYLE.md) |
| 기여 절차 | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| i18n 구현 | [`apps/worker/I18N_IMPLEMENTATION.md`](./apps/worker/I18N_IMPLEMENTATION.md) |
| Worker AGENTS 노트 | [`apps/worker/AGENTS.md`](./apps/worker/AGENTS.md) |
| Worker App 라우트 노트 | [`apps/worker/src/app/AGENTS.md`](./apps/worker/src/app/AGENTS.md) |
| TWA 매니페스트 | [`apps/worker/android/twa-manifest.json`](./apps/worker/android/twa-manifest.json) |

---

## License

이 저장소의 라이선스는 [`LICENSE`](./LICENSE) 파일을 참조하십시오.  
See the [`LICENSE`](./LICENSE) file in this repository for licensing terms.