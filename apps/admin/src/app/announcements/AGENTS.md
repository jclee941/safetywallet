# Announcements

## OVERVIEW

- Announcement management route; editor/form flow plus card and delete confirmation.

## FILES

- Runtime files (`5`):
  - `page.tsx`
  - `utils.tsx`
  - `components/announcement-card.tsx`
  - `components/announcement-form.tsx`
  - `components/delete-confirm-dialog.tsx`
- Tests (`1`): `__tests__/page.test.tsx`
- Subdirs: `__tests__/`, `components/`

## WHERE TO LOOK

- Route shell: `page.tsx`
- Form/editor helpers: `utils.tsx`
- Announcement list item UI: `components/announcement-card.tsx`
- Create/edit UI: `components/announcement-form.tsx`
- Delete guard UX: `components/delete-confirm-dialog.tsx`

## CONVENTIONS

- Keep announcement formatting helpers in `utils.tsx`.
- Form, card, delete dialog stay route-local.
- No shared dialog extraction unless reused outside announcements.
- Keep destructive confirmation copy in the delete dialog, not page shell.
- Keep card rendering concerns out of `utils.tsx`.
