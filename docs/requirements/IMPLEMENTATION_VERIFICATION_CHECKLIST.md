# SafetyWallet 구현 검증 체크리스트

> **생성일**: 2026-03-03
> **기준 브랜치**: master
> **작성 근거**: 실제 코드베이스 탐색 결과 기반 (glob, AST, file read)

---

## 목차

1. [API 라우트 및 엔드포인트](#1-api-라우트-및-엔드포인트)
2. [미들웨어 체인](#2-미들웨어-체인)
3. [데이터베이스 스키마](#3-데이터베이스-스키마)
4. [인증 및 권한](#4-인증-및-권한)
5. [Worker PWA (현장근로자 앱)](#5-worker-pwa-현장근로자-앱)
6. [Admin Dashboard (관리자 앱)](#6-admin-dashboard-관리자-앱)
7. [공유 패키지](#7-공유-패키지)
8. [Cloudflare 바인딩 및 인프라](#8-cloudflare-바인딩-및-인프라)
9. [테스트 커버리지](#9-테스트-커버리지)
10. [CI/CD 파이프라인](#10-cicd-파이프라인)
11. [보안](#11-보안)
12. [운영 및 모니터링](#12-운영-및-모니터링)
13. [미해결 항목 및 기술 부채](#13-미해결-항목-및-기술-부채)

---

## 1. API 라우트 및 엔드포인트

### 1.1 인증 (auth/) — 8 파일

| #     | 검증 항목                | 파일                   | 상태 | 비고                  |
| ----- | ------------------------ | ---------------------- | ---- | --------------------- |
| 1.1.1 | 근로자 로그인 (FAS 연동) | `auth/login-worker.ts` | [ ]  | FAS Hyperdrive 경유   |
| 1.1.2 | 관리자 로그인            | `auth/login-admin.ts`  | [ ]  |                       |
| 1.1.3 | 로그인 라우터 통합       | `auth/login.ts`        | [ ]  | worker/admin 분기     |
| 1.1.4 | 회원가입                 | `auth/register.ts`     | [ ]  |                       |
| 1.1.5 | 비밀번호 관리            | `auth/password.ts`     | [ ]  | 변경/초기화           |
| 1.1.6 | 세션 관리                | `auth/session.ts`      | [ ]  | 토큰 갱신/검증        |
| 1.1.7 | 계정 잠금                | `auth/lockout.ts`      | [ ]  | 로그인 실패 횟수 제한 |
| 1.1.8 | auth 라우터 통합         | `auth/index.ts`        | [ ]  | 하위 라우트 마운트    |

### 1.2 출석/근태 (attendance/) — 2 파일

| #     | 검증 항목        | 파일                   | 상태 | 비고        |
| ----- | ---------------- | ---------------------- | ---- | ----------- |
| 1.2.1 | 출퇴근 기록 CRUD | `attendance/routes.ts` | [ ]  | QR/GPS 기반 |
| 1.2.2 | 라우터 통합      | `attendance/index.ts`  | [ ]  |             |

### 1.3 안전활동 (actions/) — 4 파일

| #     | 검증 항목          | 파일                      | 상태 | 비고      |
| ----- | ------------------ | ------------------------- | ---- | --------- |
| 1.3.1 | 활동 CRUD          | `actions/crud-routes.ts`  | [ ]  |           |
| 1.3.2 | 활동 이미지 업로드 | `actions/image-routes.ts` | [ ]  | R2 업로드 |
| 1.3.3 | 헬퍼 함수          | `actions/helpers.ts`      | [ ]  |           |
| 1.3.4 | 라우터 통합        | `actions/index.ts`        | [ ]  |           |

### 1.4 게시글 (posts/) — 4 파일

| #     | 검증 항목   | 파일                    | 상태 | 비고          |
| ----- | ----------- | ----------------------- | ---- | ------------- |
| 1.4.1 | 게시글 CRUD | `posts/crud-routes.ts`  | [ ]  |               |
| 1.4.2 | 미디어 첨부 | `posts/media-routes.ts` | [ ]  | 이미지/동영상 |
| 1.4.3 | 헬퍼 함수   | `posts/helpers.ts`      | [ ]  |               |
| 1.4.4 | 라우터 통합 | `posts/index.ts`        | [ ]  |               |

### 1.5 교육 (education/) — 7 파일

| #     | 검증 항목             | 파일                         | 상태 | 비고 |
| ----- | --------------------- | ---------------------------- | ---- | ---- |
| 1.5.1 | 교육 콘텐츠 관리      | `education/contents.ts`      | [ ]  |      |
| 1.5.2 | 퀴즈 관리             | `education/quizzes.ts`       | [ ]  |      |
| 1.5.3 | 퀴즈 응시             | `education/quiz-attempts.ts` | [ ]  |      |
| 1.5.4 | 법정교육              | `education/statutory.ts`     | [ ]  |      |
| 1.5.5 | TBM (작업전 안전회의) | `education/tbm.ts`           | [ ]  |      |
| 1.5.6 | 헬퍼 함수             | `education/helpers.ts`       | [ ]  |      |
| 1.5.7 | 라우터 통합           | `education/index.ts`         | [ ]  |      |

### 1.6 단독 라우트 모듈 — 13 파일

| #      | 검증 항목     | 파일                 | 상태 | 비고       |
| ------ | ------------- | -------------------- | ---- | ---------- |
| 1.6.1  | 결재/승인     | `approvals.ts`       | [ ]  |            |
| 1.6.2  | 포인트        | `points.ts`          | [ ]  |            |
| 1.6.3  | 투표          | `votes.ts`           | [ ]  |            |
| 1.6.4  | 현장 관리     | `sites.ts`           | [ ]  |            |
| 1.6.5  | 이미지 업로드 | `images.ts`          | [ ]  | R2 연동    |
| 1.6.6  | 이의제기      | `disputes.ts`        | [ ]  |            |
| 1.6.7  | 리뷰          | `reviews.ts`         | [ ]  |            |
| 1.6.8  | 사용자 관리   | `users.ts`           | [ ]  |            |
| 1.6.9  | FAS 연동      | `fas.ts`             | [ ]  | Hyperdrive |
| 1.6.10 | 공지사항      | `announcements.ts`   | [ ]  |            |
| 1.6.11 | 알림          | `notifications.ts`   | [ ]  | Push/Queue |
| 1.6.12 | 정책 관리     | `policies.ts`        | [ ]  |            |
| 1.6.13 | 추천          | `recommendations.ts` | [ ]  |            |

### 1.7 관리자 API (admin/) — 16 파일 + 하위 모듈

| #      | 검증 항목          | 파일                       | 상태 | 비고 |
| ------ | ------------------ | -------------------------- | ---- | ---- |
| 1.7.1  | 관리자 라우터 통합 | `admin/index.ts`           | [ ]  |      |
| 1.7.2  | 근태 관리          | `admin/attendance.ts`      | [ ]  |      |
| 1.7.3  | 투표 관리          | `admin/votes.ts`           | [ ]  |      |
| 1.7.4  | 통계               | `admin/stats.ts`           | [ ]  |      |
| 1.7.5  | 트렌드 분석        | `admin/trends.ts`          | [ ]  |      |
| 1.7.6  | 알림 설정          | `admin/alerting.ts`        | [ ]  |      |
| 1.7.7  | 분배 관리          | `admin/distributions.ts`   | [ ]  |      |
| 1.7.8  | 접근 정책          | `admin/access-policies.ts` | [ ]  |      |
| 1.7.9  | 정산               | `admin/settlements.ts`     | [ ]  |      |
| 1.7.10 | 추천 관리          | `admin/recommendations.ts` | [ ]  |      |
| 1.7.11 | 동기화 오류        | `admin/sync-errors.ts`     | [ ]  |      |
| 1.7.12 | 이미지 관리        | `admin/images.ts`          | [ ]  |      |
| 1.7.13 | 모니터링           | `admin/monitoring.ts`      | [ ]  |      |
| 1.7.14 | 감사 로그          | `admin/audit.ts`           | [ ]  |      |
| 1.7.15 | 데이터 내보내기    | `admin/export.ts`          | [ ]  |      |
| 1.7.16 | 헬퍼               | `admin/helpers.ts`         | [ ]  |      |

### 1.8 관리자 게시글 (admin/posts/) — 5 파일

| #     | 검증 항목   | 파일                               | 상태 | 비고 |
| ----- | ----------- | ---------------------------------- | ---- | ---- |
| 1.8.1 | 게시글 목록 | `admin/posts/list-routes.ts`       | [ ]  |      |
| 1.8.2 | 게시글 검수 | `admin/posts/moderation-routes.ts` | [ ]  |      |
| 1.8.3 | 리뷰 처리   | `admin/posts/review-handlers.ts`   | [ ]  |      |
| 1.8.4 | 삭제 처리   | `admin/posts/delete-handlers.ts`   | [ ]  |      |
| 1.8.5 | 라우터 통합 | `admin/posts/index.ts`             | [ ]  |      |

### 1.9 관리자 사용자 (admin/users/) — 2 파일

| #     | 검증 항목          | 파일                    | 상태 | 비고 |
| ----- | ------------------ | ----------------------- | ---- | ---- |
| 1.9.1 | 사용자 관리 라우트 | `admin/users/routes.ts` | [ ]  |      |
| 1.9.2 | 라우터 통합        | `admin/users/index.ts`  | [ ]  |      |

### 1.10 관리자 FAS (admin/fas/) — 6 파일

| #      | 검증 항목         | 파일                               | 상태 | 비고         |
| ------ | ----------------- | ---------------------------------- | ---- | ------------ |
| 1.10.1 | Hyperdrive 라우트 | `admin/fas/hyperdrive-routes.ts`   | [ ]  | MariaDB 연결 |
| 1.10.2 | 쿼리 라우트       | `admin/fas/query-routes.ts`        | [ ]  |              |
| 1.10.3 | 근로자 동기화     | `admin/fas/sync-workers-routes.ts` | [ ]  |              |
| 1.10.4 | 헬퍼/타입         | `admin/fas/helpers.ts`, `types.ts` | [ ]  |              |
| 1.10.5 | 라우터 통합       | `admin/fas/index.ts`               | [ ]  |              |

---

## 2. 미들웨어 체인

**실행 순서**: initFasConfig → securityHeaders → requestLoggerMiddleware → analyticsMiddleware → honoLogger → dynamic CORS

| #   | 검증 항목                  | 파일                             | 상태 | 비고                  |
| --- | -------------------------- | -------------------------------- | ---- | --------------------- |
| 2.1 | 인증 미들웨어              | `middleware/auth.ts`             | [ ]  | JWT 검증, 세션 관리   |
| 2.2 | 권한 미들웨어              | `middleware/permission.ts`       | [ ]  | 역할 기반 접근 제어   |
| 2.3 | 분석 미들웨어              | `middleware/analytics.ts`        | [ ]  | Analytics Engine 연동 |
| 2.4 | 보안 헤더                  | `middleware/security-headers.ts` | [ ]  | CSP, HSTS 등          |
| 2.5 | 근태 미들웨어              | `middleware/attendance.ts`       | [ ]  | 출석 검증             |
| 2.6 | 요청 속도 제한             | `middleware/rate-limit.ts`       | [ ]  | Durable Object 연동   |
| 2.7 | 요청 로거                  | `middleware/request-logger.ts`   | [ ]  | 구조화된 로깅         |
| 2.8 | 미들웨어 체인 순서 검증    | `apps/api/src/index.ts`          | [ ]  | 6단계 순서 준수 확인  |
| 2.9 | 미들웨어 단위 테스트 (7개) | `middleware/__tests__/`          | [ ]  | 각 미들웨어별 테스트  |

---

## 3. 데이터베이스 스키마

### 3.1 테이블 (32개)

| #      | 테이블명              | 검증 항목                                 | 상태 |
| ------ | --------------------- | ----------------------------------------- | ---- |
| 3.1.1  | `users`               | 사용자 정보 (이름, 역할, FAS ID, 기기 등) | [ ]  |
| 3.1.2  | `pushSubscriptions`   | 웹 푸시 구독                              | [ ]  |
| 3.1.3  | `sites`               | 현장 정보 (이름, 코드, 위치)              | [ ]  |
| 3.1.4  | `siteMemberships`     | 현장-사용자 매핑                          | [ ]  |
| 3.1.5  | `posts`               | 게시글 (제목, 내용, 상태, 카테고리)       | [ ]  |
| 3.1.6  | `postImages`          | 게시글 첨부 이미지                        | [ ]  |
| 3.1.7  | `reviews`             | 게시글 리뷰/검수                          | [ ]  |
| 3.1.8  | `pointsLedger`        | 포인트 원장 (적립/차감/정산)              | [ ]  |
| 3.1.9  | `actions`             | 안전활동 기록                             | [ ]  |
| 3.1.10 | `actionImages`        | 안전활동 첨부 이미지                      | [ ]  |
| 3.1.11 | `auditLogs`           | 감사 로그                                 | [ ]  |
| 3.1.12 | `announcements`       | 공지사항                                  | [ ]  |
| 3.1.13 | `attendance`          | 출퇴근 기록                               | [ ]  |
| 3.1.14 | `accessPolicies`      | 접근 정책                                 | [ ]  |
| 3.1.15 | `manualApprovals`     | 수동 승인                                 | [ ]  |
| 3.1.16 | `votes`               | 투표                                      | [ ]  |
| 3.1.17 | `voteCandidates`      | 투표 후보자                               | [ ]  |
| 3.1.18 | `votePeriods`         | 투표 기간                                 | [ ]  |
| 3.1.19 | `recommendations`     | 추천                                      | [ ]  |
| 3.1.20 | `disputes`            | 이의제기                                  | [ ]  |
| 3.1.21 | `joinCodeHistory`     | 가입코드 이력                             | [ ]  |
| 3.1.22 | `deviceRegistrations` | 기기 등록                                 | [ ]  |
| 3.1.23 | `pointPolicies`       | 포인트 정책                               | [ ]  |
| 3.1.24 | `educationContents`   | 교육 콘텐츠                               | [ ]  |
| 3.1.25 | `quizzes`             | 퀴즈                                      | [ ]  |
| 3.1.26 | `quizQuestions`       | 퀴즈 문항                                 | [ ]  |
| 3.1.27 | `quizAttempts`        | 퀴즈 응시 기록                            | [ ]  |
| 3.1.28 | `statutoryTrainings`  | 법정교육                                  | [ ]  |
| 3.1.29 | `tbmRecords`          | TBM 기록                                  | [ ]  |
| 3.1.30 | `tbmAttendees`        | TBM 참석자                                | [ ]  |
| 3.1.31 | `syncErrors`          | 동기화 오류                               | [ ]  |
| 3.1.32 | `apiMetrics`          | API 메트릭                                | [ ]  |

### 3.2 DB 인프라

| #     | 검증 항목           | 상태 | 비고                    |
| ----- | ------------------- | ---- | ----------------------- |
| 3.2.1 | Enum 정의 (21개)    | [ ]  | 역할, 상태, 카테고리 등 |
| 3.2.2 | 인덱스 (~45개)      | [ ]  | 성능 최적화 인덱스      |
| 3.2.3 | 릴레이션 맵         | [ ]  | FK 관계 정의            |
| 3.2.4 | 마이그레이션 (16개) | [ ]  | `apps/api/migrations/`  |
| 3.2.5 | DB 헬퍼 함수        | [ ]  | `db/helpers.ts`         |
| 3.2.6 | 스키마 단위 테스트  | [ ]  | `db/__tests__/`         |

---

## 4. 인증 및 권한

| #    | 검증 항목                              | 상태 | 비고                              |
| ---- | -------------------------------------- | ---- | --------------------------------- |
| 4.1  | FAS 로그인 연동 (Hyperdrive → MariaDB) | [ ]  | 외부 DB 인증                      |
| 4.2  | JWT 토큰 발급/검증                     | [ ]  |                                   |
| 4.3  | 세션 갱신 (토큰 리프레시)              | [ ]  |                                   |
| 4.4  | 로그인 실패 잠금 (lockout)             | [ ]  | 횟수 제한 + 잠금 해제             |
| 4.5  | 비밀번호 변경/초기화                   | [ ]  |                                   |
| 4.6  | 역할 기반 접근 제어 (worker/admin)     | [ ]  | `permission.ts`                   |
| 4.7  | 기기 등록/핑거프린팅                   | [ ]  | `deviceRegistrations` 테이블      |
| 4.8  | 접근 정책 관리                         | [ ]  | `accessPolicies` 테이블           |
| 4.9  | 감사 로그 기록                         | [ ]  | 인증 이벤트 추적                  |
| 4.10 | 보호된 엔드포인트 접근 차단 테스트     | [ ]  | E2E `protected-endpoints.spec.ts` |

---

## 5. Worker PWA (현장근로자 앱)

### 5.1 페이지 (16개 라우트)

| #      | 검증 항목     | 라우트                 | 상태 | 비고       |
| ------ | ------------- | ---------------------- | ---- | ---------- |
| 5.1.1  | 랜딩 페이지   | `/`                    | [ ]  |            |
| 5.1.2  | 홈 화면       | `/home`                | [ ]  | 대시보드   |
| 5.1.3  | 로그인        | `/login`               | [ ]  | FAS 로그인 |
| 5.1.4  | 회원가입      | `/register`            | [ ]  |            |
| 5.1.5  | 프로필        | `/profile`             | [ ]  |            |
| 5.1.6  | 공지사항 목록 | `/announcements`       | [ ]  |            |
| 5.1.7  | 안전활동 목록 | `/actions`             | [ ]  |            |
| 5.1.8  | 안전활동 상세 | `/actions/view`        | [ ]  |            |
| 5.1.9  | 투표          | `/votes`               | [ ]  |            |
| 5.1.10 | 게시글 목록   | `/posts`               | [ ]  |            |
| 5.1.11 | 게시글 작성   | `/posts/new`           | [ ]  |            |
| 5.1.12 | 게시글 상세   | `/posts/view`          | [ ]  |            |
| 5.1.13 | 포인트        | `/points`              | [ ]  |            |
| 5.1.14 | 교육 목록     | `/education`           | [ ]  |            |
| 5.1.15 | 교육 상세     | `/education/view`      | [ ]  |            |
| 5.1.16 | 퀴즈 응시     | `/education/quiz-take` | [ ]  |            |

### 5.2 Hooks (14개)

| #      | 검증 항목                        | 상태 | 비고              |
| ------ | -------------------------------- | ---- | ----------------- |
| 5.2.1  | `use-api` / `use-api-base`       | [ ]  | API 클라이언트    |
| 5.2.2  | `use-auth`                       | [ ]  | 인증 상태 관리    |
| 5.2.3  | `use-attendance-api`             | [ ]  | 출퇴근 API        |
| 5.2.4  | `use-actions-api`                | [ ]  | 안전활동 API      |
| 5.2.5  | `use-posts-api`                  | [ ]  | 게시글 API        |
| 5.2.6  | `use-education-api`              | [ ]  | 교육 API          |
| 5.2.7  | `use-recommendations-api`        | [ ]  | 추천 API          |
| 5.2.8  | `use-leaderboard`                | [ ]  | 리더보드          |
| 5.2.9  | `use-system-api`                 | [ ]  | 시스템 API        |
| 5.2.10 | `use-translation` / `use-locale` | [ ]  | i18n              |
| 5.2.11 | `use-install-prompt`             | [ ]  | PWA 설치 프롬프트 |
| 5.2.12 | `use-push-subscription`          | [ ]  | 웹 푸시           |

### 5.3 인프라

| #     | 검증 항목                | 상태 | 비고                     |
| ----- | ------------------------ | ---- | ------------------------ |
| 5.3.1 | Zustand auth store       | [ ]  | `stores/auth.ts`         |
| 5.3.2 | API 클라이언트 설정      | [ ]  | `lib/api.ts`             |
| 5.3.3 | 유틸리티 함수            | [ ]  | `lib/utils.ts`           |
| 5.3.4 | HTML 새니타이징          | [ ]  | `lib/sanitize-html.ts`   |
| 5.3.5 | 이미지 압축              | [ ]  | `lib/image-compress.ts`  |
| 5.3.6 | 오프라인 큐 동기화       | [ ]  | `safework2_` 키 프리픽스 |
| 5.3.7 | PWA manifest/서비스 워커 | [ ]  |                          |

---

## 6. Admin Dashboard (관리자 앱)

### 6.1 페이지 (30개 라우트)

| #      | 검증 항목     | 라우트                       | 상태 | 비고     |
| ------ | ------------- | ---------------------------- | ---- | -------- |
| 6.1.1  | 랜딩/리디렉트 | `/`                          | [ ]  |          |
| 6.1.2  | 로그인        | `/login`                     | [ ]  |          |
| 6.1.3  | 대시보드      | `/dashboard`                 | [ ]  |          |
| 6.1.4  | 분석          | `/dashboard/analytics`       | [ ]  |          |
| 6.1.5  | 추천 대시보드 | `/dashboard/recommendations` | [ ]  |          |
| 6.1.6  | 근태 관리     | `/attendance`                | [ ]  |          |
| 6.1.7  | 근태 동기화   | `/attendance/sync`           | [ ]  | FAS 연동 |
| 6.1.8  | 미매칭 근태   | `/attendance/unmatched`      | [ ]  |          |
| 6.1.9  | 투표 목록     | `/votes`                     | [ ]  |          |
| 6.1.10 | 투표 생성     | `/votes/new`                 | [ ]  |          |
| 6.1.11 | 투표 상세     | `/votes/[id]`                | [ ]  |          |
| 6.1.12 | 후보자 등록   | `/votes/[id]/candidates/new` | [ ]  |          |
| 6.1.13 | 후보자 관리   | `/votes/candidates`          | [ ]  |          |
| 6.1.14 | 게시글 관리   | `/posts`                     | [ ]  |          |
| 6.1.15 | 게시글 상세   | `/posts/[id]`                | [ ]  |          |
| 6.1.16 | 회원 목록     | `/members`                   | [ ]  |          |
| 6.1.17 | 회원 상세     | `/members/[id]`              | [ ]  |          |
| 6.1.18 | 포인트 관리   | `/points`                    | [ ]  |          |
| 6.1.19 | 포인트 정책   | `/points/policies`           | [ ]  |          |
| 6.1.20 | 포인트 정산   | `/points/settlement`         | [ ]  |          |
| 6.1.21 | 보상          | `/rewards`                   | [ ]  |          |
| 6.1.22 | 교육 관리     | `/education`                 | [ ]  |          |
| 6.1.23 | 추천 관리     | `/recommendations`           | [ ]  |          |
| 6.1.24 | 안전활동 관리 | `/actions`                   | [ ]  |          |
| 6.1.25 | 승인 관리     | `/approvals`                 | [ ]  |          |
| 6.1.26 | 공지사항 관리 | `/announcements`             | [ ]  |          |
| 6.1.27 | 모니터링      | `/monitoring`                | [ ]  |          |
| 6.1.28 | 동기화 오류   | `/sync-errors`               | [ ]  |          |
| 6.1.29 | 설정          | `/settings`                  | [ ]  |          |
| 6.1.30 | 감사 로그     | `/audit`                     | [ ]  |          |

### 6.2 Hooks (30개)

| #      | 검증 항목                                                 | 상태 | 비고            |
| ------ | --------------------------------------------------------- | ---- | --------------- |
| 6.2.1  | `use-api` / `use-api-base` / `use-admin-api`              | [ ]  | API 클라이언트  |
| 6.2.2  | `use-admin-members-api`                                   | [ ]  | 회원 관리       |
| 6.2.3  | `use-admin-sites-api`                                     | [ ]  | 현장 관리       |
| 6.2.4  | `use-admin-audit-api`                                     | [ ]  | 감사 로그       |
| 6.2.5  | `use-admin-announcements-api`                             | [ ]  | 공지사항        |
| 6.2.6  | `use-admin-approvals-api`                                 | [ ]  | 승인 관리       |
| 6.2.7  | `use-admin-dashboard-api`                                 | [ ]  | 대시보드        |
| 6.2.8  | `use-attendance`                                          | [ ]  | 근태            |
| 6.2.9  | `use-votes`                                               | [ ]  | 투표            |
| 6.2.10 | `use-posts-api`                                           | [ ]  | 게시글          |
| 6.2.11 | `use-points-api` / `use-points-policies-api`              | [ ]  | 포인트          |
| 6.2.12 | `use-points-settlement-api` / `use-points-ledger-api`     | [ ]  | 정산/원장       |
| 6.2.13 | `use-rewards`                                             | [ ]  | 보상            |
| 6.2.14 | `use-education-api` (+ tbm, statutory, contents, quizzes) | [ ]  | 교육 (5개 하위) |
| 6.2.15 | `use-recommendations`                                     | [ ]  | 추천            |
| 6.2.16 | `use-actions-api`                                         | [ ]  | 안전활동        |
| 6.2.17 | `use-monitoring-api`                                      | [ ]  | 모니터링        |
| 6.2.18 | `use-sync-errors`                                         | [ ]  | 동기화 오류     |
| 6.2.19 | `use-sites-api`                                           | [ ]  | 현장            |
| 6.2.20 | `use-stats` / `use-trends`                                | [ ]  | 통계/트렌드     |
| 6.2.21 | `use-fas-sync`                                            | [ ]  | FAS 동기화      |

### 6.3 인프라

| #     | 검증 항목           | 상태 | 비고             |
| ----- | ------------------- | ---- | ---------------- |
| 6.3.1 | Zustand auth store  | [ ]  | `stores/auth.ts` |
| 6.3.2 | API 클라이언트 설정 | [ ]  | `lib/api.ts`     |
| 6.3.3 | 유틸리티 함수       | [ ]  | `lib/utils.ts`   |

---

## 7. 공유 패키지

### 7.1 @safetywallet/types (22 파일)

| #     | 검증 항목                                | 상태 | 비고                        |
| ----- | ---------------------------------------- | ---- | --------------------------- |
| 7.1.1 | DTO: announcement, education, user, auth | [ ]  |                             |
| 7.1.2 | DTO: review, vote, post, points          | [ ]  |                             |
| 7.1.3 | DTO: analytics, site, action             | [ ]  |                             |
| 7.1.4 | Enums                                    | [ ]  | `enums.ts`                  |
| 7.1.5 | API 타입                                 | [ ]  | `api.ts`                    |
| 7.1.6 | i18n: 한국어 (ko.ts)                     | [ ]  |                             |
| 7.1.7 | i18n: 로더/인덱스                        | [ ]  | ko/en만 로드 (vi/zh 미구현) |
| 7.1.8 | 타입 패키지 테스트 (5개)                 | [ ]  |                             |

### 7.2 @safetywallet/ui (14 컴포넌트)

| #     | 검증 항목                   | 상태 | 비고      |
| ----- | --------------------------- | ---- | --------- |
| 7.2.1 | button, input, card         | [ ]  | 기본 요소 |
| 7.2.2 | badge, avatar, skeleton     | [ ]  | 표시 요소 |
| 7.2.3 | switch, select              | [ ]  | 폼 요소   |
| 7.2.4 | dialog, alert-dialog, sheet | [ ]  | 오버레이  |
| 7.2.5 | toast, toaster, use-toast   | [ ]  | 알림      |

---

## 8. Cloudflare 바인딩 및 인프라

### 8.1 바인딩 (11개)

| #      | 바인딩               | 타입             | 검증 항목                    | 상태 |
| ------ | -------------------- | ---------------- | ---------------------------- | ---- |
| 8.1.1  | `DB`                 | D1               | 기본 DB 연결, 32 테이블 접근 | [ ]  |
| 8.1.2  | `ASSETS`             | R2               | 정적 에셋 / Admin SPA 서빙   | [ ]  |
| 8.1.3  | `R2`                 | R2               | 사용자 업로드 이미지 저장    | [ ]  |
| 8.1.4  | `ACETIME_BUCKET`     | R2               | 근태 기록 저장               | [ ]  |
| 8.1.5  | `FAS_HYPERDRIVE`     | Hyperdrive       | 외부 FAS MariaDB 연결        | [ ]  |
| 8.1.6  | `KV`                 | KV               | 캐시 저장소                  | [ ]  |
| 8.1.7  | `ANALYTICS`          | Analytics Engine | 요청/이벤트 분석             | [ ]  |
| 8.1.8  | `NOTIFICATION_QUEUE` | Queue            | 비동기 알림 처리             | [ ]  |
| 8.1.9  | `AI`                 | Workers AI       | AI 추론                      | [ ]  |
| 8.1.10 | `RATE_LIMITER`       | Durable Object   | 요청 속도 제한               | [ ]  |
| 8.1.11 | `JOB_SCHEDULER`      | Durable Object   | 예약 작업 실행               | [ ]  |

### 8.2 Durable Objects

| #     | 검증 항목       | 파일                              | 상태 | 비고           |
| ----- | --------------- | --------------------------------- | ---- | -------------- |
| 8.2.1 | RateLimiter DO  | `durable-objects/RateLimiter.ts`  | [ ]  | 요청 제한 로직 |
| 8.2.2 | JobScheduler DO | `durable-objects/JobScheduler.ts` | [ ]  | 스케줄러 로직  |
| 8.2.3 | DO 단위 테스트  | `durable-objects/__tests__/`      | [ ]  |                |

### 8.3 예약 작업 (Jobs)

| #     | 검증 항목         | 파일                   | 상태 | 비고       |
| ----- | ----------------- | ---------------------- | ---- | ---------- |
| 8.3.1 | 작업 레지스트리   | `jobs/registry.ts`     | [ ]  |            |
| 8.3.2 | 일일 작업         | `jobs/daily-jobs.ts`   | [ ]  |            |
| 8.3.3 | 월간 작업         | `jobs/monthly-jobs.ts` | [ ]  |            |
| 8.3.4 | 동기화 작업       | `jobs/sync-jobs.ts`    | [ ]  | FAS 동기화 |
| 8.3.5 | 작업 헬퍼         | `jobs/helpers.ts`      | [ ]  |            |
| 8.3.6 | 작업 테스트 (3개) | `jobs/__tests__/`      | [ ]  |            |

### 8.4 wrangler 설정

| #     | 검증 항목                           | 상태 | 비고                  |
| ----- | ----------------------------------- | ---- | --------------------- |
| 8.4.1 | `wrangler.toml` 바인딩 일치성       | [ ]  | 11개 바인딩 선언 확인 |
| 8.4.2 | dev/prod 환경 분리                  | [ ]  |                       |
| 8.4.3 | `check:wrangler-sync` 스크립트 통과 | [ ]  |                       |

---

## 9. 테스트 커버리지

### 9.1 Vitest 단위 테스트 (100 파일, 5 워크스페이스)

| #     | 검증 항목            | 대상              | 상태 | 비고                             |
| ----- | -------------------- | ----------------- | ---- | -------------------------------- |
| 9.1.1 | API 테스트           | `apps/api/`       | [ ]  | 라우트, 미들웨어, DB, 밸리데이터 |
| 9.1.2 | Admin 테스트         | `apps/admin/`     | [ ]  | 컴포넌트, 훅                     |
| 9.1.3 | Worker 테스트        | `apps/worker/`    | [ ]  | 컴포넌트, 훅                     |
| 9.1.4 | Types 테스트         | `packages/types/` | [ ]  | DTO, enum 검증                   |
| 9.1.5 | UI 테스트            | `packages/ui/`    | [ ]  | 컴포넌트 렌더링                  |
| 9.1.6 | `npm test` 전체 통과 | —                 | [ ]  |                                  |

### 9.2 E2E 테스트 (제거됨)

E2E 테스트는 PR #68에서 전체 제거됨. Playwright 의존성, CI 워크플로, e2e/ 디렉토리 모두 삭제.

### 9.3 밸리데이터 (Zod 스키마, 50+)

| #     | 검증 항목         | 파일                           | 상태 | 비고 |
| ----- | ----------------- | ------------------------------ | ---- | ---- |
| 9.3.1 | 도메인 스키마     | `validators/schemas/domain.ts` | [ ]  |      |
| 9.3.2 | 인증 스키마       | `validators/schemas/auth.ts`   | [ ]  |      |
| 9.3.3 | 공유 스키마       | `validators/schemas/shared.ts` | [ ]  |      |
| 9.3.4 | FAS 동기화 스키마 | `validators/fas-sync.ts`       | [ ]  |      |
| 9.3.5 | 내보내기 스키마   | `validators/export.ts`         | [ ]  |      |

---

## 10. CI/CD 파이프라인

### 10.1 GitLab CI/CD 파이프라인

| #       | Job             | 검증 항목                    | 상태 | 비고           |
| ------- | --------------- | ---------------------------- | ---- | -------------- |
| 10.1.1  | `lint`          | ESLint 검사                  | [ ]  | validate stage |
| 10.1.2  | `typecheck`     | TypeScript 타입 체크         | [ ]  | validate stage |
| 10.1.3  | `guards`        | 네이밍/안티패턴 검사         | [ ]  | validate stage |
| 10.1.4  | `code-quality`  | 코드 품질 검사               | [ ]  | validate stage |
| 10.1.5  | `unit-test`     | Vitest 단위 테스트           | [ ]  | test stage     |
| 10.1.6  | `security`      | npm audit 보안 검사          | [ ]  | test stage     |
| 10.1.7  | `sast`          | Gitleaks Secret Detection    | [ ]  | test stage     |
| 10.1.8  | `d1-dryrun`     | D1 마이그레이션 dry-run      | [ ]  | test stage     |
| 10.1.9  | `build:*`       | Types/Worker/Admin/API 빌드  | [ ]  | build stage    |
| 10.1.10 | `e2e-smoke`     | Playwright E2E 스모크 테스트 | [ ]  | e2e stage      |
| 10.1.11 | `deploy:worker` | Cloudflare Worker 배포       | [ ]  | deploy stage   |
| 10.1.12 | `d1-migrate`    | D1 마이그레이션 적용         | [ ]  | deploy stage   |
| 10.1.13 | `deploy-verify` | 배포 검증                    | [ ]  | deploy stage   |
| 10.1.14 | `notify:slack`  | Slack 알림                   | [ ]  | notify stage   |

### 10.2 배포

| #      | 검증 항목                                  | 상태 | 비고 |
| ------ | ------------------------------------------ | ---- | ---- |
| 10.2.1 | CF Git Integration 자동 배포 (master push) | [ ]  |      |
| 10.2.2 | 로컬 배포 차단 (exit with error)           | [ ]  |      |
| 10.2.3 | R2 에셋 동기화                             | [ ]  |      |
| 10.2.4 | D1 마이그레이션 실행                       | [ ]  |      |
| 10.2.5 | 스모크 테스트                              | [ ]  |      |
| 10.2.6 | Slack 알림                                 | [ ]  |      |

---

## 11. 보안

| #     | 검증 항목                          | 상태 | 비고                  |
| ----- | ---------------------------------- | ---- | --------------------- |
| 11.1  | 보안 헤더 (CSP, HSTS, X-Frame 등)  | [ ]  | `security-headers.ts` |
| 11.2  | CORS 동적 설정 (`ALLOWED_ORIGINS`) | [ ]  |                       |
| 11.3  | Rate Limiting (Durable Object)     | [ ]  |                       |
| 11.4  | JWT 토큰 보안                      | [ ]  | 만료, 서명 검증       |
| 11.5  | 입력 검증 (Zod 밸리데이터)         | [ ]  | 50+ 스키마            |
| 11.6  | HTML 새니타이징                    | [ ]  | `sanitize-html.ts`    |
| 11.7  | 이미지 업로드 검증                 | [ ]  | 타입/크기 제한        |
| 11.8  | SQL 인젝션 방지 (Drizzle ORM)      | [ ]  |                       |
| 11.9  | 감사 로그 (`auditLogs` 테이블)     | [ ]  |                       |
| 11.10 | 비밀값 환경변수 관리 (CF Bindings) | [ ]  | 하드코딩 금지         |
| 11.11 | 계정 잠금 메커니즘                 | [ ]  | `lockout.ts`          |
| 11.12 | Dead-letter Queue (알림 실패 처리) | [ ]  |                       |
| 11.13 | 기기 등록/핑거프린팅               | [ ]  |                       |

---

## 12. 운영 및 모니터링

| #     | 검증 항목                              | 상태 | 비고                         |
| ----- | -------------------------------------- | ---- | ---------------------------- |
| 12.1  | 요청 로거 (`request-logger.ts`)        | [ ]  | 구조화된 로깅                |
| 12.2  | Analytics Engine 연동                  | [ ]  | `analytics.ts`               |
| 12.3  | API 메트릭 수집 (`apiMetrics` 테이블)  | [ ]  |                              |
| 12.4  | 동기화 오류 추적 (`syncErrors` 테이블) | [ ]  |                              |
| 12.5  | 모니터링 대시보드                      | [ ]  | Admin `/monitoring`          |
| 12.6  | 배포 모니터링 + Slack 알림             | [ ]  | `notify:slack` job           |
| 12.7  | 일일/월간/동기화 크론 작업             | [ ]  | JobScheduler DO              |
| 12.8  | ~~E2E 야간 테스트~~                    | [x]  | 제거됨 (PR #68)              |
| 12.9  | ~~E2E 실패 자동 이슈 생성~~            | [x]  | 제거됨 (PR #68)              |
| 12.10 | Stale 이슈/PR 관리                     | [ ]  | GitLab 스케줄 또는 수동 처리 |

---

## 13. 미해결 항목 및 기술 부채

> REQUIREMENTS_CHECKLIST.md 기준 잔여 항목 + 코드베이스 탐색에서 발견된 사항

### 13.1 미구현/부분 구현

| #      | 항목                    | 우선순위 | 현재 상태 | 비고                               |
| ------ | ----------------------- | -------- | --------- | ---------------------------------- |
| 13.1.1 | i18n: vi/zh 로케일      | P2       | 미구현    | `loader.ts`에 ko/en만 import       |
| 13.1.2 | QR 재발급 UI            | P2       | 부분      | API 존재, UI 미완                  |
| 13.1.3 | QR 설치 위치 안내       | P2       | 부분      |                                    |
| 13.1.4 | 목록 로딩 성능 최적화   | P2       | 부분      | 가상 스크롤/무한 스크롤            |
| 13.1.5 | OWASP 종합 보안 감사    | P2       | 부분      | 기본 보안 구현됨, 종합 감사 미실시 |
| 13.1.6 | 업타임 모니터링         | P2       | 부분      | 기본 모니터링만                    |
| 13.1.7 | DR 테스트               | P2       | 미실시    | 재해복구 시나리오 테스트           |
| 13.1.8 | 동시 사용자 부하 테스트 | P2       | 미실시    |                                    |
| 13.1.9 | 보상 수령 서명/영수증   | P2       | 부분      |                                    |

### 13.2 제거된 범위

| #      | 항목                    | 사유                |
| ------ | ----------------------- | ------------------- |
| 13.2.1 | KakaoTalk Business 연동 | 범위 외 제거        |
| 13.2.2 | ERP 통합                | 범위 외 제거        |
| 13.2.3 | SMS OTP 인증            | FAS 로그인으로 대체 |

### 13.3 기술 부채

| #      | 항목                     | 위치                        | 비고                                                          |
| ------ | ------------------------ | --------------------------- | ------------------------------------------------------------- |
| 13.3.1 | `safework2_` 키 프리픽스 | Worker 오프라인 큐/임시저장 | 마이그레이션 없이 이름 변경 금지                              |
| 13.3.2 | 서비스 레이어 부재       | `apps/api/src/`             | `services/` 디렉토리 없음, 비즈니스 로직이 라우트에 직접 위치 |

---

## 빌드/검증 명령어 요약

```bash
# 전체 검증
npm run verify              # 종합 검증 스크립트

# 개별 검증
npm run typecheck           # TypeScript 타입 체크
npm run lint                # ESLint
npm run format:check        # Prettier 포맷 체크
npm test                    # Vitest 단위 테스트 (5 워크스페이스)
npm run build               # 전체 빌드
npm run check:wrangler-sync # wrangler.toml 일관성 검사
npm run lint:naming         # 파일/디렉토리 네이밍 규칙 검사
npm run git:preflight       # 푸시 전 사전 검사
```

---

## 통계 요약

| 항목                     | 수량                |
| ------------------------ | ------------------- |
| API 라우트 모듈          | 18 + admin 서브트리 |
| API 소스 파일 (non-test) | ~65                 |
| 미들웨어                 | 7                   |
| DB 테이블                | 32                  |
| DB Enum                  | 21                  |
| DB 인덱스                | ~45                 |
| DB 마이그레이션          | 16                  |
| Worker 페이지            | 16                  |
| Admin 페이지             | 30                  |
| Worker Hooks             | 14                  |
| Admin Hooks              | 30                  |
| 공유 UI 컴포넌트         | 14                  |
| 공유 타입/DTO            | 22 파일             |
| Zod 밸리데이터           | 50+                 |
| Cloudflare 바인딩        | 11                  |
| Durable Objects          | 2                   |
| 예약 작업                | 4                   |
| Vitest 테스트 파일       | 100                 |
| Playwright E2E 스펙      | 75                  |
| GitLab CI/CD             | 1                   |
| **전체 검증 항목**       | **~310**            |
