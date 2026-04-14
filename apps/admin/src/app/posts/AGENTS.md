# Posts

## OVERVIEW

- Post review tree: list route plus thin `[id]` wrapper around detail client.

## FILES

- Root files (`4`): `page.tsx`, `page.test.tsx`, `error.tsx`, `AGENTS.md`
- Root test dir: `__tests__/page.test.tsx`
- Detail route dir: `[id]/`
- `[id]/` core files (`3`): `page.tsx`, `post-detail.tsx`, `post-detail-helpers.ts`
- `[id]/components/` files (`6`):
  - `ai-analysis-card.tsx`
  - `assignment-form.tsx`
  - `metadata-card.tsx`
  - `post-classification-card.tsx`
  - `post-content-card.tsx`
  - `review-history-card.tsx`
- `[id]/` tests (`9`):
  - `__tests__/page.test.tsx`
  - `__tests__/post-detail.test.tsx`
  - `__tests__/post-detail-helpers.test.ts`
  - `components/__tests__/ai-analysis-card.test.tsx`
  - `components/__tests__/assignment-form.test.tsx`
  - `components/__tests__/metadata-card.test.tsx`
  - `components/__tests__/post-classification-card.test.tsx`
  - `components/__tests__/post-content-card.test.tsx`
  - `components/__tests__/review-history-card.test.tsx`

## WHERE TO LOOK

- Wrapper boundary: `[id]/page.tsx`
- Detail shell: `[id]/post-detail.tsx`
- Display/status helpers: `[id]/post-detail-helpers.ts`

## CONVENTIONS

- `[id]/page.tsx`: params handoff only.
- Detail cards stay route-local under `[id]/components/`.
- Labels/date/status transforms stay in `post-detail-helpers.ts`.
