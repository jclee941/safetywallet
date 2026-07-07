# SafetyWallet

[![Status: Active](https://img.shields.io/badge/Status-Active-brightgreen)]()
[![Node >=20](https://img.shields.io/badge/Node-%3E%3D20-339933)]()
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020)]()
[![Next.js 15](https://img.shields.io/badge/Next.js-15-000000)]()
[![License: Internal](https://img.shields.io/badge/License-Internal-lightgrey)]()

## 한국어 요약

SafetyWallet은 현장 근로자가 모바일 PWA로 위험 요소를 신고하고, 출퇴근을 기록하며, 안전 포인트를 적립하도록 돕는 현장 안전 운영 플랫폼입니다. 현장 관리자는 관리자 대시보드에서 제보 검토, 정산, 컴플라이언스 처리를 수행합니다. 단일 Cloudflare Worker가 Hono API와 두 개의 정적 Next.js 프런트엔드(현장 PWA, 관리자 SPA)를 호스트 이름으로 라우팅하며, 인증은 KST 자정 기준 만료 JWT + 3단 권한 모델을 사용합니다.

## Overview

SafetyWallet is a workplace safety operations platform. Field workers report hazards, log attendance, and earn safety points through a mobile PWA; site admins run reviews, settlements, and compliance from a separate dashboard. One Cloudflare Worker serves the Hono API and the two statically-exported Next.js frontends via hostname routing.

## 한눈에 보기

| 항목 | 값 |
| --- | --- |
| 제품 | 현장 안전 운영 PWA + 관리자 대시보드 |
| 백엔드 | Cloudflare Worker (Hono) + D1 (Drizzle ORM) |
| 프런트엔드 | Next.js 15 PWA (`apps/worker`, :3000) + 관리자 SPA (`apps/admin`, :3001) |
| 인증 | JWT (KST 자정 만료) + Zustand 클라이언트 + KV → D1 폴백 |
| 권한 | 역할 (`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`) + 현장 멤버십 + 필드 플래그 |
| 다국어 | `apps/worker/src/i18n` — ko, en, vi, zh |
| 데이터 | D1 (SQLite), 34 테이블, 31 마이그레이션 |
| 스토리지 | R2 (사용자 업로드) + ACETIME_BUCKET (근태) |
| 잡 / 큐 | 10개 cron 잡, `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ`, Durable Objects |
| 빌드 파이프라인 | Turborepo (`types → ui → apps/*`) |
| CI | `.github/workflows/` (lint → typecheck → guards → test → build → migrate) |
| 배포 | master ref 기반 GitOps (수동 배포 비활성화) |
| 상태 | Active — 운영 중 |

## 운영 흐름

1. 현장 근로자가 모바일 PWA(`apps/worker`)에서 제보/출퇴근/교육 이벤트를 제출한다.
2. 요청이 단일 Cloudflare Worker로 라우팅되고, Hono 라우터가 호스트 이름에 따라 API 또는 `ASSETS` 정적 자산을 응답한다.
3. API는 Zod 검증 후 Drizzle ORM으로 D1에 쓰거나 Hyperdrive를 통해 외부 FAS 직원 DB를 조회한다.
4. 관리자 SPA(`apps/admin`)는 동일 Worker의 호스트 라우팅을 통해 정적 자산을 받아 대시보드를 렌더링한다.
5. Durable Object(`RateLimiter`)가 호출 빈도를 제한하고, `NOTIFICATION_QUEUE`가 알림을 비동기 배달한다.
6. 10개 cron 잡이 만료 JWT 청소, 정산, 알림 재시도 같은 백그라운드 작업을 주기적으로 처리한다.

## 목차

- [핵심 기능](#핵심-기능)
- [아키텍처](#아키텍처)
- [빠른 시작](#빠른-시작)
- [명령어 참조](#명령어-참조)
- [로컬 개발](#로컬-개발)
- [테스트](#테스트)
- [기여 가이드](#기여-가이드)
- [라이선스](#라이선스)
- [메인테이너](#메인테이너)
- [추가 문서](#추가-문서)

## 핵심 기능

- **현장 PWA** — `apps/worker`. 로그인, 출퇴근, 제보, 안전 교육, 포인트.
- **관리자 대시보드** — `apps/admin`. 출퇴근/제보/투표/교육 검토, 정산, 데이터 내보내기.
- **단일 Worker API** — Hono 라우팅 18개 모듈, `admin/` 하위 네임스페이스, Zod 요청 검증.
- **3단 권한 모델** — 역할 + 현장 멤버십 + 필드 플래그 (`canAwardPoints`, `canReview`, `canExportData`).
- **JWT 인증** — KST 자정 기준 만료, KV 캐시 → D1 폴백, 클라이언트 401 refresh mutex.
- **다국어 런타임** — `apps/worker/src/i18n`에서 ko/en/vi/zh 번역 데이터를 동적 로드.
- **예약 작업** — 10개 cron 잡, Durable Object(`JobScheduler`)로 큐잉.
- **미디어 저장** — R2(사용자 업로드) + ACETIME_BUCKET(근태 자산).
- **E2E 검증** — Playwright 6 프로젝트, 인증/관리자/워커 플로우.
- **Android TWA** — `apps/worker/android/`. Bubblewrap로 생성된 신뢰할 수 있는 웹 활동 래퍼.

## 아키텍처

워크스페이스 주요 모듈:

| 컴포넌트 | 위치 | 역할 |
| --- | --- | --- |
| Worker 라우터 | `apps/api/src/routes/` | 18개 API 모듈 (`admin/` 하위 중첩) |
| 미들웨어 | `apps/api/src/middleware/` | CORS, 로깅, 분석, 보안 헤더 |
| DB 계층 | `apps/api/src/db/` | Drizzle 스키마 34 테이블, 시드, 헬퍼 |
| Durable Object | `apps/api/src/durable-objects/` | `RateLimiter`, `JobScheduler` |
| 크론 잡 | `apps/api/src/jobs/` | 10개 스케줄 잡 |
| 검증 | `apps/api/src/validators/` | Zod 요청 스키마 |
| 마이그레이션 | `apps/api/migrations/` | D1 SQL 31개 |
| 현장 PWA | `apps/worker/src/app/` | Next.js App Router (login/posts/attendance/education) |
| 관리자 SPA | `apps/admin/src/app/` | Next.js App Router |
| 공유 타입 | `packages/types/` | TS enum, DTO, i18n 번역 데이터 |
| 공유 UI | `packages/ui/` | shadcn/ui 컴포넌트 + Tailwind v4 토큰 |
| E2E | `e2e/` | Playwright 6 프로젝트 |

Cloudflare 바인딩 (`wrangler.toml` 참조):

- `DB` (D1) — 주 데이터베이스.
- `FAS_HYPERDRIVE` — 외부 FAS 직원 DB 조회.
- `ASSETS` — Worker 정적 자산(현장 PWA + 관리자 SPA).
- `R2`, `ACETIME_BUCKET` — 업로드/근태 파일.
- `KV` — 인증 캐시, 시스템 상태, 설정.
- `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` — 알림 비동기 배달.
- `RATE_LIMITER` (Durable Object) — 레이트 리미팅.

## 빠른 시작

사전 요구 사항:

- Node.js `>=20.0.0` (`.nvmrc`/`engines` 명시).
- npm `>=10` (`packageManager: npm@10.8.2`).
- Cloudflare 계정 (D1, R2, KV, Queue 바인딩 활성화).
- Go `1.22+` — `scripts/verify.go`, `scripts/git-preflight.go` 사용 시.
- 1Password CLI (`op`) — E2E 테스트 시 `.env.e2e` 주입용.

설치와 개발:

```bash
npm install
npm run dev          # turbo run dev — apps/worker :3000, apps/admin :3001
```

정적 자산까지 통합 빌드:

```bash
npm run build        # turbo run build && build:static
npm run build:api    # API만 단독 빌드
```

## 명령어 참조

루트 `package.json` 스크립트:

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | Turborepo 개발 서버 기동 |
| `npm run build` | 전체 빌드 후 `dist/`로 정적 자산 통합 |
| `npm run build:api` | API Worker 번들 빌드 |
| `npm run build:static` | `apps/{worker,admin}/out` → `dist/`, `dist/admin/` |
| `npm run build:one-worker` | API만 단독 빌드 |
| `npm run lint` | Turborepo 린트 실행 |
| `npm run lint:naming` | 명명 규칙 Go 스크립트 검사 |
| `npm run test` | Vitest 전체 실행 |
| `npm run test:coverage` | 커버리지 측정 모드 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run check:wrangler-sync` | `wrangler.toml` 동기화 검사 |
| `npm run git:preflight` | 커밋 전 git 상태 검사 (Go) |
| `npm run verify` | 풀 검증 (Go) |
| `npm run format` / `format:check` | Prettier 실행 / 검사 |
| `npm run clean` | 빌드 산출물 및 `node_modules` 정리 |
| `npm run db:generate` | Drizzle 스키마 생성 (`apps/api`) |
| `npm run e2e` | Playwright E2E (`.env.e2e` 필요, `op` 기반) |
| `npm run e2e:headed` / `e2e:ui` | 헤드 / UI 모드 E2E |
| `npm run deploy:api` | 수동 배포 비활성화 (CI 전용, master ref) |

`husky`는 `prepare` 훅으로 활성화되어 pre-commit에서 `scripts/check-anti-patterns.go`와 Prettier를 자동 실행한다.

## 로컬 개발

- Worker PWA는 `apps/worker`, 관리자 SPA는 `apps/admin`에서 독립 실행 가능.
- 공유 타입 변경 시 `packages/types`를 먼저 빌드 (`turbo.json` 파이프라인 순서 보장).
- Drizzle 스키마 변경은 `npm run db:generate --workspace=apps/api`로 마이그레이션 SQL 생성 후 `apps/api/migrations/`에 커밋.
- `wrangler.toml` 동기화는 `npm run check:wrangler-sync`로 확인.
- 바인딩 시크릿은 `op` 또는 로컬 `.dev.vars` 사용 (저장소에 커밋 금지).

## 테스트

- **단위** — Vitest (`vitest.config.ts`, 워크스페이스별). `npm run test` / `npm run test:coverage`.
- **E2E** — Playwright (`playwright.config.ts`, 6 프로젝트). 환경 변수는 `op run --env-file=.env.e2e -- npx playwright test` 패턴으로 주입.
- **타입 / 린트 가드** — PR 전 `npm run verify` 권장.
- **마이그레이션** — CI에서 D1에 순차 적용, 로컬은 `wrangler d1 migrations apply` 사용.

## 기여 가이드

1. `CONTRIBUTING.md`의 절차(브랜치 명명, 커밋 메시지 컨벤션, PR 체크리스트) 준수.
2. `CODE_STYLE.md` 적용 — Prettier 설정과 명명 규칙 가드 자동 검사.
3. 커밋 전 `npm run git:preflight` 통과.
4. PR 전 `npm run verify`와 워크스페이스별 테스트 통과 확인.
5. 변경 시 `AGENTS.md`(모듈 단위)도 함께 갱신.

## 라이선스

내부 라이선스. 자세한 내용은 저장소 `LICENSE` 파일 참고.

## 메인테이너

- **팀** — 현장 안전 플랫폼 팀 (내부 메일링 리스트).
- **이슈 트래커** — 저장소 GitHub Issues.
- **온콜** — 사내 PagerDuty 서비스 `safetywallet-oncall`.
- **문서** — 추가 문서는 아래 [추가 문서](#추가-문서) 참고.

## 추가 문서

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 시스템/모듈 아키텍처 상세.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 기여 절차.
- [CODE_STYLE.md](./CODE_STYLE.md) — 코드 스타일.
- [AGENTS.md](./AGENTS.md) — 프로젝트 지식 베이스 진입점.
- [apps/worker/I18N_IMPLEMENTATION.md](./apps/worker/I18N_IMPLEMENTATION.md) — 다국어 구현 가이드.
- [apps/worker/AGENTS.md](./apps/worker/AGENTS.md) — Worker PWA 모듈 가이드.
- `apps/api/AGENTS.md` — API 모듈 가이드.
- `apps/admin/AGENTS.md` — 관리자 SPA 모듈 가이드.
- `docs/` — PRD, 요구사항 명세, 운영 런북.
- `e2e/` — Playwright E2E 작성 가이드.