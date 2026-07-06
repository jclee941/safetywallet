# SafetyWallet

[![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Hono%20%7C%20Next.js%2015%20%7C%20Cloudflare%20Workers-blue)]()
[![Package Manager](https://img.shields.io/badge/packageManager-npm%4010.8.2-orange)]()
[![Node](https://img.shields.io/badge/node-%3E%3D20-green)]()
[![License](https://img.shields.io/badge/license-see%20LICENSE-lightgrey)](LICENSE)

## 한 줄 요약

SafetyWallet은 현장 근로자용 모바일 PWA와 관리자 대시보드를 한 개의 Cloudflare Worker 위에서 운영하는 클라우드 네이티브 안전관리 플랫폼입니다.
작업자는 위험요인을 신고하고 근태를 기록하며 안전 포인트를 적립하고, 관리자는 검토·정산·컴플라이언스를 한 화면에서 처리합니다.

## One-line summary

SafetyWallet is a cloud-native workplace safety platform that pairs a field-worker mobile PWA with an admin dashboard, served by a single Cloudflare Worker hosting the Hono API and two statically-exported Next.js frontends.

## 상태 / Status

| 영역 | 상태 |
| --- | --- |
| 런타임 | Cloudflare Workers + D1 + Drizzle |
| 프런트엔드 | Next.js 15 (apps/worker, apps/admin) 정적 export |
| 모바일 래퍼 | Bubblewrap 기반 Trusted Web Activity (`apps/worker/android`) |
| 인증 | JWT (KST 자정 만료) + KV 캐시 + D1 폴백 |
| 데이터베이스 | D1(SQLite) + Drizzle ORM |
| 저장소 | R2(업로드), KV(캐시/설정), Queue(알림) |
| 패키지 관리 | npm workspaces + Turborepo |
| 테스트 | Vitest + Playwright (6 프로젝트) |
| 다국어 | 런타임 i18n (ko, en, vi, zh) |
| 배포 | master Git-ref 기반 CI 자동 배포 (수동 배포 차단) |
| 운영 준비도 | Active · 60+ 개의 `AGENTS.md` 컨텍스트 문서 |

## 런타임 흐름 / Runtime flow

| 단계 | 무슨 일이 일어나는가 | 누가 보는가 |
| --- | --- | --- |
| 1 | 작업자 모바일 PWA 로그인 → JWT 발급 | 작업자 |
| 2 | JWT KST 자정 만료 + KV 캐시 적재, 3단 검증 | API |
| 3 | 위험요인 신고·근태 기록·교육 이수 | 작업자 |
| 4 | 업로드 본문·이미지 R2 저장, 메타는 D1 기록 | API |
| 5 | 알림 Queue → 푸시/Webhook 처리 | 알림 워커 |
| 6 | 관리자 대시보드에서 검토·포인트 정산·내보내기 | 현장/최고 관리자 |
| 7 | Hyperdrive를 통해 외부 FAS 사원 DB 조회 | 시스템 |
| 8 | 야간 cron 잡으로 마감·집계·만료 처리 | 시스템 (DO/JOB_SCHEDULER) |

진입점: Hono 앱 `apps/api/src/index.ts`, 작업자 PWA `apps/worker`, 관리자 SPA `apps/admin`.
운영자가 가장 먼저 만지는 명령은 `npm run verify` 와 `npm run check:wrangler-sync` 입니다.

## 목차 / Contents

1. [목적 / Purpose](#목적--purpose)
2. [패키지 구성 / Package contents](#패키지-구성--package-contents)
3. [처음 읽을 파일 / First files to read](#처음-읽을-파일--first-files-to-read)
4. [API 및 엔드포인트 / API & entry points](#api-및-엔드포인트--api--entry-points)
5. [빠른 시작 / Quickstart](#빠른-시작--quickstart)
6. [구성 / Configuration](#구성--configuration)
7. [명령어 / Commands](#명령어--commands)
8. [로컬 개발 / Local development](#로컬-개발--local-development)
9. [테스트 / Testing](#테스트--testing)
10. [기여 / Contribution](#기여--contribution)
11. [운영자 및 연락처 / Maintainers & contact](#운영자-및-연락처--maintainers--contact)
12. [추가 문서 / Further documentation](#추가-문서--further-documentation)
13. [라이선스 / License](#라이선스--license)

---

## 목적 / Purpose

SafetyWallet은 건설·현장 산업의 안전관리 운영을 한 곳에서 묶기 위한 제품입니다.

- 작업자: 모바일 PWA로 즉시 위험요인을 사진과 함께 신고하고, 출퇴근 근태를 기록하며, 안전 교육 이수로 포인트를 적립합니다.
- 현장 관리자: 대시보드에서 신고를 검토하고 등급을 매기며, 작업자에게 안전 포인트를 부여하고 정산합니다.
- 최고 관리자 / 시스템: 사이트 멤버십과 역할 기반 권한을 관리하고, 컴플라이언스 데이터를 내보내며, 시스템 설정을 운영합니다.

운영 상태: 본 저장소는 **Active**. `master` 브랜치 푸시 후 CI(lint → typecheck → guards → test → build → migrate)를 통과하면 Cloudflare Workers에 Git-ref 방식으로 자동 배포됩니다. 수동 `wrangler deploy`는 의도적으로 비활성화되어 있습니다 (`npm run deploy:api` 가 명시적으로 실패합니다).

## 패키지 구성 / Package contents

| 경로 | 역할 |
| --- | --- |
| `apps/api/` | Cloudflare Worker API (Hono + Drizzle + D1), 18개 라우트 모듈 |
| `apps/admin/` | Next.js 15 관리자 대시보드 (port 3001, 정적 export) |
| `apps/worker/` | Next.js 15 작업자 PWA (port 3000, 정적 export) + Android TWA |
| `packages/types/` | 공유 TS 타입, enum, DTO, i18n 번역 데이터 |
| `packages/ui/` | 공유 shadcn/ui 컴포넌트 + Tailwind v4 테마 토큰 |
| `docs/` | PRD, 요구사항 명세, 운영 런북 |
| `scripts/` | Go/JS 검증 도구 (`verify`, `lint-naming`, `check-anti-patterns`) |
| `e2e/` | Playwright E2E (인증 셋업, 관리자/작업자 흐름) |
| `.github/workflows/` | CI/CD 파이프라인 정의 |
| `wrangler.toml` | 루트 Cloudflare Worker 설정 + 모든 바인딩 |
| `turbo.json` | Turborepo 파이프라인 (types → ui → apps) |
| `playwright.config.ts` | 6개 Playwright 프로젝트 |
| `vitest.config.ts` | 워크스페이스 공통 Vitest 설정 |

저장소 최상위 트리 (`package.json` workspaces 및 `AGENTS.md` 기준):

```text
.
├── apps/
│   ├── api/                # Cloudflare Worker API
│   ├── admin/              # 관리자 대시보드 SPA
│   └── worker/             # 작업자 PWA + Android TWA
│       └── android/        # Bubblewrap TWA 프로젝트
├── packages/
│   ├── types/              # 공유 타입 / DTO / i18n 사전
│   └── ui/                 # 공유 UI 토큰 / 컴포넌트
├── docs/                   # PRD, 운영 런북
├── scripts/                # Go/JS 검증 도구
├── e2e/                    # Playwright E2E
├── .github/workflows/      # CI/CD
├── AGENTS.md               # AI/에이전트 진입 인덱스
├── ARCHITECTURE.md         # 상세 아키텍처
├── CODE_STYLE.md           # 네이밍·디렉터리 규약
├── CONTRIBUTING.md         # PR 절차
├── LICENSE
├── README.md
├── package.json            # npm workspaces 루트
├── package-lock.json
├── playwright.config.ts
├── turbo.json
├── vitest.config.ts
└── wrangler.toml           # Cloudflare 바인딩 단일 진실
```

## 처음 읽을 파일 / First files to read

새로 합류한 운영자/개발자는 아래 순서로 읽는 것을 권장합니다.

| 순서 | 파일 | 이유 |
| --- | --- | --- |
| 1 | [README.md](README.md) | 제품 개요와 진입점 |
| 2 | [ARCHITECTURE.md](ARCHITECTURE.md) | 컴포넌트 경계와 데이터 흐름 |
| 3 | [AGENTS.md](AGENTS.md) | 60+ `AGENTS.md`로 이어지는 인덱스 |
| 4 | [CODE_STYLE.md](CODE_STYLE.md) | 네이밍·디렉터리 규약 |
| 5 | [CONTRIBUTING.md](CONTRIBUTING.md) | 브랜치, 커밋, PR 절차 |
| 6 | [LICENSE](LICENSE) | 라이선스 조건 |
| 7 | `wrangler.toml` | 환경 바인딩 단일 진실 공급원 |

## API 및 엔드포인트 / API & entry points

진입점: 단일 Worker가 호스트 이름으로 두 정적 SPA와 API를 라우팅합니다 (`wrangler.toml` 참조).

| 엔드포인트 종류 | 위치 | 사용처 |
| --- | --- | --- |
| 모바일 작업자 | Worker PWA `apps/worker` | 작업자 모바일·Android TWA |
| 관리 콘솔 | Admin SPA `apps/admin` | 현장/최고 관리자 |
| REST API | Hono 앱 `apps/api/src/index.ts` | 두 프런트엔드 + 외부 연동 |

인증/권한 핵심 규칙:

- 발급: 로그인 성공 시 JWT, 만료시각은 한국 시각(KST) 당일 자정.
- 검증: JWT 디코드 → KST 날짜 검사 → KV 캐시 → D1 폴백의 3단 검증.
- 권한: 역할(`WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`) → 사이트 멤버십 → 필드 플래그(`canAwardPoints`, `canReview`, `canExportData` 등).
- 클라이언트: Zustand 영속 스토어 + 401 리프레시 mutex. 작업자 키 `safetywallet-auth`, 관리자 키 `safetywallet-admin-auth`.

Cloudflare 바인딩 (요약):

| 바인딩 | 종류 | 용도 |
| --- | --- | --- |
| `DB` | D1 | 주 데이터베이스 (Drizzle) |
| `FAS_HYPERDRIVE` | Hyperdrive | 외부 FAS 사원 DB 조회 |
| `ASSETS` | Workers Static Assets | 정적 프런트엔드 자산 |
| `R2` | R2 | 사용자 업로드 이미지/영상 |
| `ACETIME_BUCKET` | R2 | 근태 관련 자산 |
| `KV` | KV | 인증 캐시, 시스템 상태, 설정 |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | Queue | 알림 전송 파이프라인 |
| `RATE_LIMITER` | Durable Object | 요청 레이트 리미트 |
| `JOB_SCHEDULER` | Durable Object | cron 잡 스케줄링 |

배치 잡: `apps/api/src/jobs/` 에 10개의 cron 잡이 정의되어 있으며, 마감·집계·만료·외부 연동 동기화를 담당합니다.

## 빠른 시작 / Quickstart

요구 사항: Node 20+, npm 10.8+, Cloudflare 계정 (개발/배포 시), Playwright 브라우저 (E2E 시).

```bash
# 1. 의존성 설치 (npm workspaces)
npm install

# 2. wrangler.toml ↔ 코드 동기화 검사
npm run check:wrangler-sync

# 3. 사전 검증 (네이밍 + 안티 패턴 + Git preflight)
npm run verify

# 4. 로컬 개발 서버 (Turborepo로 워크스페이스 동시 실행)
npm run dev
```

로컬 기본 포트:

| 워크스페이스 | 포트 | 비고 |
| --- | --- | --- |
| `apps/worker` | 3000 | 작업자 PWA |
| `apps/admin` | 3001 | 관리자 대시보드 |
| `apps/api` | wrangler 로컬 | Workers 런타임 |
| `packages/ui` | (없음) | 빌드 산출물만 노출 |

## 구성 / Configuration

Cloudflare 바인딩과 환경 변수의 단일 진실은 `wrangler.toml` 입니다. 코드와 어긋나면 `npm run check:wrangler-sync` 가 실패합니다.

| 항목 | 위치 | 비고 |
| --- | --- | --- |
| Cloudflare 바인딩 | `wrangler.toml` | D1, R2, KV, Queue, Durable Object, Hyperdrive |
| 환경 변수 | 워크스페이스별 `.env*` | E2E는 1Password CLI (`op run`) 로 주입 |
| Drizzle 스키마 | `apps/api/src/db/schema/` | 34 테이블 정의 |
| 마이그레이션 | `apps/api/migrations/` | D1 SQL 31개 |
| i18n 사전 | `packages/types` 내 번역 데이터 | ko, en, vi, zh |
| 테마 토큰 | `packages/ui` | Tailwind v4 디자인 토큰 |
| Android TWA 빌드 | `apps/worker/android/twa-manifest.json`, `build.gradle` | Bubblewrap 산출물 |

## 명령어 / Commands

루트 `package.json` 기준 운영자가 자주 쓰는 명령입니다.

| 명령 | 역할 |
| --- | --- |
| `npm run dev` | 워크스페이스 전체 개발 서버 (Turborepo) |
| `npm run build` | 전체 빌드 + 정적 export 묶기 (`dist/`) |
| `npm run build:api` | `packages/types` → `apps/api` 빌드만 |
| `npm run build:one-worker` | 운영용 단일 Worker 빌드 |
| `npm run build:static` | `apps/worker/out` + `apps/admin/out` → `dist/` |
| `npm run lint` | 워크스페이스 lint |
| `npm run lint:naming` | 네이밍 규약 검사 (`scripts/lint-naming.js`) |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run test` | 워크스페이스 유닛 테스트 (Vitest) |
| `npm run test:coverage` | 커버리지 포함 Vitest |
| `npm run e2e` | Playwright E2E (1Password 주입) |
| `npm run e2e:headed` | 헤드 모드 Playwright |
| `npm run e2e:ui` | Playwright UI 모드 |
| `npm run check:wrangler-sync` | `wrangler.toml` ↔ 코드 동기화 검사 |
| `npm run git:preflight` | Git pre-flight (Go) |
| `npm run verify` | 전체 사전 검증 (네이밍 + preflight + anti-pattern) |
| `npm run format` / `format:check` | Prettier 적용 / 검사 |
| `npm run db:generate` | Drizzle 스키마 → SQL 생성 |
| `npm run clean` | 산출물 + `node_modules` 정리 |
| `npm run deploy:api` | (의도적으로 실패) 수동 배포 차단 |

## 로컬 개발 / Local development

| 작업 | 명령 | 메모 |
| --- | --- | --- |
| 새 워크스페이스 추가 | `mkdir apps/<name> && npm init -w` | `apps/*` workspaces 가 자동 인식 |
| 공유 타입 변경 | `npm run build -w packages/types` | 다른 워크스페이스가 의존 |
| UI 토큰 변경 | `npm run build -w packages/ui` | 디자인 토큰 재빌드 |
| 스키마 변경 | `apps/api/src/db/schema/*` 편집 → `npm run db:generate` | 마이그레이션 SQL 도 함께 PR |
| 새 환경 추가 | `wrangler.toml` 신규 env 블록 | `check:wrangler-sync` 로 검증 |
| Husky pre-commit | `prepare` 단계에서 자동 설치 | staged 파일 lint + format 적용 |
| Android TWA 빌드 | `apps/worker/android/` (Bubblewrap) | `gradle`/`twa-manifest.json` 확인 |

## 테스트 / Testing

| 종류 | 도구 | 위치 | 실행 |
| --- | --- | --- | --- |
| 유닛 / 통합 | Vitest | 각 워크스페이스 | `npm run test` |
| 커버리지 | Vitest + v8 | 유닛과 동일 | `npm run test:coverage` |
| E2E | Playwright | `e2e/` | `npm run e2e` |
| 타입 검사 | TypeScript | 워크스페이스 전반 | `npm run typecheck` |
| 정적 규약 | Prettier + custom lint | 전 파일 | `npm run lint` / `format:check` |
| 안티 패턴 | Go 스크립트 | `scripts/` | pre-commit, `verify` |

E2E는 1Password CLI를 통해 `.env.e2e` 를 주입합니다. 운영자는 사전에 `op` 로그인이 필요하며, 미로그인 시 시크릿 주입 단계에서 실패합니다.

## 기여 / Contribution

1. 먼저 이슈를 열거나 연결된 이슈를 확인합니다.
2. 대상 워크스페이스의 `AGENTS.md` 또는 모듈별 가이드를 읽습니다 (저장소 컨벤션: 워크스페이스마다 `AGENTS.md` 를 둡니다).
3. 브랜치 명명 규약은 [CONTRIBUTING.md](CONTRIBUTING.md) 를 따릅니다.
4. 커밋 전 `npm run verify` 통과를 권장합니다.
5. PR은 CI(lint → typecheck → guards → test → build → migrate)가 모두 통과해야 머지 가능합니다.

## 운영자 및 연락처 / Maintainers & contact

| 역할 | 어디서 |
| --- | --- |
| 제품/엔지니어링 책임 | [CONTRIBUTING.md](CONTRIBUTING.md) 의 책임자 섹션 |
| 인시던트 / 온콜 | `docs/` 하위 운영 런북 |
| 보안 이슈 | 비공개 채널 우선 — 공개 이슈 트래커에 비밀을 올리지 마세요 |

## 추가 문서 / Further documentation

| 문서 | 위치 |
| --- | --- |
| 아키텍처 상세 | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 코딩 규약 | [CODE_STYLE.md](CODE_STYLE.md) |
| 기여 절차 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| AI / 에이전트 컨텍스트 | [AGENTS.md](AGENTS.md) |
| 라이선스 | [LICENSE](LICENSE) |
| PRD / 요구사항 / 런북 | `docs/` |
| i18n 구현 메모 | [`apps/worker/I18N_IMPLEMENTATION.md`](apps/worker/I18N_IMPLEMENTATION.md) |
| Android TWA 설정 | [`apps/worker/android/`](apps/worker/android) |
| 작업자 워크스페이스 규약 | [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md) |

## 라이선스 / License

이 저장소는 [LICENSE](LICENSE) 파일의 조건에 따라 배포됩니다.