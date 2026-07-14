# SafetyWallet

![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-339933?logo=node.js&logoColor=white)
![npm](https://img.shields.io/badge/package%20manager-npm%2010.8.2-CB3837?logo=npm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-enabled-3178C6?logo=typescript&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)
![Status](https://img.shields.io/badge/status-active-brightgreen)

SafetyWallet은 건설·현장 근로자가 모바일 PWA에서 위험을 신고하고,
출근을 기록하며, 안전 포인트를 적립할 수 있게 하는
현장 안전 운영 플랫폼입니다.

Site admins use the dashboard to review reports, manage attendance,
settle points, and monitor compliance. A Cloudflare Worker runtime serves
the API and statically exported web apps.

## 빠른 상태 / Quick status

| 항목 | 현재값 | 운영자가 다음에 할 일 |
| --- | --- | --- |
| 제품 상태 | Active, private application | 변경 전 `npm run verify` 실행 |
| 주요 사용자 | 현장 근로자, 현장 관리자, 슈퍼 관리자 | 역할별 권한과 현장 소속 확인 |
| 런타임 | Cloudflare Workers, D1, R2, KV | `wrangler.toml` 바인딩 동기화 확인 |
| 웹 앱 | Worker PWA, Admin dashboard | 로컬은 `npm run dev`로 실행 |
| 배포 방식 | 수동 배포 차단, Git ref 기반 배포 | `npm run deploy:api` 사용 금지 |
| 품질 게이트 | lint, typecheck, test, build, e2e | PR 전 `npm run verify` 권장 |

## 실행 흐름 요약 / Flow summary

1. Worker PWA에서 근로자가 로그인하고 위험 신고·출근·교육 기능을 사용합니다.
2. Admin dashboard에서 관리자가 신고 검토, 정산, 규정 준수 작업을 처리합니다.
3. Hono API가 인증, 권한, D1 데이터, R2 파일, 큐 작업을 조정합니다.
4. 운영자는 로컬 검증에 `npm run verify`, 개발 서버에 `npm run dev`,
   E2E 검증에 `npm run e2e`를 사용합니다.

## 목차 / Table of contents

- [목적 / Purpose](#목적--purpose)
- [주요 기능 / Features](#주요-기능--features)
- [패키지 구성 / Package contents](#패키지-구성--package-contents)
- [아키텍처 / Architecture](#아키텍처--architecture)
- [상태 / Status](#상태--status)
- [먼저 읽을 파일 / First files to read](#먼저-읽을-파일--first-files-to-read)
- [API 및 진입점 / Entry points](#api-및-진입점--entry-points)
- [빠른 시작 / Quick start](#빠른-시작--quick-start)
- [설정 / Configuration](#설정--configuration)
- [명령어 참조 / Commands](#명령어-참조--commands)
- [로컬 개발 / Local development](#로컬-개발--local-development)
- [테스트 / Testing](#테스트--testing)
- [Android TWA](#android-twa)
- [기여 / Contributing](#기여--contributing)
- [관리자 및 문의 / Maintainers](#관리자-및-문의--maintainers)
- [라이선스 / License](#라이선스--license)

## 목적 / Purpose

SafetyWallet은 현장 안전 데이터를 모바일 중심으로 수집하고,
관리자가 같은 데이터 흐름 안에서 검토·정산·감사를 수행하도록 돕습니다.

English: SafetyWallet is a field safety operations platform for mobile
hazard reporting, attendance tracking, safety education, point rewards,
and administrative compliance workflows.

### 이 프로젝트가 유용한 이유

- 현장 근로자는 별도 설치 없이 PWA에서 빠르게 신고와 출근 기록을 남깁니다.
- 관리자는 신고 검토, 포인트 정산, 교육 현황, 출근 데이터를 한 곳에서 봅니다.
- API, 정적 프론트엔드, Cloudflare 리소스를 하나의 배포 단위로 운영합니다.
- 다국어 UI와 Android Trusted Web Activity 패키징을 지원합니다.

## 주요 기능 / Features

| 영역 | 기능 | 사용자 |
| --- | --- | --- |
| 인증 | JWT 기반 로그인, 클라이언트 세션 저장 | Worker, Admin |
| 현장 신고 | 위험 게시물 작성, 이미지·동영상 첨부 | Worker |
| 출근 | 모바일 출근 기록 및 현장 출석 흐름 | Worker, Admin |
| 안전 교육 | 교육 콘텐츠와 이수 흐름 | Worker, Admin |
| 포인트 | 안전 활동 포인트 적립·검토·정산 | Worker, Admin |
| 관리자 기능 | 신고 검토, 데이터 조회, 권한 기반 처리 | Site Admin |
| 다국어 | `ko`, `en`, `vi`, `zh` 중심 i18n | Worker PWA |
| 배포 | Cloudflare Worker와 정적 자산 배포 | Operator |

## 패키지 구성 / Package contents

이 저장소는 npm workspaces와 Turborepo를 사용합니다.
제공된 루트 구조는 다음과 같습니다.

```text
.
├── AGENTS.md
├── ARCHITECTURE.md
├── CODE_STYLE.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── package-lock.json
├── package.json
├── playwright.config.ts
├── turbo.json
├── vitest.config.ts
├── wrangler.toml
└── apps/
    └── worker/
        ├── I18N_IMPLEMENTATION.md
        ├── next.config.mjs
        ├── package.json
        ├── tailwind.config.js
        ├── tsconfig.json
        ├── vitest.config.ts
        ├── android/
        └── src/
```

### 주요 파일

| 경로 | 설명 |
| --- | --- |
| `package.json` | 루트 npm scripts, workspaces, Node 엔진 정의 |
| `turbo.json` | build, dev, lint, test, typecheck 파이프라인 |
| `wrangler.toml` | Cloudflare Worker와 바인딩 설정 |
| `playwright.config.ts` | E2E 테스트 프로젝트 설정 |
| `vitest.config.ts` | 루트 단위 테스트 설정 |
| `apps/worker/` | 근로자용 Next.js PWA |
| `apps/worker/android/` | Android TWA 패키징 프로젝트 |
| `ARCHITECTURE.md` | 시스템 구조 상세 설명 |
| `CODE_STYLE.md` | 코드 스타일과 작성 규칙 |
| `CONTRIBUTING.md` | 기여 절차 |
| `LICENSE` | 라이선스 |

## 아키텍처 / Architecture

SafetyWallet은 Cloudflare Workers 환경을 중심으로 설계되었습니다.
프론트엔드는 정적 export된 Next.js 앱으로 제공되고,
API는 Hono 기반 Worker가 담당합니다.

English: The application is designed around a Cloudflare Worker runtime.
Static Next.js frontends are served beside the API, with Cloudflare
services used for persistence, files, cache, queues, and scheduled work.

### 구성 요소

| 구성 요소 | 역할 | 기술 |
| --- | --- | --- |
| Worker PWA | 근로자 모바일 웹 앱 | Next.js 15, React, Tailwind |
| Admin dashboard | 관리자 운영 화면 | Next.js static export |
| API Worker | 인증, 권한, 비즈니스 API | Hono, TypeScript |
| Database | 핵심 업무 데이터 저장 | Cloudflare D1, Drizzle |
| Object storage | 신고 이미지·동영상 등 파일 저장 | Cloudflare R2 |
| Cache/config | 인증 캐시와 시스템 설정 | Cloudflare KV |
| Queue/jobs | 알림과 비동기 작업 | Cloudflare Queues, cron |
| Android app | PWA를 감싸는 TWA 앱 | Gradle, Android TWA |

### 요청 흐름

1. 사용자가 Worker PWA 또는 Admin dashboard에 접속합니다.
2. 정적 자산은 Cloudflare Worker assets에서 제공됩니다.
3. 앱은 API 엔드포인트로 로그인, 신고, 출근, 교육 요청을 보냅니다.
4. API는 JWT, 역할, 현장 소속, 필드 권한을 확인합니다.
5. 업무 데이터는 D1에 저장되고, 첨부 파일은 R2에 저장됩니다.
6. 알림이나 후속 처리는 큐와 scheduled job에서 처리됩니다.

### 권한 모델

| 계층 | 설명 | 예시 |
| --- | --- | --- |
| 역할 | 전역 역할 기반 권한 | `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM` |
| 현장 소속 | 특정 현장에 대한 접근 권한 | 근로자 현장 배정, 관리자 현장 관리 |
| 필드 권한 | 세부 기능 플래그 | 포인트 지급, 검토, 데이터 내보내기 |

## 상태 / Status

| 항목 | 상태 |
| --- | --- |
| 개발 상태 | Active |
| 공개 여부 | Private package |
| 프로덕션 적합성 | 운영용으로 설계됨. 환경별 검증 필요 |
| 지원 Node.js | `>=20.0.0` |
| 패키지 매니저 | `npm@10.8.2` |
| 배포 정책 | 수동 API 배포 명령은 차단됨 |
| 기본 검증 | `npm run verify` |

## 먼저 읽을 파일 / First files to read

| 순서 | 파일 | 읽어야 하는 이유 |
| --- | --- | --- |
| 1 | [`ARCHITECTURE.md`](ARCHITECTURE.md) | 런타임, 배포 단위, 요청 흐름 이해 |
| 2 | [`package.json`](package.json) | 루트 명령어와 워크스페이스 확인 |
| 3 | [`wrangler.toml`](wrangler.toml) | Cloudflare 바인딩과 환경 설정 확인 |
| 4 | [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) | Worker PWA 다국어 구현 이해 |
| 5 | [`CODE_STYLE.md`](CODE_STYLE.md) | 코드 작성 규칙 확인 |
| 6 | [`CONTRIBUTING.md`](CONTRIBUTING.md) | 변경 제출 절차 확인 |

## API 및 진입점 / Entry points

### 사용자 진입점

| 진입점 | 대상 | 설명 |
| --- | --- | --- |
| Worker PWA | 현장 근로자 | 로그인, 위험 신고, 출근, 교육, 포인트 확인 |
| Admin dashboard | 현장 관리자 | 신고 검토, 출근·교육·정산 관리 |
| Android TWA | 모바일 사용자 | PWA를 Android 앱 형태로 제공 |

### 개발 진입점

| 진입점 | 명령어 또는 파일 | 설명 |
| --- | --- | --- |
| 전체 개발 서버 | `npm run dev` | Turborepo dev pipeline 실행 |
| 전체 빌드 | `npm run build` | 워크스페이스 빌드 후 정적 산출물 복사 |
| Worker PWA | `apps/worker/src/app/` | Next.js App Router 기반 화면 |
| Cloudflare 설정 | `wrangler.toml` | Worker, assets, D1, R2, KV 바인딩 |
| 테스트 설정 | `vitest.config.ts` | 단위 테스트 설정 |
| E2E 설정 | `playwright.config.ts` | Playwright 브라우저 테스트 |

## 빠른 시작 / Quick start

### 1. 요구 사항 설치

```bash
node --version
npm --version
```

필요 버전:

| 도구 | 버전 |
| --- | --- |
| Node.js | `>=20.0.0` |
| npm | `10.8.2` 권장 |
| Cloudflare Wrangler | 프로젝트 설정에 맞는 버전 |
| 1Password CLI | E2E 환경 파일을 사용할 때 필요 |

### 2. 의존성 설치

```bash
npm install
```

### 3. 로컬 개발 서버 실행

```bash
npm run dev
```

### 4. 기본 검증 실행

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

또는 통합 검증 명령을 사용합니다.

```bash
npm run verify
```

### 5. E2E 테스트 실행

```bash
npm run e2e
```

헤드 모드 또는 UI 모드가 필요하면 다음을 사용합니다.

```bash
npm run e2e:headed
npm run e2e:ui
```

## 설정 / Configuration

### 환경 설정 파일

| 파일 | 용도 |
| --- | --- |
| `wrangler.toml` | Cloudflare Worker, assets, bindings 설정 |
| `.env.e2e` | Playwright E2E 테스트 환경 변수 |
| `apps/worker/next.config.mjs` | Worker PWA Next.js 설정 |
| `apps/worker/tailwind.config.js` | Worker PWA Tailwind 설정 |
| `apps/worker/postcss.config.cjs` | PostCSS 설정 |

`.env.e2e`는 루트 scripts에서 1Password CLI와 함께 사용됩니다.

```bash
op run --env-file=.env.e2e -- npx playwright test
```

### Cloudflare 바인딩

| 바인딩 | 유형 | 목적 |
| --- | --- | --- |
| `DB` | D1 | 핵심 업무 데이터 저장 |
| `R2` | R2 | 사용자 업로드 파일 저장 |
| `ACETIME_BUCKET` | R2 | 출근 관련 자산 저장 |
| `KV` | KV | 인증 캐시, 설정, 상태 저장 |
| `ASSETS` | Workers Static Assets | 정적 프론트엔드 제공 |
| `NOTIFICATION_QUEUE` | Queue | 알림 전달 작업 |
| `NOTIFICATION_DLQ` | Queue | 실패한 알림 작업 보관 |
| `RATE_LIMITER` | Durable Object | 요청 제한 |
| `JOB_SCHEDULER` | Durable Object | 예약 작업 조정 |
| `FAS_HYPERDRIVE` | Hyperdrive | 외부 직원 데이터베이스 연동 |

실제 계정 ID, 데이터베이스 ID, 버킷 이름, 시크릿은
`wrangler.toml`과 Cloudflare 대시보드에서 환경별로 관리합니다.
README에는 내부 IP나 민감한 값을 기록하지 마세요.

### 인증과 세션

| 항목 | 설명 |
| --- | --- |
| 토큰 | JWT 기반 |
| 만료 | KST 기준 당일 자정 만료 정책 |
| 검증 | JWT decode, 날짜 확인, KV cache, D1 fallback |
| Worker PWA 저장소 | `safetywallet-auth` |
| Admin 저장소 | `safetywallet-admin-auth` |
| 401 처리 | 클라이언트 refresh mutex 사용 |

## 명령어 참조 / Commands

루트 `package.json`에서 제공하는 주요 명령입니다.

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 전체 워크스페이스 개발 서버 실행 |
| `npm run build` | 전체 빌드 후 정적 산출물 생성 |
| `npm run build:api` | API와 공유 타입 빌드 |
| `npm run build:static` | 정적 frontend 산출물을 `dist/`로 복사 |
| `npm run build:one-worker` | 단일 Worker 배포용 API 빌드 |
| `npm run lint` | 전체 lint 실행 |
| `npm run lint:naming` | 네이밍 규칙 검사 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run test` | 단위 테스트 실행 |
| `npm run test:coverage` | 커버리지 포함 테스트 |
| `npm run e2e` | Playwright E2E 테스트 |
| `npm run e2e:headed` | 브라우저 표시 모드 E2E |
| `npm run e2e:ui` | Playwright UI 모드 |
| `npm run format` | Prettier 포맷 적용 |
| `npm run format:check` | Prettier 포맷 검사 |
| `npm run check:wrangler-sync` | Wrangler 설정 동기화 검사 |
| `npm run git:preflight` | Git 변경 전 사전 검사 |
| `npm run verify` | 통합 검증 스크립트 |
| `npm run clean` | 빌드 산출물과 `node_modules` 정리 |
| `npm run db:generate` | 데이터베이스 코드 생성 |
| `npm run deploy:api` | 수동 배포 차단용 명령 |

### 배포 주의

`npm run deploy:api`는 의도적으로 실패합니다.
API 배포는 수동 명령이 아니라 Git ref 기반 배포 흐름을 따릅니다.

## 로컬 개발 / Local development

### 권장 작업 순서

1. 최신 브랜치를 가져옵니다.
2. `npm install`로 의존성을 설치합니다.
3. `npm run dev`로 개발 서버를 시작합니다.
4. 변경 범위에 맞춰 `npm run test` 또는 `npm run e2e`를 실행합니다.
5. PR 전 `npm run verify`와 `npm run format:check`를 실행합니다.

### Worker PWA 개발

Worker 앱은 `apps/worker`에 있습니다.

| 경로 | 설명 |
| --- | --- |
| `apps/worker/src/app/` | App Router 화면과 라우트 |
| `apps/worker/src/types/` | 앱 전용 타입 선언 |
| `apps/worker/src/app/globals.css` | 전역 스타일 |
| `apps/worker/next.config.mjs` | Next.js 설정 |
| `apps/worker/tailwind.config.js` | Tailwind 설정 |
| `apps/worker/I18N_IMPLEMENTATION.md` | i18n 구현 문서 |

### 다국어 개발

Worker PWA는 한국어, 영어, 베트남어, 중국어 UI를 목표로 합니다.

| 언어 | 코드 |
| --- | --- |
| 한국어 | `ko` |
| English | `en` |
| Tiếng Việt | `vi` |
| 中文 | `zh` |

문구를 추가할 때는 다음을 확인하세요.

- 동일한 의미의 키를 재사용합니다.
- 한국어 원문과 영어 보조 문구를 함께 검토합니다.
- 긴 문장은 모바일 화면에서 줄바꿈이 자연스러운지 확인합니다.
- 자세한 구현은
  [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md)를
  참고합니다.

## 테스트 / Testing

### 테스트 종류

| 테스트 | 명령어 | 목적 |
| --- | --- | --- |
| Unit | `npm run test` | 컴포넌트와 유틸리티 검증 |
| Coverage | `npm run test:coverage` | 커버리지 포함 검증 |
| Typecheck | `npm run typecheck` | TypeScript 오류 방지 |
| Lint | `npm run lint` | 코드 품질 규칙 검사 |
| E2E | `npm run e2e` | 사용자 흐름 검증 |
| Full verify | `npm run verify` | 배포 전 통합 검증 |

### Playwright

Playwright 설정은 [`playwright.config.ts`](playwright.config.ts)에 있습니다.
E2E 테스트는 환경 변수가 필요할 수 있으므로
프로젝트의 `.env.e2e` 준비 상태를 먼저 확인하세요.

```bash
npm run e2e
```

디버깅이 필요할 때:

```bash
npm run e2e:headed
npm run e2e:ui
```

### Vitest

루트 설정은 [`vitest.config.ts`](vitest.config.ts)에 있고,
Worker 앱은 `apps/worker/vitest.config.ts`를 사용합니다.

```bash
npm run test
```

## Android TWA

`apps/worker/android`는 Worker PWA를 Android Trusted Web Activity로
패키징하기 위한 프로젝트입니다.

| 경로 | 설명 |
| --- | --- |
| `apps/worker/android/build.gradle` | Android 루트 Gradle 설정 |
| `apps/worker/android/settings.gradle` | Gradle 프로젝트 설정 |
| `apps/worker/android/twa-manifest.json` | TWA manifest |
| `apps/worker/android/app/src/main/AndroidManifest.xml` | Android 앱 manifest |
| `apps/worker/android/app/src/main/res/` | 아이콘, splash, strings, shortcuts |
| `apps/worker/android/app/src/main/java/.../twa/` | TWA launcher와 delegation service |

Android 빌드는 로컬 Android SDK와 Gradle 환경이 필요합니다.

```bash
cd apps/worker/android
./gradlew build
```

Windows에서는 다음을 사용합니다.

```powershell
cd apps/worker/android
.\gradlew.bat build
```

## 운영 관찰 포인트 / Observability

| 영역 | 확인 대상 | 운영 판단 |
| --- | --- | --- |
| 인증 | 401, 토큰 만료, KV cache miss | 세션 만료인지 권한 문제인지 구분 |
| API | 4xx, 5xx, route latency | 사용자 오류와 서버 오류 분리 |
| D1 | migration 상태, query failure | 배포 전 schema 동기화 확인 |
| R2 | upload failure, object access | 첨부 파일 누락 여부 확인 |
| Queue | retry, DLQ 적재 | 알림 실패와 재처리 필요성 확인 |
| Cron jobs | job success, last run | 정산·알림 작업 지연 확인 |
| Static assets | cache, 404 | 정적 export 산출물 배치 확인 |

## 기여 / Contributing

기여 절차는 [`CONTRIBUTING.md`](CONTRIBUTING.md)를 따릅니다.

기본 규칙:

- 변경 전 관련 문서를 먼저 읽습니다.
- 코드 스타일은 [`CODE_STYLE.md`](CODE_STYLE.md)를 따릅니다.
- PR 전 `npm run verify`를 실행합니다.
- 포맷 변경은 `npm run format` 또는 `npm run format:check`로 확인합니다.
- 민감한 설정값, 내부 주소, 개인 정보를 커밋하지 않습니다.

### 커밋 전 체크리스트

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run verify
```

변경이 사용자 흐름에 영향을 주면 E2E도 실행합니다.

```bash
npm run e2e
```

## 관리자 및 문의 / Maintainers

| 역할 | 책임 |
| --- | --- |
| Product owner | 현장 안전 업무 요구사항과 우선순위 |
| Engineering owner | API, 프론트엔드, 배포 구조 |
| Site operations | 운영 데이터, 사용자 지원, 현장 설정 |
| Security reviewer | 인증, 권한, 민감 데이터 검토 |

도움이 필요하면 먼저 관련 문서를 확인한 뒤,
프로젝트의 내부 이슈 트래커나 지정된 팀 채널로 문의하세요.

English: For support, start with the local documentation and then contact
the assigned product, engineering, or operations owner through the
project’s internal support channel.

## 추가 문서 / Further documentation

| 문서 | 내용 |
| --- | --- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 시스템 아키텍처 상세 |
| [`CODE_STYLE.md`](CODE_STYLE.md) | 코드 스타일과 품질 규칙 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 기여 절차 |
| [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) | Worker PWA i18n 구현 |
| [`wrangler.toml`](wrangler.toml) | Cloudflare Worker 설정 |
| [`playwright.config.ts`](playwright.config.ts) | E2E 테스트 설정 |
| [`turbo.json`](turbo.json) | Turborepo pipeline 설정 |

## 라이선스 / License

이 프로젝트의 라이선스는 [`LICENSE`](LICENSE)를 참고하세요.