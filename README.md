# SafetyWallet

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Next.js 15](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![License](https://img.shields.io/badge/license-See%20LICENSE-blue)

## 개요

**SafetyWallet**은 현장 작업자가 모바일 PWA로 위험 요소를 신고하고, 출퇴근을 기록하며, 안전 점수와 보상을 적립할 수 있도록 돕는 현장 안전 관리 플랫폼입니다. 같은 인프라에서 사이트 관리자·슈퍼 관리자는 대시보드를 통해 신고 검토, 정산, 컴플라이언스를 처리합니다. 한국어·영어·베트남어·중국어를 지원하며, 단일 Cloudflare Worker가 Hono API와 두 개의 정적 Next.js 프런트엔드를 호스트명 기반으로 라우팅합니다.

**English:** A field-safety platform where workers report hazards, log attendance, and earn safety points via a mobile PWA, while site and super admins review reports, settle rewards, and track compliance from a dashboard. One Cloudflare Worker serves the Hono API and two statically-exported Next.js apps behind hostname routing.

## 빠른 상태 (At a Glance)

| 항목 | 값 |
| --- | --- |
| 상태 | Active, 운영 환경 배포 중 |
| 스택 | TypeScript · Hono · Drizzle · Next.js 15 · Cloudflare Workers · D1 |
| 패키지 매니저 | npm 10.8.2 (workspaces) |
| 빌드 파이프라인 | Turborepo (types → ui → apps) |
| Node | `>=20.0.0` |
| 테스트 | Vitest (단위) + Playwright (E2E) |
| 다국어 | ko, en, vi, zh |
| 배포 | Git-ref 기반 (master 푸시 → CI) |
| 라이선스 | [LICENSE](./LICENSE) |

## 운영 흐름 (Operational Flow)

- **작업자:** PWA(`apps/worker`)에서 출퇴근·신고·교육·포인트를 사용. 기본 진입 호스트는 worker 호스트명.
- **관리자:** 대시보드(`apps/admin`)에서 신고 검토·정산·데이터 내보내기. 기본 진입 호스트는 admin 호스트명.
- **API:** Hono 라우터가 D1, R2, KV, 알림 큐를 오케스트레이션하고 FAS 외부 DB를 Hyperdrive로 조회.
- **운영자 다음 단계:** `npm run verify`로 로컬 검증, 마스터 푸시 시 CI가 D1 마이그레이션과 Cloudflare 배포를 트리거.

## 목차 (Table of Contents)

- [1. 목적 (Purpose)](#1-목적-purpose)
- [2. 주요 기능 (Features)](#2-주요-기능-features)
- [3. 아키텍처 (Architecture)](#3-아키텍처-architecture)
- [4. 패키지 구성 (Package Contents)](#4-패키지-구성-package-contents)
- [5. 빠른 시작 (Quickstart)](#5-빠른-시작-quickstart)
- [6. 명령어 (Commands)](#6-명령어-commands)
- [7. 로컬 개발 (Local Development)](#7-로컬-개발-local-development)
- [8. 테스트 (Testing)](#8-테스트-testing)
- [9. 설정 (Configuration)](#9-설정-configuration)
- [10. 기여 (Contributing)](#10-기여-contributing)
- [11. 유지보수자 (Maintainers)](#11-유지보수자-maintainers)
- [12. 추가 문서 (Further Documentation)](#12-추가-문서-further-documentation)
- [13. 라이선스 (License)](#13-라이선스-license)

## 1. 목적 (Purpose)

SafetyWallet은 중소 건설·현장 사업장의 안전 관리를 종이·스프레드시트 기반에서 모바일 기반 워크플로우로 전환하기 위해 만들어졌습니다.

- **핵심 가치:** 작업자가 즉석에서 위험을 신고하고 즉시 보상 포인트를 받게 한다.
- **대상 사용자:** 현장 작업자(모바일 우선), 사이트 관리자, 통합 운영(슈퍼) 관리자.
- **왜 유용한가:** 단일 플랫폼에서 신고 → 검토 → 교육 → 정산까지의 추적성을 확보하고, 외부 FAS 인사 시스템과 연동해 출퇴근과 안전 점수를 통합한다.
- **현 상태:** Active. 마스터 브랜치 푸시가 CI를 통해 운영 배포를 트리거한다.

## 2. 주요 기능 (Features)

### 작업자 (Worker, 모바일 PWA)

- 한국어·영어·베트남어·중국어 UI, KST 자정 기준 JWT 세션.
- 게시글 신고, 출퇴근 체크, 안전 교육 시청, 포인트와 리워드 확인.
- 오프라인 대응과 Trusted Web Activity 기반 APK(`apps/worker/android`) 제공.

### 관리자 (Admin, 대시보드)

- 신고 검토, 보상 정산, 출퇴근 데이터 내보내기.
- 3단계 역할(`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`)과 사이트 멤버십, 필드 플래그(`canAwardPoints`, `canReview`, `canExportData`)를 결합한 권한 모델.

### API 및 인프라

- Hono 라우터, Zod 요청 검증, 34개 D1 테이블을 Drizzle로 관리.
- 인증 캐시(KV), 이미지·영상 스토리지(R2), 외부 FAS DB(Hyperdrive), 알림 큐 + DLQ, 알림 Durable Object, 10개의 cron 잡.

## 3. 아키텍처 (Architecture)

### 요청 흐름 (Request Flow)

1. 클라이언트가 worker 호스트, admin 호스트, api 호스트 중 하나로 요청한다.
2. 단일 Cloudflare Worker가 호스트 헤더로 라우팅 결정한다.
3. 정적 자산은 `ASSETS` 바인딩에서 즉시 응답; `/api/*`는 Hono 라우터로 진입한다.
4. Hono 미들웨어 체인(CORS → 로깅 → 보안 헤더 → 인증 → 분석)이 순서대로 실행된다.
5. 인증은 JWT 디코드 → KST 자정 만료 검사 → KV 캐시 → D1 폴백 순서로 검증한다.
6. 라우트 핸들러가 Drizzle로 D1에 질의하고, 필요 시 R2·Hyperdrive·Queue를 호출한다.
7. 알림은 `NOTIFICATION_QUEUE`로 enqueue되며, 실패는 `NOTIFICATION_DLQ`로 이동한다.

### Cloudflare 바인딩

| 바인딩 | 타입 | 용도 |
| --- | --- | --- |
| `DB` | D1 | 메인 데이터 (34개 테이블) |
| `FAS_HYPERDRIVE` | Hyperdrive | 외부 FAS 직원 DB |
| `ASSETS` | Workers Static Assets | worker/admin 정적 자산 |
| `R2` | R2 | 사용자 업로드 이미지/영상 |
| `ACETIME_BUCKET` | R2 | 출퇴근 관련 자산 |
| `KV` | KV | 인증 캐시, 시스템 상태, 설정 |
| `NOTIFICATION_QUEUE` | Queue | 알림 파이프라인 |
| `NOTIFICATION_DLQ` | Queue | 알림 실패 DLQ |
| `RATE_LIMITER` | Durable Object | API 레이트 리밋 |

## 4. 패키지 구성 (Package Contents)

저장소 루트의 npm 워크스페이스(`apps/*`, `packages/*`)를 사용합니다.

| 경로 | 역할 | 진입점 |
| --- | --- | --- |
| `apps/api` | Cloudflare Worker API (Hono + Drizzle + D1) | `apps/api/src/index.ts` (라우터 부트스트랩) |
| `apps/admin` | Next.js 15 관리자 대시보드 (정적 익스포트, 기본 포트 3001) | `apps/admin/src/app/` |
| `apps/worker` | Next.js 15 작업자 PWA (정적 익스포트, 기본 포트 3000) | `apps/worker/src/app/` |
| `apps/worker/android` | Trusted Web Activity APK 래퍼 | `apps/worker/android/app/src/main/java/me/jclee/safetywallet/twa/` |
| `packages/types` | 공유 TS 타입·열거형·DTO·i18n 번역 데이터 | `packages/types/src` |
| `packages/ui` | 공유 shadcn/ui 컴포넌트 + Tailwind v4 테마 토큰 | `packages/ui/src` |
| `e2e` | Playwright E2E (인증 셋업, admin, worker 플로우) | `e2e/` |
| `docs` | PRD, 요구사항 명세, 운영 런북 | `docs/` |
| `scripts` | Go/JS 도구(verify, 네이밍 린트, 안티 패턴 검사) | `scripts/` |
| `wrangler.toml` | 루트 Cloudflare Worker 설정과 모든 바인딩 | `wrangler.toml` |
| `turbo.json` | Turborepo 파이프라인 정의 | `turbo.json` |
| `playwright.config.ts` | Playwright 6개 프로젝트 설정 | `playwright.config.ts` |

## 5. 빠른 시작 (Quickstart)

요구 사항:

- Node `>=20.0.0`
- npm 10.8.2 (저장소 `packageManager` 핀)
- Cloudflare 계정과 D1/Hyperdrive/R2/KV/Queue 리소스
- E2E 실행 시 [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`op`)

### 설치

```bash
npm install
```

### 첫 빌드

```bash
npm run build          # Turbo 전체 빌드 후 정적 자산을 dist/로 복사
npm run build:api      # types → apps/api만 빌드
npm run build:static   # dist/ 디렉터리로 worker/admin 정적 산출물 복사
```

### 첫 실행

```bash
npm run dev            # admin(3001), worker(3000), api(8787) 동시 실행
```

## 6. 명령어 (Commands)

| 명령어 | 설명 |
| --- | --- |
| `npm run build` | Turbo 빌드 후 정적 자산을 `dist/`로 패키징 |
| `npm run build:api` | `packages/types`와 `apps/api`만 빌드 |
| `npm run build:static` | `dist/`로 정적 산출물 복사 |
| `npm run build:one-worker` | CI용 단일 워크플로 빌드 |
| `npm run dev` | 워크스페이스 전체 개발 서버 실행 |
| `npm run lint` | Turbo를 통한 린트 |
| `npm run lint:naming` | 네이밍 컨벤션 린트 (`scripts/lint-naming.js`) |
| `npm run typecheck` | 전체 타입 검사 |
| `npm run test` | Turbo를 통한 Vitest 단위 테스트 |
| `npm run test:coverage` | 커버리지 포함 Vitest |
| `npm run e2e` | `op`으로 시크릿 로드 후 Playwright |
| `npm run e2e:headed` | 헤드드 모드 Playwright |
| `npm run e2e:ui` | Playwright UI 모드 |
| `npm run db:generate` | Drizzle 스키마 생성 (`apps/api`) |
| `npm run check:wrangler-sync` | `wrangler.toml` 동기화 가드 |
| `npm run git:preflight` | 커밋 전 Git preflight |
| `npm run verify` | 풀 검증 파이프라인 (Go) |
| `npm run format` / `format:check` | Prettier 실행 / 검사 |
| `npm run clean` | Turbo 클린 + `node_modules` 제거 |
| `npm run deploy:api` | 수동 배포 비활성화 (CI 전용) |

## 7. 로컬 개발 (Local Development)

- 작업자 PWA는 기본 포트 3000, 관리자 대시보드는 3001, API 워커는 8787(Wrangler)에서 실행됩니다.
- `wrangler.toml`의 D1 ID, KV namespace, R2 버킷, Hyperdrive ID는 본인 환경에 맞게 교체하세요 (예: `wrangler dev --local` 사용).
- E2E는 `op run --env-file=.env.e2e`로 시크릿을 로드하므로, 자체 시크릿 파일을 준비하세요.
- Husky가 `prepare` 훅으로 활성화되고, `lint-staged`가 Prettier와 Go 안티 패턴 검사를 실행합니다.

## 8. 테스트 (Testing)

- **단위 테스트:** Vitest. 워크스페이스별 설정이 있고 루트는 `vitest.config.ts`.
- **E2E:** Playwright. `playwright.config.ts`에 6개 프로젝트가 정의되어 있고 인증 셋업 프로젝트에 의존합니다.
- **검증 게이트:** CI에서 lint → typecheck → 가드(`git:preflight`, `check:wrangler-sync`) → test → build → migrate 순서로 실행됩니다.
- **실행 팁:** `npm run e2e:headed`로 디버깅, `npm run test:coverage`로 커버리지 측정.

## 9. 설정 (Configuration)

- Cloudflare 바인딩은 [`wrangler.toml`](./wrangler.toml)에 정의되며 `npm run check:wrangler-sync`로 동기화 상태를 강제합니다.
- 인증 시크릿, FAS 엔드포인트, R2 키는 환경 변수 또는 `op` 시크릿으로 주입합니다.
- i18n 카탈로그는 `apps/worker/src/i18n/`(런타임)과 `packages/types`(번역 데이터)에 있으며 ko/en/vi/zh를 기본 지원합니다.
- 정적 자산은 빌드 후 `dist/`에 모이며 worker SPA는 루트, admin SPA는 `dist/admin/`에 위치합니다.

## 10. 기여 (Contributing)

1. 이슈를 먼저 작성해 변경 범위를 합의합니다.
2. [AGENTS.md](./AGENTS.md)와 [CODE_STYLE.md](./CODE_STYLE.md)의 컨벤션을 준수합니다.
3. `npm run verify`를 로컬에서 통과시킨 뒤 PR을 올립니다.
4. PR 본문에 영향 범위(API/스키마/마이그레이션/UI)와 검증 결과를 명시합니다.
5. 마스터 머지는 CI를 트리거해 자동으로 운영 배포를 진행합니다.
6. 자세한 절차는 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 11. 유지보수자 (Maintainers)

- 코드 소유와 운영 책임은 `apps/*`, `packages/*` 워크스페이스 단위로 분리되어 있습니다.
- 런타임, 배포, 보안 이슈는 조직 내부 채널을 통해 메인tainer에게 보고합니다.
- 본 저장소는 외부 공개 기여보다 내부 운영을 우선합니다.

## 12. 추가 문서 (Further Documentation)

| 문서 | 설명 |
| --- | --- |
| [AGENTS.md](./AGENTS.md) | 프로젝트 지식 베이스, 바인딩, 인증 모델 요약 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 아키텍처 상세와 결정 기록 |
| [CODE_STYLE.md](./CODE_STYLE.md) | 네이밍, 포맷팅, 모듈 경계 규칙 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | PR 워크플로우와 리뷰 체크리스트 |
| [`docs/`](./docs) | PRD, 요구사항 명세, 운영 런북 |
| [`apps/worker/AGENTS.md`](./apps/worker/AGENTS.md) | 작업자 PWA 세부 사항 |
| [`apps/worker/I18N_IMPLEMENTATION.md`](./apps/worker/I18N_IMPLEMENTATION.md) | i18n 런타임 상세 |
| [`LICENSE`](./LICENSE) | 라이선스 전문 |

## 13. 라이선스 (License)

본 저장소는 [LICENSE](./LICENSE) 파일의 조건에 따라 배포됩니다. 외부 사용 전 라이선스 전문을 확인하세요.