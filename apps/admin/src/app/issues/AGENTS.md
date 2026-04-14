# Issues

## OVERVIEW

- Issue intake route; template-backed create flow and issue cards.

## FILES

- Runtime files (`6`):
  - `page.tsx`
  - `issue-template.ts`
  - `utils.ts`
  - `components/issue-card.tsx`
  - `components/issue-create-dialog.tsx`
  - `components/issue-template-select.tsx`
- Tests (`2`):
  - `__tests__/page.test.tsx`
  - `__tests__/issue-template.test.ts`
- Subdirs: `__tests__/`, `components/`

## WHERE TO LOOK

- Route shell: `page.tsx`
- Template contract: `issue-template.ts`
- Dialog/select pair: `components/issue-create-dialog.tsx`, `components/issue-template-select.tsx`

## CONVENTIONS

- Template defaults/schema stay in `issue-template.ts`.
- Small route helpers stay in `utils.ts`.
- Create-dialog logic stays with issues route; no move to shared layer.
