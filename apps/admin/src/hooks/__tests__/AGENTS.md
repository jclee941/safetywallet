# Hook Tests

## PURPOSE

- Document ownership of hook-level test coverage in `src/hooks/__tests__`.

## INVENTORY

- Root files (`45` files, `44` TS/TSX):
  - `AGENTS.md`, `test-utils.tsx`
  - Core API (4): `use-actions-api`, `use-admin-api`, `use-api-base`, `use-api`.
  - Admin domain (6): `use-admin-announcements-api`, `use-admin-approvals-api`, `use-admin-audit-api`, `use-admin-dashboard-api`, `use-admin-members-api`, `use-admin-sites-api`.
  - AI analysis (10): `use-action-ai-analysis`, `use-ai-analysis`, `use-ai-insights-api`, `use-announcement-ai-draft`, `use-before-after-comparison`, `use-education-ai-analysis`, `use-post-classification`, `use-quiz-generation`, `use-tbm-ai-analysis`, `use-tbm-meeting-minutes`.
  - Education (7): `use-education-api`, `use-education-api-types`, `use-education-completions`, `use-education-contents-api`, `use-education-quizzes-api`, `use-education-statutory-api`, `use-education-tbm-api`.
  - Points (4): `use-points-api`, `use-points-ledger-api`, `use-points-policies-api`, `use-points-settlement-api`.
  - Features (12): `use-attendance`, `use-fas-sync`, `use-issues-api`, `use-monitoring-api`, `use-posts-api`, `use-recommendations`, `use-rewards`, `use-sites-api`, `use-stats`, `use-sync-errors`, `use-trends`, `use-votes`.
  - All test files use `.test.ts` suffix (omitted above for brevity).

## CONVENTIONS

- Use `test-utils.tsx` QueryClient wrapper for `renderHook` consistency.
- Mock transport at `@/lib/api` or `@/hooks/use-api-base` boundary.
- Stub auth-store state (`currentSiteId`, hydration, role flags) per suite.
- Assert mutation invalidation/query key interactions when mutation exists.
- Keep barrel test (`use-api.test.ts`) export-contract focused.

## ANTI-PATTERNS

- Treating barrel tests as replacement for domain behavior tests.
- Using real network/timer dependencies in unit suites.
- Skipping key state assertions in mutation-heavy test files.
- Adding broad snapshot-only tests for data hooks.

## DRIFT GUARDS

- On new hook module, add or update matching test suite.
- Keep root file count accurate (`45` files, `0` subdirs).
- Keep `test-utils.tsx` API stable; update callers together when changing wrapper.
- Remove stale tests when corresponding hook modules are deleted.
