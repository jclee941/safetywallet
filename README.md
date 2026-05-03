<div align="center">

# SafetyWallet

**건설 현장 안전관리 플랫폼**

현장 근로자의 위험 보고, 출퇴근 관리, 안전 포인트 적립을 하나의 PWA에서 처리합니다.
관리자는 리뷰, 정산, 교육, 모니터링을 대시보드에서 함께 봅니다.

<p align="center">
  <a href="./ARCHITECTURE.md">아키텍처</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./CODE_STYLE.md">코딩 컨벤션</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./.env.example">환경 변수</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./docs/">문서</a>
</p>

<p align="center">
  <a href="https://github.com/jclee941/safetywallet/actions/workflows/ci.yml"><img src="https://github.com/jclee941/safetywallet/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>&nbsp;&nbsp;
  <img src="https://img.shields.io/github/v/tag/jclee941/safetywallet?label=version&sort=semver" alt="Version" />&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/tests-3%2C521%20passed-brightgreen" alt="Tests" />&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/coverage-96%25+-blue" alt="Coverage" />&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

</div>

---

## 핵심 기능

| 근로자 (PWA)                        | 관리자 (Dashboard)                                        |
| ----------------------------------- | --------------------------------------------------------- |
| 위험 요소 보고, 사진 및 동영상 첨부 | 위험 보고 리뷰, 승인, 반려                                |
| 출퇴근 기록, FAS 연동 동기화        | 출퇴근 통계, 동기화 상태 추적                             |
| 안전 포인트 적립, 조회              | 포인트 정산, 정책 관리                                    |
| 안전 교육 수강, 퀴즈 응답           | 교육 콘텐츠, 법정교육 관리                                |
| TBM 참석, 이수 확인                 | TBM 관리, 공지 작성                                       |
| 추천 투표 참여                      | 투표 기간 설정, 결과 집계                                 |
| 공지사항 확인                       | AI 초안 기반 공지 작성                                    |
| 웹 푸시 알림 수신                   | AI 인사이트, 시스템 모니터링, 감사 로그, 동기화 오류 추적 |
| 오프라인 큐 자동 동기화             | 보상 관리, 수동 승인 처리                                 |

## 기술 스택

- **Frontend** — Next.js 15.5.10 (Static Export) · React 18.3.1 · Tailwind v4 · Zustand · TanStack Query
- **Backend** — Hono · Drizzle ORM · Cloudflare Workers · D1 (SQLite)
- **Infra** — Cloudflare R2 · KV · Queues · Durable Objects · Workers AI · Hyperdrive
- **Testing** — Vitest · Testing Library · Playwright · 3,521 unit tests · 341 test files · 4 E2E smoke tests
- **CI/CD** — GitHub Actions (13 jobs) · Semantic Versioning · Slack 알림
- **i18n** — ko (기본) · en · vi · zh

## 프로젝트 구조

```text
safetywallet/
├── apps/
│   ├── api/              Cloudflare Worker API (Hono + D1)
│   │   ├── src/routes/    18개 API 도메인, 133개 모듈
│   │   ├── src/lib/       인증, FAS 연동, R2, 웹 푸시
│   │   ├── src/jobs/      예약 작업, 일간 5개와 월간 5개
│   │   ├── src/db/        Drizzle 스키마, 8개 파일, 34개 테이블
│   │   ├── src/middleware/ CORS, 로깅, 분석, 보안 헤더
│   │   ├── src/validators/ Zod 요청 스키마
│   │   └── src/durable-objects/ RateLimiter, JobScheduler
│   ├── admin/            관리자 대시보드 (Next.js 15, :3001)
│   └── worker/           근로자 PWA (Next.js 15, :3000)
├── packages/
│   ├── types/            공유 타입, enum, DTO, i18n 데이터
│   └── ui/               공유 UI 컴포넌트 (shadcn/ui, 15개)
├── e2e/                  Playwright E2E 테스트 (26개 스펙)
├── scripts/              Go/JS 운영 스크립트
└── docs/                 PRD, 요구사항 명세, 운영 가이드
```

