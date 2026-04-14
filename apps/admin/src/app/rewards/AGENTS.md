# Rewards

## OVERVIEW

- Rewards admin route; tabbed rankings, criteria, distribution, export, history.

## FILES

- Runtime files (`7`):
  - `page.tsx`
  - `rewards-helpers.ts`
  - `components/rankings-tab.tsx`
  - `components/criteria-tab.tsx`
  - `components/distribution-tab.tsx`
  - `components/export-tab.tsx`
  - `components/history-tab.tsx`
- Tests (`7`):
  - `__tests__/page.test.tsx`
  - `__tests__/rewards-helpers.test.ts`
  - `components/__tests__/rankings-tab.test.tsx`
  - `components/__tests__/criteria-tab.test.tsx`
  - `components/__tests__/distribution-tab.test.tsx`
  - `components/__tests__/export-tab.test.tsx`
  - `components/__tests__/history-tab.test.tsx`
- Subdirs: `__tests__/`, `components/`, `components/__tests__/`

## WHERE TO LOOK

- Route shell: `page.tsx`
- Shared reward labels/formatters: `rewards-helpers.ts`
- Tab panels: `components/*-tab.tsx`

## CONVENTIONS

- Keep tab metadata and cross-tab transforms in `rewards-helpers.ts`.
- Tab panels stay flat under `components/`; no nested tab folders yet.
- Export/history logic stays route-local.
