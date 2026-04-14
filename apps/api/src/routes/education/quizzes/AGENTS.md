# AGENTS: ROUTES EDUCATION QUIZZES

## OVERVIEW

Quiz-definition router; quiz CRUD plus question CRUD and reorder flows split into focused modules.

## FILES

- `index.ts` - nested router composition.
- `crud.ts` - quiz CRUD mount surface.
- `crud-read.ts` - quiz read handlers.
- `crud-write.ts` - quiz write handlers.
- `questions.ts` - question route mount surface.
- `questions-crud.ts` - question create/update/delete handlers.
- `questions-reorder.ts` - question reorder handlers.
- Local doc: `AGENTS.md`.

## WHERE TO LOOK

- `index.ts` - split between quiz CRUD and question routes.
- `crud.ts`, `crud-read.ts`, `crud-write.ts` - quiz definition flow.
- `questions.ts`, `questions-crud.ts`, `questions-reorder.ts` - question management flow.

## CONVENTIONS

- Keep read/write quiz handlers split when permission or payload shape differs.
- Keep question reorder logic isolated from question CRUD.
- Keep `crud.ts` and `questions.ts` as assembly files, not logic-heavy handlers.
- Keep shared quiz router concerns inside this subdir; do not leak them to parent files.

## ANTI-PATTERNS

- Merging read and write quiz handlers into one branch-heavy file.
- Hiding reorder behavior inside generic question CRUD handlers.
- Treating `index.ts` as a catch-all for every quiz endpoint.
- Moving question route assembly back into the parent education router.
