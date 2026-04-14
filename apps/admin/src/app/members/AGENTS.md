# Members

## OVERVIEW

- Member admin tree; list route plus thin `[id]` detail wrapper.

## FILES

- Root files (`4`): `page.tsx`, `page.test.tsx`, `error.tsx`, `AGENTS.md`
- Root test dir: `__tests__/page.test.tsx`
- Detail route files (`2`): `[id]/page.tsx`, `[id]/member-detail.tsx`
- Detail tests (`2`): `[id]/page.test.tsx`, `[id]/__tests__/member-detail.test.tsx`
- Subdirs: `__tests__/`, `[id]/`, `[id]/__tests__/`

## WHERE TO LOOK

- List shell: `page.tsx`
- List test coverage: `page.test.tsx`, `__tests__/page.test.tsx`
- Wrapper boundary: `[id]/page.tsx`
- Detail client: `[id]/member-detail.tsx`
- Detail test coverage: `[id]/page.test.tsx`, `[id]/__tests__/member-detail.test.tsx`

## CONVENTIONS

- `[id]/page.tsx`: params handoff only.
- Member detail stays in `member-detail.tsx`; no extra route-local helper split yet.
- Keep list/detail concerns separated across root and `[id]/`.
- Keep error handling local to `error.tsx`.
- Keep detail-only rendering decisions inside `[id]/member-detail.tsx`.
- Keep detail test updates paired with `[id]/member-detail.tsx` edits.
