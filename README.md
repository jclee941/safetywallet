<div align="center">

# SafetyWallet

**건설 현장 안전관리 플랫폼**

현장 근로자의 위험 보고, 출퇴근 관리, 안전 포인트 적립을 하나의 PWA에서.
관리자는 리뷰, 정산, 교육을 대시보드에서 실시간으로 관리합니다.

[![CI](https://github.com/jclee941/safetywallet/actions/workflows/ci.yml/badge.svg)](https://github.com/jclee941/safetywallet/actions/workflows/ci.yml)
![Version](https://img.shields.io/github/v/tag/jclee941/safetywallet?label=version&sort=semver)
![Tests](https://img.shields.io/badge/tests-3%2C521%20passed-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-96%25+-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)

</div>

---

## 핵심 기능

| 근로자 (PWA)                 | 관리자 (Dashboard)          |
| ---------------------------- | --------------------------- |
| 위험 요소 보고 (사진/동영상) | 위험 보고 리뷰 및 승인      |
| 출퇴근 기록 (FAS 연동)       | 출퇴근 통계 및 동기화       |
| 안전 포인트 적립/조회        | 포인트 정산 및 정책 관리    |
| 안전 교육 수강/퀴즈          | 교육 콘텐츠 및 TBM 관리     |
| 추천 투표 참여               | 투표 기간 설정 및 결과 집계 |
| 공지사항 확인                | 공지 작성 (AI 초안 지원)    |
| 오프라인 큐 → 자동 동기화    | 시스템 모니터링 및 알림     |

## 기술 스택

```
Frontend    Next.js 15 (Static Export) · React 19 · Tailwind v4 · Zustand · TanStack Query
Backend     Hono · Drizzle ORM · Cloudflare Workers · D1 (SQLite)
Infra       Cloudflare R2 · KV · Queues · Durable Objects · Workers AI · Hyperdrive
Testing     Vitest · Testing Library · Playwright · 3,521 unit tests · 4 E2E smoke tests
CI/CD       GitHub Actions (15 jobs) · Semantic Versioning · Slack 알림
i18n        ko (기본) · en · vi · zh
```

## 프로젝트 구조

```text
safetywallet/
├── apps/
│   ├── api/          Cloudflare Worker API (Hono + D1)
│   │   ├── routes/   18개 API 모듈 (admin/ 중첩)
│   │   ├── lib/      인증, FAS 연동, R2, 웹 푸시
│   │   ├── jobs/     10개 예약 작업 (cron)
│   │   └── db/       Drizzle 스키마 (34 테이블)
│   ├── admin/        관리자 대시보드 (Next.js, :3001)
│   └── worker/       근로자 PWA (Next.js, :3000)
├── packages/
│   ├── types/        공유 타입, enum, DTO, i18n 데이터
│   └── ui/           공유 UI 컴포넌트 (shadcn/ui)
├── e2e/              Playwright E2E 테스트
├── scripts/          Go/JS 운영 스크립트
└── docs/             PRD, 요구사항 명세
```

## 시작하기

### 요구사항

- Node.js 20+
- npm 9+
- [1Password CLI](https://developer.1password.com/docs/cli/) (E2E 테스트용)

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 (Turborepo 병렬)
npm run dev
# → worker:  http://localhost:3000
# → admin:   http://localhost:3001
# → api:     http://localhost:8787
```

### 주요 명령어

```bash
npm run dev             # 전체 개발 서버
npm run build           # Turborepo 병렬 빌드
npm run typecheck       # 워크스페이스 전체 타입 체크
npm test                # Vitest 전체 실행 (340 파일)
npm run e2e             # Playwright E2E (op run 필요)
npm run verify          # 7단계 검증 파이프라인
npm run format          # Prettier 포매팅
npm run db:generate     # Drizzle 마이그레이션 생성
```

## 아키텍처

### 호스팅 라우팅

단일 Cloudflare Worker가 hostname 기반으로 세 가지 서비스를 라우팅합니다:

```
safetywallet.jclee.me/api/*  →  Hono API
safetywallet.jclee.me/*      →  근로자 PWA (Static)
admin.safetywallet.jclee.me  →  관리자 SPA (Static)
```

### 인증 흐름

```
로그인 → JWT 발급 (KST 당일 자정 만료)
       → 3중 검증: JWT decode → KST 날짜 체크 → KV 캐시 → D1 폴백
       → 3단계 권한: 역할(WORKER/SITE_ADMIN/SUPER_ADMIN) → 사이트 멤버십 → 필드 플래그
```

### 데이터베이스

D1 (SQLite) 기반 34개 테이블, 5개 도메인:

| 도메인      | 테이블 수 | 주요 테이블                             |
| ----------- | --------- | --------------------------------------- |
| 사용자/인증 | 7         | users, sites, sessions, siteMemberships |
| 안전 관리   | 8         | posts, actions, reviews, approvals      |
| 포인트/투표 | 6         | pointTransactions, votes, voteRecords   |
| 출퇴근      | 4         | attendanceRecords, fasEmployeeCache     |
| 교육        | 8         | educationContents, educationQuizzes     |

## CI/CD 파이프라인

```
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
  ├─ Phase 2 (Phase 1 완료 후)
  │   ├── Build (api)           ✓
  │   ├── Build (worker)        ✓
  │   ├── Build (admin)         ✓
  │   ├── E2E Smoke Tests       ✓
  │   └── D1 Migrate            ✓
  │
  └─ Phase 3
      ├── Validate              ✓
      ├── Slack Notification    ✓
      └── Semantic Version      → v{x}.{y}.{z} 태그 생성
```

**Semantic Versioning**: Conventional Commits 기반 자동 버전 관리

- `feat:` → minor bump (0.1.0 → 0.2.0)
- `fix:` / `ci:` / `refactor:` → patch bump (0.2.0 → 0.2.1)
- `BREAKING CHANGE` → major bump

## 테스트

### 단위 테스트

| 워크스페이스           | 파일 | 테스트 수 | 커버리지 | Threshold   |
| ---------------------- | ---- | --------- | -------- | ----------- |
| `@safetywallet/api`    | 102  | 2,207     | 96%+     | 90/85/75/90 |
| `@safetywallet/admin`  | 165  | 818       | 98%+     | 90/85/90/90 |
| `@safetywallet/worker` | 59   | 437       | 98%+     | 90/85/90/90 |
| `@safetywallet/types`  | 5    | 17        | 100%     | 80/80/80/80 |
| `@safetywallet/ui`     | 9    | 42        | 100%     | 80/80/80/80 |

> Threshold 형식: `statements/branches/functions/lines`

### E2E 테스트

Playwright 6개 프로젝트: `admin-setup`, `worker-setup`, `worker-smoke`, `admin-smoke`, `worker`, `admin`

```bash
# 스모크 테스트 (CI)
npx playwright test --project=worker-smoke --project=admin-smoke

# 전체 (1Password 필요)
op run --env-file=.env.e2e -- npx playwright test
```

## 기여 규칙

- **커밋**: Conventional Commits (`type(scope): summary`)
- **머지**: Squash merge only
- **배포**: Cloudflare Git Integration (push to master → 자동 배포)
- **PR 크기**: ~200 LOC 이하 권장
- **타입 안전성**: `as any`, `@ts-ignore`, `@ts-expect-error` 금지
- **브랜치**: trunk-based development (장기 feature 브랜치 금지)

## 라이선스

Private — All rights reserved.
