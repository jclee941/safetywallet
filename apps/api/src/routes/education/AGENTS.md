# AGENTS: ROUTES EDUCATION

## OVERVIEW

Education route surface; top-level content/attempt/statutory handlers plus nested `quizzes/` and `tbm/` routers.

## FILES

- Top-level files (9): `completions.ts`, `contents-ai.ts`, `contents-routes.ts`, `helpers.ts`, `index.ts`, `quiz-answer-utils.ts`, `quiz-attempts.ts`, `quiz-question-validators.ts`, `statutory.ts`.
- Feature subdirs (3): `__tests__/`, `quizzes/`, `tbm/`.
- `quizzes/` files (7): `crud-read.ts`, `crud-write.ts`, `crud.ts`, `index.ts`, `questions-crud.ts`, `questions-reorder.ts`, `questions.ts`.
- `tbm/` files (7): `ai-analysis.ts`, `ai-jobs.ts`, `attendance.ts`, `crud-detail.ts`, `crud.ts`, `index.ts`, `shared.ts`.
- Tests dir: `__tests__/`.

## WHERE TO LOOK

- `index.ts` - mount order for contents, attempts, quizzes, statutory, TBM.
- `contents-routes.ts` and `contents-ai.ts` - content CRUD vs AI helpers.
- `quiz-answer-utils.ts` and `quiz-question-validators.ts` - shared quiz answer/validation helpers.
- `quizzes/` - quiz definition and question management routes.
- `tbm/` - TBM CRUD, attendance, and AI analysis split.

## CONVENTIONS

- Keep top-level content helpers separate from nested quiz/TBM routers.
- Keep quiz-attempt runtime separate from quiz-definition CRUD.
- Keep TBM AI jobs and analysis split from TBM CRUD handlers.
- Keep validation helpers in named utility files, not hidden inside route modules.

## ANTI-PATTERNS

- Listing `contents.ts`, `quizzes.ts`, or `tbm.ts` as if they still exist.
- Merging `contents-routes.ts` and `contents-ai.ts` into one branch-heavy file.
- Copying quiz answer validation into `quizzes/` handlers.
- Treating `quizzes/` or `tbm/` as undocumented leaf routers.
