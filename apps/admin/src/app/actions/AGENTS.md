# Actions

## OVERVIEW

- Action review route; list shell plus AI/image comparison cards.

## FILES

- Runtime files (`5`):
  - `page.tsx`
  - `components/action-filter-tabs.tsx`
  - `components/action-image-ai-analysis.tsx`
  - `components/action-stats-cards.tsx`
  - `components/before-after-comparison-card.tsx`
- Tests (`3`):
  - `__tests__/page.test.tsx`
  - `components/__tests__/action-image-ai-analysis.test.tsx`
  - `components/__tests__/before-after-comparison-card.test.tsx`
- Subdirs: `__tests__/`, `components/`, `components/__tests__/`

## WHERE TO LOOK

- Route shell: `page.tsx`
- Filters/tabs: `components/action-filter-tabs.tsx`
- AI/image cards: `components/action-image-ai-analysis.tsx`, `components/before-after-comparison-card.tsx`

## CONVENTIONS

- Keep action-specific cards local; no promotion to shared components.
- Comparison/AI presentation stays in components; transport remains outside route docs.
- Filter tab labels stay beside route, not in global constants.
