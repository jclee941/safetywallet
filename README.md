# SafetyWallet

> 현장 작업자가 위험 요인을 신고하고 안전 점수를 적립하는 모바일 PWA 기반 작업장 안전 관리 SaaS.
> A workplace safety SaaS: mobile-PWA hazard reporting, attendance, and safety points for field workers.

## 한 줄 요약 / At a glance

| 항목 / Item | 값 / Value |
| --- | --- |
| 이름 / Name | SafetyWallet |
| 버전 / Version | `0.1.0` (private) |
| 상태 / Status | 운영 중 · Active |
| 노드 / Node | `>=20.0.0` |
| 패키지 매니저 | `npm@10.8.2` (workspaces) |
| 스택 / Stack | TypeScript · Hono · Drizzle · Next.js 15 · Cloudflare Workers · D1 |
| 데이터 계층 | D1(주 DB) · R2 · Hyperdrive · KV · Queue · Durable Objects |
| 프런트엔드 | Next.js 15 정적 내보내기 — 워커 PWA `3000`, 관리자 콘솔 `3001` |
| 모바일 | PWA + Android TWA (`apps/worker/android/`) |
| 테스트 | Vitest(단위) · Playwright(E2E, 6 프로젝트) |
| 배포 | Git-ref 기반 CI(master) — 수동 배포 비활성 |
| 다국어 / i18n | ko · en · vi · zh (자체 런타임) |
| 라이선스 | [`LICENSE`](./LICENSE) 참조 |

## 핵심 흐름 / Core flow

1. 작업자가 Android TWA 또는 PWA로 로그인 → JWT 발급(KST 자정 만료), Zustand에 저장.
2. 출퇴근·위험 신고·안전 교육 이수·안전 점수 적립.
3. 현장 관리자가 `admin` 콘솔로 검토·승인·정산·데이터 내보내기.
4. 단일 Cloudflare Worker가 호스트명 라우팅으로 API와 두 개의 정적 SPA를 제공.
5. 알림은 R2 업로드 후 `NOTIFICATION_QUEUE` → `NOTIFICATION_DLQ` 파이프라인으로 비동기 전송.

## 목차 / Table of contents

- [프로젝트 목적 / Purpose](#프로젝트-목적--purpose)
- [패키지 구성 / Package contents](#패키지-구성--package-contents)
- [주요 기능 / Features](#주요-기능--features)
- [아키텍처 / Architecture](#아키텍처--architecture)
- [API와 진입점 / API & entry points](#api와-진입점--api--entry-points)
- [빠른 시작 / Quickstart](#빠른-시작--quickstart)
- [환경 설정 / Configuration](#환경-설정--configuration)
- [명령어 / Commands](#명령어--commands)
- [로컬 개발 / Local development](#로컬-개발--local-development)
- [테스트 / Testing](#테스트--testing)
- [기여 / Contributing](#기여--contributing)
- [유지보수자 / Maintainers](#유지보수자--maintainers)
- [추가 문서 / Further documentation](#추가-문서--further-documentation)
- [라이선스 / License](#라이선스--license)

## 프로젝트 목적 / Purpose

SafetyWallet은 건설·제조 등 산업 현장의 안전 관리를 모바일 1등 시민(worker) 경험으로 만드는 데 초점을 맞춘 SaaS입니다.

- 4단 역할 모델: `WORKER`, `SITE_ADMIN`, `SUPER_ADMIN`, `SYSTEM`.
- 클라이언트는 정적 내보내기(Static Export)된 Next.js 15 PWA, 백엔드는 Cloudflare Worker의 Hono API + D1.
- 단일 Worker가 호스트명 기반으로 두 개의 프런트엔드와 API를 동시에 제공.
- D1·R2·KV·Queue·Durable Object 등 Cloudflare 네이티브 자원으로 비용과 지연을 낮춤.

## 패키지 구성 / Package contents

| 경로 / Path | 설명 / Description |
| --- | --- |
| `apps/api/` | Hono 기반 Cloudflare Worker API. Drizzle 스키마(34 테이블), 31개 SQL 마이그레이션, 10개 cron 잡. |
| `apps/admin/` | Next.js 15 관리자 콘솔. 포트 `3001`, 정적 내보내기. |
| `apps/worker/` | Next.js 15 워커 PWA. 포트 `3000`, 정적 내보내기 + Android TWA 래퍼. |
| `apps/worker/android/` | Bubblewrap 기반 Android TWA. 패키지 `me.jclee.safetywallet.twa`. |
| `packages/types/` | 공용 TypeScript 타입, 열거형, DTO, i18n 번역 원본. |
| `packages/ui/` | 공용 shadcn/ui 컴포넌트 + Tailwind v4 테마 토큰. |
| `docs/` | PRD, 요구사항 명세, 운영 런북. |
| `e2e/` | Playwright E2E — 인증 셋업, admin, worker 플로우. |
| `scripts/` | 보조 도구 — `verify.go`, `lint-naming.js`, `check-anti-patterns.go`, `check-wrangler-sync.js`, `git-preflight.go`. |
| `.github/workflows/` | CI: lint → typecheck → 가드 → test → build → migrate. |
| `wrangler.toml` | 루트 Cloudflare Worker 설정 + 모든 바인딩. |
| `turbo.json` | Turborepo 파이프라인 (`types → ui → apps`). |
| `playwright.config.ts` | 6개 Playwright 프로젝트 정의. |
| `vitest.config.ts` | 단위 테스트 설정. |

루트에는 위 워크스페이스 외에 `AGENTS.md`, `ARCHITECTURE.md`, `CODE_STYLE.md`, `CONTRIBUTING.md`, `LICENSE`, `package.json`, `package-lock.json`이 있습니다.

## 주요 기능 / Features

- **인증 / Auth**: JWT(로그인 시 KST 자정 만료), 3단 권한(역할 · 현장 멤버십 · 필드 플래그), Zustand 영속 스토어, 401 리프레시 mutex. 클라이언트 스토리지 키 — 워커 `safetywallet-auth`, 관리자 `safetywallet-admin-auth`.
- **모바일 PWA**: 출퇴근, 위험 신고, 안전 교육 이수, 안전 점수 적립. 오프라인 친화 정적 자산.
- **Android TWA**: `apps/worker/android/`의 Bubblewrap 래퍼와 `twa-manifest.json` 사용.
- **관리자 콘솔**: 신고 검토, 정산, 데이터 내보내기, 교육 관리.
- **알림 파이프라인**: 업로드 → R2 → `NOTIFICATION_QUEUE` → DLQ.
- **외부 시스템**: Hyperdrive로 사내 FAS 직원 DB 조회.
- **다국어**: ko · en · vi · zh. 자체 i18n 런타임 (`apps/worker/src/i18n/`).
- **스케줄 잡**: 10개 cron 잡 — 정산·알림 정리 등.
- **관측 가능성**: 구조화 로깅·분석·보안 헤더·CORS 미들웨어.

## 아키텍처 / Architecture

### Cloudflare 바인딩 / Bindings

| 바인딩 / Binding | 종류 / Type | 용도 / Purpose |
| --- | --- | --- |
| `DB` | D1 | 주 데이터베이스(34 테이블, Drizzle ORM). |
| `FAS_HYPERDRIVE` | Hyperdrive | 사내 FAS 직원 DB로의 읽기 전용 연결. |
| `ASSETS` | Workers Static Assets | 워커 PWA·관리자 정적 자산. |
| `R2` | R2 | 사용자