# SafetyWallet — 현장 안전/컴플라이언스 플랫폼

[![npm workspaces](https://img.shields.io/badge/workspaces-npm%2010.8.2-blue)]()
[![Node](https://img.shields.io/badge/node-%E2%89%A520.0.0-339933)]()
[![Stack](https://img.shields.io/badge/stack-Cloudflare%20Workers%20%7C%20Next.js%2015%20%7C%20D1-orange)]()
[![Status](https://img.shields.io/badge/status-active%20development-yellowgreen)]()

## 한국어 요약 / Korean Summary

SafetyWallet는 **현장 작업자**가 모바일 PWA에서 위험 요소를 신고하고 근태를 기록하며 안전 포인트를 적립하고, **사이트 관리자**가 대시보드에서 신고 검토·정산·컴플라이언스 처리를 하도록 돕는 안전/컴플라이언스 플랫폼입니다. 단일 **Cloudflare Worker**가 Hono API와 두 개의 정적(Static Export) Next.js 프런트엔드(작업자 PWA, 관리자 대시보드)를 호스트 이름 기반으로 라우팅하며, **Cloudflare D1**을 주 데이터베이스로, **R2**를 업로드 저장소로, **KV**를 인증·설정 캐시로 사용합니다. 작업자 앱은 PWA 형태와 동등한 **Android TWA(Trusted Web Activity)** 패키지로도 빌드됩니다.

## English Summary

SafetyWallet is a safety/compliance platform that lets **field workers** report hazards, log attendance, and earn safety points from a mobile PWA, while **site administrators** handle reviews, settlements, and compliance in a dedicated dashboard. A single **Cloudflare Worker** routes by hostname to a Hono API and two statically-exported **Next.js 15** frontends (worker PWA on `:3000`, admin dashboard on `:3001`). **D1** is the primary store, **R2** holds uploaded media, and **KV** caches auth and system config. The worker app also builds as an **Android TWA** for store-distributed installs.

---

## 한눈으로 보기 / At a Glance

| 항목 / Item | 값 / Value |
| --- | --- |
| 패키지 이름 / Package | `safetywallet` |
| 버전 / Version | `0.1.0` (private) |
| 워크스페이스 / Workspaces | npm 10.8.2, `apps/*`, `packages/*` |
| Node 런타임 / Node runtime | `>= 20.0.0` |
| 백엔드 / Backend | Hono on Cloudflare Workers + D1 (Drizzle ORM, 34 tables) |
| 프런트엔드 / Frontend | Next.js 15 static export — `apps/worker` (PWA) · `apps/admin` (dashboard) |
| API 스타일 / API style | Hono REST, Zod 검증, 다중 권한 계층 / multi-tier RBAC |
| 모바일 / Mobile | PWA + Android TWA (Bubblewrap, `apps/worker/android`) |
| 테스트 / Testing | Vitest (단위) + Playwright (E2E 6개 프로젝트) |
| 배포 / Deployment | Git-ref 기반 CI on master (수동 `deploy:api` 비활성화 / manual deploy disabled) |
| 상태 / Status | Active development |

## 핵심 흐름 / Core Flow

| 단계 / Step | 어디서 / Where | 무엇이 일어나는가 / What happens |
| --- | --- | --- |
| 1. 현장 신고 / Field report | 작업자 PWA | 사진·위치·항목 첨부하여 제출 / Worker submits report with attachments |
| 2. 라우팅 / Routing | Cloudflare Worker | 호스트명으로 worker 자산 또는 API 라우트 선택 / Hostname routes to assets or API |
| 3. 검증·저장 / Validate & persist | Hono + D1 + R2 | Zod 스키마 검증, 권한 확인, D1 행 기록, 미디어는 R2 / Zod check, RBAC, D1 row, R2 object |
| 4. 검토·포인트 / Review & points | 관리자 대시보드 | 승인/반려, 포인트 부여, 정산 트리거 / Approve, reject, award points, settle |
| 5. 알림·정산 / Notify & settle | Durable Object + Queue + Cron | 알림 큐 → 푸시/이메일 발송, Cron 잡이 정산 마감 처리 / Queue delivers; cron closes cycles |

---

## 목차 / Table of Contents

- [주요 기능 / Features](#주요-기능--features)
- [아키텍처 / Architecture](#아키텍처--architecture)
- [저장소 구조 / Repository Structure](#저장소-구조--repository-structure)
- [빠른 시작 / Quickstart](#빠른-시작--quickstart)
- [설정 / Configuration](#설정--configuration)
- [명령어 / Commands](#명령어--commands)
- [로컬 개발 / Local Development](#로컬-개발--local-development)
- [테스트 / Testing](#테스트--testing)
- [Android TWA 빌드 / Android TWA Build](#android-twa-빌드--android-twa-build)
- [문서 안내 / Further Documentation](#문서-안내--further-documentation)
- [기여 / Contributing](#기여--contributing)
- [라이선스 / License](#라이선스--license)

---

## 주요 기능 / Features

- **현장 작업자 PWA** (`apps/worker`)
  - 오프라인 친화 모바일 UI, 사진/영상 첨부, 위치 태깅
  - 4개 언어 런타임 i18n (`ko`, `en`, `vi`, `zh`) — 자세한 내용은 `apps/worker/I18N_IMPLEMENTATION.md`
  - 출퇴근(attendance), 안전 게시물(posts/votes), 교육(education) 모듈
  - `safetywallet-auth` Zustand 영속 키 + 401 갱신 뮤텍스(refresh mutex)
- **관리자 대시보드** (`apps/admin`)
  - 출퇴근/게시물/투표/교육 관리, 권한별 화면 (`SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`)
  - `safetywallet-admin-auth` Zustand 영속 키
- **Hono API** (`apps/api`)
  - 18개 라우트 모듈, Zod 검증, 3계층 권한(역할 → 사이트 멤버십 → 필드 플래그)
  - Drizzle 스키마 34 테이블, Drizzle Kit 마이그레이션 31개
  - 10개 Cron 잡, Durable Object (`RateLimiter`, `JobScheduler`)
  - FAS 외부 HR DB(Hyperdrive) 통합, 알림 큐 + DLQ
- **공유 패키지** (`packages/*`)
  - `packages/types`: 공유 타입·enum·DTO·i18n 번역 데이터
  - `packages/ui`: 공유 shadcn/ui 컴포넌트 + Tailwind v4 테마 토큰

## 아키텍처 / Architecture

SafetyWallet는 한 개의 Cloudflare Worker가 두 개의 정적 자산 번들과 한 개의 API를 호스트 이름으로 분기하는 구조입니다. 작업자와 관리자 도메인이 다르고, 단일 Worker가 그 차이를 흡수합니다.

- **라우팅 디스패치 / Routing dispatch** — Cloudflare Worker가 `Host` 헤더로 worker 자산(`ASSETS`), admin 자산, Hono API 분기
- **인증 / Auth** — 로그인 → KST 자정 만료 JWT → 클라이언트 Zustand 저장 → 서버는 JWT 디코드 → KST 날짜 검증 → KV 캐시 → D1 폴백 3중 검증
- **권한 / Authorization** — 역할(`WORKER` / `SITE_ADMIN` / `SUPER_ADMIN` / `SYSTEM`) × 사이트 멤버십 × 필드 플래그(`canAwardPoints`, `canReview`, `canExportData`)
- **데이터 평면 / Data plane** — D1(주 DB) + R2(미디어) + KV(캐시/설정) + Hyperdrive(외부 FAS) + Queue(알림 파이프라인) + Durable Object(레이트리밋·잡 스케줄러)

### Cloudflare 바인딩 / Cloudflare Bindings

`wrangler.toml`에 정의된 바인딩은 다음과 같습니다.

- `DB` — D1, 주 데이터베이스
- `FAS_HYPERDRIVE` — 외부 FAS 임직원 데이터베이스
- `ASSETS` — Workers Static Assets (작업자·관리자 SPA)
- `R2` — 사용자 업로드 이미지/영상
- `ACETIME_BUCKET` — 출퇴근 관련 R2 버킷
- `KV` — 인증 캐시, 시스템 상태, 설정
- `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` — 알림 배달 큐와 데드레터
- `RATE_LIMITER` — Durable Object 레이트리미터

> **참고 / Note** — 전체 데이터 흐름, 시퀀스 다이어그램, ERD는 [ARCHITECTURE.md](./ARCHITECTURE.md)에 정리되어 있습니다.

## 저장소 구조 / Repository Structure

이 저장소의 최상위 레이아웃은 다음과 같습니다 (제공된 트리 기준 / as listed).

```text
.
├── AGENTS.md                  # 프로젝트 지식 베이스 (스택, 인증, 바인딩 요약)
├── ARCHITECTURE.md            # 상세 아키텍처 문서
├── CODE_STYLE.md              # 코드 스타일 가이드
├── CONTRIBUTING.md            # 기여 가이드
├── LICENSE
├── README.md
├── package.json               # 루트 워크스페이스 정의 + Turbo 스크립트
├── package-lock.json
├── turbo.json                 # Turborepo 파이프라인 (types → ui → apps)
├── vitest.config.ts
├── wrangler.toml              # 루트 Cloudflare Worker 설정 + 바인딩
├── playwright.config.ts       # Playwright 6개 프로젝트
└── apps/
    └── worker/
        ├── AGENTS.md
        ├── I18N_IMPLEMENTATION.md
        ├── next-env.d.ts
        ├── next.config.mjs
        ├── package.json
        ├── postcss.config.cjs
        ├── tailwind.config.js
        ├── tsconfig.json
        ├── vitest.config.ts
        ├── src/
        │   ├── app/
        │   │   ├── AGENTS.md
        │   │   ├── error.tsx
        │   │   └── globals.css
        │   └── types/
        │       └── css.d.ts
        └── android/           # Bubblewrap TWA 빌드 산출물
            ├── build.gradle
            ├── settings.gradle
            ├── gradle.properties
            ├── gradlew, gradlew.bat
            ├── manifest-checksum.txt
            ├── store_icon.png
            ├── twa-manifest.json
            └── app/
                ├── build.gradle
                └── src/main/
                    ├── AndroidManifest.xml
                    ├── res/                # 런처 아이콘, 알림 아이콘, 스플래시, 단축키
                    └── java/me/jclee/safetywallet/twa/
                        ├── Application.java
                        ├── DelegationService.java
                        └── LauncherActivity.java
```

> **참고 / Note** — 루트 `package.json`은 `apps/*`, `packages/*` 워크스페이스를 선언하지만, 이 README가 작성된 시점의 트리에는 `apps/worker`만 노출됩니다. `apps/api`, `apps/admin`, `packages/types`, `packages/ui`, `docs/`, `e2e/`, `scripts/`에 대한 자세한 설명은 [AGENTS.md](./AGENTS.md)와 [ARCHITECTURE.md](./ARCHITECTURE.md)에 있습니다.

## 빠른 시작 / Quickstart

요구 사항 / Prerequisites:

- Node.js `>= 20.0.0`
- npm `10.8.2` (또는 호환 버전 / or compatible)
- Cloudflare 계정 + Wrangler 인증 (API 워크스페이스 배포 시)

### 설치 / Install

```bash
npm install
```

### 개발 서버 / Dev server

루트의 Turbo 파이프라인이 모든 워크스페이스의 `dev`를 병렬 실행합니다.

```bash
npm run dev
```

- 작업자 PWA: <http://localhost:3000>
- 관리자 대시보드: <http://localhost:3001>
- API: 라우트에 따라 동일 Worker 인스턴스(포트/호스트는 `wrangler.toml`과 워크스페이스 설정 참조)

### 첫 빌드 / First build

```bash
npm run build
```

빌드는 Turbo 의존 그래프를 따른 다음 정적 산출물을 `dist/`로 모읍니다(`dist/admin/`에 관리자 번들 포함).

### 첫 마이그레이션 / First D1 migration

Drizzle Kit 마이그레이션은 `apps/api/migrations`에 있으며, 운영 적용은 CI에서 Git-ref 기반으로 자동 수행됩니다. 로컬 적용은 해당 워크스페이스 문서를 따릅니다.

## 설정 / Configuration

대부분의 외부 의존성은 Cloudflare 바인딩(`wrangler.toml`)과 `.env`(시크릿)로 주입됩니다.

- **`wrangler.toml`** — D1 ID, R2 버킷, KV ID, Hyperdrive ID, Queue 이름, Durable Object 클래스
- **로컬 시크릿 / Local secrets** — CI는 `.env.e2e`를 1Password CLI(`op run`)를 통해 주입합니다. 로컬에서도 같은 패턴 권장
- **E2E 자격증명 / E2E credentials** — `npm run e2e`는 `op run --env-file=.env.e2e --` 접두사를 사용

> **중요 / Important** — `npm run deploy:api`는 의도적으로 실패하도록 잠겨 있습니다(`Manual deploy is disabled. Deploy is Git-ref driven via CI on master.`). 모든 운영 배포는 master 브랜치 푸시 후 CI에서 수행됩니다.

## 명령어 / Commands

루트 `package.json` 기준 / As defined in the root `package.json`.

| 명령어 / Command | 목적 / Purpose |
| --- | --- |
| `npm run dev` | Turbo로 모든 워크스페이스 개발 서버 기동 / Run all workspaces in dev |
| `npm run build` | 전체 빌드 + 정적 산출물 `dist/`로 모음 / Full build + assemble `dist/` |
| `npm run build:api` | `packages/types` + `apps/api` 순차 빌드 / Sequential build of types + API |
| `npm run build:one-worker` | API 워크스페이스만 빌드 / API-only build |
| `npm run build:static` | 정적 자산을 `dist/` 및 `dist/admin/`로 복사 / Copy static exports into `dist/` |
| `npm run lint` | Turbo로 워크스페이스 린트 / Lint across workspaces |
| `npm run lint:naming` | 명명 규칙 검사 스크립트 / Naming lint script |
| `npm run typecheck` | 전체 타입 검사 / TypeScript checks |
| `npm run test` | Turbo로 워크스페이스 테스트 / Run unit tests |
| `npm run test:coverage` | 커버리지 포함 / With coverage |
| `npm run e2e` | Playwright E2E (1Password 환경 주입) / Playwright with `op run` |
| `npm run e2e:headed` | 헤드 모드로 E2E / Headed E2E |
| `npm run e2e:ui` | Playwright UI 모드 / Playwright UI |
| `npm run format` / `format:check` | Prettier 쓰기/검사 / Prettier write/check |
| `npm run db:generate` | Drizzle 클라이언트 생성 / Generate Drizzle client |
| `npm run check:wrangler-sync` | wrangler 동기화 검사 / Wrangler sync check |
| `npm run git:preflight` | 커밋 사전 점검 / Pre-commit check |
| `npm run verify` | 통합 검증 / Integrated verification |
| `npm run clean` | 워크스페이스 정리 + `node_modules` 제거 / Clean workspaces + node_modules |
| `npm run deploy:api` | **의도적으로 실패** / Intentionally disabled |

## 로컬 개발 / Local Development

1. **Node 버전 고정 / Pin Node** — `engines` 필드는 `>=20.0.0`. Volta 또는 nvm으로 고정할 것.
2. **husky 훅 / Husky hooks** — `prepare` 스크립트가 husky를 설치. 커밋 시 staged 파일은 `lint-staged` 규칙대로 prettier 포맷 + `scripts/check-anti-patterns.go` 점검.
3. **워크스페이스 의존성 / Workspace deps** — 루트 `overrides`로 `react/react-dom`을 18.3.1로, `eslint`를 ^8.57.0로, `serialize-javascript`를 >=7.0.3로 강제함.
4. **.env 관리 / .env** — E2E는 `op run --env-file=.env.e2e`. 로컬 개발에서도 같은 패턴 권장.

## 테스트 / Testing

- **단위 테스트 / Unit** — Vitest, 루트 `vitest.config.ts` + 워크스페이스별 설정.
- **E2E** — Playwright, 루트 `playwright.config.ts` 기준 **6개 프로젝트**(worker, admin, 인증, 통합 등). `e2e/` 디렉터리에 시나리오.
- **모킹·격리** — Playwright의 각 프로젝트는 자체 storage state로 격리, 인증 setup(`e2e/auth.setup.ts`) 사용 — 자세한 내용은 `e2e/` 디렉터리의 README.
- **커버리지 / Coverage** — `npm run test:coverage`.

```bash
npm run test           # 단위
npm run e2e            # E2E (1Password 환경 필요)
```

## Android TWA 빌드 / Android TWA Build

`apps/worker/android/`는 Bubblewrap으로 생성된 **Trusted Web Activity** 프로젝트입니다. PWA를 Google Play 스토어 배포용 APK/AAB로 감쌉니다.

### 산출물 / Artifacts in repo

- `twa-manifest.json` — Bubblewrap 매니페스트 (웹 매니페스트 참조, 매니페스트 체크섬 포함)
- `manifest-checksum.txt` — 빌드 시점의 체크섬 추적 파일
- `gradle/`, `gradlew`, `settings.gradle`, `build.gradle` — 표준 Gradle 레이아웃
- `app/src/main/AndroidManifest.xml` + `java/.../twa/` (`Application`, `DelegationService`, `LauncherActivity`)
- `app/src/main/res/` — 런처/마스커블 아이콘(mdpi~xxxhdpi), 알림 아이콘, 스플래시, 단축키 XML, `raw/web_app_manifest.json`

### 빌드 절차 / Build steps

```bash
# 1) 작업자 PWA를 먼저 빌드해 자산이 준비되어 있어야 함
npm run build --workspace=apps/worker

# 2) TWA 디렉터리로 이동해 Bubblewrap으로 갱신/빌드
cd apps/worker/android
./gradlew assembleRelease         # APK
./gradlew bundleRelease           # AAB (Play 업로드용)
```

> 자세한 환경 변수, 서명 키 스토어 구성, Play 업로드 절차는 `apps/worker/AGENTS.md`와 `docs/` 운영 런북을 참조하세요.

## 문서 안내 / Further Documentation

| 문서 / Document | 위치 / Path | 용도 / Purpose |
| --- | --- | --- |
| 프로젝트 지식 베이스 / Project knowledge base | [AGENTS.md](./AGENTS.md) | 스택, 인증, 권한, 바인딩, 디렉터리 맵 |
| 아키텍처 / Architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) | 시퀀스 다이어그램, 요청 흐름, ERD |
| 코드 스타일 / Code style | [CODE_STYLE.md](./CODE_STYLE.md) | 컨벤션·금지 패턴 |
| 기여 가이드 / Contributing | [CONTRIBUTING.md](./CONTRIBUTING.md) | PR 절차, 커밋 규약 |
| 작업자 앱 i18n | [apps/worker/I18N_IMPLEMENTATION.md](./apps/worker/I18N_IMPLEMENTATION.md) | 4개국어 런타임 상세 |
| 작업자 앱 지식 베이스 | [apps/worker/AGENTS.md](./apps/worker/AGENTS.md) | 작업자 PWA 모듈별 노트 |

추가 문서(`docs/`의 PRD·요구사항 사양·운영 런북)는 저장소 내에서 워크스페이스와 함께 제공됩니다.

## 기여 / Contributing

1. 이슈 또는 작업 단위로 브랜치 생성 (`feature/<scope>` 또는 `fix/<scope>`).
2. 커밋 전에 `npm run verify` 통과. CI도 동일 시퀀스(린트 → 타입 검사 → 가드 → 테스트 → 빌드 → 마이그레이션)를 실행합니다.
3. PR은 [CONTRIBUTING.md](./CONTRIBUTING.md) 절차와 [CODE_STYLE.md](./CODE_STYLE.md) 규약을 따릅니다.
4. PR 제목과 본문에 관련 AGENTS.md 위치를 명시하면 리뷰어가 컨텍스트를 빠르게 잡을 수 있습니다.

## 유지보수 / Maintainers & Contacts

- 작업자 앱 영역 — `apps/worker/AGENTS.md` 상단 오너 표 참조
- API/D1/바인딩 — [AGENTS.md](./AGENTS.md) "CLOUDFLARE BINDINGS" 섹션과 [ARCHITECTURE.md](./ARCHITECTURE.md) 책임자 표 참조
- 일반 운영 — 저장소 내 `CODEOWNERS`(있는 경우)와 [CONTRIBUTING.md](./CONTRIBUTING.md)

도움이 필요할 때 / Where to get help:

- 동작/설계 의도 → 각 워크스페이스의 `AGENTS.md`
- 빌드/배포 문제 → [ARCHITECTURE.md](./ARCHITECTURE.md) + `docs/` 운영 런북
- 기여 절차/PR → [CONTRIBUTING.md](./CONTRIBUTING.md)

## 운영 상태 / Production Readiness

| 영역 / Area | 상태 / Status | 메모 / Notes |
| --- | --- | --- |
| 데이터 마이그레이션 / DB migrations | Active · production-ready 경로 | CI에서 Git-ref 기반 자동 적용 / Git-ref driven CI apply |
| 수동 배포 / Manual deploy | Disabled by design | `npm run deploy:api`가 의도적으로 실패함 |
| 알림 파이프라인 / Notifications | Queue + DLQ 운영 중 / In production | 재시도 정책은 워크스페이스 노트 참조 |
| 인증 / Auth | 3중 검증 (JWT · KST · KV) / Triple-layer validation | 캐시 무효화는 `apps/api` 노트 참조 |
| 모바일 / Mobile | PWA + TWA 양쪽 지원 / PWA + TWA | 스토어 배포 절차는 `apps/worker/android/` 참조 |

## 라이선스 / License

이 프로젝트의 라이선스 조건은 저장소 루트의 [LICENSE](./LICENSE) 파일을 참조하세요.