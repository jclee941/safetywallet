# Monitoring

## OVERVIEW

- Monitoring dashboard route; summary, charts, endpoint table, error table.

## FILES

- Root files (`2`): `page.tsx`, `page.test.tsx`
- Component runtime files (`5`):
  - `components/summary-cards.tsx`
  - `components/time-series-chart.tsx`
  - `components/endpoints-table.tsx`
  - `components/errors-table.tsx`
  - `components/helpers.ts`
- Component tests (`5`):
  - `components/__tests__/summary-cards.test.tsx`
  - `components/__tests__/time-series-chart.test.tsx`
  - `components/__tests__/endpoints-table.test.tsx`
  - `components/__tests__/errors-table.test.tsx`
  - `components/__tests__/helpers.test.ts`
- Subdirs: `components/`, `components/__tests__/`

## WHERE TO LOOK

- Route shell: `page.tsx`
- Shared monitoring transforms: `components/helpers.ts`
- Metric widgets: `summary-cards.tsx`, `time-series-chart.tsx`
- Tabular diagnostics: `endpoints-table.tsx`, `errors-table.tsx`

## CONVENTIONS

- Monitoring-only helpers stay in `components/helpers.ts`.
- Cards/charts/tables stay split by visualization type.
- No generic table helper extraction from monitoring unless used elsewhere.
