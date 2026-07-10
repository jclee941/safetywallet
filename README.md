# SafetyWallet

> 현장 근로자 안전 보고 PWA + 관리자 대시보드. Cloudflare Workers에서 단일 진실 공급원(Single Source of Truth)을 통해 API와 정적 프런트엔드를 제공합니다.

[![Stack](https://img.shields.io/badge/stack-TypeScript%20%C2%B7%20Hono%20%C2%B7%20Drizzle-3178C6)]()
[![Runtime](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)]()
[![Frontend](https://img.shields.io/badge/frontend-Next.js%2015-000000)]()
[![DB](https://img.shields.io/badge/db-D1%20%2B%20Hyperdrive-FF6B35)]()
[![Status](https://img.shields.io/badge/status-Production%20Ready-2EA043)]()

## 한국어 요약

SafetyWallet은 건설·산업 현장의 안전 관리를 위한 종단간 시스템입니다. 근로자는 모바일 PWA로 위험 요소를 신고하고, 출퇴근을 기록하며, 안전 포인트를 적립합니다. 현장 관리자는 웹 대시보드에서 신고 검토, 정산, 컴플라이언스를 처리합니다. 단일 Cloudflare Worker가 Hono API와 두 개의 Next.js 정적 익스포트(`apps/worker`, `apps/admin`)를 호스트명 라우팅으로 제공하여 운영 복잡도를 최소화합니다.

## English Summary

SafetyWallet is an end-to-end safety management system for construction and industrial sites. Field workers use a mobile PWA to report hazards, log attendance, and earn safety points. Site admins process reviews, settlements, and compliance from a web dashboard. A single Cloudflare Worker serves the Hono API and two statically exported Next.js frontends (`apps/worker`, `apps/admin`) via hostname routing, minimizing operational complexity.

## 빠른 상태 / Quick Status

| 항목 | 상태 | 비고 |
|------|------|------|
| Production readiness | Production-ready | Cloudflare Workers + D1 기반 |
| Worker PWA | Active | Next.js 15, ko/en/vi/zh |
| Admin Dashboard | Active | Next.js 15, 정적 익스포트 |
| API | Active | Hono + Drizzle ORM |
| Android (TWA) | Active | `apps/worker/android` |
| E2E Tests | Active | Playwright 6 프로젝트 |
| Manual deploy | Disabled | Git-ref 기반 CI 자동 배포 |
| Node engine | `>=20.0.0` | npm `10.8.2` |

## 흐름 요약 / Flow Summary

1. 사용자가 PWA(또는 Android TWA)로 접근 → 호스트명 라우팅이 Worker 또는 Admin으로 분기.
2. 클라이언트가 Zustand 저장소에 저장된 JWT로 인증, KST 자정 기준 만료 검증.
3. Hono 라우트가 요청 처리 → Drizzle로 D1 조회 → 필요 시 Hyperdrive/FAS 연동.
4. Cron 잡(10개) 및 Durable Object(`RateLimiter`, `JobScheduler`)로 부가 작업 수행.
5. 알림은 `NOTIFICATION_QUEUE`/`NOTIFICATION_DLQ`로 분리 전송.

## 목차 / Table of Contents

- [프로젝트 개요 / Overview](#프로젝트-개요--overview)
- [주요 기능 / Features](#주요-기능--features)
- [아키텍처 / Architecture](#아키텍처--architecture)
- [저장소 구조 / Repository Layout](#저장소-구조--repository-layout)
- [빠른 시작 / Quickstart](#빠른-시작--quickstart)
- [명령어 참조 / Commands Reference](#명령어-참조--commands-reference)
- [설정 / Configuration](#설정--configuration)
- [로컬 개발 / Local Development](#로컬-개발--local-development)
- [테스트 / Testing](#테스트--testing)
- [배포 / Deployment](#배포--deployment)
- [기여 가이드 / Contributing](#기여-가이드--contributing)
- [유지보수자 / Maintainers](#유지보수자--maintainers)
- [라이선스 / License](#라이선스--license)

## 프로젝트 개요 / Overview

SafetyWallet은 현장 안전 관리의 전체 사이클을 하나의 코드베이스로 통합합니다. AGENTS.md 기준 60개의 모듈별 가이드가 코드를 보강하며, AGENTS.md·ARCHITECTURE.md·CODE_STYLE.md·CONTRIBUTING.md가 핵심 문서군을 형성합니다.

- **대상 사용자**: 현장 근로자(Worker), 현장 관리자(Site Admin), 시스템 관리자(Super Admin).
- **핵심 가치**: 모바일 우선 신고, 실시간 정산, 다국어 지원, 단일 배포 단위.
- **확장성**: Workers Static Assets, R2, KV, Queue, Durable Objects로 구성되어 edge-first 운영.

## 주요 기능 / Features

| 영역 | 기능 | 설명 |
|------|------|------|
| PWA | 위험 신고 | 사진·영상 첨부, R2 업로드 |
| PWA | 출퇴근 기록 | 위치·시간 기반, KST 정렬 |
| PWA | 안전 교육 | 모듈형 콘텐츠, 진도 추적 |
| PWA | 포인트/리워드 | 적립·교환·정산 |
| Admin | 신고 검토 | 승인·반려, 코멘트 |
| Admin | 정산 | 포인트 정산 내역 |
| Admin | 컴플라이언스 | 데이터 익스포트, 감사 로그 |
| 통합 | 다국어 | ko, en, vi, zh (커스텀 i18n 런타임) |
| 통합 | 인증 | JWT(KST 자정 만료) + 3단 권한 |
| 통합 | 알림 | Queue/DLQ 기반 비동기 전달 |

## 아키텍처 / Architecture

### 구성 요소 매핑 / Component Map

| 컴포넌트 | 위치 | 역할 |
|----------|------|------|
| API Worker | `apps/api` | Hono + Drizzle + D1 |
| Worker PWA | `apps/worker` | Next.js 15, 정적 익스포트 |
| Admin PWA | `apps/admin` | Next.js 15, 포트 3001 |
| Android TWA | `apps/worker/android` | Bubblewrap 스타일 네이티브 래퍼 |
| 공유 타입 | `packages/types` | TS 타입·enum·DTO·i18n |
| 공유 UI | `packages/ui` | shadcn/ui + Tailwind v4 |
| 스크립트 | `scripts/` | Go/JS 검증 도구 |
| E2E | `e2e/` | Playwright 6 프로젝트 |
| 문서 | `docs/` | PRD, 요구사항, 운영 런북 |

### Cloudflare 바인딩 / Cloudflare Bindings

| 바인딩 | 타입 | 용도 |
|--------|------|------|
| `DB` | D1 | 주 데이터베이스 (34 테이블) |
| `FAS_HYPERDRIVE` | Hyperdrive | 외부 FAS 직원 DB |
| `ASSETS` | Workers Static Assets | 정적 프런트엔드 |
| `R2` | R2 | 사용자 업로드 미디어 |
| `ACETIME_BUCKET` | R2 | 출퇴근 자산 |
| `KV` | KV | 인증 캐시·설정 |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | Queue | 알림 파이프라인 |
| `RATE_LIMITER` | Durable Object | 요청 속도 제한 |
| `JobScheduler` | Durable Object | 잡 스케줄링 |

### 인증·권한 / Auth & Permissions

| 계층 | 메커니즘 |
|------|----------|
| 토큰 | JWT, KST 자정 기준 만료 |
| 검증 | JWT 디코드 → KST 날짜 확인 → KV 캐시 → D1 폴백 |
| 역할 | `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM` |
| 멤버십 | 현장 단위 가입 |
| 필드 플래그 | `canAwardPoints`, `canReview`, `canExportData` |
| 클라이언트 키 | Worker: `safetywallet-auth`, Admin: `safetywallet-admin-auth` |

### 요청 흐름 / Request Flow

1. 클라이언트가 Worker 호스트(`*.safetywallet` 도메인)로 HTTPS 요청.
2. Worker의 호스트명 라우터가 `worker`/`admin`/`api`로 경로 분기.
3. 미들웨어 체인이 CORS → 로깅 → 분석 → 보안 헤더 순서로 처리.
4. 인증 미들웨어가 JWT 검증 후 `c.set('user', payload)`.
5. Hono 라우트가 Zod 검증 → Drizzle 쿼리 → 응답 직렬화.
6. 부수 효과는 Queue 또는 Durable Object로 비동기 위임.

## 저장소 구조 / Repository Layout

실제 최상위 트리(제공된 메타데이터 기준)는 다음과 같습니다.

```text
.
├── AGENTS.md
├── ARCHITECTURE.md
├── CODE_STYLE.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── package.json
├── package-lock.json
├── playwright.config.ts
├── turbo.json
├── vitest.config.ts
├── wrangler.toml
└── apps/
    └── worker/
        ├── AGENTS.md
        ├── I18N_IMPLEMENTATION.md
        ├── next.config.mjs
        ├── next-env.d.ts
        ├── package.json
        ├── postcss.config.cjs
        ├── tailwind.config.js
        ├── tsconfig.json
        ├── vitest.config.ts
        ├── android/
        │   ├── build.gradle
        │   ├── gradle.properties
        │   ├── gradlew
        │   ├── gradlew.bat
        │   ├── manifest-checksum.txt
        │   ├── settings.gradle
        │   ├── store_icon.png
        │   ├── twa-manifest.json
        │   ├── app/
        │   │   ├── build.gradle
        │   │   └── src/main/
        │   └── gradle/wrapper/
        └── src/
            ├── app/ (AGENTS.md, error.tsx, globals.css)
            └── types/css.d.ts
```

`apps/api`, `apps/admin`, `packages/types`, `packages/ui`, `e2e/`, `docs/`, `scripts/`, `.github/workflows/`는 AGENTS.md의 시스템 설명에 명시된 구성 요소입니다.

## 빠른 시작 / Quickstart

### 사전 요구 사항 / Prerequisites

- Node.js `>=20.0.0` (권장: LTS 20.x)
- npm `10.8.2` (Corepack 활성화 권장)
- Wrangler CLI (`npx wrangler`)
- Go `>=1.22` (스크립트 검증 도구 실행용)
- Android 빌드를 진행하는 경우 JDK 17 + Android SDK

### 설치 / Install

```bash
npm install
npm run prepare   # husky 훅 설치
```

### 개발 서버 / Dev Servers

```bash
npm run dev       # turbo run dev — 워크스페이스 전체
```

기본 포트:

| 앱 | 포트 |
|----|------|
| Worker PWA | 3000 |
| Admin PWA | 3001 |
| API Worker | wrangler dev (8787 기본) |

### 첫 빌드 / First Build

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## 명령어 참조 / Commands Reference

| 명령어 | 용도 |
|--------|------|
| `npm run dev` | 워크스페이스 개발 서버 일괄 기동 |
| `npm run build` | 전체 빌드 + 정적 자산 통합 |
| `npm run build:api` | `packages/types` + `apps/api` 빌드 |
| `npm run build:static` | `dist/`로 정적 자산 복사 |
| `npm run build:one-worker` | API만 단독 빌드 |
| `npm run lint` | 워크스페이스 린트 |
| `npm run lint:naming` | 명명 규칙 검증 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run test` | 워크스페이스 단위 테스트 |
| `npm run test:coverage` | 커버리지 리포트 |
| `npm run e2e` | Playwright E2E (`op` 기반) |
| `npm run e2e:headed` | 헤드리스 모드 해제 |
| `npm run e2e:ui` | Playwright UI 모드 |
| `npm run db:generate` | Drizzle 마이그레이션 생성 |
| `npm run check:wrangler-sync` | `wrangler.toml` 동기성 검증 |
| `npm run git:preflight` | 커밋 전 검사 (Go) |
| `npm run verify` | 통합 검증 (Go) |
| `npm run format` / `format:check` | Prettier 실행/검증 |
| `npm run clean` | 의존성·빌드 결과 정리 |
| `npm run deploy:api` | 비활성 (CI 전용) |

## 설정 / Configuration

### 환경 변수 / Environment Variables

- `.env.e2e`: Playwright 실행용 (`op` 경유 로드)
- 워커 바인딩: `wrangler.toml` 단일 진입점
- 시크릿: `wrangler secret put <KEY>`로 등록

### 호스트명 라우팅 / Hostname Routing

Worker는 들어오는 호스트명에 따라 다음으로 라우팅합니다.

| 호스트 패턴 | 대상 |
|-------------|------|
| `worker.*` | `apps/worker/out` |
| `admin.*` | `apps/admin/out` |
| `api.*` | Hono API |

### 다국어 / i18n

`apps/worker/src/i18n`의 커스텀 런타임이 다음 로케일을 처리합니다.

| 로케일 | 코드 |
|--------|------|
| 한국어 | `ko` |
| 영어 | `en` |
| 베트남어 | `vi` |
| 중국어 | `zh` |

번역 데이터는 `packages/types`에 위치합니다. 자세한 구현은 `apps/worker/I18N_IMPLEMENTATION.md` 참고.

## 로컬 개발 / Local Development

### 브랜치 규칙 / Branching

- `master`: 프로덕션. Git-ref 기반 자동 배포.
- 기능 브랜치는 짧은 수명 + 스크래프(merge 후 삭제).

### 코드 스타일 / Code Style

- `CODE_STYLE.md`의 규칙을 우선 적용합니다.
- Prettier 2-space, ESLint 8.57.
- Husky + lint-staged로 커밋 직전 검증.
- 명명 규칙은 `npm run lint:naming`으로 강제.

### 안티 패턴 검사 / Anti-pattern Checks

`lint-staged`의 `scripts/check-anti-patterns.go`가 다음 항목을 점검합니다.

- 순환 의존성
- 매직 넘버
- 인라인 비즈니스 로직
- 누락된 i18n 키

### TWA 개발 / TWA Development

`apps/worker/android`는 Bubblewrap 스타일 TWA 래퍼입니다.

- 패키지: `me.jclee.safetywallet.twa`
- 진입점: `LauncherActivity`, `DelegationService`, `Application`
- 매니페스트: `twa-manifest.json`
- 빌드: `./gradlew assembleRelease`

## 테스트 / Testing

| 계층 | 도구 | 위치 |
|------|------|------|
| 단위 | Vitest | 워크스페이스 전반 |
| E2E | Playwright | `e2e/` (6 프로젝트) |
| 타입 | `tsc --noEmit` | `npm run typecheck` |
| 정적 | ESLint + Prettier | `npm run lint` |

E2E는 1Password CLI(`op`)로 `.env.e2e`를 주입받습니다. CI에서는 별도 자격 증명 흐름을 사용합니다.

## 배포 / Deployment

- **수동 배포는 비활성화**되어 있습니다. `npm run deploy:api`는 의도적으로 실패합니다.
- 배포는 `master` 브랜치 Git-ref 기반 GitHub Actions에서만 트리거됩니다.
- 파이프라인 순서: `lint → typecheck → guards → test → build → migrate`.
- 정적 자산은 `dist/`로 통합되어 `ASSETS` 바인딩으로 서빙됩니다.

## 기여 가이드 / Contributing

`CONTRIBUTING.md`를 우선 읽어 주세요. 핵심 요약:

1. 이슈 또는 작업 항목 생성 후 브랜치 분기.
2. `npm run git:preflight` 통과 후 PR 개설.
3. PR은 한 가지 변경에 집중하고, 모듈별 `AGENTS.md`를 함께 갱신.
4. 리뷰어는 ARCHITECTURE.md 기준으로 변경 영향 평가.
5. 머지 후 `master`에서 자동 배포 트리거.

## 유지보수자 / Maintainers

| 역할 | 책임 |
|------|------|
| 시스템 관리자 | 도메인, 바인딩, 배포 게이트 |
| 백엔드 리드 | API, Drizzle, Durable Objects |
| 프런트엔드 리드 | Worker/Admin PWA, i18n |
| 모바일 리드 | Android TWA |
| 운영 리드 | KV/Queue/R2 정책, 모니터링 |

상세 연락처는 저장소 내 CODEOWNERS 또는 `docs/operations/`을 참고하세요.

## 라이선스 / License

`LICENSE` 파일의 조항을 따릅니다. 사내 배포용이며 외부 재배포 시 별도 승인이 필요합니다.

---

### 추가 문서 / Further Documentation

| 문서 | 경로 |
|------|------|
| 아키텍처 상세 | `ARCHITECTURE.md` |
| 코드 스타일 | `CODE_STYLE.md` |
| 기여 절차 | `CONTRIBUTING.md` |
| 모듈별 가이드 (60개) | 각 디렉터리의 `AGENTS.md` |
| i18n 구현 | `apps/worker/I18N_IMPLEMENTATION.md` |
| 운영 런북 | `docs/operations/` |
| 요구사항 명세 | `docs/` |