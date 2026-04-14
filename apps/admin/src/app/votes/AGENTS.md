# Votes

## OVERVIEW

- Vote admin tree: dashboard shell, creation routes, candidate list, `[id]` detail flow.

## FILES

- Root files (`4`): `page.tsx`, `error.tsx`, `votes-helpers.ts`, `AGENTS.md`
- Root test dir (`3`): `__tests__/page.test.tsx`, `__tests__/error.test.tsx`, `__tests__/votes-helpers.test.ts`
- Root subdirs (`4` runtime + test dir): `new/`, `candidates/`, `components/`, `[id]/`, `__tests__/`
- Shared cards (`3`): `components/vote-period-card.tsx`, `components/candidates-card.tsx`, `components/results-card.tsx`
- Shared card tests (`3`):
  - `components/__tests__/vote-period-card.test.tsx`
  - `components/__tests__/candidates-card.test.tsx`
  - `components/__tests__/results-card.test.tsx`
- Simple routes:
  - `new/page.tsx`, `new/__tests__/page.test.tsx`
  - `candidates/page.tsx`, `candidates/__tests__/page.test.tsx`
- `[id]/` detail files (`2`): `page.tsx`, `vote-detail.tsx`
- `[id]/` detail tests (`2`): `__tests__/page.test.tsx`, `__tests__/vote-detail.test.tsx`
- Nested candidate-create under `[id]/candidates/new/`:
  - `page.tsx`, `add-candidate.tsx`
  - `__tests__/page.test.tsx`, `__tests__/add-candidate.test.tsx`

## WHERE TO LOOK

- Display helpers: `votes-helpers.ts`
- Dashboard shell: `page.tsx`
- Detail shell: `[id]/vote-detail.tsx`

## CONVENTIONS

- Month key stays central in root route + helpers.
- `[id]/page.tsx`: wrapper only; detail UI stays in `vote-detail.tsx`.
- Candidate-create flow stays nested under `[id]/candidates/new/`.
