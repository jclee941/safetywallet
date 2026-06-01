# SafetyWallet

> 건설 현장 안전 관리 플랫폼 / Construction Site Safety Management Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.8.2-orange.svg)](https://pnpm.io/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-red.svg)](https://workers.cloudflare.com/)

---

## 목차 / Table of Contents

- [개요 / Overview](#개요--overview)
- [주요 기능 / Features](#주요-기능--features)
- [아키텍처 / Architecture](#아키텍처--architecture)
- [자동화 인벤토리 / Automation Inventory](#자동화-인벤토리--automation-inventory)
- [빠른 시작 / Quick Start](#빠른-시작--quick-start)
- [로컬 개발 / Local Development](#로컬-개발--local-development)
- [명령어 참조 / Commands Reference](#명령어-참조--commands-reference)
- [기여 가이드 / Contributing Guide](#기여-가이드--contributing-guide)

---

## 개요 / Overview

**SafetyWallet**은 건설 현장의 안전 관리와 현장 인력의 효율적인 소통을 위한 통합 플랫폼입니다.

**SafetyWallet** is an integrated platform for construction site safety management and efficient communication with field workers.

- **현장 근무자 (Worker)**: 모바일 PWA를 통해 위험 보고, 출석 체크, 안전 점수 적립
- **현장 관리자 (Site Admin)**: 리뷰审核, 정산, compliance 관리
- **시스템**: 단일 Cloudflare Worker가 호스트네임 라우팅으로 Hono API + 2개 Next.js 정적 프론트엔드提供服务

- **Field Workers (Worker)**: Report hazards, log attendance, and earn safety points via mobile PWA
- **Site Admins (Site Admin)**: Manage reviews, settlements, and compliance via dashboard
- **System**: Single Cloudflare Worker serves Hono API and two statically-exported Next.js frontends via hostname routing

### 기술 스택 / Tech Stack

| Layer | Technology |
|-------|------------|
| **API** | Hono + Drizzle ORM + D1 (Cloudflare) |
| **Frontend** | Next.js 15 (App Router, Static Export) |
| **Styling** | Tailwind CSS v4 + shadcn/ui components |
| **Database** | Cloudflare D1 (SQLite) |
| **Storage** | Cloudflare R2 |
| **Runtime** | Cloudflare Workers |
| **Monorepo** | Turborepo + pnpm workspace |

---

## 주요 기능 / Features

### 안전 관리 / Safety Management

- [x] 위험 요소 신고 및 사진 업로드
- [x] 안전 점수 시스템 (포인트 적립/차감)
- [x] 현장 안전 교육 콘텐츠
- [x] 퀴즈 및 교육 이수 관리

- [x] Hazard reporting with photo upload
- [x] Safety points system (award/deduct)
- [x] Safety education content
- [x] Quiz and training completion tracking

### 출석 및 근태 / Attendance & Timekeeping

- [x] GPS 기반 현장 체크인/체크아웃
- [x] 근태 통계 대시보드
- [x] FAS 연동 급여 정산

- [x] GPS-based site check-in/check-out
- [x] Attendance statistics dashboard
- [x] FAS integration for payroll settlement

### 현장 소통 / Site Communication

- [x] 공지사항 게시
- [x] 투표 및 찬반 기능
- [x] 리뷰 시스템
- [x] 다국어 지원 (ko, en, vi, zh)

- [x] Announcement postings
- [x] Voting system
- [x] Review system
- [x] Multi-language support (ko, en, vi, zh)

### 권한 관리 / Access Control

- [x] JWT 기반 인증 (KST 자정 만료)
- [x] 3단계 권한 모델 (WORKER, SITE_ADMIN, SUPER_ADMIN, SYSTEM)
- [x] 현장별 멤버십 관리
- [x] 필드 단위 권한 플래그 (canAwardPoints, canReview, canExportData)

- [x] JWT authentication (KST midnight expiry)
- [x] Three-tier permission model (WORKER, SITE_ADMIN, SUPER_ADMIN, SYSTEM)
- [x] Site-specific membership management
- [x] Field-level permission flags (canAwardPoints, canReview, canExportData)

---

## 아키텍처 / Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Edge                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              safetywallet-api (Hono Worker)              │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │   API    │  │  Static App  │  │   Static Admin   │   │   │
│  │  │ :8787    │  │ worker.*     │  │ admin.*          │   │   │
│  │  └──────────┘  └──────────────┘  └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │              │                    │                  │
│    ┌────┴────┐    ┌────┴────┐          ┌────┴────┐            │
│    │   D1    │    │   R2    │          │   KV    │            │
│    │ (SQLite)│    │ (Assets)│          │ (Cache) │            │
│    └─────────┘    └─────────┘          └─────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 디렉토리 구조 / Directory Structure

```
safetywallet/
├── apps/
│   ├── api/                 # Cloudflare Worker API (Hono + Drizzle + D1)
│   │   ├── src/routes/      # 18 API route modules (admin/ nested)
│   │   ├── src/lib/         # Auth, helpers, FAS integration, R2
│   │   ├── src/middleware/  # CORS, logging, analytics, security headers
│   │   ├── src/db/          # Drizzle schema (34 tables), seed, helpers
│   │   ├── src/durable-objects/ # RateLimiter, JobScheduler DOs
│   │   ├── src/jobs/        # 10 scheduled cron jobs
│   │   ├── src/validators/  # Zod request schemas
│   │   └── migrations/      # 31 D1 SQL migrations
│   ├── admin/               # Next.js 15 admin dashboard (port 3001, static export)
│   │   └── src/app/         # App Router: attendance, posts, votes, education
│   └── worker/              # Next.js 15 worker PWA (port 3000, static export)
│       ├── src/app/         # App Router: login, posts, attendance, education
│       ├── src/i18n/        # Custom i18n runtime (ko, en, vi, zh)
│       └── src/components/  # Worker-specific UI components
├── packages/
│   ├── types/               # Shared TS types, enums, DTOs, i18n translation data
│   │   └── src/
│   │       ├── dto/         # Data Transfer Objects per domain
│   │       └── i18n/        # Translation strings (ko.ts)
│   └── ui/                  # Shared shadcn/ui components + Tailwind v4 theme tokens
├── scripts/                 # Go/JS tooling (verify, naming lint, anti-pattern checks)
├── e2e/                     # Playwright E2E tests (auth setup, admin, worker flows)
├── .github/workflows/      # 33 GitHub Actions workflows
├── wrangler.toml           # Root CF Worker config + all bindings
├── turbo.json              # Turborepo pipeline (types → ui → apps)
└── playwright.config.ts    # 6 Playwright projects
```

### Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 | Primary database (34 tables, SQLite via Drizzle) |
| `FAS_HYPERDRIVE` | Hyperdrive | External FAS employee database |
| `ASSETS` | Workers Static Assets | Static frontend files |
| `R2` | R2 | User-uploaded images and videos |
| `ACETIME_BUCKET` | R2 | Attendance-related assets |
| `KV` | KV | Auth cache, system status, config |
| `NOTIFICATION_QUEUE` / `NOTIFICATION_DLQ` | Queue | Notification delivery pipeline |
| `RATE_LIMITER` | Durable Object | Rate limiting per client |

---

## 자동화 인벤토리 / Automation Inventory

### GitHub Actions 워크플로우 / Workflows

본 프로젝트는 **33개 GitHub Actions 워크플로우**로 자동화되어 있습니다.

This project is automated with **33 GitHub Actions workflows**.

#### CI/CD 파이프라인 / CI/CD Pipeline

| 파일명 | 설명 |
|--------|------|
| `ci.yml` | 메인 CI 파이프라인 (lint → typecheck → test → build) |
| `standard-ci.yml` | 표준 CI 템플릿 |
| `labeler.yml` | 파일 경로 기반 자동 라벨링 |

#### Pull Request 자동화 / Pull Request Automation

| 파일명 | 설명 |
|--------|------|
| `01_branch-to-pr.yml` | 브랜치 → PR 자동 생성 |
| `02_issue-to-branch.yml` | 이슈 → 브랜치 자동 생성 |
| `03_pr-checks.yml` | PR 필수 체크 실행 |
| `04_actionlint.yml` | GitHub Actions YAML 검증 |
| `09_semantic-pr.yml` | semantic PR 규칙 검증 |
| `10_pr-review.yml` | PR 자동 리뷰 (qodo-ai/pr-agent) |
| `13_pr-auto-merge.yml` | PR 자동 병합 |
| `14_bot-auto-fix.yml` | 봇 수정 자동 적용 |
| `15_merged-pr-cleanup.yml` | 병합 후 브랜치 정리 |
| `security/11_pr-review.yml` | 보안 리뷰 워크플로우 |

#### 의존성 관리 / Dependency Management

| 파일명 | 설명 |
|--------|------|
| `07_dependency-review.yml` | 의존성 보안 검토 |
| `12_dependabot-auto-merge.yml` | Dependabot 자동 병합 |

#### 보안 스캐닝 / Security Scanning

| 파일명 | 설명 |
|--------|------|
| `05_gitleaks.yml` | Secrets 스캐닝 |
| `06_codeql.yml` | 코드 품질 분석 |
| `08_scorecard.yml` | OpenSSF Scorecard |

#### 이슈 관리 / Issue Management

| 파일명 | 설명 |
|--------|------|
| `18_issue-management.yml` | 이슈 자동 관리 |
| `19_issue-backfill.yml` | 이슈 백필 |
| `37_ci-failure-issues.yml` | CI 실패 시 이슈 생성 |

#### 문서 자동화 / Documentation Automation

| 파일명 | 설명 |
|--------|------|
| `20_readme-gen.yml` | README 자동 생성 |
| `21_docs-sync.yml` | 문서 동기화 |
| `42_reusable-docs-sync.yml` | 재사용可能な 문서 동기화 |

#### 릴리스 및 배포 / Release & Deploy

| 파일명 | 설명 |
|--------|------|
| `24_release-notes.yml` | 릴리스 노트 생성 |
| `25_release-publish.yml` | 릴리스 게시 |

#### 다운스트림 모니터링 / Downstream Monitoring

| 파일명 | 설명 |
|--------|------|
| `29_downstream-health-check.yml` | 하위 서비스 상태 확인 |

#### 자동 복구 / Auto Healing

| 파일명 | 설명 |
|--------|------|
| `60_ci-auto-heal.yml` | CI 실패 자동 복구 |

#### 환영 인사 / Welcome

| 파일명 | 설명 |
|--------|------|
| `welcome.yml` | 신규 기여자 환영 인사 |

#### 재사용 가능한 워크플로우 / Reusable Workflows

| 파일명 | 설명 |
|--------|------|
| `43_reusable-issue-management.yml` | 이슈 관리 재사용 워크플로우 |
| `44_reusable-pr-checks.yml` | PR 체크 재사용 워크플로우 |
| `45_reusable-gitleaks.yml` | Gitleaks 재사용 워크플로우 |

### 자동화 도구 / Automation Tools

#### 스크립트 도구 / Script Tools

| 도구 | 언어 | 용도 |
|------|------|------|
| `scripts/verify.go` | Go | 빌드 및 배포 검증 |
| `scripts/git-preflight.go` | Go | Git preflight 체크 |
| `scripts/check-anti-patterns.go` | Go | 안티 패턴 검사 |
| `scripts/check-wrangler-sync.js` | Node.js | wrangler.toml 동기화 확인 |
| `scripts/lint-naming.js` | Node.js | 명명 규칙 린트 |

#### AI 리뷰 시스템 / AI Review System

| 도구 | 용도 |
|------|------|
| **qodo-ai/pr-agent** | Pull Request 자동 리뷰 및 분석 |
| **minimax-m2.7** | README 생성 (Primary model) |
| **gpt-5.5** | README 생성 (Fallback model, via CLIProxyAPI) |

#### 자동화 프록시 / Automation Proxy

| 도구 | URL | 용도 |
|------|-----|------|
| CLIProxyAPI | [cliproxy.jclee.me](https://cliproxy.jclee.me) | AI 모델 페일오버 라우팅 |
| Bot Service | [bot.jclee.me](https://bot.jclee.me) | 봇 명령어 처리 |

---

## 빠른 시작 / Quick Start

### 전제 조건 / Prerequisites

- Node.js >= 20.0.0
- pnpm 10.8.2
- Wrangler CLI (`npx wrangler`)
- Cloudflare 계정

### 설치 / Installation

```bash
# 저장소 클론
git clone <repository-url>
cd safetywallet

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env.local
```

### 개발 서버 시작 / Start Development Server

```bash
# 전체 개발 서버 (API + Admin + Worker)
pnpm dev

# 개별 앱만 실행
pnpm dev --filter=api
pnpm dev --filter=worker
pnpm dev --filter=admin
```

### 빌드 / Build

```bash
# 전체 빌드
pnpm build

# API만 빌드
pnpm build:api

# 정적 파일만 빌드
pnpm build:static
```

---

## 로컬 개발 / Local Development

### 환경 변수 / Environment Variables

`.env.local` 파일 생성:

```env
# Database
DB=/path/to/local.db

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# Auth
JWT_SECRET=your_jwt_secret

# FAS Integration
FAS_API_URL=https://fas.example.com
FAS_API_KEY=your_fas_key
```

### 데이터베이스 마이그레이션 / Database Migration

```bash
# 마이그레이션 생성
pnpm db:generate

# 마이그레이션 적용 (로컬)
wrangler d1 migrations apply safetywallet --local

# 마이그레이션 적용 (프로덕션)
wrangler d1 migrations apply safetywallet --remote
```

### 테스트 실행 / Run Tests

```bash
# 모든 테스트
pnpm test

# 커버리지 포함
pnpm test:coverage

# 특정 패키지 테스트
pnpm test --filter=types
pnpm test --filter=ui
```

### E2E 테스트 / E2E Testing

```bash
# E2E 테스트 실행
pnpm e2e

# 헤드리스 모드
pnpm e2e:headed

# Playwright UI
pnpm e2e:ui
```

### 코드 품질 / Code Quality

```bash
# 린트 실행
pnpm lint

# 타입 체크
pnpm typecheck

# 포맷터 체크
pnpm format:check

# 네이밍 규칙 검사
pnpm lint:naming
```

---

## 명령어 참조 / Commands Reference

### 패키지 관리 / Package Management

| 명령어 | 설명 |
|--------|------|
| `pnpm install` | 의존성 설치 |
| `pnpm clean` | node_modules 및 dist 삭제 |

### 빌드 명령어 / Build Commands

| 명령어 | 설명 |
|--------|------|
| `pnpm build` | 전체 빌드 (turbo + static) |
| `pnpm build:api` | API 패키지 빌드 (types → api) |
| `pnpm build:static` | 정적 파일 빌드 및 배포 폴더 준비 |
| `pnpm build:one-worker` | 단일 Worker 빌드 |

### 개발 명령어 / Development Commands

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 전체 개발 서버 실행 |
| `pnpm dev --filter=<app>` | 특정 앱만 개발 서버 실행 |

### 테스트 명령어 / Test Commands

| 명령어 | 설명 |
|--------|------|
| `pnpm test` | 모든 테스트 실행 |
| `pnpm test:coverage` | 커버리지 포함 테스트 |
| `pnpm typecheck` | TypeScript 타입 체크 |
| `pnpm lint` | ESLint 실행 |

### 데이터베이스 명령어 / Database Commands

| 명령어 | 설명 |
|--------|------|
| `pnpm db:generate` | Drizzle 마이그레이션 생성 |

### 코드 품질 명령어 / Code Quality Commands

| 명령어 | 설명 |
|--------|------|
| `pnpm format` | Prettier 포맷팅 (쓰기) |
| `pnpm format:check` | Prettier 포맷팅 (체크) |
| `pnpm lint:naming` | 네이밍 규칙 검사 |

### 배포 명령어 / Deploy Commands

| 명령어 | 설명 |
|--------|------|
| `pnpm deploy:api` | API 배포 (비활성화됨 - Git-ref 기반 CI 배포) |

### 유틸리티 명령어 / Utility Commands

| 명령어 | 설명 |
|--------|------|
| `pnpm check:wrangler-sync` | wrangler.toml 동기화 확인 |
| `pnpm git:preflight` | Git preflight 체크 |
| `pnpm verify` | 빌드 검증 스크립트 |

---

## 기여 가이드 / Contributing Guide

### Workflow 개발 가이드 / Workflow Development Guide

#### 새 워크플로우 추가 / Adding New Workflows

1. `.github/workflows/` 디렉토리에 새 YAML 파일 생성
2. 파일명 형식: `NN_<purpose>.yml` (NN은 순번)
3. `actionlint.yml`로 구문 검증
4. 필수环境保护变量 문서화

### 코드 스타일 가이드 / Code Style Guide

자세한 내용은 [CODE_STYLE.md](./CODE_STYLE.md)를 참조하세요.

### 커밋 메시지 규칙 / Commit Message Rules

- **Conventional Commits** 사용
- 타입: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`
- 예: `feat: add attendance GPS tracking`

### Pull Request 프로세스 / Pull Request Process

1. 브랜치 생성: `git checkout -b feature/my-feature`
2. 변경 사항 커밋
3. PR 템플릿 작성
4. 자동화 체크 대기 (CI 통과 필수)
5. 리뷰 요청 → 병합

### 자동화 기여 / Automation Contributions

#### Bot 명령어 사용 / Using Bot Commands

бот команда어: `@bot help`

#### AI 리뷰 요청 / Requesting AI Review

PR에 라벨 `review` 추가하면 qodo-ai/pr-agent가 자동 리뷰 수행

### 문서 자동화 / Documentation Automation

README.md는 자동으로 생성됩니다:

- **트리거**: main 브랜치 병합 시, 또는 `README-gen` 워크플로우 수동 실행
- **모델**: minimax-m2.7 (Primary), gpt-5.5 via CLIProxyAPI (Fallback)
- **설정**: `.github/workflows/20_readme-gen.yml`

### 보안 취약점 보고 / Reporting Security Vulnerabilities

보안 관련 문제는 비공개로 신고해주세요:

- Email: <security@example.com> (예시)
- GitHub Security Advisories 사용

---

## 라이선스 / License

MIT License - 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.

---

## 연락처 / Contact

- 프로젝트 URL: [safetywallet.io](https://safetywallet.io)
- 이슈 Tracker: [GitHub Issues](https://github.com/<owner>/<repo>/issues)

---

_이 README는 `20_readme-gen.yml` 워크플로우에 의해 자동 생성되었습니다._

_This README was auto-generated by the `20_readme-gen.yml` workflow._
