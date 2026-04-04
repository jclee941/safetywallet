# Scripts

## PURPOSE

- Operational tooling for verification, policy checks, and utility generation.
- Mixed Go/JS/TS/SQL script set used by local and CI flows.

## INVENTORY

- `AGENTS.md` — local scripts governance.
- `verify.go` — end-to-end verification runner.
- `git-preflight.go` — pre-push/preflight gate checks.
- `check-anti-patterns.go` — anti-pattern detector for changed files.
- `build-static.go` — static asset build helper.
- `create-cf-token.go` — Cloudflare token helper.
- `check-wrangler-sync.js` — wrangler binding parity checker.
- `lint-naming.js` — naming convention validator wrapper.
- `create-test-user.ts` — SQL generation utility for test user.
- `hash-admin-password.ts` — password hash utility.
- `create-test-user.sql` — generated SQL artifact.
- `migrate-s4-enums.sql` — manual SQL migration helper.
- `elasticsearch-index-template.json` — Elasticsearch index template configuration.
- `ci-debug.go` — CI debugging and troubleshooting helper.
- `deploy-elk-secrets.go` — ELK secrets deployment automation.
- `deploy-verify.go` — post-deployment health verification.
- `test-elk-integration.go` — ELK connectivity testing.

## CONVENTIONS

- Prefer Go for operational automation and CI-executed logic.
- Keep JS/TS scripts for ecosystem-coupled tasks only.
- Keep CI scripts deterministic and non-interactive.
- Pass secrets via env vars/flags; never embed literals.
- Keep generated artifact scripts explicit about overwrite/output path.

## ANTI-PATTERNS

- Hardcoded absolute local paths in reusable scripts.
- Interactive prompts in CI-referenced scripts.
- Credential defaults or plaintext secrets in source.
- Stale helpers not referenced by package scripts/workflows.

## DRIFT GUARDS

- Confirm directory remains 17 entries.
- Confirm inventory names match exact filenames/extensions.
- Confirm script language mix (Go/JS/TS/SQL) remains intentional.
- Confirm renamed scripts are updated in callers (`package.json`, workflows, docs).
