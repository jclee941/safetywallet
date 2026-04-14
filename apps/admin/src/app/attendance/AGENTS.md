# Attendance

## OVERVIEW

- Attendance admin tree: logs shell, unmatched deep-link, sync diagnostics subtree.

## FILES

- Root files (`6`): `page.tsx`, `page.test.tsx`, `error.tsx`, `attendance-helpers.ts`, `attendance-helpers.test.ts`, `AGENTS.md`
- Root subdirs (`3`): `components/`, `sync/`, `unmatched/`
- Root components:
  - `components/attendance-logs-tab.tsx`
  - `components/attendance-stats.tsx`
  - `components/unmatched-tab.tsx`
- Root component tests:
  - `components/__tests__/attendance-logs-tab.test.tsx`
  - `components/__tests__/attendance-stats.test.tsx`
  - `components/__tests__/unmatched-tab.test.tsx`
- `sync/` files (`8`):
  - `page.tsx`, `sync-helpers.ts`
  - `components/status-cards.tsx`
  - `components/manual-sync-card.tsx`
  - `components/fas-search-card.tsx`
  - `components/sync-errors-card.tsx`
  - `components/sync-logs-card.tsx`
  - `__tests__/page.test.tsx`
- `sync/` nested tests:
  - `__tests__/sync-helpers.test.ts`
  - `components/__tests__/status-cards.test.tsx`
  - `components/__tests__/manual-sync-card.test.tsx`
  - `components/__tests__/fas-search-card.test.tsx`
  - `components/__tests__/sync-errors-card.test.tsx`
  - `components/__tests__/sync-logs-card.test.tsx`
- `unmatched/` files: `page.tsx`, `__tests__/page.test.tsx`

## WHERE TO LOOK

- Shared labels/mappers: `attendance-helpers.ts`
- Sync-only transforms: `sync/sync-helpers.ts`
- Tab shell composition: root `page.tsx`

## CONVENTIONS

- Root `page.tsx`: logs + stats + unmatched tab shell.
- `unmatched/page.tsx`: direct-link parity with unmatched tab.
- `sync/page.tsx`: diagnostics-only route; keep sync cards local to `sync/components/`.
- Format/status/date helpers: root helper or sync helper only; no duplicate mappers in cards.
