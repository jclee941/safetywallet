# Points

## OVERVIEW

- Points admin tree: root ledger/manual award, policy CRUD subtree, settlement subtree.

## FILES

- Root files (`3`): `page.tsx`, `error.tsx`, `AGENTS.md`
- Root test dir: `__tests__/page.test.tsx`
- Root subdirs (`2`): `policies/`, `settlement/`
- `policies/` runtime files (`5`):
  - `page.tsx`
  - `policy-helpers.ts`
  - `components/policies-data-table.tsx`
  - `components/policy-form-dialog.tsx`
  - `components/delete-policy-dialog.tsx`
- `policies/` tests (`5`):
  - `__tests__/page.test.tsx`
  - `__tests__/policy-helpers.test.ts`
  - `components/__tests__/policies-data-table.test.tsx`
  - `components/__tests__/policy-form-dialog.test.tsx`
  - `components/__tests__/delete-policy-dialog.test.tsx`
- `settlement/` files (`2`):
  - `page.tsx`
  - `__tests__/page.test.tsx`

## WHERE TO LOOK

- Root award/ledger shell: `page.tsx`
- Policy labels/mappers: `policies/policy-helpers.ts`
- Settlement flow: `settlement/page.tsx`

## CONVENTIONS

- Root route: manual awards + ledger view only.
- Policy display helpers stay in `policies/policy-helpers.ts`.
- Settlement logic stays inside `settlement/`; no spillback into root route.
