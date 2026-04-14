# Education

## OVERVIEW

- Single-route education hub; tab folders own content, quiz, statutory, TBM modules.

## FILES

- Root files (`3`): `page.tsx`, `education-helpers.ts`, `AGENTS.md`
- Root test dir: `__tests__/page.test.tsx`
- Root component files:
  - `components/content-completions.tsx`
  - `components/education-types.ts`
- Tab folders:
  - `components/contents-tab/` (`9` files): `index.tsx`, `constants.ts`, `content-list.tsx`, `content-form.tsx`, `content-form-fields.tsx`, `content-form-kosha.tsx`, `content-form-source-modes.tsx`, `content-form-youtube.tsx`, `content-ai-analysis.tsx`
  - `components/quizzes-tab/` (`9` files): `index.tsx`, `constants.ts`, `types.ts`, `utils.ts`, `quiz-list.tsx`, `quiz-registration.tsx`, `question-list.tsx`, `question-management.tsx`, `question-form.tsx`
  - `components/statutory-tab/` (`3` files): `index.tsx`, `training-list.tsx`, `training-form.tsx`
  - `components/tbm-tab/` (`5` files): `index.tsx`, `tbm-list.tsx`, `tbm-form.tsx`, `tbm-meeting-minutes.tsx`, `tbm-ai-analysis.tsx`
- Component test files (`8`):
  - `components/__tests__/contents-tab.test.tsx`
  - `components/__tests__/contents-subcomponents.test.tsx`
  - `components/__tests__/quizzes-tab.test.tsx`
  - `components/__tests__/quizzes-subcomponents.test.tsx`
  - `components/__tests__/statutory-tab.test.tsx`
  - `components/__tests__/tbm-tab.test.tsx`
  - `components/__tests__/tbm-subcomponents.test.tsx`
  - `components/__tests__/education-helpers-completions.test.tsx`

## WHERE TO LOOK

- Tab metadata: `education-helpers.ts`
- Shared tab types: `components/education-types.ts`
- Completion view: `components/content-completions.tsx`

## CONVENTIONS

- Keep cross-tab labels/ids in `education-helpers.ts`.
- Keep tab-local constants/types/utils inside owning tab folder.
- No nested route splits; tab switching stays inside root `page.tsx`.
