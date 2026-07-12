# SafetyWallet

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Hono](https://img.shields.io/badge/Hono-4.x-E36002?logo=hono)](https://hono.dev)
[![D1 / Drizzle](https://img.shields.io/badge/D1-Drizzle-FF6B00)](https://orm.drizzle.team)
[![Turborepo](https://img.shields.io/badge/Turbo-2.x-FF5A1F?logo=turborepo)](https://turbo.build)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-lightgrey)](#license)
[![Node ≥ 20](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)

현장 작업자가 모바일 PWA로 위험 요인을 신고하고 출퇴근을 기록하며 안전 포인트를 적립하는 시스템. 사이트 관리자는 동일 플랫폼에서 리뷰·정산·컴플라이언스를 처리한다. 단일 Cloudflare Worker가 Hono API와 두 개의 Next.js 정적 내보내기 프런트엔드를 호스트명 기반으로 라우팅한다.

A mobile-first PWA for field workers (hazard reports, attendance, safety points) paired with an admin console for site admins (reviews, settlements, compliance). One Cloudflare Worker serves a Hono API plus two statically-exported Next.js frontends, split by hostname.

## Quick Glance

| 항목 / Item                  | 값 / Value                                                                 |
| ---------------------------- | -------------------------------------------------------------------------- |
| Product                      | 현장 안전 신고·출퇴근·포인트 PWA + 관리자 콘솔                              |
| Edge runtime                 | Cloudflare Workers (Hono) + D1 + R2 + KV + Queues + Durable Objects + Hyperdrive |
| Frontends                    | Next.js 15 App Router, static export — `worker` (port 3000) + `admin` (port 3001) |
| Auth                         | JWT with KST same-day midnight expiry · Zustand (persisted) · 3-tier roles |
| Roles                        | `WORKER` → `SITE_ADMIN` → `SUPER_ADMIN` → `SYSTEM` + per-site membership + field flags |
| i18n                         | ko · en · vi · zh (custom runtime)                                         |
| Mobile shell                 | Android Trusted Web Activity (`apps/worker/android`)                        |
| Database                     | D1 (SQLite via Drizzle) — 34 tables, 31 migrations                          |
| Background work              | 10 cron jobs + Durable Objects (RateLimiter, JobScheduler)                  |
| Notifications                | Queue → DLQ pipeline with retry                                            |
| Tests                        | Vitest + Playwright (6 projects)                                           |
| Build pipeline               | Turborepo (types → ui → apps)                                              |
| Deployment                   | Git-ref driven via CI on `master` (manual deploy disabled)                 |
| Node / Package manager       | Node ≥ 20.0.0, npm 10.8.2                                                  |

## 핵심 흐름 / Core Flow

작업자는 모바일 PWA에서 위험 요인을 신고하고 출퇴근을 찍는다. 사이트 관리자는 같은 호스트의 콘솔에서 이를 리뷰·정산한다. 모든 요청은 단일 Cloudflare Worker로 흘러 D1(34 테이블)·R2·KV·외부 FAS Hyperdrive·Durable Objects와 상호작용하고, 알림은 Queue → DLQ 파이프라인을 따른다. 인증은 JWT(KST 자정 자가 만료) + KV 캐시 + D1 폴백의 3중 검증이다.

---

## 목차 / Table of Contents

- [개요 / Overview](#개요--overview)
- [주요 기능 / Key Features](#주요-기능--key-features)
- [저장소 구성 / Package Contents](#저장소-구성--package-contents)
- [상태 / Status](#상태--status)
- [첫 번째로 읽을 문서 / First Files to Read](#첫-번째로-읽을-문서--first-files-to-read)
- [아키텍처 / Architecture](#아키텍처--architecture)
- [진입점 / Entry Points](#진입점--entry-points)
- [빠른 시작 / Quickstart](#빠른-시작--quickstart)
- [명령어 / Commands](#명령어--commands)
- [환경 설정 / Configuration](#환경-설정--configuration)
- [테스트 / Testing](#테스트--testing)
- [로컬 개발 / Local Development](#로컬-개발--local-development)
- [배포 / Deployment](#배포--deployment)
- [문제 해결 / Getting Help](#문제-해결--getting-help)
- [유지보수 / Maintainers](#유지보수--maintainers)
- [추가 문서 / Further Documentation](#추가-문서--further-documentation)
- [라이선스 / License](#라이선스--license)

## 개요 / Overview

SafetyWallet은 건설·현장 산업에서 작업자와 관리자를 연결하는 안전 관리 워크스페이스다. 단일 Cloudflare Worker가 API와 두 개의 SPA를 호스팅하므로 별도의 웹 호스팅 없이 모바일과 데스크톱에 동시 배포된다.

What it does, and why
- 모바일 PWA로 작업자가 별도 앱 설치 없이 위험 요인을 즉시 신고하고 출퇴근을 기록한다.
- 리뷰 완료 시 안전 포인트가 자동으로 적립·정산된다.
- 사이트 관리자는 같은 데이터 위에 리뷰, 정산, 컴플라이언스 대시보드를 본다.
- 단일 Worker가 API와 SPA를 같이 서빙해 운영 표면이 작다.

What users can do
- **작업자 (Worker)** — 게시글 작성, 출퇴근 체크, 교육 콘텐츠 시청, 안전 포인트 적립.
- **현장 관리자 (Site Admin)** — 신고 리뷰, 인원·출퇴근 정산, 데이터 내보내기.
- **최고 관리자 (Super Admin)** — 사이트 단위 권한, 멤버십, 시스템 설정.
- **시스템 (System)** — 자동 잡·내부 cron 트리거 권한.

## 주요 기능 / Key Features

- **현장 최적화 PWA** — 오프라인 친화적 인터페이스, 위치·카메라 통합, 출퇴근 빠른 흐름.
- **안전 포인트 엔진** — 리뷰·출퇴근·교육 완료에 가산되는 포인트, 사이트/역할별 가중치.
- **3단 권한 모델** — 역할 + 사이트 멤버십 + 필드 플래그(`canAwardPoints`, `canReview`, `canExportData` 등).
- **JWT 인증** — KST 자정 자가 만료, KV 캐시 + D1 폴백 3중 검증, 401 리프레시 mutex.
- **다국어** — ko · en · vi · zh 번역 데이터, 런타임 switcher.
- **알림 파이프라인** — Queue + DLQ, 실패 시 자동 재시도.
- **Durable Objects** — 분당·시간당 레이트 리미터, 분산 잡 스케줄러.
- **안드로이드 셸** — TWA로 PWA를 패키징, 알림 아이콘·스플래시 포함.
- **백그라운드 잡 10종** — 포인트 만료, 알림 발송, 정산 마감 등 cron 트리거.
- **CI 표준화** — lint → typecheck → guards → test → build → migrate 직렬 파이프라인.

## 저장소 구성 / Package Contents

| 경로 / Path                | 역할 / Role                                                               |
| -------------------------- | ------------------------------------------------------------------------- |
| `apps/api`                 | Cloudflare Worker API (Hono + Drizzle + D1) — 18개 라우트 모듈              |
| `apps/worker`              | 작업자 PWA (Next.js 15, static export, port 3000) + Android TWA 셸         |
| `apps/admin`               | 관리자 콘솔 (Next.js 15, static export, port 3001)                         |
| `packages/types`           | 공유 TypeScript 타입·열거형·DTO·i18n 번역 데이터                          |
| `packages/ui`              | 공유 shadcn/ui 컴포넌트, Tailwind v4 테마 토큰                            |
| `e2e/`                     | Playwright E2E — auth 설정, admin·worker 흐름                              |
| `scripts/`                 | Go/JS 도구 (verify, naming lint, anti-pattern, wrangler 동기화)             |
| `docs/`                    | PRD, 요구사항 명세, 운영 런북                                              |
| `.github/workflows/`       | CI 파이프라인 정의                                                         |
| `wrangler.toml`            | 루트 CF Worker 설정 + 바인딩 정의                                          |
| `turbo.json`               | Turborepo 파이프라인 정의                                                  |
| `playwright.config.ts`     | 6개 Playwright 프로젝트 설정                                               |
| `vitest.config.ts`         | Vitest 워크스페이스 통합 설정                                              |
| `AGENTS.md`                | 프로젝트 지식 베이스                                                       |
| `ARCHITECTURE.md`          | 상세 아키텍처                                                              |
| `CODE_STYLE.md`            | 명명·포맷 규칙                                                             |
| `CONTRIBUTING.md`          | PR·리뷰·릴리스 절차                                                        |

## 상태 / Status

- **Active development** — 60+ `AGENTS.md` 파일이 코드베이스 전반에 분산되어 있다.
- **Production-ready edge runtime** — 단일 Cloudflare Worker + D1 + R2 + KV + Queues + Durable Objects.
- **Manual deploy disabled by design** — `npm run deploy:api`는 의도적으로 1을 반환한다. 모든 배포는 `master` 커밋의 Git ref 트리거로만 일어난다.
- **Internal tool** — 라이선스는 내부 사용 전용이다.

## 첫 번째로 읽을 문서 / First Files to Read

1. `AGENTS.md` — 스택, 권한 모델, 모든 Cloudflare 바인딩 요약.
2. `ARCHITECTURE.md` — 데이터 흐름과 컴포넌트 다이어그램.
3. `CODE_STYLE.md` — 명명·구조 규칙.
4. `CONTRIBUTING.md` — PR 절차, 커밋 컨벤션, 릴리스 흐름.
5. `apps/worker/I18N_IMPLEMENTATION.md` — i18n 런타임 동작 방식.
6. `wrangler.toml` — 실제 바인딩·환경 변수 정의 (ground truth).

## 아키텍처 / Architecture

단일 Cloudflare Worker가 두 개의 SPA와 API를 같이 서빙한다. 요청은 호스트명으로 분기되며 같은 데이터(D1/R2/KV)를 공유한다.

| 컴포넌트 / Component   | 책임 / Responsibility                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| Cloudflare Worker      | 호스트명 라우팅, JWT 검증, 라우트 핸들러, cron 트리거                           |
| Hono API 라우터        | REST 엔드포인트, Zod 검증, 권한 검사                                            |
| Drizzle ORM            | 34 테이블 정의, 마이그레이션, 시드                                               |
| Durable Objects        | RateLimiter, JobScheduler                                                      |
| R2 (바인딩 2개)        | 업로드 미디어, 출퇴근 자산                                                      |
| KV                     | 인증 캐시, 시스템 상태, 설정 캐시                                               |
| Queue + DLQ            | 알림 전달·재시도 파이프라인                                                     |
| Hyperdrive             | 외부 FAS 직원 DB 연결                                                           |
| Worker PWA (`apps/worker`) | 작업자 인터페이스 — 로그인, 출퇴근, 게시글, 교육, 포인트                       |
| Admin PWA (`apps/admin`) | 리뷰·정산·컴플라이언스 대시보드                                                  |
| Android TWA            | 작업자 PWA의 안드로이드 셸                                                      |

요청 흐름 예시 — 작업자 출퇴근 체크 (`POST /v1/sites/:siteId/attendance/today`):

1. PWA가 정적 자산에서 호스팅된 API로 요청을 보낸다.
2. Worker 미들웨어가 JWT 디코드 → KST 날짜 확인 → KV 캐시 조회 → D1 폴백의 3중 검증을 수행한다.
3. 라우트가 사이트 멤버십과 `canRecordAttendance` 같은 필드 플래그를 확인한다.
4. Drizzle이 D1 트랜잭션으로 출퇴근 기록을 삽입한다.
5. 성공 시 포인트 적립 잡이 Durable Object 큐로 진입한다.
6. 클라이언트는 응답을 받아 Zustand 영속 스토어를 갱신한다.

상세 시퀀스·시나리오·실패 모드는 `ARCHITECTURE.md` 참조.

## 진입점 / Entry Points

| 종류 / Kind     | 경로 / Path                              | 설명                                  |
| --------------- | ---------------------------------------- | ------------------------------------- |
| Worker API      | `apps/api/src/index.ts`                  | Hono 앱, cron 트리거, fetch 핸들러     |
| Worker PWA 루트 | `apps/worker/src/app/(public)/page.tsx` | 로그인, 메인                          |
| Admin PWA 루트  | `apps/admin/src/app/page.tsx`            | 관리자 홈                              |
| 공유 타입       | `packages/types/src/index.ts`            | DTO, 열거형, i18n 키                  |
| 공유 UI         | `packages/ui/src/index.ts`               | shadcn/ui 컴포넌트 래퍼              |
| Android 액티비티 | `apps/worker/android/.../LauncherActivity.java` | TWA 진입점                       |

## 빠른 시작 / Quickstart

선행 조건
- Node ≥ 20.0.0, npm 10.8.2
- Wrangler ≥ 3.x
- Go 1.x (`scripts/*.go` 실행용)
- 1Password CLI (`op`) — E2E 환경 로딩
- Android TWA 빌드 시: JDK 17, Android SDK (선택)

```bash
# 1) 의존성 설치 (workspaces: apps/*, packages/*)
npm install

# 2) Drizzle 마이그레이션 — 원격 D1
npm run db:generate

# 3) 로컬 Worker + 두 PWA 동시 구동
npm run dev
```

기본 포트 / Default ports

| 앱 / App              | 포트 / Port              |
| --------------------- | ------------------------ |
| Worker PWA (Next.js)  | 3000                     |
| Admin PWA (Next.js)   | 3001                     |
| Wrangler dev          | 8787 (기본값)            |

## 명령어 / Commands

| 명령어 / Command                       | 설명 / Description                                                  |
| -------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                          | Turbo로 모든 워크스페이스 병렬 dev                                  |
| `npm run build`                        | 전체 빌드 + 정적 자산 `dist/` 통합                                   |
| `npm run build:api`                    | `packages/types` + `apps/api`만 빌드                                 |
| `npm run build:one-worker`             | `build:api`의 별칭                                                   |
| `npm run build:static`                 | 두 PWA 산출물을 `dist/` 단일 디렉터리로 통합                          |
| `npm run lint`                         | Turbo 워크스페이스 전체 린트                                         |
| `npm run lint:naming`                  | 명명 규칙 검사 (`scripts/lint-naming.js`)                            |
| `npm run typecheck`                    | TypeScript 타입 체크                                                 |
| `npm run test`                         | Vitest 단위/통합 테스트                                               |
| `npm run test:coverage`                | 커버리지 포함 테스트                                                  |
| `npm run e2e`                          | 1Password 환경 로딩 후 Playwright E2E                                 |
| `npm run e2e:headed`                   | 헤드 모드 E2E                                                         |
| `npm run e2e:ui`                       | Playwright UI 모드                                                    |
| `npm run format`                       | Prettier 적용                                                         |
| `npm run format:check`                 | 포맷 위반 검사                                                        |
| `npm run check:wrangler-sync`          | wrangler 바인딩 ↔ 스크립트 일치 여부 검사                             |
| `npm run git:preflight`                | Go 기반 pre-PR 검증                                                   |
| `npm run verify`                       | Go 기반 종합 검증                                                     |
| `npm run db:generate`                  | Drizzle 마이그레이션 생성 (`apps/api`)                                |
| `npm run clean`                        | 워크스페이스 정리 + `node_modules` 제거                                |
| `npm run prepare`                      | Husky 설치 (postinstall)                                             |

## 환경 설정 / Configuration

비밀은 평문으로 커밋하지 않는다. 운영 비밀은 `wrangler secret put` 또는 GitHub Secrets로 주입한다.

- **로컬** — `.dev.vars` (git-ignored)에 KV/R2 모의 키 정의.
- **CI** — `.github/workflows/*`가 `master` ref에서만 마이그레이션·배포를 트리거.
- **E2E** — `.env.e2e`를 1Password CLI (`op run --env-file=.env.e2e`)로 로드.
- **D1 스키마** — `apps/api/migrations/*.sql` (31개), 헬퍼는 `apps/api/src/db/`.
- **권한 플래그 키** — `packages/types/src/index.ts`에서 `canAwardPoints`, `canReview`, `canExportData` 등을 정의.
- **바인딩 변경 후** — `npm run check:wrangler-sync`로 스크립트와 `wrangler.toml` 일치를 검증.

## 테스트 / Testing

| 레이어 / Layer | 도구 / Tool | 위치 / Location                                  |
| -------------- | ----------- | ------------------------------------------------ |
| Unit           | Vitest      | 각 워크스페이스의 `*.test.ts`                     |
| Integration    | Vitest      | `apps/api/src/routes/**/*` 라우트·미들웨어 테스트 |
| E2E            | Playwright  | `e2e/`, 6개 프로젝트 (auth, admin, worker)        |

```bash
npm run test
npm run e2e
```

Vitest 워치 모드, Playwright 트레이스, 커버리지 임계값은 각 워크스페이스의 `vitest.config.ts` / `playwright.config.ts`를 참조.

## 로컬 개발 / Local Development

- 코드 스타일은 `CODE_STYLE.md`, 명명은 `npm run lint:naming`을 따른다.
- Husky pre-commit: `*.ts/tsx`는 anti-pattern 체크 + Prettier, 그 외 확장은 Prettier만.
- PR 전 권장 — `npm run verify`, `npm run check:wrangler-sync`, `npm run test`.
- 새 API 라우트 — `apps/api/src/routes/` 아래 도메인별 폴더에 추가하고 `apps/api/src/db/schema.ts` 갱신.
- 마이그레이션 — `npm run db:generate` 후 `apps/api/migrations/` 검토.
- i18n 키 — `packages/types/src/i18n/`에 추가, 표시는 `apps/worker/src/i18n/`.
- 안드로이드 셸 — `apps/worker/android/`에서 `./gradlew assembleRelease`로 검증.
- 브랜치 명명·커밋 메시지·릴리스 절차는 `CONTRIBUTING.md` 참조.

## 배포 / Deployment

- **수동 배포 의도적 비활성** — `scripts/deploy:api`는 1을 반환한다.
- **Git-ref 기반 CI** — `master` 커밋에만 반응, 마이그레이션은 배포 잡의 별도 단계.
- **단일 Worker** — Hono API와 두 SPA는 같은 Worker에 호스팅되며 SPA는 정적 빌드를 `wrangler.toml`의 `ASSETS` 바인딩으로 노출한다.
- **바인딩 동기화** — 바인딩 변경 후 `npm run check:wrangler-sync`로 로컬과 CI 일치 확인.

## 문제 해결 / Getting Help

- **일반 이슈** — 저장소 이슈 트래커.
- **보안 이슈** — 비공개 채널을 우선 사용 (`docs/security/` 또는 내부 위키 참조).
- **장애 대응** — `docs/ops/`의 런북부터 확인.
- **FAQ** — `docs/faq.md` (있는 경우).
- **로그 위치** — Worker: 실시간 wrangler tail, R2/D1: Cloudflare 대시보드.

## 유지보수 / Maintainers

- **SafetyWallet 플랫폼 팀** — 안전 도메인, 리뷰 로직, 포인트 엔진.
- **인프라 팀** — Worker, R2, D1, Durable Objects, Hyperdrive 구성.
- **백엔드 팀** — 알림 파이프라인, cron 잡, 정산 로직.
- **프런트엔드 팀** — 두 PWA, i18n, 안드로이드 셸.

세부 담당자·온콜 로테이션·에스컬레이션 절차는 내부 위키 참조.

## 추가 문서 / Further Documentation

| 문서 / Doc                                | 주제 / Topic                                                |
| ----------------------------------------- | ----------------------------------------------------------- |
| `AGENTS.md`                               | 프로젝트 지식 베이스 — 스택·바인딩·권한 요약                 |
| `ARCHITECTURE.md`                         | 상세 아키텍처, 데이터 흐름, 시퀀스                          |
| `CODE_STYLE.md`                           | 명명·구조·테스트 규칙                                       |
| `CONTRIBUTING.md`                         | PR 절차, 커밋 컨벤션, 릴리스                              |
| `apps/worker/I18N_IMPLEMENTATION.md`      | i18n 런타임 동작                                            |
| `docs/prd/`                               | 제품 요구사항 정의                                          |
| `docs/ops/`                               | 운영 런북, 장애 대응                                       |
| `wrangler.toml`                           | 실제 바인딩·환경 변수 (ground truth)                       |

## 라이선스 / License

내부 라이선스 — 자세한 내용은 저장소 최상위의 `LICENSE` 파일을 참조. 외부 배포나 재판매를 금한다.