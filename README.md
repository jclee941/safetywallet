# 안전지갑 (SafetyWallet)

[![Status: Active](https://img.shields.io/badge/Status-Active-2ea44f)](#status)
[![Node: >=20](https://img.shields.io/badge/Node-%E2%89%A520-339933)](package.json)
[![Package Manager: npm 10.8.2](https://img.shields.io/badge/npm-10.8.2-CB3837)](package.json)
[![Workers: Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare_Workers-F38020)](wrangler.toml)
[![Tests: Playwright + Vitest](https://img.shields.io/badge/Tests-Playwright_%2B_Vitest-6DA55F)](#testing)

현장 근로자가 모바일 PWA로 위험 요인을 신고하고, 출퇴근을 기록하고, 안전 포인트를 적립한다. 현장 관리자는 대시보드에서 신고 검토, 정산, 컴플라이언스를 처리한다. 단일 Cloudflare Worker가 Hono API와 정적 익스포트된 두 개의 Next.js 프런트엔드를 호스트 이름 라우팅으로 제공한다.

Field workers use a mobile PWA to report hazards, log attendance, and earn safety points. Site admins manage reviews, settlements, and compliance via a dashboard. A single Cloudflare Worker serves the Hono API and two statically-exported Next.js frontends via hostname routing.

## 빠른 상태 / Quick Status

| 항목 | 값 | 비고 |
| --- | --- | --- |
| 버전 | `0.1.0` | `package.json` 루트 |
| 노드 엔진 | `>=20.0.0` | `engines.node` |
| 패키지 매니저 | `npm@10.8.2` | workspaces 사용 |
| 백엔드 런타임 | Cloudflare Workers | `wrangler.toml` |
| 데이터베이스 | D1 (SQLite, 34 tables) | Drizzle ORM |
| 외부 DB | Hyperdrive → FAS | `FAS_HYPERDRIVE` 바인딩 |
| 정적 자산 | Workers Static Assets | `ASSETS` 바인딩 |
| 미디어 스토리지 | R2 (`R2`, `ACETIME_BUCKET`) | 이미지/영상 업로드 |
| 인증 캐시 | KV | JWT/시스템 상태 |
| 메시징 | Queue + DLQ | 알림 파이프라인 |
| 속도 제한 | Durable Object | `RATE_LIMITER` |
| 권한 모델 | 3단 (Role → Site → Flag) | `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM` |
| 지원 언어 | `ko`, `en`, `vi`, `zh` | 커스텀 i18n 런타임 |
| 프런트엔드 빌드 | Next.js 15 static export | `apps/worker` (3000), `apps/admin` (3001) |
| 모바일 패키지 | Android TWA (Trusted Web Activity) | `apps/worker/android` |
| 테스트 | Vitest + Playwright (6 projects) | `playwright.config.ts` |
| 배포 방식 | Git-ref 기반 CI | `master` 푸시 시 자동 |

## 운영 흐름 / Operational Flow

1. 현장 근로자가 `worker` PWA에 로그인 → JWT 발급 (KST 자정 만료) → Zustand에 저장.
2. 신고/출퇴근/교육 데이터가 `/api/*` 경로로 단일 Worker(Hono)에 도달.
3. Worker는 Drizzle로 D1을 조회/기록하고, 업로드 미디어는 R2로 라우팅.
4. 알림은 `NOTIFICATION_QUEUE`로 발행되고 실패 시 `NOTIFICATION_DLQ`로 분기.
5. `apps/admin` 대시보드가 같은 Worker의 호스트 라우팅(`/admin/*`)을 통해 정적 자산으로 서빙.
6. CI가 `master` Git ref에 반응해 마이그레이션 적용 후 Worker를 배포.

운영자가 가장 자주 쓰는 명령/엔드포인트:

- 로컬 통합 개발: `npm run dev`
- 타입·린트·테스트·빌드 일괄 검증: `npm run verify` (Go 스크립트)
- Worker만 빌드: `npm run build:one-worker`
- Playwright E2E: `npm run e2e` (1Password CLI 기반 시크릿 주입)
- 운영자 헬스체크 엔드포인트: `/api/system/status` (KV 캐시)
- D1 마이그레이션: `npm run db:generate` + CI 자동 적용

## 패키지 구성 / Package Contents

| 경로 | 역할 | 산출물 |
| --- | --- | --- |
| `apps/api` | Hono API (Drizzle + D1) | Cloudflare Worker 스크립트 |
| `apps/admin` | 관리자 대시보드 (Next.js 15) | `dist/admin/` 정적 익스포트 |
| `apps/worker` | 근로자 PWA (Next.js 15) + Android TWA | `dist/` 정적 익스포트, TWA APK |
| `packages/types` | 공유 TS 타입/Enum/DTO/i18n 번역 | ESM 패키지 |
| `packages/ui` | 공유 shadcn/ui + Tailwind v4 토큰 | ESM 패키지 |
| `docs/` | PRD, 요구사항, 운영 런북 | Markdown |
| `scripts/` | Go/JS 자동화 (verify, naming, anti-pattern) | 실행 스크립트 |
| `e2e/` | Playwright 시나리오 (auth/admin/worker) | 테스트 스위트 |
| `wrangler.toml` | 루트 Worker 설정 + 바인딩 | 배포 매니페스트 |
| `turbo.json` | Turborepo 파이프라인 (types → ui → apps) | 빌드 오케스트레이션 |

## 먼저 읽을 파일 / First Files to Read

- `AGENTS.md` — 전체 지식 베이스 (스택, 구조, 인증, 바인딩)
- `apps/worker/AGENTS.md` — 근로자 PWA 규약
- `apps/worker/I18N_IMPLEMENTATION.md` — 다국어 런타임 동작
- `apps/worker/ARCHITECTURE.md` — 앱 아키텍처 상세
- `wrangler.toml` — 바인딩/라우팅 정의
- `playwright.config.ts` — E2E 프로젝트 구성

## API · 엔트리 포인트 / API & Entry Points

| 엔드포인트/경로 | 모듈 | 비고 |
| --- | --- | --- |
| `POST /api/auth/login` | `apps/api/src/routes/auth` | JWT 발급 (KST 자정 만료) |
| `POST /api/posts` | `apps/api/src/routes/posts` | 위험 요인/게시글 신고 |
| `POST /api/attendance` | `apps/api/src/routes/attendance` | 출퇴근 기록 (ACETIME 버킷 연동) |
| `POST /api/votes/:id` | `apps/api/src/routes/votes` | 신고에 대한 현장 투표 |
| `GET /api/admin/*` | `apps/api/src/routes/admin/*` | 관리자 전용 (역할 가드) |
| `GET /api/education/*` | `apps/api/src/routes/education` | 교육 콘텐츠 |
| `GET /api/system/status` | `apps/api/src/routes/system` | 헬스체크 (KV 캐시) |
| Cron jobs (10) | `apps/api/src/jobs/*` | 정산, 리마인더, 동기화 |
| RateLimiter DO | `apps/api/src/durable-objects/RateLimiter` | 요청 속도 제한 |
| JobScheduler DO | `apps/api/src/durable-objects/JobScheduler` | 분산 작업 스케줄링 |
| Worker PWA 진입 | `apps/worker/src/app` | Next.js App Router |
| Admin 진입 | `apps/admin/src/app` | Next.js App Router |
| Android 진입 | `apps/worker/android/app/src/main` | TWA `LauncherActivity` |

## 빠른 시작 / Quickstart

필수 도구: Node 20+, npm 10.8+, Wrangler, (E2E 실행 시) 1Password CLI.

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 개발 (Worker + Admin + PWA 통합)
npm run dev

# 3. 정적 자산 + API 일괄 빌드
npm run build

# 4. 검증 파이프라인 (lint → typecheck → test)
npm run verify

# 5. E2E (Playwright, .env.e2e 주입 필요)
npm run e2e
```

자주 쓰는 스크립트 (전체는 루트 `package.json`):

- `npm run dev` — Turborepo 병렬 개발 서버
- `npm run build` — 전체 빌드 + 정적 자산 패키징 (`dist/`)
- `npm run build:one-worker` — API만 빌드 (Worker 스크립트 검증)
- `npm run typecheck` — TypeScript 일괄 검증
- `npm run test` — Vitest 일괄 실행
- `npm run test:coverage` — 커버리지 포함 Vitest
- `npm run lint` / `lint:naming` — 코드·명명 린트
- `npm run format` / `format:check` — Prettier
- `npm run check:wrangler-sync` — `wrangler.toml`과 코드 바인딩 일치 검사
- `npm run git:preflight` — 커밋 전 검사
- `npm run db:generate` — Drizzle 마이그레이션 생성
- `npm run clean` — 산출물 + `node_modules` 정리

## 인증 · 권한 / Authentication & Authorization

- **로그인 → JWT**: KST 자정 기준 일일 만료, 클라이언트 Zustand 저장.
- **3중 검증**: JWT 디코드 → KST 날짜 확인 → KV 캐시 조회 → D1 폴백.
- **3단 권한**: 역할(`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`) → 현장 멤버십 → 필드 플래그(`canAwardPoints`, `canReview`, `canExportData`).
- **클라이언트 상태**: `safetywallet-auth` (worker), `safetywallet-admin-auth` (admin), 401 refresh mutex.
- **바인딩**: `KV`(인증 캐시·시스템 상태·설정), `DB`(D1), `RATE_LIMITER` DO(엔드포인트 보호).

## 로컬 개발 / Local Development

- `apps/api`, `apps/admin`, `apps/worker` 각각 `vitest.config.ts`로 단위 테스트.
- `e2e/` 디렉터리는 Playwright 6개 프로젝트(인증, 관리자, 근로자 흐름 등).
- `wrangler.toml`은 루트에서 단일 Worker로 통합 관리되며, 호스트 이름(`worker` / `admin` 서브도메인)별 라우팅을 정의.
- TWA 패키징은 `apps/worker/android/`의 Gradle 프로젝트(`./gradlew assembleRelease`)로 수행하며, 정적 자산은 빌드 산출물에서 주입.
- 명명 규칙과 안티 패턴 검사는 커밋 훅(Husky + lint-staged)과 `npm run git:preflight`에서 강제.

## 테스트 / Testing

- 단위/통합: Vitest (`apps/*/vitest.config.ts`, 루트 `vitest.config.ts`).
- E2E: Playwright (`playwright.config.ts`, 6개 프로젝트), 1Password CLI로 시크릿 주입.
- D1 마이그레이션: `migrations/` 디렉터리의 31개 SQL 파일을 CI가 순차 적용.
- 보안 가드: `scripts/check-anti-patterns.go`, `scripts/lint-naming.js`, `scripts/check-wrangler-sync.js`.

## 배포 / Deployment

- `master` 브랜치 푸시 시 CI가 마이그레이션 적용 후 Worker를 배포.
- 수동 배포는 비활성화되어 있으며 `npm run deploy:api`는 실패를 반환하도록 의도적으로 잠겨 있다.
- 산출물 구조: `dist/`(worker PWA), `dist/admin/`(admin 대시보드)가 Worker `ASSETS`로 서빙.

## 기여 / Contributing

- 절차와 가드는 `CONTRIBUTING.md`와 `CODE_STYLE.md`를 따른다.
- 커밋 전 `npm run git:preflight`와 `npm run verify` 통과가 필요하다.
- PR은 Turborepo 태스크(`build`, `typecheck`, `test`, `lint`)와 Playwright E2E가 모두 통과해야 한다.

## 라이선스 / License

`LICENSE` 파일을 참조한다. 별도 명시가 없는 한 본 저장소의 모든 산출물은 해당 라이선스를 따른다.

## 운영자 · 문의 / Maintainers & Contact

- 저장소 운영/지식 베이스: `AGENTS.md`
- 사양·운영 절차: `docs/` 하위 런북
- 이슈 트래커: 저장소 Issues 탭

## 추가 문서 / Further Documentation

- 지식 베이스: [`AGENTS.md`](AGENTS.md)
- 아키텍처: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- 코드 스타일: [`CODE_STYLE.md`](CODE_STYLE.md)
- 기여 가이드: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- 근로자 PWA 규약: [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md)
- i18n 동작: [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md)
- 사양·운영: [`docs/`](docs/)
- Playwright 구성: [`playwright.config.ts`](playwright.config.ts)
- Worker 설정: [`wrangler.toml`](wrangler.toml)