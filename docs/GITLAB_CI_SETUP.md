# GitLab CI/CD 구성 가이드

## 현재 상태

- 수동 배포: ✅ 완료 (Global API Key 사용)
- 자동 배포: ⚠️ GitLab CI Variables 미설정

## 필수 설정

### 1. GitLab CI/CD Variables 추가

**경로**: GitLab → Settings → CI/CD → Variables → Add variable

| 변수명                  | 설명                      | 타입     | 보호 | 마스킹 |
| ----------------------- | ------------------------- | -------- | ---- | ------ |
| `CLOUDFLARE_API_KEY`    | Cloudflare Global API Key | Variable | ✅   | ✅     |
| `CLOUDFLARE_EMAIL`      | Cloudflare 계정 이메일    | Variable | ✅   | ✅     |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID     | Variable | ✅   | ❌     |

### 2. 기존 Token 제거 (선택)

기존 `CLOUDFLARE_API_TOKEN`은 Workers KV 권한이 없어 실패했습니다.

- 삭제 또는 덮어쓰기 권장
- Global API Key 방식이 더 안정적

### 3. CI/CD Pipeline 테스트

master 브랜치에 push 시 자동 배포:

```bash
git checkout master
git pull origin master
# 작업 후
git push origin master
```

## 배포 흐름

```
Push to master
    ↓
GitLab CI Trigger
    ↓
validate (lint/typecheck/guards)
    ↓
test (unit/security)
    ↓
build (types/worker/admin/api)
    ↓
e2e (smoke tests)
    ↓
deploy:worker
    ↓
d1-migrate
    ↓
deploy-verify
```

## 문제 해결

### 배포 실패 시

1. GitLab → CI/CD → Pipelines → 실패한 job 클릭
2. 로그 확인: `deploy:worker` 단계에서 오류 검색
3. 필요 시 Variables 업데이트 후 Retry

### 수동 배포 (긴급)

```bash
cd apps/api
export CLOUDFLARE_API_KEY="<YOUR_API_KEY>"
export CLOUDFLARE_EMAIL="<YOUR_EMAIL>"
npx wrangler deploy --config wrangler.toml --env=""
```

## 보안 권장사항

⚠️ **Global API Key 대신 Scoped API Token 사용 권장**

```bash
# create-cf-token.go로 Scoped Token 생성
go run scripts/create-cf-token.go
# 출력된 Token을 CLOUDFLARE_API_TOKEN으로 설정
```

필요 권한:

- Workers Scripts:Edit
- Account Settings:Read
- Workers R2 Storage:Edit
- Cloudflare Pages:Edit
- Workers KV:Edit ✅ (기존 누락)

---

**작성일**: 2026-04-04  
**참고**: 실제 API Key는 1Password 또는 GitLab CI Variables에 안전하게 보관하세요.