## 시작하기

### 요구사항

- Node.js 20+
- npm 10.8.2
- [1Password CLI](https://developer.1password.com/docs/cli/) (E2E 실행용)

### 환경 설정

> [!TIP]
> `.env.example`을 참고해서 `.env`를 만듭니다. E2E 테스트는 `.env.e2e`와 1Password CLI를 함께 씁니다. Cloudflare 바인딩 값은 `wrangler.toml`에서 확인합니다.

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버, Turborepo 병렬 실행
npm run dev

# worker: http://localhost:3000
# admin:  http://localhost:3001
# api:    http://localhost:8787
```

### 주요 명령어

```bash
npm run dev             # 전체 개발 서버
npm run build           # Turborepo 병렬 빌드
npm run typecheck       # 워크스페이스 전체 타입 체크
npm test                # Vitest 전체 실행 (341 파일)
npm run e2e             # Playwright E2E, op run 필요
npm run verify          # 전체 검증 파이프라인
npm run format          # Prettier 포매팅
npm run db:generate     # Drizzle 마이그레이션 생성
```

## 아키텍처

### 호스팅 라우팅

단일 Cloudflare Worker가 hostname 기준으로 세 서비스를 나눠서 처리합니다.

```text
safetywallet.jclee.me/api/*  → Hono API
safetywallet.jclee.me/*      → 근로자 PWA (Static)
admin.safetywallet.jclee.me  → 관리자 SPA (Static)
```

### 인증 흐름

```text
로그인 → JWT 발급, KST 당일 자정 만료
       → 3중 검증, JWT decode → KST 날짜 체크 → KV 캐시 → D1 폴백
       → 3단계 권한, 역할(WORKER/SITE_ADMIN/SUPER_ADMIN) → 사이트 멤버십 → 필드 플래그
```

### 데이터베이스

D1 (SQLite) 기반 34개 테이블, 8개 도메인입니다.

<details>
<summary><b>D1 (SQLite) 34개 테이블, 8개 도메인</b></summary>

| 도메인      | 테이블 수 | 주요 테이블                                                                                  |
| ----------- | --------: | -------------------------------------------------------------------------------------------- |
| 사용자/인증 |         4 | users, pushSubscriptions, sites, siteMemberships                                             |
| 안전 관리   |         4 | posts, postImages, reviews, pointsLedger                                                     |
| 안전 활동   |         7 | actions, actionImages, auditLogs, announcements, attendance, accessPolicies, manualApprovals |
| 투표/추천   |         5 | votes, voteCandidates, votePeriods, recommendations, disputes                                |
| 교육        |         5 | educationContents, quizzes, quizQuestions, quizAttempts, educationCompletions                |
| 훈련        |         3 | statutoryTrainings, tbmRecords, tbmAttendees                                                 |
| 시스템      |         4 | joinCodeHistory, deviceRegistrations, pointPolicies, syncErrors                              |
| 모니터링    |         2 | apiMetrics, imageAiAnalysis                                                                  |

</details>

### Cloudflare 바인딩

<details>
<summary><b>Cloudflare 바인딩 (11개)</b></summary>

| 바인딩             | 타입             | 용도                                |
| ------------------ | ---------------- | ----------------------------------- |
| DB                 | D1               | 메인 데이터베이스, 34개 테이블      |
| FAS_HYPERDRIVE     | Hyperdrive       | 외부 FAS 직원 DB 연동               |
| ASSETS             | Static Assets    | 정적 프론트엔드, worker + admin SPA |
| R2                 | R2 Bucket        | 사용자 업로드 이미지와 동영상       |
| ACETIME_BUCKET     | R2 Bucket        | 출퇴근 관련 자산                    |
| KV                 | KV Namespace     | 인증 캐시, 시스템 상태              |
| NOTIFICATION_QUEUE | Queue            | 알림 전달 파이프라인                |
| RATE_LIMITER       | Durable Object   | IP, 사용자별 속도 제한              |
| JOB_SCHEDULER      | Durable Object   | 스케줄 작업 관리                    |
| AI                 | Workers AI       | 얼굴 블러, 콘텐츠 분석              |
| ANALYTICS          | Analytics Engine | 요청 분석, 메트릭                   |

</details>

### 데이터 흐름

> [!NOTE]
> **Client → API**: `apiFetch` 래퍼로 auth headers, retry, 401 refresh를 처리합니다.  
> **Offline → reconnect sync**: IndexedDB 큐 `safetywallet_offline_queue`를 재연결 시 동기화합니다.  
> **API → D1**: Drizzle ORM으로 DB binding을 사용합니다.  
> **API → FAS**: Hyperdrive로 외부 직원 DB 동기화를 처리합니다.  
> **API → R2**: 이미지와 동영상을 올리고, Workers AI 얼굴 블러와 perceptual hash 중복 제거를 적용합니다.  
> **API → KV**: 세션 캐시와 시스템 상태 플래그를 저장합니다.  
> **API → Queue**: 알림 전달을 하고, 실패 시 DLQ로 넘깁니다.  
> **Observability**: Analytics Engine으로 요청 메트릭을 모읍니다.

## CI/CD 파이프라인

```text
Push to master
  │
  ├─ Phase 1 (병렬)
  │   ├── Lint & Typecheck      ✓
  │   ├── Config Guards         ✓
  │   ├── Code Quality          ✓
  │   ├── Unit Tests (3,521)    ✓
  │   ├── Security Audit        ✓
  │   └── Secrets Scan          ✓
  │
  ├─ Phase 2 (단일 build matrix job, 3개 entry)
  │   ├── Build matrix: api     ✓
  │   ├── Build matrix: worker   ✓
  │   ├── Build matrix: admin    ✓
  │   ├── E2E Smoke Tests        ✓
  │   └── D1 Migrate             ✓
  │
  └─ Phase 3
      ├── Validate               ✓
      ├── Slack Notification     ✓
      └── Semantic Version       → v{x}.{y}.{z} 태그 생성
```

Semantic Versioning은 Conventional Commits를 기준으로 자동 처리합니다.

- `feat:`는 minor bump
- `fix:` / `ci:` / `refactor:`는 patch bump
- `BREAKING CHANGE`는 major bump

## 테스트

### 단위 테스트

| 워크스페이스           | 테스트 파일 | 테스트 수 | 커버리지 | 기준        |
| ---------------------- | ----------: | --------: | -------- | ----------- |
| `@safetywallet/api`    |         102 |     2,207 | 96%+     | 90/85/75/90 |
| `@safetywallet/admin`  |         166 |       818 | 98%+     | 90/85/90/90 |
| `@safetywallet/worker` |          59 |       437 | 98%+     | 90/85/90/90 |
| `@safetywallet/types`  |           5 |        17 | 100%     | 80/80/80/80 |
| `@safetywallet/ui`     |           9 |        42 | 100%     | 80/80/80/80 |

전체 합계는 3,521개 테스트, 341개 테스트 파일입니다.

> 기준 형식: `statements/branches/functions/lines`

### E2E 테스트

Playwright 스펙 파일은 26개입니다.

- admin 15개
- worker 11개

Playwright 프로젝트는 6개입니다.

- `admin-setup`
- `worker-setup`
- `worker-smoke`
- `admin-smoke`
- `worker`
- `admin`

```bash
# 스모크 테스트, CI용
npx playwright test --project=worker-smoke --project=admin-smoke

# 전체 실행, 1Password 필요
op run --env-file=.env.e2e -- npx playwright test
```

## 기여 규칙

- **커밋**: Conventional Commits (`type(scope): summary`)
- **머지**: Squash merge only
- **배포**: Cloudflare Git Integration, push to master 시 자동 배포
- **PR 크기**: 200 LOC 이하 권장
- **타입 안전성**: `as any`, `@ts-ignore`, `@ts-expect-error` 금지
- **브랜치**: trunk-based development, 장기 feature 브랜치 금지

## 라이선스

Private. All rights reserved.

<!-- LLM final probe 1777812018 -->
