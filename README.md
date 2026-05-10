<think>
The user wants me to generate a README.md for a repository called "SafetyWallet" - a construction site safety management platform. Let me analyze the project structure and package.json to understand the full scope.

Key observations:
1. It's a monorepo with npm workspaces (apps/* and packages/*)
2. Uses Turborepo for build orchestration
3. Has multiple components:
   - Worker PWA (apps/worker)
   - Admin Dashboard (apps/admin)
   - API (apps/api)
   - Shared types (packages/types)
4. Tech stack includes:
   - React 18.3.1
   - TypeScript
   - Playwright for e2e tests
   - Vitest for testing
   - Cloudflare Workers (wrangler.toml)
5. E2E tests for both admin and worker
6. Go scripts for various operations
7. CI/CD with GitHub Actions

From the existing README.md content, I can see:
- Construction site safety management platform
- Features for workers (PWA) and admins (Dashboard)
- Status badges showing CI, version, tests, coverage, TypeScript

Let me generate a comprehensive but concise README in Korean as requested.
</think>

# SafetyWallet

**건설 현장 안전관리 플랫폼**

현장 근로자의 위험 보고, 출퇴근 관리, 안전 포인트 적립을 하나의 PWA에서 처리합니다. 관리자는 리뷰, 정산, 교육, 모니터링을 대시보드에서 함께 봅니다.

<p align="center">
  <a href="./ARCHITECTURE.md">아키텍처</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./CODE_STYLE.md">코딩 컨벤션</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./docs/">문서</a>
</p>

<p align="center">
  <a href="https://github.com/jclee941/safetywallet/actions/workflows/ci.yml"><img src="https://github.com/jclee941/safetywallet/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>&nbsp;&nbsp;
  <img src="https://img.shields.io/github/v/tag/jclee941/safetywallet?label=version&sort=semver" alt="Version" />&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

---

## 핵심 기능

| 근로자 (PWA) | 관리자 (Dashboard) |
|---|---|
| 위험 요소 보고 (사진/동영상 첨부) | 위험 보고 리뷰, 승인, 반려 |
| 출퇴근 기록, FAS 연동 동기화 | 출퇴근 통계, 동기화 상태 추적 |
| 안전 포인트 적립, 조회 | 포인트 정산, 정책 관리 |
| 안전 교육 수강, 퀴즈 응답 | 교육 콘텐츠, 법정교육 관리 |
| TBM 참석, 이수 확인 | TBM 관리, 공지 작성 |
| 추천 투표 참여 | 투표 기간 설정, 결과 집계 |
| 공지사항 확인 | AI 초안 기반 공지 작성 |
| 웹 푸시 알림 수신 | AI 인사이트, 시스템 모니터링 |
| 오프라인 큐 자동 동기화 | 감사 로그, 보상 관리 |

---

## 기술 스택

**Frontend**
- React 18 + TypeScript (strict mode)
- PWA (오프라인 지원)
- TanStack Query (데이터 페칭)
- Playwright (E2E 테스트)

**Backend**
- Cloudflare Workers (API)
- Hono Framework
- Drizzle ORM
- PostgreSQL

**Infrastructure**
- Turborepo (모노레포 빌드)
- Cloudflare (호스팅)
- GitHub Actions (CI/CD)

**Testing**
- Vitest (유닛/통합 테스트)
- Playwright (E2E 테스트)

---

## 프로젝트 구조

```
/
├── apps/
│   ├── admin/       # 관리자 대시보드 (React PWA)
│   ├── api/         # Cloudflare Workers API
│   └── worker/      # 근로자 PWA (React)
├── packages/
│   └── types/       # 공유 TypeScript 타입 정의
├── e2e/
│   ├── admin/       # 관리자 E2E 테스트
│   ├── worker/      # 근로자 E2E 테스트
│   └── auth/        # 인증 관련 테스트 헬퍼
├── scripts/         # CI/CD 및 개발 스크립트 (Go)
├── docs/            # 프로젝트 문서
└── _bot-scripts/    # AI PR 리뷰 봇
```

---

## 설치

```bash
# 의존성 설치
npm install

# Husky 훅 설정
npm run prepare
```

---

## 개발

```bash
# 전체 개발 서버 실행
npm run dev

# 개별 앱 개발
npm run dev --workspace=apps/worker
npm run dev --workspace=apps/admin
npm run dev --workspace=apps/api
```

---

## 빌드

```bash
# 전체 빌드 (정적 파일 포함)
npm run build

# API만 빌드
npm run build:api

# 정적 파일 생성
npm run build:static
```

---

## 테스트

```bash
# 전체 테스트 실행
npm run test

# 테스트 커버리지
npm run test:coverage

# E2E 테스트
npm run e2e

# E2E 테스트 (headed 모드)
npm run e2e:headed

# E2E 테스트 (UI 모드)
npm run e2e:ui
```

---

## 코드 품질

```bash
# TypeScript 타입 체크
npm run typecheck

# 린트 실행
npm run lint

# 코드 포맷팅
npm run format

# 포맷팅 확인만
npm run format:check
```

---

## 배포

> ⚠️ **참고**: API 배포는 Git-ref 기반 CI/CD로 자동화되어 있습니다. `master` 브랜치에 Merge 시 자동으로 배포됩니다.

수동 배포는 비활성화되어 있습니다.

```bash
npm run deploy:api
# Manual deploy is disabled. Deploy is Git-ref driven via CI on master.
```

---

## 기여

기여를 환영합니다. 자세한 내용은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참조하세요.

---

## 라이선스

MIT License. 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.