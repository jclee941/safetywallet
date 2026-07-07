# SafetyWallet

[![Stack](https://img.shields.io/badge/Stack-TypeScript%20%7C%20Hono%20%7C%20Drizzle%20%7C%20Next.js%2015%20%7C%20Cloudflare%20Workers-blue)](#아키텍처--architecture)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520.0.0-339933)](package.json)
[![Wrangler](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-F38020)](wrangler.toml)
[![Status](https://img.shields.io/badge/Status-Active%20Development-orange)](#상태--status)

현장 근로자가 모바일 PWA로 위험 요인을 신고하고 출퇴근을 기록해 안전 포인트를 적립하며, 현장 관리자가 웹 대시보드에서 검토·정산·컴플라이언스를 처리하도록 돕는 클라우드 안전 관리 플랫폼입니다. 단일 Cloudflare Worker가 Hono API와 두 개의 정적 Next.js 프런트엔드를 호스트 이름 라우팅으로 함께 제공합니다.

SafetyWallet is a cloud safety-management platform for industrial sites. Field workers file hazard reports and attendance from a mobile PWA to earn safety points; site admins review submissions, run settlements, and oversee compliance from a web dashboard. A single Cloudflare Worker serves the Hono API and two statically-exported Next.js frontends via hostname routing.

---

## 한눈에 보기 / At a Glance

| 영역 / Area | 항목 / Item | 값 / Value |
| --- | --- | --- |
| Product | 사용자 / Users | 현장 근로자(Worker) + 현장 관리자(Site/Super Admin) |
| Product | 디바이스 / Devices | 모바일 PWA, Android TWA, 관리자 웹 대시보드 |
| Runtime | API | Hono on Cloudflare Workers |
| Runtime | Database | Cloudflare D1 + Drizzle ORM |
| Runtime | Frontends | Next.js 15 static export (Worker, Admin) |
| i18n | 지원 언어 / Locales | `ko`, `en`, `vi`, `zh` |
| Auth | 토큰 / Token | JWT (KST 자정 만료) |
| Bindings | 주요 리소스 / Resources | D1, Hyperdrive, R2 ×2, KV, Queue ×2, Durable Objects |
| Deploy | 트리거 / Trigger | `master` 브랜치 Git-ref 기반 CI |
| Tests | 스택 / Stack | Vitest + Playwright(6 프로젝트) + Go 정적 분석 |

운영자가 다음에 사용할 진입점은 `npm run dev`(로컬), `npm run build`(정적 산출물), 그리고 `/api/*` Hono 엔드포인트입니다.

---

## 동작 흐름 / Request Flow

1. 근로자가 `worker` 호스트의 PWA(또는 Android TWA)에 접속해 로그인 → JWT가 Zustand에 저장됩니다.
2. 클라이언트가 `/api/*`로 Hono API에 요청을 보내고 CORS · 로깅 · 보안 헤더 미들웨어를 통과합니다.
3. 인증 미들웨어가 JWT를 검증(KST 자정 만료 → KV 캐시 → D1 폴백)하고 역할·사이트 멤버십·필드 플래그로 인가를 결정합니다.
4. 라우트 핸들러가 Drizzle로 D1에 쓰고, 미디어가 있으면 R2에 업로드하며, 알림이 필요하면 `NOTIFICATION_QUEUE`에 작업을 enqueue합니다.
5. 응답이 클라이언트로 돌아오고, `admin` 호스트의 대시보드도 동일한 Worker에서 정적 자산으로 함께 호스팅됩니다.
6. Durable Object 기반 `JobScheduler`가 10개의 cron 잡을 돌려 정산, 리마인더, 데이터 정리를 수행합니다.

---

## 목차 / Table of Contents

- [주요 기능 / Features](#주요-기능--features)
- [아키텍처 / Architecture](#아키텍처--architecture)
- [패키지 구성 / Package Contents](#패키지-구성--package-contents)
- [빠른 시작 / Quickstart](#빠른-시작--quickstart)
- [명령어 / Commands](#명령어--commands)
- [설정 / Configuration](#설정--configuration)
- [인증과 권한 / Auth and Permissions](#인증과-권한--auth-and-permissions)
- [Cloudflare 바인딩 / Bindings](#cloudflare-바인딩--bindings)
- [로컬 개발 / Local Development](#로컬-개발--local-development)
- [테스트 / Testing](#테스트--testing)
- [Android TWA 빌드 / Android TWA Build](#android-twa-빌드--android-twa-build)
- [상태 / Status](#상태--status)
- [기여와 유지보수 / Contributing and Maintainers](#기여와-유지보수--contributing-and-maintainers)
- [추가 문서 / Further Documentation](#추가-문서--further-documentation)
- [라이선스 / License](#라이선스--license)

---

## 주요 기능 / Features

### 현장 근로자용 Worker PWA (`apps/worker`)

- 로그인/세션 관리와 다국어 UI(`ko`, `en`, `vi`, `zh`)
- 위험 요인 신고: 사진·동영상 첨부(R2 업로드), 위치/카테고리 메타
- 출퇴근 기록: GPS/QR 기반 체크인·체크아웃
- 안전 포인트 적립·사용 내역 조회
- 교육 자료 열람과 진도 추적
- 알림 큐 경유 푸시 알림

### 현장 관리자용 Admin Dashboard (`apps/admin`)

- 제출물 검토와 승인/반려
- 출퇴근 명단 정산과 근로 시간 리포트
- 포인트 정책·정산 설정
- 데이터 내보내기(`canExportData` 플래그 보유자)
- 교육 콘텐츠 관리

### 공통 인프라

- 단일 Cloudflare Worker에서 API와 두 개의 정적 SPA 호스팅
- Durable Object 기반 속도 제한과 잡 스케줄러
- 31개의 D1 SQL 마이그레이션을 Drizzle 스키마로 관리
- GitHub Actions CI: lint → typecheck → guards → test → build → migrate

---

## 아키텍처 / Architecture

| 계층 | 기술 | 역할 |
| --- | --- | --- |
| Edge | Cloudflare Workers | 라우팅·SSR·API 단일 진입점 |
| API | Hono + Drizzle | 18개 라우트 모듈, Zod 검증 |
| Storage | D1 (SQLite) | 34개 테이블의 주 데이터베이스 |
| Storage | Hyperdrive (`FAS_HYPERDRIVE`) | 외부 FAS 사원 DB 연결 |
| Storage | R2 (`R2`, `ACETIME_BUCKET`) | 사용자 미디어, 출퇴근 자산 |
| Cache/Config | Workers KV | 인증 캐시, 시스템 상태, 설정 |
| Async | Queue (`NOTIFICATION_QUEUE`/`NOTIFICATION_DLQ`) | 알림 파이프라인 |
| Coordination | Durable Objects | `RateLimiter`, `JobScheduler` |
| Web | Next.js 15 (static export) | Worker SPA, Admin SPA |
| Tooling | Turborepo | 빌드 파이프라인(`types → ui → apps`) |
| Tooling | Go 스크립트 | `verify`, `git-preflight`, `check-anti-patterns` |
| Tests | Vitest + Playwright | 단위 + E2E(6 프로젝트) |

상세 결정은 [ARCHITECTURE.md](ARCHITECTURE.md)와 [AGENTS.md](AGENTS.md)를 참고하세요.

---

## 패키지 구성 / Package Contents

| 경로 | 설명 |
| --- | --- |
| `apps/api/` | Cloudflare Worker API(Hono + Drizzle + D1). 18개 라우트, 31개 마이그레이션, 10개 cron 잡 |
| `apps/admin/` | Next.js 15 관리자 대시보드(포트 3001, 정적 export). 출퇴근·게시글·투표·교육 모듈 |
| `apps/worker/` | Next.js 15 근로자 PWA(포트 3000, 정적 export). 로그인·게시글·출퇴근·교육 화면 |
| `apps/worker/android/` | Bubblewrap 기반 Android TWA 프로젝트 |
| `apps/worker/src/i18n/` | 커스텀 i18n 런타임(`ko`, `en`, `vi`, `zh`) |
| `packages/types/` | 공유 TS 타입·열거형·DTO·번역 데이터 |
| `packages/ui/` | 공유 `shadcn/ui` 컴포넌트 + Tailwind v4 테마 토큰 |
| `e2e/` | Playwright E2E(인증 셋업, admin, worker 플로우) |
| `scripts/` | Go/JS 도구: verify, naming lint, anti-pattern 검사, wrangler 동기화 검사 |
| `docs/` | PRD, 요구사항 명세, 운영 런북 |
| `wrangler.toml` | 루트 Cloudflare Worker 설정 + 모든 바인딩 |
| `turbo.json` | Turborepo 파이프라인 정의 |
| `playwright.config.ts` | Playwright 프로젝트(6개) 설정 |

---

## 빠른 시작 / Quickstart

### 사전 요구 사항 / Prerequisites

- Node.js 20 이상(`engines.node` 기준)
- npm 10.8.2(`packageManager` 고정)
- Wrangler CLI: `npx wrangler --version`
- 1Password CLI(`op`) — E2E에서 `.env.e2e` 주입용
- 선택: Go 1.21+(정적 분석 스크립트 실행 시)

### 설치와 개발 서버 / Install and Run

```bash
# 의존성 설치
npm install

# 개발 서버 일괄 실행(worker 3000, admin 3001, API는 wrangler dev)
npm run dev

# 타입/린트/테스트 한 번에
npm run typecheck && npm run lint && npm test
```

`wrangler.toml`에 정의된 모든 바인딩을 로컬에서 사용하려면 워크스페이스 루트에서 `npx wrangler dev`를 실행해 주세요.

---

## 명령어 / Commands

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | Turborepo로 모든 워크스페이스 개발 서버 실행 |
| `npm run build` | `turbo run build` 후 `dist/`로 정적 산출물 통합 |
| `npm run build:api` | `packages/types` + `apps/api`만 빌드 |
| `npm run build:one-worker` | `build:api`의 단축 별칭 |
| `npm run build:static` | `apps/worker/out` + `apps/admin/out`을 `dist/`로 복사 |
| `npm run lint` | Turborepo로 워크스페이스별 린트 실행 |
| `npm run lint:naming` | 명명 규칙 정적 검사(`scripts/lint-naming.js`) |
| `npm run typecheck` | 워크스페이스 전체 타입 검사 |
| `npm test` | Vitest 단위 테스트 |
| `npm run test:coverage` | 커버리지 포함 단위 테스트 |
| `npm run e2e` | 1Password로 시크릿 주입 후 Playwright E2E |
| `npm run e2e:headed` / `npm run e2e:ui` | 헤디드/UI 모드 E2E |
| `npm run db:generate` | Drizzle 마이그레이션 생성 |
| `npm run check:wrangler-sync` | wrangler 설정 동기화 검사 |
| `npm run git:preflight` | 커밋 전 Go 프리플라이트 |
| `npm run verify` | 전체 검증 실행(Go) |
| `npm run format` / `format:check` | Prettier 쓰기/검사 |
| `npm run clean` | 산출물 + `node_modules` 정리 |
| `npm run deploy:api` | 수동 배포 비활성화. CI(`master` 푸시) 전용 |

---

## 설정 / Configuration

루트 `wrangler.toml`에 모든 Cloudflare 바인딩과 라우트가 선언되어 있습니다. 로컬 개발용 `.dev.vars`는 직접 생성하세요.

| 변수 / 바인딩 | 용도 |
| --- | --- |
| `JWT_SECRET` | JWT 서명 키 |
| `DB` | D1 주 데이터베이스 |
| `FAS_HYPERDRIVE` | 외부 FAS 사원 DB |
| `R2` / `ACETIME_BUCKET` | 미디어/출퇴근 자산 |
| `KV` | 인증 캐시·시스템 상태·설정 |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | 알림 파이프라인 |
| `RATE_LIMITER` | Durable Object 기반 속도 제한 |
| `ASSETS` | Workers Static Assets |
| `.env.e2e` | 1Password CLI(`op run`)로 주입되는 E2E 시크릿 |

마이그레이션은 `apps/api/migrations/`의 SQL 파일 31개로 관리되며 `npm run db:generate`로 새 마이그레이션을 만듭니다.

---

## 인증과 권한 / Auth and Permissions

- **토큰 수명**: JWT 발급 시점의 KST 자정까지 유효. 자정이 지나면 만료.
- **3중 검증**: JWT 디코드 → KST 날짜 확인 → KV 캐시 조회 → D1 폴백.
- **3단 권한**:
  1. 역할: `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`
  2. 사이트 멤버십
  3. 필드 플래그: `canAwardPoints`, `canReview`, `canExportData`
- **클라이언트 영속화**: Zustand + 401 리프레시 뮤텍스.
  - Worker 클라이언트 키: `safetywallet-auth`
  - Admin 클라이언트 키: `safetywallet-admin-auth`

---

## Cloudflare 바인딩 / Bindings

`wrangler.toml` 기준 주요 바인딩입니다.

| 바인딩 | 종류 | 용도 |
| --- | --- | --- |
| `DB` | D1 | 주 데이터베이스(34개 테이블, SQLite/Drizzle) |
| `FAS_HYPERDRIVE` | Hyperdrive | 외부 FAS 사원 DB |
| `ASSETS` | Workers Static Assets | Worker + Admin 정적 프런트엔드 |
| `R2` | R2 | 사용자가 업로드한 이미지/동영상 |
| `ACETIME_BUCKET` | R2 | 출퇴근 관련 자산 |
| `KV` | KV | 인증 캐시, 시스템 상태, 설정 |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | Queue | 알림 전달 파이프라인 |
| `RATE_LIMITER` | Durable Object | API 속도 제한 |

---

## 로컬 개발 / Local Development

1. `npx wrangler d1 create <DB이름>`로 로컬 D1을 만들고, `wrangler.toml`의 `[[d1_databases]]`에 ID를 채워 주세요.
2. `npm run db:generate`로 마이그레이션을 만들고 `npx wrangler d1 migrations apply DB --local`로 적용합니다.
3. `npm run dev`로 워크스페이스 개발 서버를 띄웁니다. 기본 포트는 worker 3000, admin 3001.
4. Hyperdrive/R2/KV 등 외부 바인딩은 원격 리소스를 가리키도록 `wrangler.toml`을 조정하세요.
5. 커밋 전에 `npm run git:preflight`와 `npm run verify`로 정적 검사를 통과시켜 주세요.

자세한 워크플로우는 [CONTRIBUTING.md](CONTRIBUTING.md), 코딩 규칙은 [CODE_STYLE.md](CODE_STYLE.md)를 참고하세요.

---

## 테스트 / Testing

| 종류 | 도구 | 위치 |
| --- | --- | --- |
| 단위 | Vitest | 각 워크스페이스의 `*.test.ts` |
| E2E | Playwright(6 프로젝트) | `e2e/`, 설정은 `playwright.config.ts` |
| 정적 분석 | Go 스크립트 | `scripts/check-anti-patterns.go` 등 |
| 명명 규칙 | Node 스크립트 | `scripts/lint-naming.js` |

E2E 실행은 시크릿 주입을 위해 1Password CLI가 필요합니다.

```bash
# 1Password에 .env.e2e 템플릿을 등록한 뒤
npm run e2e            # 헤드리스
npm run e2e:headed     # 브라우저 표시
npm run e2e:ui         # Playwright UI 모드
```

CI에서는 GitHub Actions가 `lint → typecheck → guards → test → build → migrate` 순서로 실행됩니다.

---

## Android TWA 빌드 / Android TWA Build

`apps/worker/android/`는 Bubblewrap 기반의 Trusted Web Activity 프로젝트입니다.

| 항목 | 값 |
| --- | --- |
| 패키지 | `me.jclee.safetywallet.twa` |
| 매니페스트 | `apps/worker/android/twa-manifest.json` |
| 진입점 | `Application`, `LauncherActivity`, `DelegationService` |
| 아이콘/스플래시 | `mipmap-*`, `drawable-*` 디렉터리에 미리 생성됨 |

빌드는 프로젝트 내 Gradle 래퍼(`./gradlew`)로 진행하며, 정적 자산을 변경한 뒤에는 새 체크섬으로 `twa-manifest.json`을 갱신해야 합니다.

---

## 상태 / Status

| 항목 | 값 |
| --- | --- |
| Development | 진행 중 — AGENTS.md 60개로 코드베이스 전반에 컨텍스트 분산 |
| Production | 배포는 `master` 브랜치 Git-ref 기반 CI로만 진행(수동 배포 비활성) |
| Deprecated | 없음 |
| 데이터베이스 | 31개 D1 마이그레이션 적용 상태에서 운영 |

도움을 받을 곳: 저장소 이슈 트래커, 그리고 모듈별 [AGENTS.md](AGENTS.md) 가이드.

---

## 기여와 유지보수 / Contributing and Maintainers

기여 절차는 [CONTRIBUTING.md](CONTRIBUTING.md), 코드 스타일은 [CODE_STYLE.md](CODE_STYLE.md), 아키텍처 결정은 [ARCHITECTURE.md](ARCHITECTURE.md)에 정리되어 있습니다. PR 전 `npm run lint`, `npm run typecheck`, `npm test`, `npm run verify`를 로컬에서 통과시켜 주세요.

- **유지보수 팀**: 내부 SafetyWallet 운영팀(`me.jclee.safetywallet` 패키지 네임스페이스 기준)
- **연락 채널**: 저장소 이슈 트래커와 [CONTRIBUTING.md](CONTRIBUTING.md) 가이드 참조

---

## 추가 문서 / Further Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — 시스템 아키텍처와 라우팅 결정
- [AGENTS.md](AGENTS.md) — 프로젝트 지식 베이스(스택, 구조, 권한, 바인딩)
- [CONTRIBUTING.md](CONTRIBUTING.md) — 기여 절차와 PR 가이드
- [CODE_STYLE.md](CODE_STYLE.md) — TypeScript/React 코딩 컨벤션
- [apps/worker/I18N_IMPLEMENTATION.md](apps/worker/I18N_IMPLEMENTATION.md) — 커스텀 i18n 런타임 사양
- [apps/worker/AGENTS.md](apps/worker/AGENTS.md) — Worker PWA 모듈 가이드
- `docs/` — PRD, 요구사항 명세, 운영 런북

---

## 라이선스 / License

[LICENSE](LICENSE) 파일을 참고하세요. 본 저장소는 비공개(`"private": true`)이며 외부 배포를 목적으로 하지 않습니다.