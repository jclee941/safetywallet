# SafetyWallet / 안전지갑

> Mobile-first PWA for construction-site safety reporting, attendance, and safety-point incentive management — deployed end-to-end on the Cloudflare edge.
> 건설 현장의 안전 보고 · 출퇴근 · 안전 포인트 인센티브를 관리하는 모바일 우선 PWA. **Cloudflare** 엣지에 전량 배포됩니다.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Hono%20%7C%20Drizzle%20%7C%20Next.js%2015%20%7C%20Cloudflare%20Workers-blue)
![Node](https://img.shields.io/badge/node-%E2%89%A520.0.0-green)
![Package%20Manager](https://img.shields.io/badge/npm-10.8.2-CB3837)
![Turborepo](https://img.shields.io/badge/turborepo-monorepo-FF1E56)

---

## Table of Contents / 목차

- [Overview / 개요](#overview--개요)
- [Key Features / 주요 기능](#key-features--주요-기능)
- [Architecture / 아키텍처](#architecture--아키텍처)
- [Tech Stack / 기술 스택](#tech-stack--기술-스택)
- [Repository Layout / 저장소 구조](#repository-layout--저장소-구조)
- [Quick Start / 빠른 시작](#quick-start--빠른-시작)
- [Configuration / 설정](#configuration--설정)
- [Commands Reference / 명령어 레퍼런스](#commands-reference--명령어-레퍼런스)
- [Local Development / 로컬 개발](#local-development--로컬-개발)
- [Testing / 테스트](#testing--테스트)
- [Android TWA Build / Android TWA 빌드](#android-twa-build--android-twa-빌드)
- [Internationalization / 국제화](#internationalization--국제화)
- [Contribution Guide / 기여 가이드](#contribution-guide--기여-가이드)
- [License / 라이선스](#license--라이선스)

---

## Overview / 개요

SafetyWallet is a field-worker safety platform organized as a **Turborepo monorepo** and deployed end-to-end on **Cloudflare**. It targets construction sites where workers need a low-friction, installable mobile experience and site managers need a dashboard to triage safety reports, attendance, and incentive accrual.

SafetyWallet은 **Cloudflare** 엣지에 전량 배포되는 **Turborepo 모노레포** 기반 현장 작업자 안전 플랫폼입니다. 작업자가 현장에서 마찰 없이 설치 가능한 모바일 환경을 사용하고, 현장 관리자가 안전 보고 · 출퇴근 · 인센티브 적립을 심사할 수 있는 대시보드를 제공합니다.

### Product Surfaces / 제품 표면

| Surface / 표면 | Location / 위치 | Purpose / 용도 |
| --- | --- | --- |
| Field-worker PWA / 작업자 PWA | `apps/worker` | Statically exported Next.js 15 application. Primary mobile experience installed on devices. / 현장 작업자가 단말에 설치해 사용하는 정적 배포 Next.js 15 앱 |
| Admin Dashboard / 관리자 대시보드 | `apps/admin` *(workspace)* | Statically exported Next.js 15 dashboard served from the same Worker via hostname routing. / 동일 Worker에서 호스트명 라우팅으로 제공되는 정적 대시보드 |
| API Worker / API Worker | `apps/api` *(workspace)* | Cloudflare Worker hosting the **Hono** HTTP API on a **Drizzle / D1** data layer. / **Hono** HTTP API와 **Drizzle / D1** 데이터 계층을 호스팅하는 Cloudflare Worker |
| Shared Types / 공유 타입 | `packages/types` *(workspace)* | Cross-workspace TypeScript contracts shared by API, PWA, and admin. / API · PWA · Admin이 공유하는 타입 계약 |

> Note / 참고: `apps/admin`, `apps/api`, and `packages/types` are referenced by `package.json` workspaces and root scripts but are not enumerated in this snapshot. They are documented as part of the design contract. / `apps/admin` · `apps/api` · `packages/types`는 루트 `package.json` 워크스페이스 및 스크립트에서 참조되지만 본 스냅샷에는 디렉터리가 직접 포함되지 않습니다. 설계 계약의 일부로 문서화합니다.

---

## Key Features / 주요 기능

- **Installable mobile PWA / 설치 가능한 모바일 PWA** — Next.js 15 static export with a manifest and service-worker-friendly build. Statically exported and served from Cloudflare.
- **Android TWA / Android 신뢰 웹 활동** — Native-installable APK via Bubblewrap with origin verification through `manifest-checksum.txt`. Chrome address bar is hidden; installable from Play Store or sideload.
- **Safety reporting / 안전 보고** — Workers capture hazards, near-misses, and incidents from the field.
- **Attendance / 출퇴근** — Time-on-site tracking aligned to incentive accrual.
- **Safety-point incentives / 안전 포인트 인센티브** — Points accrue on report quality and attendance, redeemable in the admin console.
- **Admin dashboard / 관리자 대시보드** — Triage queue, attendance review, and incentive reconciliation.
- **Edge-native data layer / 엣지 네이티브 데이터 계층** — Drizzle ORM over Cloudflare D1 (SQLite at the edge).
- **Bilingual UI / 이중 언어 UI** — Korean-first with English copy. See [I18N_IMPLEMENTATION.md](./apps/worker/I18N_IMPLEMENTATION.md).
- **CI-driven deploy / CI 기반 배포** — Manual deploys are disabled; release is Git-ref driven via CI on `master`.

---

## Architecture / 아키텍처

The system has three runtime surfaces that all terminate at a single Cloudflare Worker, which performs hostname-based routing to static assets or to the Hono API.

```mermaid
flowchart TB
    subgraph Field["Field Devices / 현장 단말"]
        PWA["PWA<br/>(Next.js 15 static export)<br/>apps/worker"]
        TWA["Android TWA<br/>(Bubblewrap APK)<br/>apps/worker/android"]
    end

    subgraph Edge["Cloudflare Edge / Cloudflare 엣지"]
        Worker["Worker<br/>(hostname routing)<br/>wrangler.toml"]
        Static["Static Assets<br/>(apps/worker/out, apps/admin/out)"]
        API["Hono API<br/>(apps/api)"]
        D1[("D1 / SQLite<br/>(Drizzle ORM schema)")]
        KV[(("KV / R2<br/>(per wrangler.toml)"))]
    end

    subgraph Admin["Manager Browser / 관리자"]
        AdminUI["Admin Dashboard<br/>(Next.js 15 static export)<br/>apps/admin"]
    end

    subgraph CI["CI / CD"]
        GHA["GitHub Actions<br/>(master ref → deploy)"]
    end

    PWA -->|"HTTPS"| Worker
    TWA -->|"HTTPS<br/>origin verified<br/>via manifest-checksum.txt"| Worker
    AdminUI -->|"HTTPS"| Worker

    Worker -->|"hostname match"| Static
    Worker -->|"hostname match"| API
    API --> D1
    API --> KV

    GHA -->|"wrangler deploy"| Worker
```

### Request flow / 요청 흐름

1. A field device loads the PWA (browser install) or launches the TWA (Android install). / 현장 단말이 PWA(브라우저 설치) 또는 TWA(Android 설치)를 기동합니다.
2. The Cloudflare Worker terminates the TLS connection and matches the `Host` header. / Cloudflare Worker가 TLS를 종료하고 `Host` 헤더를 매칭합니다.
3. Worker hostnames resolve to either the static asset bundle (`apps/worker/out` or `apps/admin/out`) or the Hono API. / Worker는 호스트명에 따라 정적 자산 번들 또는 Hono API로 라우팅합니다.
4. The Hono API executes against Drizzle-typed handlers backed by D1 (and any KV / R2 bindings declared in `wrangler.toml`). / Hono API는 `wrangler.toml`의 D1 · KV · R2 바인딩 위에서 Drizzle 타입 핸들러를 실행합니다.

---

## Tech Stack / 기술 스택

| Layer / 계층 | Technology / 기술 | Notes / 비고 |
| --- | --- | --- |
| Language / 언어 | TypeScript | Strict mode; React pinned to `18.3.1` via `overrides`. |
| API framework / API 프레임워크 | Hono | Runs on Cloudflare Workers. |
| ORM / ORM | Drizzle | Type-safe schema and migrations for D1. |
| Database / 데이터베이스 | Cloudflare D1 | SQLite at the edge. |
| Frontend / 프런트엔드 | Next.js 15 (App Router) | Statically exported (`output: "export"`). |
| Styling / 스타일링 | Tailwind CSS | Per `apps/worker/tailwind.config.js`. |
| Build orchestration / 빌드 오케스트레이션 | Turborepo | Per `turbo.json`. |
| Hosting / 호스팅 | Cloudflare Workers + Assets | Per `wrangler.toml`. |
| Unit testing / 단위 테스트 | Vitest | Per workspace `vitest.config.ts`. |
| E2E testing / E2E 테스트 | Playwright | Secrets injected via `op run` from `.env.e2e`. |
| Git hooks / Git 훅 | Husky | Pre-commit pipeline (see `package.json#lint-staged`). |
| Formatting / 포맷팅 | Prettier | Write and check modes exposed. |
| Android wrapper / Android 래퍼 | Bubblewrap | TWA build via Gradle; `twa-manifest.json` is the source of truth. |

---

## Repository Layout / 저장소 구조

The current top-level layout of this repository snapshot:

```
.
├── AGENTS.md                       # Agent / contributor operating contract
├── ARCHITECTURE.md                 # Deeper architecture rationale
├── CODE_STYLE.md                   # Coding conventions
├── CONTRIBUTING.md                 # Contribution workflow
├── LICENSE                         # Project license
├── README.md                       # This file
├── package.json                    # Workspaces, scripts, overrides
├── package-lock.json               # npm lockfile
├── playwright.config.ts            # Playwright E2E config
├── turbo.json                      # Turborepo pipeline config
├── vitest.config.ts                # Root Vitest config
├── wrangler.toml                   # Cloudflare Worker bindings
└── apps/
    └── worker/
        ├── AGENTS.md               # Worker-app-level contract
        ├── I18N_IMPLEMENTATION.md  # Bilingual i18n notes
        ├── next.config.mjs         # Next.js static-export config
        ├── next-env.d.ts
        ├── package.json
        ├── postcss.config.cjs
        ├── tailwind.config.js
        ├── tsconfig.json
        ├── vitest.config.ts
        ├── android/                # Bubblewrap TWA project
        │   ├── build.gradle
        │   ├── settings.gradle
        │   ├── gradle.properties
        │   ├── gradlew / gradlew.bat
        │   ├── gradle/wrapper/...
        │   ├── manifest-checksum.txt   # Origin verification asset
        │   ├── store_icon.png
        │   ├── twa-manifest.json       # TWA manifest (source of truth)
        │   └── app/
        │       ├── build.gradle
        │       └── src/main/
        │           ├── AndroidManifest.xml
        │           ├── java/me/jclee/safetywallet/twa/
        │           │   ├── Application.java
        │           │   ├── DelegationService.java
        │           │   └── LauncherActivity.java
        │           └── res/...    # Icons (mipmap-*), splash, notification icon, shortcuts, filepaths, strings, colors
        └── src/
            └── app/
                ├── AGENTS.md       # App-router conventions
                ├── error.tsx
                ├── globals.css
                ├── layout.tsx
                └── page.tsx
```

Workspaces declared in the root `package.json` (`apps/*`, `packages/*`) include additional packages such as `apps/api`, `apps/admin`, and `packages/types`, which are built and orchestrated by the root scripts but are not enumerated in this directory snapshot. / 루트 `package.json`이 선언한 워크스페이스에는 `apps/api` · `apps/admin` · `packages/types` 등이 포함되어 루트 스크립트로 오케스트레이션되지만, 본 스냅샷에는 디렉터리가 직접 표시되지 않습니다.

---

## Quick Start / 빠른 시작

### Prerequisites / 사전 준비

- **Node.js** ≥ 20.0.0 (declared in `package.json#engines`)
- **npm** 10.8.2 (declared in `packageManager`)
- **Go** ≥ 1.21 (for `scripts/git-preflight.go`, `scripts/verify.go`, `scripts/check-anti-patterns.go`)
- **Wrangler** (Cloudflare) — installed per workspace when needed
- **1Password CLI** (`op`) — required for E2E test runs (`e2e`, `e2e:headed`, `e2e:ui`)
- **Java JDK 17+ and Android SDK** — required only for the Android TWA build

### Install / 설치

```bash
npm install
```

This installs all workspaces (`apps/*`, `packages/*`) via npm workspaces. / npm 워크스페이스로 모든 워크스페이스를 설치합니다.

### Run the worker PWA locally / 작업자 PWA 로컬 실행

```bash
npm run dev --workspace=apps/worker
# or the full dev pipeline across workspaces
npm run dev
```

### Build everything / 전체 빌드

```bash
npm run build
```

This runs `turbo run build` and then `build:static`, which assembles the Cloudflare-distributable bundle into `./dist/`:

- `./dist/*` — Worker PWA static export
- `./dist/admin/*` — Admin dashboard static export

### Build only the API / API만 빌드

```bash
npm run build:api
```

This first builds `packages/types`, then `apps/api`. / `packages/types` → `apps/api` 순서로 빌드합니다.

---

## Configuration / 설정

### `wrangler.toml`

The Worker entry point is `wrangler.toml` at the repository root. It declares:

- Worker name and main entry
- Compatibility date / flags
- D1 database binding(s)
- KV namespace binding(s)
- R2 bucket binding(s) (if any)
- Static asset directory and binding

Review and adjust bindings before deploying. / 배포 전 바인딩을 검토하세요.

### Environment variables / 환경 변수

There is no committed `.env`. E2E runs load secrets from `.env.e2e` through 1Password CLI:

```bash
npm run e2e
# equivalent to:
op run --env-file=.env.e2e -- npx playwright test
```

For local development, copy any per-workspace `.env.example` if present, or define variables in your shell / Wrangler dev secret store. / 로컬 개발에서는 각 워크스페이스의 `.env.example`(있을 경우)을 복사하거나, 셸 / Wrangler dev 시크릿 저장소에 정의하세요.

### `apps/worker/android/twa-manifest.json`

The TWA manifest is the **source of truth** for the Android wrapper:

- `packageId` — Android application ID
- `host` and `name` — origin and display name
- `iconUrl`, `splashScreenUrl`, `monochromeIconUrl` — PWA-side assets that the APK references
- `assetLinks` — Digital Asset Links used by Chrome for origin verification

`manifest-checksum.txt` next to it lets the build verify the integrity of the upstream manifest.

---

## Commands Reference / 명령어 레퍼런스

All commands are run from the repository root unless a `--workspace=` is specified.

### Build / 빌드

| Command / 명령어 | Description / 설명 |
| --- | --- |
| `npm run build` | Runs `turbo run build`, then assembles the static distribution into `./dist/`. |
| `npm run build:api` | Builds `packages/types` then `apps/api`. |
| `npm run build:static` | Removes `./dist/` and re-assembles static assets from `apps/worker/out` and `apps/admin/out`. |
| `npm run build:one-worker` | Alias for `build:api`. |

### Develop / 개발

| Command / 명령어 | Description / 설명 |
| --- | --- |
| `npm run dev` | Runs `turbo run dev` across workspaces. |
| `npm run dev --workspace=apps/worker` | Runs the worker PWA dev server only. |

### Quality / 품질

| Command / 명령어 | Description / 설명 |
| --- | --- |
| `npm run lint` | Runs `turbo run lint`. |
| `npm run lint:naming` | Runs the cross-workspace naming lint (`scripts/lint-naming.js`). |
| `npm run typecheck` | Runs `turbo run typecheck`. |
| `npm run format` | Formats `*.{ts,tsx,js,jsx,json,md}` with Prettier. |
| `npm run format:check` | Verifies formatting without modifying files. |
| `npm run check:wrangler-sync` | Checks that `wrangler.toml` is in sync with source-of-truth elsewhere. |
| `npm run git:preflight` | Runs the Go-based git pre-flight checks. |
| `npm run verify` | Runs the Go-based verify suite. |

### Test / 테스트

| Command / 명령어 | Description / 설명 |
| --- | --- |
| `npm run test` | Runs `turbo run test` across workspaces (Vitest). |
| `npm run test:coverage` | Runs tests with `--coverage`. |
| `npm run e2e` | Playwright E2E with secrets from `.env.e2e` via 1Password CLI. |
| `npm run e2e:headed` | Headed Playwright run. |
| `npm run e2e:ui` | Playwright UI mode. |

### Data and deploy / 데이터 및 배포

| Command / 명령어 | Description / 설명 |
| --- | --- |
| `npm run db:generate` | Generates Drizzle artifacts for `apps/api` (migrations, typed client). |
| `npm run deploy:api` | Intentionally disabled — exits non-zero. Deploys are Git-ref driven via CI on `master`. |

### Hooks and housekeeping / 훅 및 정리

| Command / 명령어 | Description / 설명 |
| --- | --- |
| `npm run prepare` | Installs Husky hooks. |
| `npm run clean` | Runs `turbo run clean` and removes `node_modules`. |

### Pre-commit pipeline / Pre-commit 파이프라인

Configured in `package.json#lint-staged`:

- `*.{ts,tsx}` → Go anti-pattern check (`scripts/check-anti-patterns.go`) then Prettier write.
- `*.{js,jsx,json,md}` → Prettier write.

---

## Local Development / 로컬 개발

### Recommended workflow / 권장 워크플로

1. Install dependencies: `npm install`.
2. Run the type check and lint baseline: `npm run typecheck && npm run lint`.
3. Start the worker PWA dev server: `npm run dev --workspace=apps/worker`.
4. Iterate on `apps/worker/src/app/...`. Hot reload is provided by the Next.js dev server.
5. Before opening a PR, run `npm run verify` and `npm run format:check`.

### Per-workspace scripts / 워크스페이스별 스크립트

Each workspace has its own `package.json` with at least `dev`, `build`, `lint`, `typecheck`, and `test`. Use `--workspace=<name>` or `cd` into the workspace:

```bash
npm run dev --workspace=apps/worker
npm run test --workspace=apps/api
```

### Editor setup / 에디터 설정

- Enable TypeScript strict mode (already enforced via each `tsconfig.json`).
- Configure Prettier as the default formatter and enable format-on-save.
- Configure ESLint with the rules referenced by `turbo.json`.

---

## Testing / 테스트

### Unit tests (Vitest) / 단위 테스트

```bash
npm run test                      # all workspaces
npm run test --workspace=apps/worker
npm run test:coverage             # with coverage
```

Vitest configuration lives at the root (`vitest.config.ts`) and per workspace (e.g. `apps/worker/vitest.config.ts`).

### End-to-end tests (Playwright) / E2E 테스트

E2E tests are gated by secrets stored in 1Password and exposed through `.env.e2e`. They are never committed.

```bash
op run --env-file=.env.e2e -- npx playwright test          # headless
npm run e2e:headed                                          # headed browser
npm run e2e:ui                                              # Playwright UI mode
```

`playwright.config.ts` is the root configuration. Add scenarios under a per-workspace `e2e/` directory following the conventions documented in `AGENTS.md`.

---

## Android TWA Build / Android TWA 빌드

The Android wrapper is a **Bubblewrap** Trusted Web Activity project under `apps/worker/android/`. The PWA is wrapped into a native APK that, when installed, opens the Worker PWA full-screen with the Chrome address bar hidden.

### Prerequisites / 사전 준비

- Java JDK 17 or later
- Android SDK with build-tools matching `build.gradle`
- The Worker PWA must be reachable at a public HTTPS origin (Chrome requires it for asset verification)

### Configure / 설정

Edit `apps/worker/android/twa-manifest.json` to set:

- `packageId` — Android application ID
- `host` — the PWA origin (must match `wrangler.toml` routing and `manifest-checksum.txt`)
- `name`, `shortName`, `backgroundColor`, `themeColor`
- `iconUrl`, `splashScreenUrl`, `monochromeIconUrl`
- `assetLinks` — Digital Asset Links JSON used by Chrome for origin verification

The `manifest-checksum.txt` file is used by the build to verify the upstream manifest has not been tampered with.

### Build / 빌드

```bash
cd apps/worker/android
./gradlew assembleRelease
# Output APK appears under app/build/outputs/apk/...
```

For Play Store distribution, use `./gradlew bundleRelease` to produce an AAB.

### Icon and splash resources / 아이콘 및 스플래시 리소스

Icons are pre-baked into multiple density buckets (`mipmap-mdpi` through `mipmap-xxxhdpi`), plus maskable variants and a notification icon. Splash assets are provided per density (`drawable-mdpi` through `drawable-xxxhdpi`). Replace these source images and rebuild to customize branding.

---

## Internationalization / 국제화

The project ships bilingual UI (Korean + English). Implementation details — file layout, message catalog conventions, locale fallbacks — are documented in:

- [`apps/worker/I18N_IMPLEMENTATION.md`](./apps/worker/I18N_IMPLEMENTATION.md)

When adding new strings, follow the conventions in that document. New locale keys should land in both languages. / 새 문자열을 추가할 때는 해당 문서의 규약을 따르고, 두 언어 모두에 키를 등록하세요.

---

## Contribution Guide / 기여 가이드

We welcome contributions. Before opening a pull request, please read:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — workflow, branching, review expectations
- [`CODE_STYLE.md`](./CODE_STYLE.md) — formatting, naming, anti-patterns
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design and boundaries
- [`AGENTS.md`](./AGENTS.md) — operating contract for contributors and automation agents
- [`apps/worker/AGENTS.md`](./apps/worker/AGENTS.md) — worker-app-specific conventions
- [`apps/worker/src/app/AGENTS.md`](./apps/worker/src/app/AGENTS.md) — App Router conventions

### Pre-PR checklist / PR 전 점검

```bash
npm run typecheck
npm run lint
npm run lint:naming
npm run format:check
npm run test
npm run verify
npm run check:wrangler-sync
```

If you changed the database schema, run `npm run db:generate` and commit the generated migration. / 스키마를 변경했다면 `db:generate`를 실행하고 생성된 마이그레이션을 커밋하세요.

### Deploy policy / 배포 정책

Manual deploys are disabled by design (`npm run deploy:api` exits non-zero). Releases are Git-ref driven via CI on `master`. / 수동 배포는 의도적으로 비활성화되어 있으며, 릴리스는 `master` 브랜치 기준 CI의 Git-ref 흐름으로 진행됩니다.

---

## License / 라이선스

Released under the terms described in [`LICENSE`](./LICENSE). / 본 프로젝트는 [`LICENSE`](./LICENSE)에 명시된 조건 하에 배포됩니다.