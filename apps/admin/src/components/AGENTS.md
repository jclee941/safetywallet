# Components

## OVERVIEW

- Shared admin UI layer; inventories reusable component packs and shared tests.

## FILES

- Root files (`8`): `admin-shell.tsx`, `providers.tsx`, `sidebar.tsx`, `data-table.tsx`, `image-lightbox.tsx`, `rich-text-editor.tsx`, `stats-card.tsx`, `AGENTS.md`
- Root shared tests (`14`):
  - `__tests__/admin-shell.test.tsx`, `__tests__/approval-dialog.test.tsx`, `__tests__/approval-history.test.tsx`, `__tests__/approval-list.test.tsx`
  - `__tests__/candidate-dialog.test.tsx`, `__tests__/data-table.test.tsx`, `__tests__/image-lightbox.test.tsx`, `__tests__/providers.test.tsx`
  - `__tests__/reject-dialog.test.tsx`, `__tests__/review-actions.test.tsx`, `__tests__/rich-text-editor.test.tsx`, `__tests__/sidebar.test.tsx`, `__tests__/stats-card.test.tsx`, `__tests__/table.test.tsx`
- Feature dirs:
  - `approvals/`: `approval-dialog.tsx`, `approval-history.tsx`, `approval-list.tsx`, `reject-dialog.tsx`
  - `review-actions/`: `index.tsx`, `action-buttons.tsx`, `constants.ts`, `info-request-form.tsx`, `points-panel.tsx`, `reject-form.tsx`, `urgent-confirm.tsx`
  - `votes/`: `candidate-dialog.tsx`
  - `ui/`: `table.tsx`
- Nested feature tests:
  - `approvals/__tests__/approval-dialog.test.tsx`, `approvals/__tests__/approval-history.test.tsx`, `approvals/__tests__/approval-list.test.tsx`, `approvals/__tests__/reject-dialog.test.tsx`
  - `review-actions/__tests__/action-buttons.test.tsx`, `review-actions/__tests__/constants.test.ts`, `review-actions/__tests__/index.test.tsx`, `review-actions/__tests__/info-request-form.test.tsx`, `review-actions/__tests__/points-panel.test.tsx`, `review-actions/__tests__/reject-form.test.tsx`, `review-actions/__tests__/urgent-confirm.test.tsx`

## WHERE TO LOOK

- App frame: `admin-shell.tsx`, `sidebar.tsx`, `providers.tsx`
- Review action pack: `review-actions/`
- Table pair: `data-table.tsx`, `ui/table.tsx`

## CONVENTIONS

- Shared-only UI here; route-only UI stays under `src/app/*`.
- `review-actions/constants.ts`: pack-local constants only.
- Keep `urgent-confirm.tsx` with review-actions flow, not root shared files.
