# SafetyWallet / 안전지갑

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Hono%20%7C%20Next.js%20%7C%20Cloudflare%20Workers-blue)
![Runtime](https://img.shields.io/badge/node-%E2%89%A520.0.0-339933)
![Package manager](https://img.shields.io/badge/npm-10.8.2-CB3837)
![Pipeline](https://img.shields.io/badge/turborepo-workspace-FF1E56)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

---

## 한국어 요약

SafetyWallet은(는) 건설 현장의 작업자가 모바일 PWA에서 위험 요인을 보고하고 출퇴근을 기록하며 안전 포인트를 적립하도록 돕는 클라우드 네이티브 서비스입니다. 단일 Cloudflare Worker가 Hono 기반 API와 정적으로 내보내진(exported) Next.js 프런트엔드를 호스트 이름 라우팅으로 동시에 제공하며, D1 · R2 · KV · Hyperdrive · Queue · Durable Object를 엣지에서 결합합니다. 관리자는 별도 콘솔에서 게시물 검토, 정산, 교육, 컴플라이언스를 처리하고, 작업자는 한국어 · 영어 · 베트남어 · 중국어로 제공되는 PWA를 사용해 현장 활동을 기록합니다.

## English Summary

SafetyWallet is a cloud-native service that lets construction-site workers report hazards, log attendance, and earn safety points from a mobile PWA. A single Cloudflare Worker serves the Hono API and statically-exported Next.js frontends via hostname routing, combining D1, R2, KV, Hyperdrive, Queues, and Durable Objects at the edge. Site admins handle reviews, settlements, education, and compliance from a dedicated console, while workers record day-to-day field activity through a localized PWA (ko, en, vi, zh).

---

## 한눈에 보기 / At a Glance

| 항목 / Item              | 값 / Value                                                       |
| ------------------------ | ---------------------------------------------------------------- |
| 배포 모델 / Deployment   | Cloudflare Workers + Workers Static Assets                       |
| 데이터 저장 / Data       | D1 (primary), R2 (media), KV (cache), Hyperdrive (FAS DB)       |
| 워크스페이스 / Workspaces | `apps/*`, `packages/*` (Turborepo)                              |
| 런타임 / Runtime         | Node.js >= 20.0.0, npm 10.8.2                                    |
| 빌드 파이프라인 / Build  | Turborepo (`types` → `ui` → `apps`)                              |
| 테스트 / Testing         | Vitest (unit, integration), Playwright (E2E)                     |
| 다국어 / i18n            | ko, en, vi, zh (커스텀 런타임)                                   |
| 인증 / Auth              | JWT (KST 자정 기준 만료) + 3단 권한 계층 + Zustand 클라이언트    |
| 라이선스 / License       | Proprietary ([LICENSE](LICENSE))                                 |

## 흐름 요약 / Flow Summary

1. 작업자가 모바일 PWA에서 로그인하고 현장 활동(위험 보고, 출퇴근, 교육)을 기록합니다.
2. PWA가 단일 Cloudflare Worker에 요청을 보내면 호스트 이름에 따라 정적 자산 또는 Hono API로 라우팅됩니다.
3. API는 Drizzle로 D1에 기록하고, 미디어는 R2에 업로드하며, 인증 토큰은 KV에서 캐싱합니다.
4. Durable Object(RateLimiter)가 남용을 막고, Queue 파이프라인이 알림을 비동기로 전달합니다.
5. 관리자 콘솔은 동일 API를 호출하여 검토, 정산, 컴플라이언스를 처리합니다.
6. 모든 정적 자산은 동일 Worker의 `ASSETS` 바인딩으로 호스팅되어 캐시 일관성을 유지합니다.

---

## Purpose / 목적

SafetyWallet은(는) 건설 현장의 작업자, 현장 관리자, 본사 운영팀 사이의 안전 활동을 한 곳에서 모으기 위한 SaaS입니다.

- **작업자가 할 수 있는 것** — 모바일 브라우저에서 위험 요인 사진과 함께 보고, GPS 기반 출퇴근을 찍고, 안전 점수와 포인트를 실시간으로 확인합니다.
- **현장 관리자가 할 수 있는 것** — 게시물을 검토·승인하고, 포인트를 정산하며, 교육 모듈을 배정합니다.
- **운영팀이 할 수 있는 것** — 외부 FAS DB와 Hyperdrive로 연동된 임직원 정보, 알림 큐, Durable Object 기반 스케줄러로 정기 작업을 처리합니다.

Cloudflare 엣지에서 전체 스택이 동작하므로 동일 배포가 글로벌 현장에 낮은 지연 시간을 제공합니다.

---

## Package Contents / 저장소 구성

현재 저장소의 최상위 레이아웃입니다.

```
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
        ├── android/                  # Bubblewrap Trusted Web Activity 셸
        │   ├── build.gradle
        │   ├── gradle.properties
        │   ├── gradlew, gradlew.bat
        │   ├── manifest-checksum.txt
        │   ├── settings.gradle
        │   ├── store_icon.png
        │   ├── twa-manifest.json
        │   ├── app/
        │   │   ├── build.gradle
        │   │   └── src/main/
        │   │       ├── AndroidManifest.xml
        │   │       ├── java/me/jclee/safetywallet/twa/
        │   │       │   ├── Application.java
        │   │       │   ├── DelegationService.java
        │   │       │   └── LauncherActivity.java
        │   │       └── res/         # 아이콘, 스플래시, web manifest
        │   └── gradle/wrapper/
        └── src/
            └── app/
                ├── AGENTS.md
                ├── error.tsx
                ├── globals.css
                ├── layout.tsx
                └── page.tsx
```

`apps/worker`는 작업자용 Next.js 15 PWA (App Router, 정적 내보내기)이며 Play Store 배포를 위한 Trusted Web Activity 셸을 함께 포함합니다. 루트 메타데이터와 `package.json`의 워크스페이스 선언, [AGENTS.md](AGENTS.md)가 참조하는 다른 영역(예: `apps/api`, `apps/admin`, `packages/types`, `packages/ui`, `docs/`, `scripts/`, `e2e/`, `.github/workflows/`)은 이 단편에 직접 표시되지 않지만 저장소 운영의 일부로 관리됩니다.

---

## Status / 상태

| 항목 / Item                | 상태 / Status                                                |
| -------------------------- | ------------------------------------------------------------ |
| 개발 상태 / Lifecycle      | Active — 운영 배포 진행 중                                    |
| API 런타임 / API runtime   | Cloudflare Workers (Hono)                                     |
| 데이터베이스 / Database    | D1, Drizzle ORM                                              |
| 정적 호스팅 / Static host  | Workers Static Assets                                        |
| 모바일 클라이언트 / Client | PWA + Android TWA wrapper                                    |
| 다국어 / i18n              | ko, en, vi, zh                                               |
| 인증 / Auth                | JWT (KST 자정 기준 만료), 3단 권한 계층                       |
| 배포 / Deployment          | Git 참조 기반 CI(`master` 푸시). 수동 배포는 의도적으로 차단됨  |

Production-ready 평가, 미해결 이슈, 배포 차단 사유는 [AGENTS.md](AGENTS.md)와 내부 운영 대시보드가 단일 진실 공급원입니다.

---

## First Files to Read / 먼저 읽을 파일

운영자, 신규 합류자, 자동화 에이전트는 다음 순서로 읽으면 빠르게 맥락을 잡을 수 있습니다.

1. [AGENTS.md](AGENTS.md) — 저장소 전체 지식 베이스와 작업 규칙
2. [ARCHITECTURE.md](ARCHITECTURE.md) — 시스템 구조, 데이터 흐름, 바인딩
3. [CODE_STYLE.md](CODE_STYLE.md) — 코딩 컨벤션, 금지 패턴 목록
4. [CONTRIBUTING.md](CONTRIBUTING.md) — PR 절차와 기여 흐름
5. [`wrangler.toml`](wrangler.toml) — Cloudflare 바인딩과 환경 변수
6. [`package.json`](package.json) — 워크스페이스, 스크립트, 린트 스테이지
7. [apps/worker/AGENTS.md](apps/worker/AGENTS.md) — 작업자 PWA 모듈 규칙
8. [apps/worker/I18N_IMPLEMENTATION.md](apps/worker/I18N_IMPLEMENTATION.md) — 다국어 런타임 동작

---

## API or Entry Points / API 및 진입점

| 진입점 / Entry Point   | 경로 / Path                                       | 용도 / Purpose                                |
| ---------------------- | ------------------------------------------------- | --------------------------------------------- |
| 작업자 PWA 루트        | `apps/worker/src/app/page.tsx`                    | 작업자 메인 페이지                            |
| 작업자 PWA 레이아웃    | `apps/worker/src/app/layout.tsx`                  | 루트 레이아웃, 메타데이터, i18n 부트          |
| 작업자 에러 바운더리   | `apps/worker/src/app/error.tsx`                   | 클라이언트 에러 폴백                          |
| 작업자 전역 스타일     | `apps/worker/src/app/globals.css`                 | Tailwind/CSS 진입                             |
| Cloudflare Worker 설정 | `wrangler.toml`                                   | 호스트 이름 라우팅, 바인딩, 크론 트리거        |
| Android TWA 셸         | `apps/worker/android/app/src/main/java/...`       | Play Store 배포용 Trusted Web Activity       |
| TWA 매니페스트         | `apps/worker/android/twa-manifest.json`           | Bubblewrap 래퍼 메타데이터                    |
| Android 진입점 클래스  | `apps/worker/android/app/src/main/java/me/jclee/safetywallet/twa/Application.java` 외 | TWA 부트스트랩 및 딥링크 |

Hono 라우트, Drizzle 스키마, Durable Object 정의, 알림 핸들러는 [ARCHITECTURE.md](ARCHITECTURE.md)에 매핑되어 있습니다.

---

## Quickstart / 빠른 시작

사전 요구 사항:

- Node.js 20.x 이상
- npm 10.8.2 (`packageManager` 필드로 잠금)
- Cloudflare 계정과 Wrangler CLI (`npx wrangler`로도 실행 가능)
- Husky(`prepare` 훅)용 Git
- Go (린트 스테이지의 안티 패턴 검사 스크립트 실행에 필요)

순서:

1. 의존성을 설치합니다.

   ```bash
   npm install
   ```

2. 환경 변수를 준비합니다. 저장소에서 `.env.example`이 제공되는 경우 이를 복사해 `.env`를 만들고 Cloudflare 계정 ID, D1 ID, R2 버킷 이름 등을 채워 넣습니다.

3. 로컬 개발 서버를 띄웁니다(Turborepo가 워크스페이스의 `dev` 스크립트를 병렬 실행).

   ```bash
   npm run dev
   ```

4. 작업자 PWA만 단독으로 보고 싶다면 다음을 사용하세요.

   ```bash
   npm run dev --workspace=apps/worker
   ```

5. 정적 자산을 빌드합니다.

   ```bash
   npm run build
   ```

6. 배포는 Git 참조 기반 CI에서만 실행됩니다. 수동 배포는 의도적으로 차단되어 있습니다.

   ```
   $ npm run deploy:api
   > Manual deploy is disabled. Deploy is Git-ref driven via CI on master.
   ```

자세한 시크릿 주입 흐름은 `e2e` 스크립트의 `op run --env-file=.env.e2e ...` 호출을 참고하세요.

---

## Architecture / 아키텍처

운영자가 보는 주요 요청 흐름은 다음과 같습니다.

| 단계 / Step | 출발지                | 도착지                                  | 비고 / Notes                                          |
| ----------- | --------------------- | --------------------------------------- | ----------------------------------------------------- |
| 1           | 모바일 PWA            | Cloudflare Worker (호스트 이름 라우팅)   | `worker.` 서브도메인 정적 자산 우선                     |
| 2           | Worker                | Hono API 라우트                         | API 호스트로 들어온 요청                                |
| 3           | API                   | Drizzle ORM                             | 타입 안전한 쿼리 빌더                                  |
| 4           | API                   | D1 / R2 / KV / Hyperdrive / Queue       | `wrangler.toml`의 바인딩                                |
| 5           | API                   | Durable Objects                         | `RateLimiter`, `JobScheduler`                          |
| 6           | Worker                | Workers Static Assets                   | PWA / 관리자 콘솔 자산                                 |
| 7           | 관리자 콘솔           | 동일 API                                | `admin.` 호스트                                        |

한 문장 요약: 작업자 PWA와 관리자 콘솔은 모두 같은 Cloudflare Worker에 도달하고, Worker는 호스트 이름에 따라 정적 자산을 돌려주거나 Hono API로 요청을 위임하며, API는 Cloudflare 바인딩을 통해 데이터를 기록·조회·캐싱합니다. 상세 다이어그램은 [ARCHITECTURE.md](ARCHITECTURE.md)를 참조하세요.

## Configuration / 구성

Cloudflare 바인딩은 [`wrangler.toml`](wrangler.toml)에서 한곳에 정의되며, 다음 표에 정리되어 있습니다.

| 바인딩 / Binding              | 종류                  | 용도                                |
| ----------------------------- | --------------------- | ----------------------------------- |
| `DB`                          | D1                    | 주 데이터베이스                     |
| `FAS_HYPERDRIVE`              | Hyperdrive            | 외부 FAS 직원 DB                    |
| `ASSETS`                      | Workers Static Assets | 정적 프런트엔드 자산                 |
| `R2`                          | R2                    | 사용자 업로드 미디어                |
| `ACETIME_BUCKET`              | R2                    | 출퇴근 관련 자산                    |
| `KV`                          | KV                    | 인증 캐시, 시스템 상태              |
| `NOTIFICATION_QUEUE` / `_DLQ` | Queue                 | 알림 전달 파이프라인                 |
| `RATE_LIMITER`                | Durable Object        | API 속도 제한                       |

로컬 환경 변수, 시크릿, 호스트별 환경 분리는 [CODE_STYLE.md](CODE_STYLE.md) 및 내부 런북을 따릅니다.

---

## Commands Reference / 명령어 레퍼런스

루트에서 자주 쓰는 명령어입니다. 워크스페이스 단위로 실행할 때는 `--workspace=<name>`을 붙입니다.

| 명령어                        | 설명                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| `npm run dev`                 | 모든 워크스페이스의 개발 서버를 Turborepo로 병렬 실행            |
| `npm run build`               | 전체 빌드 후 정적 자산을 `dist/`로 모음                          |
| `npm run build:api`           | `packages/types` → `apps/api` 순서로 빌드                        |
| `npm run build:static`        | 빌드 산출물을 `dist/`에 복사, 관리자 콘솔은 `dist/admin/` 하위  |
| `npm run build:one-worker`    | API 워크스페이스만 빌드 (점진적 배포용)                           |
| `npm run lint`                | 워크스페이스 전체 린트 (Turbo)                                   |
| `npm run lint:naming`         | 명명 규칙 린트 (`scripts/lint-naming.js`)                       |
| `npm run typecheck`           | 워크스페이스 전체 타입 검사                                      |
| `npm run test`                | Vitest 단위/통합 테스트                                          |
| `npm run test:coverage`       | 커버리지 리포트가 포함된 Vitest 실행                             |
| `npm run check:wrangler-sync` | `wrangler.toml` 동기화 검사                                     |
| `npm run git:preflight`       | 커밋 전 Git 사전 점검 (Go 스크립트)                              |
| `npm run verify`              | 빌드/타입/테스트/동기화 통합 검증                                |
| `npm run format`              | Prettier로 전체 포맷                                              |
| `npm run format:check`        | Prettier 검사 전용                                                |
| `npm run clean`               | Turbo 정리 + `node_modules` 제거                                |
| `npm run db:generate`         | `apps/api` Drizzle 마이그레이션 생성                              |
| `npm run e2e`                 | Playwright E2E (1Password CLI로 시크릿 주입)                     |
| `npm run e2e:headed`          | 헤드 모드로 Playwright 실행                                      |
| `npm run e2e:ui`              | Playwright UI 모드                                               |
| `npm run deploy:api`          | 의도적으로 실패 — 수동 배포 차단 메시지 출력                     |

---

## Local Development / 로컬 개발

- 단일 앱만 빠르게 보고 싶다면 `--workspace` 플래그를 사용하세요. 예: `npm run dev --workspace=apps/worker`.
- `lint-staged` 훅이 커밋 직전 Prettier와 Go 기반 안티 패턴 검사를 실행합니다.
- 안전 가드 스크립트는 Go로 작성되어 있으므로 로컬에 `go` 런타임이 필요합니다. CI에서도 동일하게 실행됩니다.
- Husky가 `npm run prepare` 단계에서 활성화되어 Git 훅이 자동으로 설치됩니다.
- E2E 시크릿은 1Password CLI를 통해 주입됩니다(`op run --env-file=.env.e2e ...`). 평문 시크릿은 커밋하지 마세요.

## Testing / 테스트

| 종류 / Type | 위치 / Runner                       | 목적                          |
| ----------- | ----------------------------------- | ----------------------------- |
| 단위        | Vitest (`vitest.config.ts`)         | 비즈니스 로직, 헬퍼 함수      |
| 통합        | Vitest (`vitest.config.ts`)         | 리포지토리, 검증 스키마       |
| E2E         | Playwright (`playwright.config.ts`) | 작업자/관리자 전체 흐름        |
| 정적 타입   | TypeScript 컴파일러                 | 정적 안전성                   |
| 가드        | Go 스크립트 (`scripts/`)            | 안티 패턴, wrangler 동기화    |

E2E 테스트는 환경 변수 주입에 1Password CLI를 사용합니다. CI에서도 동일한 방식으로 동작합니다.

---

## Maintainers / Points of Contact / 유지보수 및 연락처

| 역할 / Role                 | 채널 / Channel                                              |
| --------------------------- | ----------------------------------------------------------- |
| 저장소 규칙 · 자동화 규칙   | [AGENTS.md](AGENTS.md) — 자동화 에이전트의 단일 진실 공급원  |
| 기여 절차                   | [CONTRIBUTING.md](CONTRIBUTING.md)                          |
| 코드 스타일 · 금지 패턴     | [CODE_STYLE.md](CODE_STYLE.md)                              |
| 인시던트 대응 런북          | `docs/` 하위 런북 (저장소 메타 참조)                        |
| 외부 의존성                 | Cloudflare 대시보드, FAS Hyperdrive 원본 DB                 |

팀 구조와 책임자 정보는 사내용이라 README에는 직접 기재하지 않습니다. 보안 관련 사안은 내부 채널을 통해 공유됩니다.

---

## Further Documentation / 추가 문서

- [AGENTS.md](AGENTS.md) — 자동화 에이전트 포함 전사 지식 베이스
- [ARCHITECTURE.md](ARCHITECTURE.md) — 시스템 아키텍처와 데이터 흐름
- [CODE_STYLE.md](CODE_STYLE.md) — 코딩 컨벤션
- [CONTRIBUTING.md](CONTRIBUTING.md) — 기여 가이드
- [apps/worker/AGENTS.md](apps/worker/AGENTS.md) — 작업자 PWA 모듈 지식
- [apps/worker/I18N_IMPLEMENTATION.md](apps/worker/I18N_IMPLEMENTATION.md) — i18n 런타임 동작
- [LICENSE](LICENSE) — 라이선스 전문

Cloudflare Workers, D1, R2, KV, Hyperdrive, Queues, Durable Objects의 사양은 공식 문서를 참조하세요. 본 README의 표는 저장소 메타데이터에서 파생된 요약이며, 실제 트래픽 흐름과 바인딩 세부값은 [`wrangler.toml`](wrangler.toml)과 [ARCHITECTURE.md](ARCHITECTURE.md)가 단일 진실 공급원입니다.